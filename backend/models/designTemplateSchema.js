const mongoose = require('mongoose');

const designTemplateSchema = new mongoose.Schema({
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'admin', required: true, index: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true, index: true },
    isDefault: { type: Boolean, default: false },
    page: {
        widthMm: { type: Number, default: 210 },
        heightMm: { type: Number, default: 297 },
        background: { type: String, default: '#ffffff' },
        marginMm: { type: Number, default: 0 },
    },
    pages: { type: Array, default: [] },
    assets: { type: Array, default: [] },
    versions: { type: Array, default: [] },
}, { timestamps: true });

designTemplateSchema.index({ school: 1, category: 1, isDefault: 1 });

module.exports = mongoose.model('designTemplate', designTemplateSchema);
