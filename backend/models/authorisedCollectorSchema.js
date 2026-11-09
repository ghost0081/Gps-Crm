const mongoose = require('mongoose');

const authorisedCollectorSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'admin', required: true, index: true },
  parent: { type: mongoose.Schema.Types.ObjectId, ref: 'parent', required: true, index: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'student', required: true, index: true },
  name: { type: String, required: true, trim: true },
  relation: { type: String, default: 'Guardian' },
  phone: { type: String, default: '' },
  photoUrl: { type: String, default: '' },
  /** SHA-256 hex of gate PIN (never store plaintext). */
  pinHash: { type: String, default: '', select: false },
  active: { type: Boolean, default: true },
  approvedBySchool: { type: Boolean, default: true },
  effectiveFrom: { type: Date, default: Date.now },
  expiresAt: { type: Date },
  revokedAt: { type: Date },
  notes: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('authorisedCollector', authorisedCollectorSchema);
