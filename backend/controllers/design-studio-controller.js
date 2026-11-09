const mongoose = require('mongoose');
const Admin = require('../models/adminSchema');
const DesignTemplate = require('../models/designTemplateSchema');
const {
    loadAllModels,
    describeSchema,
    starterTemplates,
    formatValue,
    readPath,
    safeProjection,
    recordLabel,
    SENSITIVE,
} = require('../services/design-schema');

const CATEGORIES = [
    'fee-receipt',
    'admission',
    'student-id',
    'staff-id',
    'fee-structure',
    'bonafide',
    'transfer',
    'character',
    'report-card',
    'notice',
    'letterhead',
    'fee-due',
    'fee-adjustment',
    'custom',
];

async function requireSchool(schoolId) {
    if (!mongoose.isValidObjectId(schoolId)) {
        const error = new Error('A valid school is required.');
        error.status = 400;
        throw error;
    }
    const admin = await Admin.findById(schoolId).select('name email schoolName role');
    if (!admin) {
        const error = new Error('Only a school administrator can use Design Studio.');
        error.status = 403;
        throw error;
    }
    return admin;
}

function sendError(res, error) {
    const status = error.status || 500;
    res.status(status).json({ message: error.message || 'Design Studio request failed.' });
}

function sanitizeDocument(body) {
    const page = body.page || {};
    const width = Number(page.widthMm);
    const height = Number(page.heightMm);
    const assets = Array.isArray(body.assets) ? body.assets.slice(0, 12) : [];
    assets.forEach((asset) => {
        const data = String(asset.dataUrl || '');
        if (data && !/^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(data)) {
            const error = new Error('Only PNG, JPEG, WEBP, and GIF images can be stored on a design.');
            error.status = 400;
            throw error;
        }
        if (data.length > 550000) {
            const error = new Error('An uploaded image is too large. Use an image under about 400 KB.');
            error.status = 400;
            throw error;
        }
    });
    const pages = Array.isArray(body.pages) ? body.pages.slice(0, 12) : [];
    pages.forEach((pageItem) => {
        (pageItem.elements || []).forEach((item) => {
            if (item && item.binding && SENSITIVE.test(`${item.binding.path || ''}`)) {
                const error = new Error('That field cannot be placed on a design.');
                error.status = 400;
                throw error;
            }
        });
    });
    return {
        name: String(body.name || 'Untitled design').trim().slice(0, 120),
        category: CATEGORIES.includes(body.category) ? body.category : 'custom',
        isDefault: Boolean(body.isDefault),
        page: {
            widthMm: Number.isFinite(width) && width >= 40 && width <= 500 ? width : 210,
            heightMm: Number.isFinite(height) && height >= 40 && height <= 500 ? height : 297,
            background: /^#[0-9a-fA-F]{6}$/.test(page.background || '') ? page.background : '#ffffff',
            marginMm: 0,
        },
        pages,
        assets: assets.map((asset) => ({
            id: String(asset.id || ''),
            name: String(asset.name || 'Image').slice(0, 80),
            dataUrl: asset.dataUrl || '',
        })),
    };
}

async function ensureStarters(schoolId) {
    const count = await DesignTemplate.countDocuments({ school: schoolId });
    if (count > 0) return;
    const starters = starterTemplates().map((item) => ({ ...item, school: schoolId, versions: [] }));
    if (starters.length) await DesignTemplate.insertMany(starters);
}

const getSchema = async (req, res) => {
    try {
        await requireSchool(req.query.schoolId);
        loadAllModels();
        res.json(describeSchema());
    } catch (error) {
        sendError(res, error);
    }
};

const listTemplates = async (req, res) => {
    try {
        const schoolId = req.query.schoolId;
        await requireSchool(schoolId);
        await ensureStarters(schoolId);
        const query = { school: schoolId };
        if (req.query.category) query.category = req.query.category;
        if (req.query.defaultsOnly === '1') query.isDefault = true;
        const templates = await DesignTemplate.find(query).sort({ updatedAt: -1 }).lean();
        res.json(templates);
    } catch (error) {
        sendError(res, error);
    }
};

const getTemplate = async (req, res) => {
    try {
        await requireSchool(req.query.schoolId);
        const template = await DesignTemplate.findOne({ _id: req.params.id, school: req.query.schoolId }).lean();
        if (!template) return res.status(404).json({ message: 'Design not found.' });
        res.json(template);
    } catch (error) {
        sendError(res, error);
    }
};

const createTemplate = async (req, res) => {
    try {
        await requireSchool(req.body.schoolId);
        const payload = sanitizeDocument(req.body);
        if (payload.isDefault) {
            await DesignTemplate.updateMany(
                { school: req.body.schoolId, category: payload.category },
                { $set: { isDefault: false } }
            );
        }
        const created = await DesignTemplate.create({ ...payload, school: req.body.schoolId, versions: [] });
        res.status(201).json(created);
    } catch (error) {
        sendError(res, error);
    }
};

