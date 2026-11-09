const FeeHead = require('../models/feeHeadSchema.js');
const FeeInvoice = require('../models/feeInvoiceSchema.js');
const Student = require('../models/studentSchema.js');

const generateInvoicesForClass = async (req, res) => {
  try {
    const { schoolId, classId, month, dueDate } = req.body;
    if (!schoolId || !classId || !month) {
      return res.status(400).json({ message: 'schoolId, classId, and month (YYYY-MM) required' });
    }
    const heads = await FeeHead.find({ school: schoolId, active: true });
    if (!heads.length) return res.status(400).json({ message: 'No active fee heads — configure Fee Heads first' });

    const students = await Student.find({ school: schoolId, sclassName: classId });
    const lines = heads.map((h) => ({
      feeHeadId: h._id,
      code: h.code,
      name: h.name,
      amount: h.defaultAmount,
    }));
    const total = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);

    let created = 0;
    let skipped = 0;
    for (const st of students) {
      try {
        await FeeInvoice.create({
          school: schoolId,
          student: st._id,
          sclassName: classId,
          month,
          lines,
          total,
          status: 'Issued',
          dueDate: dueDate ? new Date(dueDate) : undefined,
        });
        created += 1;
      } catch (e) {
        if (e.code === 11000) skipped += 1;
        else throw e;
      }
    }
    return res.send({ created, skipped, totalPerStudent: total, students: students.length });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

const listInvoices = async (req, res) => {
  try {
    const { schoolId, classId, month, studentId } = req.query;
    const q = {};
    if (schoolId) q.school = schoolId;
    if (classId) q.sclassName = classId;
    if (month) q.month = month;
    if (studentId) q.student = studentId;
    const rows = await FeeInvoice.find(q)
      .populate('student', 'name rollNum')
      .sort({ createdAt: -1 })
      .limit(200);
    return res.send(rows);
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

const markInvoicePaid = async (req, res) => {
  try {
    const { id } = req.params;
    const { paidAmount } = req.body;
    const inv = await FeeInvoice.findById(id);
    if (!inv) return res.status(404).json({ message: 'Invoice not found' });
    const paid = paidAmount != null ? Number(paidAmount) : inv.total;
    inv.paidAmount = paid;
    inv.status = paid >= inv.total ? 'Paid' : 'Partial';
    await inv.save();
    return res.send(inv);
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

module.exports = { generateInvoicesForClass, listInvoices, markInvoicePaid };
