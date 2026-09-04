const mongoose = require('mongoose');

const parentArrivalSchema = new mongoose.Schema({
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
    sclassName: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'sclass',
    },
    sclassNameStr: {
        type: String,
    },
    teacher: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'teacher',
    },
    teacherName: {
        type: String,
    },
    school: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'admin',
    },
    parentName: {
        type: String,
        default: 'Parent',
    },
    parentPhone: {
        type: String,
    },
    status: {
        type: String,
        enum: ['Waiting at Frontdesk', 'Acknowledged', 'Student Dispatched'],
        default: 'Waiting at Frontdesk',
    },
    arrivalTime: {
        type: Date,
        default: Date.now,
    },
    dispatchTime: {
        type: Date,
    },
    scannedBy: {
        type: String,
        default: 'FrontDesk Staff',
    }
}, { timestamps: true });

module.exports = mongoose.model('parentArrival', parentArrivalSchema);
