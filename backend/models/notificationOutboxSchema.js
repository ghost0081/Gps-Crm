const mongoose = require('mongoose');

/** Durable notification queue for pickup / gate events (P0.3). */
const notificationOutboxSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'admin', index: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'teacher', index: true },
  arrival: { type: mongoose.Schema.Types.ObjectId, ref: 'parentArrival', index: true },
  type: { type: String, default: 'pickup.scan', index: true },
  title: { type: String, default: '' },
  body: { type: String, default: '' },
  payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  status: {
    type: String,
    enum: ['pending', 'delivered', 'failed'],
    default: 'pending',
    index: true,
  },
  attempts: { type: Number, default: 0 },
  lastError: { type: String, default: '' },
  deliveredAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('notificationOutbox', notificationOutboxSchema);