const updateTemplate = async (req, res) => {
    try {
        await requireSchool(req.body.schoolId);
        const existing = await DesignTemplate.findOne({ _id: req.params.id, school: req.body.schoolId });
        if (!existing) return res.status(404).json({ message: 'Design not found.' });
        const payload = sanitizeDocument(req.body);
        const versions = [
            {
                savedAt: new Date(),
                name: existing.name,
                category: existing.category,
                page: existing.page,
                pages: existing.pages,
            },
            ...(existing.versions || []),
        ].slice(0, 20);
        if (payload.isDefault) {
            await DesignTemplate.updateMany(
                { school: req.body.schoolId, category: payload.category, _id: { $ne: existing._id } },
                { $set: { isDefault: false } }
            );
        }
        existing.set({ ...payload, versions });
        await existing.save();
        res.json(existing);
    } catch (error) {
        sendError(res, error);
    }
};

const duplicateTemplate = async (req, res) => {
    try {
        await requireSchool(req.body.schoolId);
        const existing = await DesignTemplate.findOne({ _id: req.params.id, school: req.body.schoolId }).lean();
        if (!existing) return res.status(404).json({ message: 'Design not found.' });
        const copy = await DesignTemplate.create({
            school: req.body.schoolId,
            name: `${existing.name} copy`.slice(0, 120),
            category: existing.category,
            isDefault: false,
            page: existing.page,
            pages: existing.pages,
            assets: existing.assets,
            versions: [],
        });
        res.status(201).json(copy);
    } catch (error) {
        sendError(res, error);
    }
};

const removeTemplate = async (req, res) => {
    try {
        await requireSchool(req.query.schoolId);
        const removed = await DesignTemplate.findOneAndDelete({ _id: req.params.id, school: req.query.schoolId });
        if (!removed) return res.status(404).json({ message: 'Design not found.' });
        res.json({ ok: true });
    } catch (error) {
        sendError(res, error);
    }
};

const setDefaultTemplate = async (req, res) => {
    try {
        await requireSchool(req.body.schoolId);
        const existing = await DesignTemplate.findOne({ _id: req.params.id, school: req.body.schoolId });
        if (!existing) return res.status(404).json({ message: 'Design not found.' });
        await DesignTemplate.updateMany(
            { school: req.body.schoolId, category: existing.category },
            { $set: { isDefault: false } }
        );
        existing.isDefault = true;
        await existing.save();
        res.json(existing);
    } catch (error) {
        sendError(res, error);
    }
};

const restoreVersion = async (req, res) => {
    try {
        await requireSchool(req.body.schoolId);
        const existing = await DesignTemplate.findOne({ _id: req.params.id, school: req.body.schoolId });
        if (!existing) return res.status(404).json({ message: 'Design not found.' });
        const index = Number(req.body.versionIndex);
        const snapshot = (existing.versions || [])[index];
        if (!snapshot) return res.status(404).json({ message: 'That version is no longer available.' });
        const versions = [
            {
                savedAt: new Date(),
                name: existing.name,
                category: existing.category,
                page: existing.page,
                pages: existing.pages,
            },
            ...existing.versions,
        ].slice(0, 20);
        existing.name = snapshot.name || existing.name;
        existing.page = snapshot.page || existing.page;
        existing.pages = snapshot.pages || existing.pages;
        existing.versions = versions;
        await existing.save();
        res.json(existing);
    } catch (error) {
        sendError(res, error);
    }
};

async function loadScoped(modelName, id, schoolId) {
    loadAllModels();
    const model = mongoose.models[modelName];
    if (!model || !mongoose.isValidObjectId(id)) return null;
    if (modelName === 'admin') {
        if (String(id) !== String(schoolId)) return null;
        return model.findById(id).select('name email schoolName role').lean();
    }
    if (!model.schema.path('school')) return null;
    return model.findOne({ _id: id, school: schoolId }).select(safeProjection(model)).lean();
}

