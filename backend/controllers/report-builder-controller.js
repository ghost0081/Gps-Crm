const Student = require('../models/studentSchema.js');
const ParentArrival = require('../models/parentArrivalSchema.js');
const FeeInvoice = require('../models/feeInvoiceSchema.js');
const Teacher = require('../models/teacherSchema.js');

const DATASETS = {
  enrolment: async (schoolId) => {
    const rows = await Student.find({ school: schoolId })
      .populate('sclassName', 'sclassName')
      .select('name rollNum sclassName')
      .limit(500);
    return rows.map((s) => ({
      name: s.name,
      rollNum: s.rollNum,
      class: s.sclassName?.sclassName || '',
    }));
  },
  pickups: async (schoolId) => {
    const rows = await ParentArrival.find({ school: schoolId })
      .sort({ createdAt: -1 })
      .limit(200)
      .select('studentName rollNum status parentName teacherName arrivalTime exitTime');
    return rows.map((r) => ({
      student: r.studentName,
      roll: r.rollNum,
      status: r.status,
      collector: r.parentName,
      teacher: r.teacherName,
      arrival: r.arrivalTime,
      exit: r.exitTime,
    }));
  },
  fees: async (schoolId) => {
    const rows = await FeeInvoice.find({ school: schoolId })
      .populate('student', 'name rollNum')
      .sort({ createdAt: -1 })
      .limit(200);
    return rows.map((r) => ({
      student: r.student?.name,
      roll: r.student?.rollNum,
      month: r.month,
      total: r.total,
      paid: r.paidAmount,
      status: r.status,
    }));
  },
  staff: async (schoolId) => {
    const rows = await Teacher.find({ school: schoolId })
      .populate('teachSclass', 'sclassName')
      .populate('teachSubject', 'subName')
      .select('name email teachSclass teachSubject');
    return rows.map((t) => ({
      name: t.name,
      email: t.email,
      class: t.teachSclass?.sclassName || '',
      subject: t.teachSubject?.subName || '',
    }));
  },
};

const listDatasets = async (_req, res) => {
  return res.send({
    datasets: Object.keys(DATASETS).map((id) => ({
      id,
      label: id.charAt(0).toUpperCase() + id.slice(1),
    })),
  });
};

const runReport = async (req, res) => {
  try {
    const { schoolId, dataset } = req.query;
    if (!schoolId || !dataset) return res.status(400).json({ message: 'schoolId and dataset required' });
    const fn = DATASETS[dataset];
    if (!fn) return res.status(400).json({ message: `Unknown dataset: ${dataset}` });
    const rows = await fn(schoolId);
    return res.send({
      dataset,
      generatedAt: new Date().toISOString(),
      rowCount: rows.length,
      columns: rows[0] ? Object.keys(rows[0]) : [],
      rows,
    });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

module.exports = { listDatasets, runReport };
