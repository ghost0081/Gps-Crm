const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    rollNum: {
        type: Number,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    sclassName: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'sclass',
        required: true,
    },
    school: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'admin',
        required: true,
    },
    role: {
        type: String,
        default: "Student"
    },
    imei: {
        type: String,
        default: ""
    },
    trackers: [{
        imei: { type: String, required: true },
        name: { type: String, default: "Tracker" },
        deviceType: { type: String, default: "BLE_BEACON" },
        isPrimary: { type: Boolean, default: false }
    }],
    geofence: {
        lat: { type: Number, default: 0 },
        lng: { type: Number, default: 0 },
        radius: { type: Number, default: 500 }, // Radius in meters
        name: { type: String, default: "Safe Zone" },
        enabled: { type: Boolean, default: false }
    },
    geofences: [{
        name: { type: String, default: "Safe Zone" },
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
        radius: { type: Number, default: 10 },
        enabled: { type: Boolean, default: true }
    }],
    examResult: [
        {
            subName: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'subject',
            },
            marksObtained: {
                type: Number,
                default: 0
            }
        }
    ],
    attendance: [{
        date: {
            type: Date,
            required: true
        },
        status: {
            type: String,
            enum: ['Present', 'Absent'],
            required: true
        },
        subName: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'subject',
            required: true
        }
    }]
});

module.exports = mongoose.model("student", studentSchema);