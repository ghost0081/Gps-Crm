const mongoose = require('mongoose');
const { tableMap, operatorsFor } = require('./report-catalog.js');
const { planJoins } = require('./report-graph.js');

const OPS = new Set(['eq', 'ne', 'contains', 'starts', 'gt', 'lt', 'gte', 'lte', 'between', 'in', 'isNull', 'isNotNull']);
const AGGS = new Set(['count', 'countDistinct', 'sum', 'avg', 'min', 'max']);
const ID = /^[A-Za-z_][A-Za-z0-9_]*$/;

function assertId(name, label) {
  if (!ID.test(String(name || ''))) {
    const err = new Error(`Invalid ${label}`);
    err.status = 400;
    throw err;
  }
}

function fieldOf(tables, table, name) {
  assertId(table, 'table');
  assertId(name, 'field');
  const t = tables[table];
  if (!t) {
    const err = new Error(`Table not approved: ${table}`);
    err.status = 400;
    throw err;
  }
  const f = t.fields.find((x) => x.name === name);
  if (!f) {
    const err = new Error(`Field not approved: ${table}.${name}`);
    err.status = 400;
    throw err;
  }
  return f;
}

function assertOpForField(field, op) {
  const allowed = operatorsFor(field.type);
  if (!allowed.includes(op)) {
    const err = new Error(`Operator ${op} is not valid for ${field.type} field ${field.name}`);
    err.status = 400;
    throw err;
  }
}

function clauseFor(tables, filter, pathPrefix) {
  const field = fieldOf(tables, filter.table, filter.path);
  assertOpForField(field, filter.op);
  let value = filter.value;
  if (filter.op === 'between' && !Array.isArray(value)) {
    value = [filter.value, filter.valueTo];
  }
  if (filter.op === 'isNull' || filter.op === 'isNotNull') {
    return { [`${pathPrefix}${filter.path}`]: matchValue(field, filter.op, value) };
  }
  if (filter.op === 'between') {
    if (!Array.isArray(value) || value.length !== 2 || value[0] === '' || value[1] === '' || value[0] == null || value[1] == null) {
      return null;
    }
  } else if (value === '' || value == null) {
    return null;
  }
  return { [`${pathPrefix}${filter.path}`]: matchValue(field, filter.op, value) };
}

