const mongoose = require('mongoose');

/**
 * Pickup / parent-arrival transaction.
 * Legacy statuses kept for mobile teacher UI; new P0.2 statuses expand the state machine.
 */
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
    credentialId: {
        type: String,
        default: null,
        index: true,
    },
    clientEventId: {
        type: String,
        default: null,
        sparse: true,
        unique: true,
    },
    offlineQueuedAt: {
        type: Date,
        default: null,
    },
    notificationPending: {
        type: Boolean,
        default: false,
    },
    status: {
        type: String,
        enum: [
            // Legacy (keep)
            'Waiting at Frontdesk',
            'Acknowledged',
            'Student Dispatched',
            // P0.2 expanded
            'Scanned',
            'TeacherNotified',
            'Preparing',
            'Ready',
            'CollectorVerified',
            'HandedOver',
            'Exited',
            'Rejected',
            'Override',
        ],
        default: 'Waiting at Frontdesk',
    },
    arrivalTime: {
        type: Date,
        default: Date.now,
    },
    dispatchTime: {
        type: Date,
    },
    exitTime: {
        type: Date,
    },
    scannedBy: {
        type: String,
        default: 'FrontDesk Staff',
    },
    overrideReason: {
        type: String,
        default: '',
    },
    overrideBy: {
        type: String,
        default: '',
    },
    statusHistory: [{
        status: { type: String },
        at: { type: Date, default: Date.now },
        by: { type: String, default: '' },
        note: { type: String, default: '' },
    }],
    collectorVerifiedAt: { type: Date },
    handoverAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('parentArrival', parentArrivalSchema);
