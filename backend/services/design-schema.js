const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const SENSITIVE = /(password|token|secret|pin|embedding|credential|hash|fcm|apikey|api_key)/i;
const HIDDEN_MODELS = new Set(['designTemplate', 'receiptAssignment']);

let modelsLoaded = false;

function loadAllModels() {
    if (modelsLoaded) return;
    const dir = path.join(__dirname, '..', 'models');
    fs.readdirSync(dir)
        .filter((name) => name.endsWith('.js'))
        .forEach((name) => {
            require(path.join(dir, name));
        });
    modelsLoaded = true;
}

function labelFromPath(fieldPath) {
    return String(fieldPath || '')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[._]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function dataTypeOf(schemaType) {
    const instance = schemaType.instance;
    if (instance === 'ObjectID' || instance === 'ObjectId') return 'relation';
    if (instance === 'Date') return 'date';
    if (instance === 'Number') return 'number';
    if (instance === 'Boolean') return 'boolean';
    if (instance === 'Array') return 'collection';
    if (instance === 'Mixed') return 'mixed';
    return 'text';
}

function arrayParent(schema, fieldPath) {
    const parts = String(fieldPath).split('.');
    const acc = [];
    for (let i = 0; i < parts.length - 1; i += 1) {
        acc.push(parts[i]);
        const node = schema.path(acc.join('.'));
        if (node && node.instance === 'Array' && node.schema) return acc.join('.');
    }
    return '';
}

function describeSchema() {
    loadAllModels();
    const tables = [];
    const relationships = [];

    Object.keys(mongoose.models).sort().forEach((modelName) => {
        if (HIDDEN_MODELS.has(modelName) || SENSITIVE.test(modelName)) return;
        const model = mongoose.models[modelName];
        const fields = [];
        const schoolScoped = Boolean(model.schema.path('school')) || modelName === 'admin';

        model.schema.eachPath((fieldPath, schemaType) => {
            if (fieldPath === '__v' || fieldPath.startsWith('__')) return;
            if (SENSITIVE.test(fieldPath)) return;
            if (schemaType.instance === 'Array' && schemaType.schema) return;

            const ref = schemaType.options && schemaType.options.ref;
            const collectionPath = arrayParent(model.schema, fieldPath);
            const type = collectionPath && dataTypeOf(schemaType) !== 'relation'
                ? dataTypeOf(schemaType)
                : dataTypeOf(schemaType);

            fields.push({
                path: fieldPath,
                label: labelFromPath(fieldPath),
                dataType: type,
                ref: ref || '',
                collectionPath,
                schoolScoped,
            });

            if (ref && !collectionPath) {
                relationships.push({
                    from: modelName,
                    path: fieldPath,
                    to: ref,
                    kind: 'ref',
                });
            }
        });

        tables.push({
            model: modelName,
            label: labelFromPath(modelName),
            schoolScoped,
            fields: modelName === 'feeInvoice'
                ? fields.concat([{
                    path: 'pendingBalance',
                    label: 'Pending balance',
                    dataType: 'number',
                    ref: '',
                    collectionPath: '',
                    schoolScoped,
                    calculated: true,
                }])
                : fields,
        });
    });

    return { tables, relationships };
}

function hasField(tree, modelName, fieldPath) {
    const table = tree.tables.find((item) => item.model === modelName);
    return Boolean(table && table.fields.some((field) => field.path === fieldPath));
}

function defaultStyle(overrides = {}) {
    return {
        fontFamily: 'Nirmala UI, Noto Sans Devanagari, Arial, sans-serif',
        fontSize: 12,
        color: '#111827',
        align: 'left',
        bold: false,
        italic: false,
        lineHeight: 1.3,
        background: 'transparent',
        borderWidth: 0,
        borderColor: '#111827',
        radius: 0,
        ...overrides,
    };
}

function element(partial) {
    return {
        id: partial.id,
        type: partial.type || 'text',
        x: partial.x || 12,
        y: partial.y || 12,
        w: partial.w || 80,
        h: partial.h || 8,
        rotation: 0,
        z: partial.z || 1,
        locked: false,
        groupId: null,
        text: partial.text || '',
        binding: partial.binding || null,
        format: partial.format || 'text',
        style: defaultStyle(partial.style || {}),
        columns: partial.columns || [],
        assetId: null,
        shape: partial.shape || 'rect',
    };
}

function fieldElement(tree, spec) {
    if (!hasField(tree, spec.model, spec.path)) return null;
    return element({
        id: spec.id,
        type: 'field',
        x: spec.x,
        y: spec.y,
        w: spec.w,
        h: spec.h || 8,
        z: spec.z || 2,
        format: spec.format || 'text',
        binding: {
            model: spec.model,
            path: spec.path,
            label: spec.label || labelFromPath(spec.path),
        },
        style: spec.style,
    });
}

function starterTemplates() {
    const tree = describeSchema();
    const starters = [];

    const feeFields = [
        fieldElement(tree, { id: 'fee-school', model: 'admin', path: 'schoolName', x: 12, y: 14, w: 120, h: 10, format: 'text', style: { fontSize: 18, bold: true, align: 'center' } }),
        fieldElement(tree, { id: 'fee-student', model: 'student', path: 'name', x: 12, y: 42, w: 90, h: 8 }),
        fieldElement(tree, { id: 'fee-roll', model: 'student', path: 'rollNum', x: 110, y: 42, w: 70, h: 8 }),
        fieldElement(tree, { id: 'fee-class', model: 'sclass', path: 'sclassName', x: 12, y: 54, w: 90, h: 8 }),
        fieldElement(tree, { id: 'fee-month', model: 'fee', path: 'month', x: 110, y: 54, w: 70, h: 8 }),
        fieldElement(tree, { id: 'fee-status', model: 'fee', path: 'status', x: 12, y: 66, w: 70, h: 8 }),
        fieldElement(tree, { id: 'fee-method', model: 'fee', path: 'paymentMethod', x: 90, y: 66, w: 90, h: 8 }),
        fieldElement(tree, { id: 'fee-date', model: 'fee', path: 'paidDate', x: 12, y: 78, w: 80, h: 8, format: 'date' }),
        fieldElement(tree, { id: 'fee-amount', model: 'fee', path: 'amount', x: 12, y: 98, w: 80, h: 12, format: 'currency', style: { fontSize: 16, bold: true } }),
        fieldElement(tree, { id: 'fee-total', model: 'feeInvoice', path: 'total', x: 100, y: 98, w: 80, h: 10, format: 'currency' }),
        fieldElement(tree, { id: 'fee-paid', model: 'feeInvoice', path: 'paidAmount', x: 12, y: 114, w: 80, h: 8, format: 'currency' }),
    ].filter(Boolean);

    if (hasField(tree, 'feeInvoice', 'lines.name')) {
        feeFields.push(element({
            id: 'fee-lines',
            type: 'table',
            x: 12,
            y: 130,
            w: 186,
            h: 50,
            binding: { model: 'feeInvoice', path: 'lines', label: 'Invoice lines' },
            columns: [
                { path: 'name', label: labelFromPath('name'), format: 'text', width: 70 },
                { path: 'code', label: labelFromPath('code'), format: 'text', width: 20 },
                { path: 'amount', label: labelFromPath('amount'), format: 'currency', width: 30 },
            ].filter((column) => hasField(tree, 'feeInvoice', `lines.${column.path}`)),
        }));
    }

    starters.push(pageTemplate('Fee receipt', 'fee-receipt', 210, 297, [
        element({ id: 'fee-title', type: 'text', x: 12, y: 28, w: 186, h: 8, text: 'Fee receipt', style: { align: 'center', bold: true, fontSize: 14 } }),
        element({ id: 'fee-rule', type: 'shape', x: 12, y: 38, w: 186, h: 1, shape: 'line', style: { background: '#111827' } }),
        ...feeFields,
    ]));

    starters.push(pageTemplate('Student ID card', 'student-id', 86, 54, [
        fieldElement(tree, { id: 'id-school', model: 'admin', path: 'schoolName', x: 4, y: 3, w: 78, h: 6, style: { fontSize: 8, bold: true, align: 'center' } }),
        fieldElement(tree, { id: 'id-name', model: 'student', path: 'name', x: 4, y: 16, w: 78, h: 8, style: { fontSize: 12, bold: true } }),
        fieldElement(tree, { id: 'id-roll', model: 'student', path: 'rollNum', x: 4, y: 28, w: 36, h: 6, style: { fontSize: 9 } }),
        fieldElement(tree, { id: 'id-class', model: 'sclass', path: 'sclassName', x: 42, y: 28, w: 40, h: 6, style: { fontSize: 9 } }),
        element({ id: 'id-caption', type: 'text', x: 4, y: 42, w: 78, h: 6, text: 'Student identity card', style: { fontSize: 8, align: 'center' } }),
    ].filter(Boolean)));

    starters.push(pageTemplate('Staff ID card', 'staff-id', 86, 54, [
        fieldElement(tree, { id: 'staff-school', model: 'admin', path: 'schoolName', x: 4, y: 3, w: 78, h: 6, style: { fontSize: 8, bold: true, align: 'center' } }),
        fieldElement(tree, { id: 'staff-name', model: 'staff', path: 'name', x: 4, y: 16, w: 78, h: 8, style: { fontSize: 12, bold: true } }),
        fieldElement(tree, { id: 'staff-role', model: 'staff', path: 'role', x: 4, y: 28, w: 78, h: 6, style: { fontSize: 9 } }),
        element({ id: 'staff-caption', type: 'text', x: 4, y: 42, w: 78, h: 6, text: 'Staff identity card', style: { fontSize: 8, align: 'center' } }),
    ].filter(Boolean)));

    const certificateBody = (idPrefix, title, category) => pageTemplate(title, category, 210, 297, [
        fieldElement(tree, { id: `${idPrefix}-school`, model: 'admin', path: 'schoolName', x: 15, y: 18, w: 180, h: 12, style: { fontSize: 20, bold: true, align: 'center' } }),
        element({ id: `${idPrefix}-title`, type: 'text', x: 15, y: 40, w: 180, h: 10, text: title, style: { fontSize: 16, bold: true, align: 'center' } }),
        fieldElement(tree, { id: `${idPrefix}-name`, model: 'student', path: 'name', x: 15, y: 70, w: 180, h: 10, style: { fontSize: 14, bold: true } }),
        fieldElement(tree, { id: `${idPrefix}-class`, model: 'sclass', path: 'sclassName', x: 15, y: 86, w: 90, h: 8 }),
        fieldElement(tree, { id: `${idPrefix}-roll`, model: 'student', path: 'rollNum', x: 110, y: 86, w: 80, h: 8 }),
        element({ id: `${idPrefix}-body`, type: 'text', x: 15, y: 110, w: 180, h: 40, text: 'This certificate is issued from the school record for the student named above.', style: { fontSize: 12, lineHeight: 1.5 } }),
    ].filter(Boolean));

    starters.push(certificateBody('bonafide', 'Bonafide certificate', 'bonafide'));
    starters.push(certificateBody('transfer', 'Transfer certificate', 'transfer'));
    starters.push(certificateBody('character', 'Character certificate', 'character'));

    starters.push(pageTemplate('Admission form', 'admission', 210, 297, [
        fieldElement(tree, { id: 'adm-school', model: 'admin', path: 'schoolName', x: 15, y: 16, w: 180, h: 10, style: { fontSize: 18, bold: true, align: 'center' } }),
        element({ id: 'adm-title', type: 'text', x: 15, y: 32, w: 180, h: 8, text: 'Admission form', style: { align: 'center', bold: true } }),
        fieldElement(tree, { id: 'adm-student', model: 'admissionEnquiry', path: 'studentName', x: 15, y: 52, w: 180, h: 8 }),
        fieldElement(tree, { id: 'adm-class', model: 'admissionEnquiry', path: 'classApplying', x: 15, y: 64, w: 80, h: 8 }),
        fieldElement(tree, { id: 'adm-guardian', model: 'admissionEnquiry', path: 'guardianName', x: 15, y: 76, w: 180, h: 8 }),
        fieldElement(tree, { id: 'adm-phone', model: 'admissionEnquiry', path: 'guardianPhone', x: 15, y: 88, w: 90, h: 8 }),
        fieldElement(tree, { id: 'adm-status', model: 'admissionEnquiry', path: 'status', x: 110, y: 88, w: 80, h: 8 }),
    ].filter(Boolean)));

    starters.push(pageTemplate('Fee structure', 'fee-structure', 210, 297, [
        fieldElement(tree, { id: 'fs-school', model: 'admin', path: 'schoolName', x: 15, y: 16, w: 180, h: 10, style: { fontSize: 18, bold: true, align: 'center' } }),
        element({ id: 'fs-title', type: 'text', x: 15, y: 32, w: 180, h: 8, text: 'Fee structure', style: { align: 'center', bold: true } }),
        fieldElement(tree, { id: 'fs-name', model: 'feeHead', path: 'name', x: 15, y: 52, w: 100, h: 8 }),
        fieldElement(tree, { id: 'fs-code', model: 'feeHead', path: 'code', x: 120, y: 52, w: 70, h: 8 }),
        fieldElement(tree, { id: 'fs-amount', model: 'feeHead', path: 'defaultAmount', x: 15, y: 66, w: 80, h: 10, format: 'currency', style: { fontSize: 14, bold: true } }),
        fieldElement(tree, { id: 'fs-cycle', model: 'feeHead', path: 'billingCycle', x: 100, y: 68, w: 80, h: 8 }),
    ].filter(Boolean)));

    starters.push(pageTemplate('Student report card', 'report-card', 210, 297, [
        fieldElement(tree, { id: 'rc-school', model: 'admin', path: 'schoolName', x: 15, y: 16, w: 180, h: 10, style: { fontSize: 18, bold: true, align: 'center' } }),
        element({ id: 'rc-title', type: 'text', x: 15, y: 32, w: 180, h: 8, text: 'Report card', style: { align: 'center', bold: true } }),
        fieldElement(tree, { id: 'rc-name', model: 'student', path: 'name', x: 15, y: 50, w: 110, h: 8 }),
        fieldElement(tree, { id: 'rc-roll', model: 'student', path: 'rollNum', x: 130, y: 50, w: 60, h: 8 }),
        fieldElement(tree, { id: 'rc-class', model: 'sclass', path: 'sclassName', x: 15, y: 62, w: 80, h: 8 }),
        element({
            id: 'rc-marks',
            type: 'table',
            x: 15,
            y: 80,
            w: 180,
            h: 70,
            binding: { model: 'student', path: 'examResult', label: 'Exam result' },
            columns: [
                { path: 'marksObtained', label: labelFromPath('marksObtained'), format: 'number', width: 40 },
            ],
        }),
    ].filter(Boolean)));

    starters.push(pageTemplate('School notice', 'notice', 210, 297, [
        fieldElement(tree, { id: 'nt-school', model: 'admin', path: 'schoolName', x: 15, y: 16, w: 180, h: 10, style: { fontSize: 18, bold: true, align: 'center' } }),
        fieldElement(tree, { id: 'nt-title', model: 'notice', path: 'title', x: 15, y: 40, w: 180, h: 10, style: { fontSize: 16, bold: true } }),
        fieldElement(tree, { id: 'nt-date', model: 'notice', path: 'date', x: 15, y: 54, w: 60, h: 8, format: 'date' }),
        fieldElement(tree, { id: 'nt-details', model: 'notice', path: 'details', x: 15, y: 70, w: 180, h: 80, style: { lineHeight: 1.5 } }),
    ].filter(Boolean)));

    starters.push(pageTemplate('School letterhead', 'letterhead', 210, 297, [
        fieldElement(tree, { id: 'lh-school', model: 'admin', path: 'schoolName', x: 15, y: 14, w: 180, h: 12, style: { fontSize: 22, bold: true, align: 'center' } }),
        fieldElement(tree, { id: 'lh-email', model: 'admin', path: 'email', x: 15, y: 28, w: 180, h: 6, style: { fontSize: 10, align: 'center' } }),
        element({ id: 'lh-rule', type: 'shape', x: 15, y: 38, w: 180, h: 1, shape: 'line', style: { background: '#111827' } }),
    ].filter(Boolean)));

    return starters.filter((item) => item.pages[0].elements.length > 0);
}

function pageTemplate(name, category, widthMm, heightMm, elements) {
    return {
        name,
        category,
        isDefault: true,
        page: { widthMm, heightMm, background: '#ffffff', marginMm: 0 },
        pages: [{ id: `${category}-page-1`, elements }],
        assets: [],
    };
}

function formatValue(value, format) {
    if (value == null || value === '') return '';
    if (typeof value === 'object' && !(value instanceof Date)) {
        if (value._bsontype === 'ObjectID' || mongoose.isValidObjectId(value)) return '';
        return '';
    }
    if (format === 'currency') {
        const amount = Number(value);
        if (!Number.isFinite(amount)) return '';
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 2,
        }).format(amount);
    }
    if (format === 'date' || value instanceof Date) {
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);
        return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    if (format === 'number') {
        const amount = Number(value);
        if (!Number.isFinite(amount)) return String(value);
        return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(amount);
    }
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
}

function readPath(doc, fieldPath) {
    if (!doc || !fieldPath) return undefined;
    return String(fieldPath).split('.').reduce((current, key) => (
        current == null ? undefined : current[key]
    ), doc);
}

function safeProjection(model) {
    const hidden = [];
    model.schema.eachPath((fieldPath) => {
        if (SENSITIVE.test(fieldPath)) hidden.push(`-${fieldPath.split('.')[0]}`);
    });
    return hidden.join(' ');
}

function recordLabel(doc) {
    if (!doc) return '';
    const parts = [doc.name, doc.studentName, doc.title, doc.schoolName, doc.sclassName, doc.subName, doc.month, doc.rollNum, doc.code]
        .filter((part) => part != null && part !== '')
        .map((part) => String(part));
    return parts.slice(0, 3).join(' · ') || String(doc._id);
}

module.exports = {
    SENSITIVE,
    loadAllModels,
    describeSchema,
    starterTemplates,
    formatValue,
    readPath,
    safeProjection,
    recordLabel,
    labelFromPath,
};
