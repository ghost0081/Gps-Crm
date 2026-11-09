const mongoose = require('mongoose');

const feeInvoiceSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'admin', required: true, index: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'student', required: true, index: true },
  sclassName: { type: mongoose.Schema.Types.ObjectId, ref: 'sclass' },
  month: { type: String, required: true }, // YYYY-MM
  lines: [{
    feeHeadId: { type: mongoose.Schema.Types.ObjectId, ref: 'feeHead' },
    code: String,
    name: String,
    amount: { type: Number, default: 0 },
  }],
  total: { type: Number, default: 0 },
  status: { type: String, enum: ['Draft', 'Issued', 'Paid', 'Partial', 'Cancelled'], default: 'Issued' },
  dueDate: { type: Date },
  paidAmount: { type: Number, default: 0 },
  notes: { type: String, default: '' },
}, { timestamps: true });

feeInvoiceSchema.index({ school: 1, student: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('feeInvoice', feeInvoiceSchema);
