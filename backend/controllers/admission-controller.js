const AdmissionEnquiry = require('../models/admissionEnquirySchema.js');

const listEnquiries = async (req, res) => {
  try {
    const { schoolId, status } = req.query;
    if (!schoolId) return res.status(400).json({ message: 'schoolId required' });
    const q = { school: schoolId };
    if (status) q.status = status;
    const rows = await AdmissionEnquiry.find(q).sort({ createdAt: -1 }).limit(100);
    return res.send(rows);
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

const createEnquiry = async (req, res) => {
  try {
    const { schoolId, studentName, classApplying, guardianName, guardianPhone, guardianEmail, source, notes } = req.body;
    if (!schoolId || !studentName || !guardianName || !guardianPhone) {
      return res.status(400).json({ message: 'schoolId, studentName, guardianName, guardianPhone required' });
    }
    const row = await AdmissionEnquiry.create({
      school: schoolId,
      studentName,
      classApplying: classApplying || '',
      guardianName,
      guardianPhone,
      guardianEmail: guardianEmail || '',
      source: source || 'walk_in',
      notes: notes || '',
    });
    return res.send(row);
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

const updateEnquiry = async (req, res) => {
  try {
    const allowed = ['status', 'notes', 'assignedTo', 'followUpAt', 'classApplying'];
    const patch = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) patch[k] = req.body[k];
    }
    const row = await AdmissionEnquiry.findByIdAndUpdate(req.params.id, patch, { new: true });
    if (!row) return res.status(404).json({ message: 'Not found' });
    return res.send(row);
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

module.exports = { listEnquiries, createEnquiry, updateEnquiry };
