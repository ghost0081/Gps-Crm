const mongoose = require('mongoose');

const parentSchema = new mongoose.Schema({
    name: { type: String, required: true },
    mobile: { type: String, required: true },
    // Set by an admin. When empty, login still accepts the last 5 digits of mobile.
    password: { type: String, default: '' },
    email: { type: String },
    role: { type: String, default: 'Parent' },
    /** Primary / legacy single-child link (kept for backward compatibility). */
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'student', required: true },
    /** Multi-child family dashboard — all linked students including primary. */
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'student' }],
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'admin', required: true },
    // FCM registration tokens for authorized guardian devices (optional until google-services configured)
    fcmTokens: [{
        token: { type: String, required: true },
        platform: { type: String, default: 'android' },
        updatedAt: { type: Date, default: Date.now },
    }],
    notificationPrefs: {
        arrivalDeparture: { type: Boolean, default: true },
        proximity: { type: Boolean, default: true },
        eta: { type: Boolean, default: true },
        routeDeviation: { type: Boolean, default: true },
        deviceHealth: { type: Boolean, default: true },
        dailySummary: { type: Boolean, default: false },
        quietHoursEnabled: { type: Boolean, default: false },
        quietHoursStart: { type: String, default: '22:00' },
        quietHoursEnd: { type: String, default: '06:00' },
        proximityThresholdsM: { type: [Number], default: () => [1000, 500, 300] },
        etaThresholdsMin: { type: [Number], default: () => [15, 10, 5] },
    },
}, { timestamps: true });

module.exports = mongoose.model('parent', parentSchema);








