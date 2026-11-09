const crypto = require('crypto');
const { randomUUID } = require('crypto');

/** Must match mobile `qr_utils.dart` until secrets move to env-only. */
const QR_HMAC_SECRET = process.env.QR_HMAC_SECRET || 'gps-crm-qr-gate-pass-2026';

function newCredentialId() {
    return randomUUID();
}

function signCredentialId(credentialId, version = 1) {
    const message = `v=${version}|cid=${credentialId}`;
    return crypto.createHmac('sha256', QR_HMAC_SECRET).update(message).digest('hex');
}

function verifyCredentialSignature(credentialId, sig, version = 1) {
    if (!credentialId || !sig || typeof sig !== 'string') return false;
    const expected = signCredentialId(credentialId, version);
    try {
        return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
    } catch {
        return false;
    }
}

function buildOpaqueQrPayload(credentialId, version = 1) {
    return {
        v: version,
        cid: credentialId,
        sig: signCredentialId(credentialId, version),
    };
}

module.exports = {
    QR_HMAC_SECRET,
    newCredentialId,
    signCredentialId,
    verifyCredentialSignature,
    buildOpaqueQrPayload,
};