function applyClauses(target, clauses) {
  if (clauses.length === 1) Object.assign(target, clauses[0]);
  else if (clauses.length > 1) target.$and = [...(target.$and || []), ...clauses];
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchValue(field, op, value) {
  if (!OPS.has(op)) {
    const err = new Error(`Operator not allowed: ${op}`);
    err.status = 400;
    throw err;
  }
  if (op === 'isNull') return { $in: [null, ''] };
  if (op === 'isNotNull') return { $nin: [null, ''] };
  if (op === 'contains') return { $regex: escapeRegex(value), $options: 'i' };
  if (op === 'starts') return { $regex: `^${escapeRegex(value)}`, $options: 'i' };
  if (op === 'between') {
    if (!Array.isArray(value) || value.length !== 2) {
      const err = new Error('between requires [from, to]');
      err.status = 400;
      throw err;
    }
    return { $gte: coerce(field, value[0]), $lte: coerce(field, value[1]) };
  }
  if (op === 'in') return { $in: (Array.isArray(value) ? value : [value]).map((v) => coerce(field, v)) };
  const v = coerce(field, value);
  if (op === 'eq') return v;
  if (op === 'ne') return { $ne: v };
  if (op === 'gt') return { $gt: v };
  if (op === 'lt') return { $lt: v };
  if (op === 'gte') return { $gte: v };
  if (op === 'lte') return { $lte: v };
  const err = new Error('Unsupported operator');
  err.status = 400;
  throw err;
}

function coerce(field, value) {
  if (field.type === 'number' || field.type === 'objectId' || field.type === 'objectId[]') {
    if (field.type.startsWith('objectId') && mongoose.Types.ObjectId.isValid(String(value))) {
      return new mongoose.Types.ObjectId(String(value));
    }
    if (field.type === 'number') return Number(value);
  }
  if (field.type === 'date') return new Date(value);
  if (field.type === 'boolean') return value === true || value === 'true';
  return value;
}

function recommendChart(def) {
  const hasDate = (def.fields || []).some((f) => f.type === 'date' || /date|time|month/i.test(f.path || ''));
  const metrics = (def.fields || []).filter((f) => f.agg);
  const dims = (def.fields || []).filter((f) => !f.agg);
  if (metrics.length === 1 && dims.length === 0) return 'kpi';
  if (hasDate && metrics.length) return 'line';
  if (dims.length === 1 && metrics.length && (def.previewCardinality || 99) <= 8) return 'pie';
  if (dims.length && metrics.length) return 'bar';
  return 'table';
}

function resolveTables(live) {
  const approved = tableMap();
  if (!live || !Array.isArray(live.tables)) return approved;
  const map = { ...approved };
  for (const table of live.tables) {
    if (!map[table.name]) map[table.name] = table;
  }
  return map;
}

function build(def, live) {
  const tables = resolveTables(live);
  const base = def.base;
  if (!tables[base]) {
    const err = new Error('Base table is not approved');
    err.status = 400;
    throw err;
  }
  const selected = [base, ...(def.tables || []).filter((t) => t !== base)];
  for (const t of selected) {
    if (!tables[t]) {
      const err = new Error(`Table not approved: ${t}`);
      err.status = 400;
      throw err;
    }
  }
  const plan = planJoins(base, selected);
  if (plan.ambiguous.length || plan.missing.length) {
    const err = new Error('Join path is ambiguous or unverified');
    err.status = 400;
    err.plan = { ambiguous: plan.ambiguous, missing: plan.missing };
    throw err;
  }

  const schoolId = def.schoolId;
  if (!schoolId || !mongoose.Types.ObjectId.isValid(String(schoolId))) {
    const err = new Error('schoolId required');
    err.status = 400;
    throw err;
  }
  const logic = def.filterLogic === 'or' ? 'or' : 'and';
  const usable = [];
  for (const filter of def.filters || []) {
    if (!filter || !filter.table || !filter.path || !filter.op) continue;
    if (!selected.includes(filter.table)) {
      const err = new Error(`Filter table is not in this report: ${filter.table}`);
      err.status = 400;
      throw err;
    }
    const clause = clauseFor(tables, filter, '');
    if (!clause) continue;
    usable.push(filter);
  }

  const match = {};
  if (tables[base].tenantField) {
    match[tables[base].tenantField] = new mongoose.Types.ObjectId(String(schoolId));
  }
  const baseClauses = [];
  for (const filter of usable) {
    if (filter.table !== base) continue;
    baseClauses.push(clauseFor(tables, filter, ''));
  }
  const orAcrossTables = logic === 'or' && usable.some((filter) => filter.table !== base);
  if (!orAcrossTables && logic === 'and') applyClauses(match, baseClauses);
  if (!orAcrossTables && logic === 'or' && baseClauses.length) {
    if (baseClauses.length === 1) Object.assign(match, baseClauses[0]);
    else match.$or = baseClauses;
  }

  const pipeline = [{ $match: match }];
  const manyJoins = plan.joins.filter((j) => j.path.some((e) => e.cardinality === 'one-to-many'));

  for (const join of plan.joins) {
    const edge = join.path[join.path.length - 1];
    const alias = join.table;
    const childFilters = logic === 'and'
      ? usable.filter((f) => f.table === join.table)
      : [];
    const childMatch = {};
    applyClauses(childMatch, childFilters.map((filter) => clauseFor(tables, filter, '')));
    if (tables[join.table].tenantField) {
      childMatch[tables[join.table].tenantField] = new mongoose.Types.ObjectId(String(schoolId));
    }

    if (edge.cardinality === 'many-to-one' && !edge.reverse) {
      const inner = [{
        $match: {
          ...childMatch,
          $expr: { $eq: ['$_id', '$$lid'] },
        },
      }];
      pipeline.push({
        $lookup: {
          from: tables[join.table].collection,
          let: { lid: `$${edge.fromFields[0]}` },
          pipeline: inner,
          as: alias,
        },
      });
      pipeline.push({ $unwind: { path: `$${alias}`, preserveNullAndEmptyArrays: !childFilters.length } });
    } else {
      const local = edge.reverse ? '_id' : edge.fromFields[0];
      const foreign = edge.reverse ? edge.toFields[0] : '_id';
      const preAgg = manyJoins.length > 1;
      const inner = [{ $match: { ...childMatch, $expr: { $eq: [`$${foreign}`, '$$lid'] } } }];
      if (preAgg) {
        const sums = {};
        for (const f of def.fields || []) {
          if (f.table === join.table && ['sum', 'avg', 'min', 'max'].includes(f.agg)) {
            const fld = fieldOf(tables, join.table, f.path);
            if (fld.type !== 'number' && f.agg !== 'count') {
              const err = new Error(`${f.agg} requires a number: ${join.table}.${f.path}`);
              err.status = 400;
              throw err;
            }
            const op = f.agg === 'avg' ? '$avg' : f.agg === 'min' ? '$min' : f.agg === 'max' ? '$max' : '$sum';
            sums[f.path] = { [op]: `$${f.path}` };
          }
        }
        sums._count = { $sum: 1 };
        inner.push({ $group: { _id: null, ...sums } });
      } else {
        inner.push({ $limit: 50 });
      }
      pipeline.push({
        $lookup: {
          from: tables[join.table].collection,
          let: { lid: `$${local}` },
          pipeline: inner,
          as: alias,
        },
      });
      if (preAgg) pipeline.push({ $unwind: { path: `$${alias}`, preserveNullAndEmptyArrays: true } });
    }
  }

  if (orAcrossTables) {
    const orClauses = usable.map((filter) => clauseFor(tables, filter, filter.table === base ? '' : `${filter.table}.`));
    pipeline.push({ $match: orClauses.length === 1 ? orClauses[0] : { $or: orClauses } });
  }

  const distinctKeys = new Set();
  const groupId = {};
  const group = {};
  let grouped = false;
  for (const f of def.fields || []) {
    const field = fieldOf(tables, f.table || base, f.path);
    const key = f.alias || `${f.table || base}_${f.path}${f.agg ? '_' + f.agg : ''}`;
    if (!ID.test(key)) {
      const err = new Error('Invalid alias');
      err.status = 400;
      throw err;
    }
    const src = (f.table || base) === base ? `$${f.path}` : `$${f.table}.${f.path}`;
    if (f.agg) {
      grouped = true;
      if (!AGGS.has(f.agg)) {
        const err = new Error('Aggregation not allowed');
        err.status = 400;
        throw err;
      }
      if (['sum', 'avg', 'min', 'max'].includes(f.agg) && field.type !== 'number') {
        const err = new Error(`${f.agg} requires a numeric field`);
        err.status = 400;
        throw err;
      }
      if (f.agg === 'count') group[key] = { $sum: 1 };
      else if (f.agg === 'countDistinct') {
        group[key] = { $addToSet: src };
        distinctKeys.add(key);
      } else {
        const op = f.agg === 'avg' ? '$avg' : f.agg === 'min' ? '$min' : f.agg === 'max' ? '$max' : '$sum';
        group[key] = { [op]: src };
      }
    } else {
      groupId[key] = src;
    }
  }
  if (grouped) {
    pipeline.push({ $group: { _id: groupId, ...group } });
    const project = {};
    for (const k of Object.keys(groupId)) project[k] = `$_id.${k}`;
    for (const k of Object.keys(group)) {
      project[k] = distinctKeys.has(k) ? { $size: `$${k}` } : `$${k}`;
    }
    pipeline.push({ $project: { _id: 0, ...project } });
  } else if ((def.fields || []).length) {
    const project = {};
    for (const f of def.fields) {
      const key = f.alias || `${f.table || base}_${f.path}`;
      project[key] = (f.table || base) === base ? `$${f.path}` : `$${f.table}.${f.path}`;
    }
    pipeline.push({ $project: project });
  }

  const limit = Math.min(Math.max(Number(def.limit) || 100, 1), 500);
  pipeline.push({ $limit: limit });

  return {
    pipeline,
    collection: tables[base].collection,
    plan: {
      base,
      fanOut: plan.fanOut,
      joins: plan.joins.map((j) => ({
        table: j.table,
        path: j.path.map((e) => ({ id: e.id, cardinality: e.cardinality, from: e.from, to: e.to })),
      })),
      preAggregated: manyJoins.length > 1,
    },
    chart: def.chart || recommendChart({ ...def, fields: (def.fields || []).map((f) => ({ ...f, type: fieldOf(tables, f.table || base, f.path).type })) }),
  };
}

async function execute(def) {
  let live = null;
  if (mongoose.connection.readyState === 1) {
    const { listDatabaseTables } = require('./report-catalog.js');
    live = await listDatabaseTables();
  }
  const built = build(def, live);
  let rows;
  if (mongoose.models[def.base]) {
    rows = await mongoose.model(def.base).aggregate(built.pipeline).option({ maxTimeMS: 8000 });
  } else if (built.collection && mongoose.connection.readyState === 1) {
    rows = await mongoose.connection.db.collection(built.collection).aggregate(built.pipeline, { maxTimeMS: 8000 }).toArray();
  } else {
    const err = new Error('Base table is not approved');
    err.status = 400;
    throw err;
  }
  return { ...built, rows, rowCount: rows.length };
}

module.exports = { build, execute, recommendChart, OPS, AGGS };
