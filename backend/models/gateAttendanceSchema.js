const mongoose = require('mongoose');

const gateAttendanceSchema = new mongoose.Schema({
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'admin',
    required: true,
    index: true,
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'student',
    required: true,
    index: true,
  },
  camera: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'camera',
    index: true,
  },
  cameraName: {
    type: String,
    default: 'Campus Gate Camera',
  },
  location: {
    type: String,
    default: 'Campus Entrance',
  },
  direction: {
    type: String,
    enum: ['IN', 'OUT'],
    default: 'IN',
    index: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
  confidence: {
    type: Number,
    required: true, // Cosine score e.g. 0.85
  },
  snapshotPath: {
    type: String, // Thumbnail snapshot for visual audit
  },
  status: {
    type: String,
    enum: ['Present', 'Late', 'Departed'],
    default: 'Present',
  },
}, { timestamps: true });

// Compound indexes for high-speed duplicate lookup & report queries
gateAttendanceSchema.index({ student: 1, direction: 1, timestamp: -1 });
gateAttendanceSchema.index({ school: 1, timestamp: -1 });

module.exports = mongoose.model('gateAttendance', gateAttendanceSchema);
