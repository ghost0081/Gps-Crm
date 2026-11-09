const mongoose = require('mongoose');

const cameraSchema = new mongoose.Schema({
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'admin',
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  location: {
    type: String,
    required: true,
    trim: true,
    default: 'Campus Gate',
  },
  rtspUrl: {
    type: String,
    required: true,
    trim: true,
  },
  direction: {
    type: String,
    enum: ['IN', 'OUT', 'GENERAL'],
    default: 'IN',
    index: true,
  },
  enabled: {
    type: Boolean,
    default: true,
    index: true,
  },
  fps: {
    type: Number,
    default: 2,
    min: 1,
    max: 15,
  },
  status: {
    type: String,
    enum: ['online', 'offline', 'error'],
    default: 'offline',
  },
  lastSeen: {
    type: Date,
  },
  lastError: {
    type: String,
  },
  notes: {
    type: String,
    default: '',
  },
}, { timestamps: true });

cameraSchema.index({ school: 1, enabled: 1 });

module.exports = mongoose.model('camera', cameraSchema);
