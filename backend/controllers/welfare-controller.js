const WelfareNote = require('../models/welfareNoteSchema.js');

const listWelfareNotes = async (req, res) => {
  try {
    const { schoolId, studentId, kind } = req.query;
    if (!schoolId) return res.status(400).json({ message: 'schoolId required' });
    const q = { school: schoolId };
    if (studentId) q.student = studentId;
    if (kind) q.kind = kind;
    const rows = await WelfareNote.find(q)
      .populate('student', 'name rollNum')
      .sort({ createdAt: -1 })
      .limit(100);
    return res.send(rows);
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

const createWelfareNote = async (req, res) => {
  try {
    const {
      schoolId, studentId, kind, summary, detail,
      visibleToTeachers, teacherSafeSummary, createdBy, followUpAt,
    } = req.body;
    if (!schoolId || !studentId || !summary) {
      return res.status(400).json({ message: 'schoolId, studentId, summary required' });
    }
    const row = await WelfareNote.create({
      school: schoolId,
      student: studentId,
      kind: kind || 'medical',
      summary,
      detail: detail || '',
      visibleToTeachers: Boolean(visibleToTeachers),
      teacherSafeSummary: teacherSafeSummary || '',
      createdBy: createdBy || '',
      followUpAt: followUpAt ? new Date(followUpAt) : undefined,
    });
    return res.send(row);
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

/** Teachers only receive safe summaries when flag is set. */
const listTeacherSafeAlerts = async (req, res) => {
  try {
    const { schoolId, classId } = req.query;
    if (!schoolId) return res.status(400).json({ message: 'schoolId required' });
    const Student = require('../models/studentSchema.js');
    const studentQ = { school: schoolId };
    if (classId) studentQ.sclassName = classId;
    const students = await Student.find(studentQ).select('_id');
    const ids = students.map((s) => s._id);
    const rows = await WelfareNote.find({
      school: schoolId,
      student: { $in: ids },
      visibleToTeachers: true,
      status: 'open',
    }).populate('student', 'name rollNum').limit(50);
    return res.send(rows.map((r) => ({
      studentId: r.student?._id,
      studentName: r.student?.name,
      rollNum: r.student?.rollNum,
      alert: r.teacherSafeSummary || r.summary,
      kind: r.kind,
    })));
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

module.exports = { listWelfareNotes, createWelfareNote, listTeacherSafeAlerts };