async function expandBag(bag, schoolId, warnings) {
    loadAllModels();
    const seen = new Set();
    const warn = (message) => {
        if (seen.has(message)) return;
        seen.add(message);
        warnings.push(message);
    };
    for (let hop = 0; hop < 3; hop += 1) {
        const entries = Object.entries(bag);
        for (const [modelName, doc] of entries) {
            const model = mongoose.models[modelName];
            if (!model || !doc) continue;
            for (const [fieldPath, schemaType] of Object.entries(model.schema.paths)) {
                if (SENSITIVE.test(fieldPath)) continue;
                const ref = schemaType.options && schemaType.options.ref;
                if (!ref || !mongoose.models[ref]) continue;
                const value = doc[fieldPath];
                const id = value && value._id ? value._id : value;
                if (!mongoose.isValidObjectId(id)) continue;
                if (bag[ref] && String(bag[ref]._id) !== String(id)) {
                    warn(`More than one ${ref} record is linked. The preview kept the first ${ref} record.`);
                    continue;
                }
                if (bag[ref]) continue;
                const related = await loadScoped(ref, id, schoolId);
                if (related) bag[ref] = related;
            }
        }
    }
}

async function fillTemplatePages({ schoolId, admin, pages, anchors }) {
    const bag = { admin: admin.toObject ? admin.toObject() : admin };
    const warnings = [];
    for (const [modelName, id] of Object.entries(anchors || {})) {
        if (!id) continue;
        const doc = await loadScoped(modelName, id, schoolId);
        if (!doc) {
            warnings.push(`The selected ${modelName} record is not available for this school.`);
            continue;
        }
        bag[modelName] = doc;
    }
    await expandBag(bag, schoolId, warnings);
    const values = {};
    (pages || []).forEach((pageItem) => {
        (pageItem.elements || []).forEach((item) => {
            if (!item || !item.binding || SENSITIVE.test(item.binding.path || '')) return;
            const source = bag[item.binding.model];
            if (!source) {
                values[item.id] = { text: '', rows: [] };
                return;
            }
            if (item.type === 'table') {
                const rowsSource = readPath(source, item.binding.path);
                const rows = Array.isArray(rowsSource) ? rowsSource : [];
                values[item.id] = {
                    rows: rows.map((row) => {
                        const cells = {};
                        (item.columns || []).forEach((column) => {
                            cells[column.path] = formatValue(readPath(row, column.path), column.format || 'text');
                        });
                        return cells;
                    }),
                };
                return;
            }
            const raw = item.binding.path === 'pendingBalance' && item.binding.model === 'feeInvoice'
                ? Number(source.total || 0) - Number(source.paidAmount || 0)
                : readPath(source, item.binding.path);
            let text = formatValue(raw, item.format || 'text');
            if (!text && item.binding && mongoose.isValidObjectId(raw)) {
                const refField = mongoose.models[item.binding.model]
                    && mongoose.models[item.binding.model].schema.path(item.binding.path);
                const ref = refField && refField.options && refField.options.ref;
                if (ref && bag[ref]) text = recordLabel(bag[ref]);
            }
            values[item.id] = { text };
        });
    });
    return { values, warnings };
}

const previewDesign = async (req, res) => {
    try {
        const schoolId = req.body.schoolId;
        const admin = await requireSchool(schoolId);
        const filled = await fillTemplatePages({
            schoolId,
            admin,
            pages: Array.isArray(req.body.pages) ? req.body.pages : [],
            anchors: req.body.anchors || {},
        });
        res.json(filled);
    } catch (error) {
        sendError(res, error);
    }
};

const listRecords = async (req, res) => {
    try {
        const schoolId = req.query.schoolId;
        await requireSchool(schoolId);
        loadAllModels();
        const modelName = req.query.model;
        const model = mongoose.models[modelName];
        if (!model || SENSITIVE.test(modelName)) {
            return res.status(400).json({ message: 'That collection is not available in Design Studio.' });
        }
        if (modelName === 'admin') {
            const admin = await model.findById(schoolId).select('name schoolName email').lean();
            return res.json(admin ? [{ id: admin._id, label: recordLabel(admin) }] : []);
        }
        if (!model.schema.path('school')) {
            return res.json([]);
        }
        const q = String(req.query.q || '').trim();
        const query = { school: schoolId };
        const textPaths = Object.entries(model.schema.paths)
            .filter(([fieldPath, schemaType]) => schemaType.instance === 'String' && !SENSITIVE.test(fieldPath) && !fieldPath.includes('.'))
            .map(([fieldPath]) => fieldPath);
        if (q && textPaths.length) {
            query.$or = textPaths.slice(0, 6).map((fieldPath) => ({
                [fieldPath]: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' },
            }));
        }
        const docs = await model.find(query).select(safeProjection(model)).limit(40).lean();
        res.json(docs.map((doc) => ({ id: doc._id, label: recordLabel(doc) })));
    } catch (error) {
        sendError(res, error);
    }
};

module.exports = {
    getSchema,
    listTemplates,
    getTemplate,
    createTemplate,
    updateTemplate,
    duplicateTemplate,
    removeTemplate,
    setDefaultTemplate,
    restoreVersion,
    previewDesign,
    listRecords,
    fillTemplatePages,
};
