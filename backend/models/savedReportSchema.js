const mongoose = require('mongoose');

const savedReportSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'admin', required: true, index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  definition: { type: mongoose.Schema.Types.Mixed, required: true },
  schemaVersion: { type: Number, default: 1 },
  ownerName: { type: String, default: 'Admin' },
  archived: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('savedReport', savedReportSchema);
