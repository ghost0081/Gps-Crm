const mongoose = require('mongoose');

const guardianPassSchema = new mongoose.Schema({
    passCode: {
        type: String,
        required: true,
        unique: true,
    },
    guardianName: {
        type: String,
        required: true,
    },
    guardianPhone: {
        type: String,
    },
    relation: {
        type: String,
        default: 'Guardian',
    },
    parent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'parent',
        required: true,
    },
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'student',
        required: true,
    },
    studentName: {
        type: String,
        required: true,
    },
    rollNum: {
        type: Number,
    },
    sclassNameStr: {
        type: String,
    },
    school: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'admin',
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    expiresAt: {
        type: Date,
        required: true,
    }
}, { timestamps: true });

module.exports = mongoose.model('guardianPass', guardianPassSchema);
