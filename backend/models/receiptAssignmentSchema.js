const mongoose = require('mongoose');

const DOCUMENT_TYPES = ['fee-receipt', 'fee-due', 'fee-adjustment'];

const receiptAssignmentSchema = new mongoose.Schema({
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'admin', required: true, index: true },
    department: { type: String, enum: ['accounts'], default: 'accounts', required: true },
    documentType: { type: String, enum: DOCUMENT_TYPES, required: true },
    scope: { type: String, enum: ['department', 'class', 'student'], required: true },
    template: { type: mongoose.Schema.Types.ObjectId, ref: 'designTemplate', required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'student', default: null },
    sclassName: { type: mongoose.Schema.Types.ObjectId, ref: 'sclass', default: null },
}, { timestamps: true });

receiptAssignmentSchema.index(
    { school: 1, department: 1, documentType: 1, scope: 1, student: 1, sclassName: 1 },
    { unique: true }
);

module.exports = mongoose.model('receiptAssignment', receiptAssignmentSchema);
module.exports.DOCUMENT_TYPES = DOCUMENT_TYPES;
