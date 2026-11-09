const mongoose = require('mongoose');

/** Restricted nurse / counsellor notes (App 14). */
const welfareNoteSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'admin', required: true, index: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'student', required: true, index: true },
  kind: { type: String, enum: ['medical', 'counselling', 'incident', 'allergy_alert'], default: 'medical' },
  summary: { type: String, required: true },
  detail: { type: String, default: '' },
  visibleToTeachers: { type: Boolean, default: false },
  teacherSafeSummary: { type: String, default: '' },
  createdBy: { type: String, default: '' },
  followUpAt: { type: Date },
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
}, { timestamps: true });

module.exports = mongoose.model('welfareNote', welfareNoteSchema);
