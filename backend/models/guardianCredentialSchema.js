const mongoose = require('mongoose');

/**
 * Opaque gate credential (P0.1).
 * The QR payload only carries credentialId + HMAC — never student/parent PII.
 */
const guardianCredentialSchema = new mongoose.Schema({
    credentialId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    kind: {
        type: String,
        enum: ['parent', 'collector', 'temp_guardian'],
        default: 'parent',
    },
    status: {
        type: String,
        enum: ['active', 'revoked', 'expired'],
        default: 'active',
        index: true,
    },
    parent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'parent',
        required: true,
        index: true,
    },
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'student',
        required: true,
        index: true,
    },
    school: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'admin',
        index: true,
    },
    /** Display-only after server/cache resolve — never embed in QR */
    collectorName: {
        type: String,
        default: 'Parent',
    },
    collectorPhone: {
        type: String,
        default: '',
    },
    guardianPass: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'guardianPass',
        default: null,
    },
    expiresAt: {
        type: Date,
        default: null,
    },
    revokedAt: {
        type: Date,
        default: null,
    },
    revokeReason: {
        type: String,
        default: '',
    },
    replacedBy: {
        type: String,
        default: null,
    },
    version: {
        type: Number,
        default: 1,
    },
}, { timestamps: true });

guardianCredentialSchema.index({ school: 1, status: 1 });
guardianCredentialSchema.index({ parent: 1, student: 1, kind: 1, status: 1 });

module.exports = mongoose.model('guardianCredential', guardianCredentialSchema);
