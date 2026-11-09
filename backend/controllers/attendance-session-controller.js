const AttendanceSession = require('../models/attendanceSessionSchema.js');
const Student = require('../models/studentSchema.js');

const startSession = async (req, res) => {
  try {
    const { schoolId, teacherId, classId, subjectId, periodLabel, room } = req.body;
    if (!schoolId || !teacherId || !classId) {
      return res.status(400).json({ message: 'schoolId, teacherId, and classId are required' });
    }
    const roster = await Student.find({ sclassName: classId, school: schoolId }).select('_id name rollNum');
    const session = await AttendanceSession.create({
      school: schoolId,
      teacher: teacherId,
      sclassName: classId,
      subject: subjectId || null,
      periodLabel: periodLabel || '',
      room: room || '',
      expectedStudentIds: roster.map((s) => s._id),
      marks: roster.map((s) => ({
        student: s._id,
        state: 'uncertain',
        bleEvidenceCount: 0,
      })),
      status: 'open',
    });
    return res.send({
      session,
      roster: roster.map((s) => ({ id: s._id, name: s.name, rollNum: s.rollNum })),
      note: 'BLE proximity is evidence only — verify uncertain cases before closing.',
    });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

const getOpenSession = async (req, res) => {
  try {
    const { teacherId } = req.query;
    if (!teacherId) return res.status(400).json({ message: 'teacherId required' });
    const session = await AttendanceSession.findOne({ teacher: teacherId, status: 'open' }).sort({ startedAt: -1 });
    return res.send(session || null);
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

const recordBleEvidence = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { studentId, rssi } = req.body;
    const session = await AttendanceSession.findById(sessionId);
    if (!session || session.status !== 'open') {
      return res.status(404).json({ message: 'Open attendance session not found' });
    }
    const expected = session.expectedStudentIds.map(String);
    if (!expected.includes(String(studentId))) {
      return res.status(400).json({
        message: 'Student not on this session roster — neighbouring classroom signal ignored as auto-present.',
        ambiguous: true,
      });
    }
    const mark = session.marks.find((m) => String(m.student) === String(studentId));
    if (!mark) return res.status(404).json({ message: 'Mark row missing' });
    mark.bleEvidenceCount = (mark.bleEvidenceCount || 0) + 1;
    if (rssi != null) mark.lastRssi = Number(rssi);
    if (mark.state === 'uncertain' && mark.bleEvidenceCount >= 2) {
      mark.state = 'present';
    }
    mark.updatedAt = new Date();
    await session.save();
    return res.send({ mark, sessionId: session._id });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

const verifyMark = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { studentId, state, note, verifiedBy } = req.body;
    const session = await AttendanceSession.findById(sessionId);
    if (!session) return res.status(404).json({ message: 'Session not found' });
    const mark = session.marks.find((m) => String(m.student) === String(studentId));
    if (!mark) return res.status(404).json({ message: 'Student not in session' });
    const allowed = ['present', 'absent', 'late', 'uncertain', 'verified_present', 'verified_absent'];
    if (!allowed.includes(state)) return res.status(400).json({ message: 'Invalid state' });
    mark.state = state;
    mark.note = note || '';
    mark.verifiedBy = verifiedBy || '';
    mark.updatedAt = new Date();
    await session.save();
    return res.send(mark);
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

const closeSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await AttendanceSession.findByIdAndUpdate(
      sessionId,
      { status: 'closed', endedAt: new Date() },
      { new: true }
    );
    if (!session) return res.status(404).json({ message: 'Session not found' });
    return res.send(session);
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

/**
 * Apply BLE RSSI as evidence to any open session whose roster includes this IMEI.
 * Neighbouring-class students are ignored (not on roster).
 */
const recordBleEvidenceByImei = async ({ imei, rssi }) => {
  if (!imei) return { matched: 0 };
  const student = await Student.findOne({
    $or: [{ imei: String(imei) }, { 'trackers.imei': String(imei) }],
  }).select('_id sclassName school');
  if (!student) return { matched: 0, reason: 'no_student' };

  const sessions = await AttendanceSession.find({
    status: 'open',
    school: student.school,
    expectedStudentIds: student._id,
  });

  let matched = 0;
  for (const session of sessions) {
    const mark = session.marks.find((m) => String(m.student) === String(student._id));
    if (!mark) continue;
    mark.bleEvidenceCount = (mark.bleEvidenceCount || 0) + 1;
    if (rssi != null) mark.lastRssi = Number(rssi);
    if (mark.state === 'uncertain' && mark.bleEvidenceCount >= 2) {
      mark.state = 'present';
    }
    mark.updatedAt = new Date();
    await session.save();
    matched += 1;
  }
  return { matched, studentId: String(student._id) };
};

module.exports = {
  startSession,
  getOpenSession,
  recordBleEvidence,
  verifyMark,
  closeSession,
  recordBleEvidenceByImei,
};