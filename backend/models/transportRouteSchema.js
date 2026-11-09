const mongoose = require('mongoose');

/** Transport routes / stops foundation (P1). */
const transportRouteSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'admin', required: true, index: true },
  name: { type: String, required: true, trim: true },
  code: { type: String, trim: true, default: '' },
  vehicleLabel: { type: String, default: '' },
  driverName: { type: String, default: '' },
  helperName: { type: String, default: '' },
  capacity: { type: Number, default: 40 },
  active: { type: Boolean, default: true },
  stops: [{
    name: { type: String, required: true },
    sequence: { type: Number, default: 0 },
    lat: { type: Number },
    lng: { type: Number },
    etaMinutes: { type: Number },
  }],
  studentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'student' }],
}, { timestamps: true });

module.exports = mongoose.model('transportRoute', transportRouteSchema);
