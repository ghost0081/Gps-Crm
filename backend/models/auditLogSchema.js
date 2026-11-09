const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    school: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'admin',
        index: true,
    },
    action: {
        type: String,
        required: true,
        index: true,
    },
    actorType: {
        type: String,
        default: 'system',
    },
    actorId: {
        type: String,
        default: '',
    },
    actorName: {
        type: String,
        default: '',
    },
    resourceType: {
        type: String,
        default: '',
    },
    resourceId: {
        type: String,
        default: '',
    },
    detail: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
}, { timestamps: true });

module.exports = mongoose.model('auditLog', auditLogSchema);
