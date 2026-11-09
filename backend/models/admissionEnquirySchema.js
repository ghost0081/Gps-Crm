const mongoose = require('mongoose');

const admissionEnquirySchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'admin', required: true, index: true },
  studentName: { type: String, required: true },
  classApplying: { type: String, default: '' },
  guardianName: { type: String, required: true },
  guardianPhone: { type: String, required: true },
  guardianEmail: { type: String, default: '' },
  source: { type: String, enum: ['website', 'phone', 'walk_in', 'referral', 'other'], default: 'walk_in' },
  status: {
    type: String,
    enum: ['New', 'Contacted', 'Assessment', 'Interview', 'Offer', 'Enrolled', 'Lost'],
    default: 'New',
    index: true,
  },
  notes: { type: String, default: '' },
  assignedTo: { type: String, default: '' },
  followUpAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('admissionEnquiry', admissionEnquirySchema);
