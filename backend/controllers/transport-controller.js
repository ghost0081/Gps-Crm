const TransportRoute = require('../models/transportRouteSchema.js');

const listRoutes = async (req, res) => {
  try {
    const { schoolId } = req.query;
    if (!schoolId) return res.status(400).json({ message: 'schoolId required' });
    const rows = await TransportRoute.find({ school: schoolId }).sort({ name: 1 });
    return res.send(rows);
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

const createRoute = async (req, res) => {
  try {
    const { schoolId, name, code, vehicleLabel, driverName, helperName, capacity, stops, studentIds } = req.body;
    if (!schoolId || !name) return res.status(400).json({ message: 'schoolId and name required' });
    const row = await TransportRoute.create({
      school: schoolId,
      name,
      code: code || '',
      vehicleLabel: vehicleLabel || '',
      driverName: driverName || '',
      helperName: helperName || '',
      capacity: capacity || 40,
      stops: Array.isArray(stops) ? stops : [],
      studentIds: Array.isArray(studentIds) ? studentIds : [],
    });
    return res.send(row);
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

const updateRoute = async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = ['name', 'code', 'vehicleLabel', 'driverName', 'helperName', 'capacity', 'stops', 'studentIds', 'active'];
    const patch = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) patch[k] = req.body[k];
    }
    const row = await TransportRoute.findByIdAndUpdate(id, patch, { new: true });
    if (!row) return res.status(404).json({ message: 'Route not found' });
    return res.send(row);
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

const getStudentTransport = async (req, res) => {
  try {
    const { studentId } = req.params;
    const routes = await TransportRoute.find({ studentIds: studentId, active: true });
    return res.send(routes);
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

module.exports = { listRoutes, createRoute, updateRoute, getStudentTransport };
