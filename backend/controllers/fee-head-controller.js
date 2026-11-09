const FeeHead = require('../models/feeHeadSchema.js');

const listFeeHeads = async (req, res) => {
  try {
    const { schoolId } = req.query;
    if (!schoolId) return res.status(400).json({ message: 'schoolId required' });
    const rows = await FeeHead.find({ school: schoolId }).sort({ category: 1, name: 1 });
    return res.send(rows);
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

const createFeeHead = async (req, res) => {
  try {
    const { schoolId, code, name, category, defaultAmount, billingCycle, notes } = req.body;
    if (!schoolId || !code || !name) {
      return res.status(400).json({ message: 'schoolId, code, and name are required' });
    }
    const row = await FeeHead.create({
      school: schoolId,
      code: String(code).toUpperCase().trim(),
      name: String(name).trim(),
      category: category || 'tuition',
      defaultAmount: Number(defaultAmount) || 0,
      billingCycle: billingCycle || 'monthly',
      notes: notes || '',
    });
    return res.send(row);
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ message: 'Fee head code already exists for this school' });
    return res.status(500).json({ message: e.message });
  }
};

const updateFeeHead = async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = ['name', 'category', 'defaultAmount', 'billingCycle', 'active', 'notes', 'effectiveFrom'];
    const patch = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) patch[k] = req.body[k];
    }
    const row = await FeeHead.findByIdAndUpdate(id, patch, { new: true });
    if (!row) return res.status(404).json({ message: 'Fee head not found' });
    return res.send(row);
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

/** Preview invoice lines from active fee heads (does not post). */
const previewFeeCharges = async (req, res) => {
  try {
    const { schoolId, classId } = req.query;
    if (!schoolId) return res.status(400).json({ message: 'schoolId required' });
    const heads = await FeeHead.find({ school: schoolId, active: true });
    const lines = heads.map((h) => ({
      feeHeadId: h._id,
      code: h.code,
      name: h.name,
      category: h.category,
      amount: h.defaultAmount,
      billingCycle: h.billingCycle,
      classId: classId || null,
    }));
    const total = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
    return res.send({ lines, total, note: 'Preview only — historical invoices are not altered.' });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

module.exports = { listFeeHeads, createFeeHead, updateFeeHead, previewFeeCharges };
