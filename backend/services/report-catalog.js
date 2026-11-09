/**
 * Approved reporting catalog discovered from Mongoose schemas.
 * Relationships come only from ObjectId `ref` paths — never from shared column names.
 * PostgreSQL is not the store in this repository; this is the schema source of truth.
 */
const mongoose = require('mongoose');

const SENSITIVE_FIELD = /password|pin|token|secret|fcm|credential|qrstring|hash/i;

const OPERATORS = {
  string: ['eq', 'ne', 'contains', 'starts', 'isNull', 'isNotNull'],
  number: ['eq', 'ne', 'gt', 'lt', 'gte', 'lte', 'between', 'isNull', 'isNotNull'],
  date: ['eq', 'ne', 'gt', 'lt', 'gte', 'lte', 'between', 'isNull', 'isNotNull'],
  boolean: ['eq', 'ne', 'isNull', 'isNotNull'],
  objectId: ['eq', 'ne', 'isNull', 'isNotNull'],
  'objectId[]': ['eq', 'ne', 'isNull', 'isNotNull'],
};

function operatorsFor(type) {
  return OPERATORS[type] || ['eq', 'ne', 'isNull', 'isNotNull'];
}

const APPROVED = [
  { file: '../models/studentSchema.js', domain: 'People', sensitivity: 'standard' },
  { file: '../models/sclassSchema.js', domain: 'People', sensitivity: 'standard' },
  { file: '../models/teacherSchema.js', domain: 'People', sensitivity: 'standard' },
  { file: '../models/parentSchema.js', domain: 'People', sensitivity: 'standard' },
  { file: '../models/staffSchema.js', domain: 'People', sensitivity: 'standard' },
  { file: '../models/subjectSchema.js', domain: 'Academics', sensitivity: 'standard' },
  { file: '../models/assignmentSchema.js', domain: 'Academics', sensitivity: 'standard' },
  { file: '../models/attendanceSessionSchema.js', domain: 'Academics', sensitivity: 'standard' },
  { file: '../models/feeInvoiceSchema.js', domain: 'Finance', sensitivity: 'finance' },
  { file: '../models/feeHeadSchema.js', domain: 'Finance', sensitivity: 'finance' },
  { file: '../models/feeSchema.js', domain: 'Finance', sensitivity: 'finance' },
  { file: '../models/admissionEnquirySchema.js', domain: 'Admissions', sensitivity: 'standard' },
  { file: '../models/parentArrivalSchema.js', domain: 'Safety', sensitivity: 'standard' },
  { file: '../models/transportRouteSchema.js', domain: 'Transport', sensitivity: 'standard' },
  { file: '../models/noticeSchema.js', domain: 'Communicate', sensitivity: 'standard' },
  { file: '../models/leaveSchema.js', domain: 'People', sensitivity: 'hr' },
];

let cache = null;

function loadModels() {
  for (const row of APPROVED) {
    require(row.file);
  }
}

function fieldType(schemaType) {
  const name = schemaType.instance || 'Mixed';
  if (name === 'ObjectID' || name === 'ObjectId') return 'objectId';
  if (name === 'Number') return 'number';
  if (name === 'Date') return 'date';
  if (name === 'Boolean') return 'boolean';
  if (name === 'Array') return 'array';
  if (name === 'String') return 'string';
  return 'mixed';
}

