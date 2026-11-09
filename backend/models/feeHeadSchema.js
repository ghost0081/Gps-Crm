const mongoose = require('mongoose');

/** Configurable fee heads (P0.4) — amounts applied by class/category later. */
const feeHeadSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'admin', required: true, index: true },
  code: { type: String, required: true, trim: true },
  name: { type: String, required: true, trim: true },
  category: {
    type: String,
    enum: ['admission', 'tuition', 'transport', 'examination', 'activity', 'meals', 'books', 'other'],
    default: 'tuition',
  },
  defaultAmount: { type: Number, default: 0 },
  billingCycle: {
    type: String,
    enum: ['monthly', 'quarterly', 'term', 'annual', 'one_time'],
    default: 'monthly',
  },
  active: { type: Boolean, default: true },
  effectiveFrom: { type: Date, default: Date.now },
  notes: { type: String, default: '' },
}, { timestamps: true });

feeHeadSchema.index({ school: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('feeHead', feeHeadSchema);
