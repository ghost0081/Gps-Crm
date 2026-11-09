const mongoose = require('mongoose');

/**
 * Timetable-bound attendance session (P0.4 / P2 BLE evidence).
 * BLE detections are evidence; teacher verification remains authoritative.
 */
const attendanceSessionSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'admin', required: true, index: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'teacher', required: true, index: true },
  sclassName: { type: mongoose.Schema.Types.ObjectId, ref: 'sclass', required: true, index: true },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'subject' },
  periodLabel: { type: String, default: '' },
  room: { type: String, default: '' },
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date },
  status: {
    type: String,
    enum: ['open', 'closed', 'cancelled'],
    default: 'open',
    index: true,
  },
  expectedStudentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'student' }],
  marks: [{
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'student' },
    state: {
      type: String,
      enum: ['present', 'absent', 'late', 'uncertain', 'verified_present', 'verified_absent'],
      default: 'uncertain',
    },
    bleEvidenceCount: { type: Number, default: 0 },
    lastRssi: { type: Number },
    verifiedBy: { type: String, default: '' },
    note: { type: String, default: '' },
    updatedAt: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

module.exports = mongoose.model('attendanceSession', attendanceSessionSchema);