function discover() {
  if (cache) return cache;
  loadModels();
  const domainByModel = {};
  const sensitivityByModel = {};
  for (const row of APPROVED) {
    const mod = require(row.file);
    const name = mod.modelName;
    domainByModel[name] = row.domain;
    sensitivityByModel[name] = row.sensitivity;
  }

  const tables = [];
  const edges = [];

  for (const name of Object.keys(domainByModel)) {
    const model = mongoose.model(name);
    const fields = [];
    model.schema.eachPath((path, schemaType) => {
      if (path === '__v' || path.includes('.')) return;
      if (SENSITIVE_FIELD.test(path)) return;
      const isArray = schemaType.instance === 'Array';
      const caster = isArray ? schemaType.caster : schemaType;
      const ref = caster && caster.options && caster.options.ref;
      const type = isArray ? 'array' : fieldType(schemaType);
      const fieldTypeName = ref ? (isArray ? 'objectId[]' : 'objectId') : type;
      fields.push({
        name: path,
        type: fieldTypeName,
        operators: operatorsFor(fieldTypeName),
        required: Boolean(schemaType.options && schemaType.options.required),
        ref: ref || null,
        indexed: Boolean(schemaType.options && schemaType.options.index),
      });
      if (ref && domainByModel[ref]) {
        edges.push({
          id: `${name}.${path}->${ref}`,
          from: name,
          fromFields: [path],
          to: ref,
          toFields: ['_id'],
          cardinality: isArray ? 'one-to-many' : 'many-to-one',
          optional: !(schemaType.options && schemaType.options.required),
          approved: true,
          tenantScoped: true,
        });
      }
    });
    tables.push({
      name,
      collection: model.collection.collectionName,
      domain: domainByModel[name],
      sensitivity: sensitivityByModel[name],
      tenantField: fields.some((f) => f.name === 'school') ? 'school' : null,
      fields,
    });
  }

  cache = { tables, edges, discoveredAt: new Date().toISOString(), engine: 'mongoose-schema' };
  return cache;
}

function tableMap() {
  const cat = discover();
  return Object.fromEntries(cat.tables.map((t) => [t.name, t]));
}

function inferValueType(value) {
  if (value == null) return 'string';
  if (value instanceof Date) return 'date';
  if (value && value._bsontype === 'ObjectId') return 'objectId';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'string') return 'string';
  if (Array.isArray(value)) return 'array';
  return 'mixed';
}

const sampleCache = new Map();

async function sampleFields(db, collection) {
  const cached = sampleCache.get(collection);
  if (cached && Date.now() - cached.at < 30000) return cached.fields;
  const doc = await db.collection(collection).findOne({}, { maxTimeMS: 1500 });
  const fields = [];
  if (doc) {
    for (const name of Object.keys(doc)) {
      if (name === '__v' || name.startsWith('$') || SENSITIVE_FIELD.test(name)) continue;
      const type = inferValueType(doc[name]);
      fields.push({
        name,
        type,
        operators: operatorsFor(type),
        required: false,
        ref: null,
        indexed: false,
      });
    }
    fields.sort((a, b) => a.name.localeCompare(b.name));
  }
  sampleCache.set(collection, { at: Date.now(), fields });
  return fields;
}

/** Collection names from the database that is connected right now. Not cached. */
async function listDatabaseTables() {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    const err = new Error('Database is not connected');
    err.status = 503;
    throw err;
  }
  const schema = discover();
  const byCollection = Object.fromEntries(schema.tables.map((t) => [t.collection, t]));
  const listed = await mongoose.connection.db.listCollections().toArray();
  const names = listed
    .map((c) => c.name)
    .filter((name) => name && !name.startsWith('system.'))
    .sort((a, b) => a.localeCompare(b));
  const tables = names.map((collection) => {
    const known = byCollection[collection];
    if (known) return { ...known, collection, source: 'database' };
    return {
      name: collection,
      collection,
      domain: 'Database',
      sensitivity: 'unmapped',
      tenantField: null,
      fields: [],
      source: 'database',
    };
  });
  await Promise.all(tables.map(async (table) => {
    if (table.fields.length) return;
    table.fields = await sampleFields(mongoose.connection.db, table.collection);
  }));
  return {
    tables,
    edges: schema.edges,
    engine: 'mongodb-listCollections',
    discoveredAt: new Date().toISOString(),
  };
}

module.exports = { discover, tableMap, listDatabaseTables, operatorsFor, APPROVED };
