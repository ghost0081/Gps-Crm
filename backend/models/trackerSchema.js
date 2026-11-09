const mongoose = require('mongoose');

const trackerSchema = new mongoose.Schema({
    imei: {
        type: String,
        required: true,
        index: true
    },
    latitude: {
        type: Number,
        default: 0
    },
    longitude: {
        type: Number,
        default: 0
    },
    speed: {
        type: Number,
        default: 0
    },
    course: {
        type: Number,
        default: 0
    },
    battery: {
        type: Number,
        default: 0
    },
    batteryMv: {
        type: Number,
        default: 0
    },
    charging: {
        type: Boolean,
        default: false
    },
    lastFullChargeAt: {
        type: Date
    },
    sequence: {
        type: Number,
        default: 0
    },
    deviceType: {
        type: String,
        default: "GT06" // "GT06" or "BLE_BEACON"
    },
    mcc: {
        type: Number,
        default: 0
    },
    mnc: {
        type: Number,
        default: 0
    },
    lac: {
        type: Number,
        default: 0
    },
    cellId: {
        type: Number,
        default: 0
    },
    cellLatitude: {
        type: Number,
        default: 0
    },
    cellLongitude: {
        type: Number,
        default: 0
    },
    cellDistanceMeters: {
        type: Number,
        default: 0
    },
    cellAccuracy: {
        type: Number,
        default: 0
    },
    cellLocation: {
        type: String,
        default: ''
    },
    cellEstimateMethod: {
        type: String,
        default: ''
    },
    cellTimestamp: {
        type: Date
    },
    locationType: {
        type: String,
        default: "GPS" // "GPS" or "CELL_TOWER"
    },
    accuracy: {
        type: Number,
        default: 10 // meters (e.g. 10m for GPS, 300m for CELL_TOWER)
    },
    status: {
        type: String,
        default: "Offline"
    },
    last_updated: {
        type: Date,
        default: Date.now
    },
    path_history: [{
        lat: Number,
        lng: Number,
        timestamp: { type: Date, default: Date.now },
        locationType: String,
        accuracy: Number,
        cellId: Number,
        lac: Number,
        mcc: Number,
        mnc: Number,
        cellLat: Number,
        cellLng: Number,
        cellLocation: String,
        deviceType: String,
        quality: String,
        confidence: String,
        serverReceivedAt: Date,
        rejected: Boolean,
        rejectReasons: [String],
    }],
    // Last high-confidence fix (GPS preferred) separate from latest raw receipt
    lastReliableLocation: {
        lat: Number,
        lng: Number,
        timestamp: Date,
        locationType: String,
        accuracy: Number,
        confidence: String,
    },
    // Recent accepted normalized samples for ETA / approach speed
    recentObservations: [{
        lat: Number,
        lng: Number,
        deviceTimestamp: Date,
        locationType: String,
        accuracy: Number,
        speed: Number,
        usableForEta: Boolean,
        usableForDistance: Boolean,
        usableForGeofenceConfirm: Boolean,
        confidence: String,
    }],
    // Persistent geofence + proximity arming state (survives restarts)
    trackingState: {
        type: mongoose.Schema.Types.Mixed,
        default: () => ({ zones: {}, proximity: {}, updatedAt: null }),
    },
}, { timestamps: true });

module.exports = mongoose.model("tracker", trackerSchema);
