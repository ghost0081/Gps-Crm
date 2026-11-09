const mongoose = require('mongoose');

/**
 * Idempotent safety / proximity notification ledger.
 * Unique index on eventId prevents duplicate FCM / in-app alerts on retries.
 */
const safetyEventSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true, index: true },
  type: { type: String, required: true, index: true },
  category: {
    type: String,
    enum: ['arrival_departure', 'proximity', 'eta', 'route', 'device', 'emergency', 'other'],
    default: 'other',
  },
  imei: { type: String, index: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'student', index: true },
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'admin', index: true },
  zoneKey: { type: String },
  zoneName: { type: String },
  journeyId: { type: String, index: true },
  title: { type: String, required: true },
  body: { type: String, required: true },
  confidence: { type: String },
  source: { type: String },
  distanceMeters: { type: Number },
  etaMinutes: { type: Number },
  thresholdMeters: { type: Number },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  critical: { type: Boolean, default: false },
  recipients: [{
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'parent' },
    read: { type: Boolean, default: false },
    readAt: { type: Date },
  }],
  delivery: {
    attempted: { type: Boolean, default: false },
    sent: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    skipped: { type: Boolean, default: false },
    reason: { type: String },
    at: { type: Date },
  },
  occurredAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

safetyEventSchema.index({ student: 1, occurredAt: -1 });
safetyEventSchema.index({ school: 1, occurredAt: -1 });

module.exports = mongoose.model('safetyEvent', safetyEventSchema);
