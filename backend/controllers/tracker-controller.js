const TrackerData = require('../models/trackerSchema');
const Student = require('../models/studentSchema');

// Retrieve tracking data for a specific device or student
const getDeviceData = async (req, res) => {
    try {
        const { device_id } = req.params;
        const requestedImei = req.query.imei;
        
        let imei = requestedImei || device_id;
        let studentGeofence = null;
        let studentGeofences = [];
        let studentTrackers = [];

        try {
            const student = await Student.findById(device_id);
            if (student) {
                if (student.trackers && student.trackers.length > 0) {
                    studentTrackers = student.trackers;
                    if (!requestedImei) {
                        const primary = student.trackers.find(t => t.isPrimary) || student.trackers[0];
                        imei = primary.imei;
                    }
                } else if (student.imei) {
                    imei = student.imei;
                    studentTrackers = [{ imei: student.imei, name: "Primary Tracker", isPrimary: true }];
                }

                if (student.geofence) studentGeofence = student.geofence;
                if (student.geofences && student.geofences.length > 0) {
                    studentGeofences = student.geofences;
                } else if (student.geofence) {
                    studentGeofences = [student.geofence];
                }
            }
        } catch(e) {
            // Not a valid object ID, treat as IMEI directly
        }

        const data = await TrackerData.findOne({ imei }).sort({ last_updated: -1 }).lean();

        if (!data) {
            return res.status(200).json({
                device_id: imei,
                imei: imei,
                latitude: 0,
                longitude: 0,
                speed: 0,
                course: 0,
                battery: 0,
                mcc: 0,
                mnc: 0,
                lac: 0,
                cellId: 0,
                locationType: 'GPS',
                accuracy: 10,
                status: 'Offline',
                isLiveFix: false,
                last_updated: null,
                geofence: studentGeofence,
                geofences: studentGeofences,
                trackers: studentTrackers,
                path_history: []
            });
        }

        // Check if tracker is live (updated within 3 minutes)
        const now = new Date();
        const lastUpdated = data.last_updated ? new Date(data.last_updated) : null;
        const isRecent = lastUpdated && ((now.getTime() - lastUpdated.getTime()) <= 3 * 60 * 1000);

        if (!isRecent) {
            data.status = 'Offline';
            data.isLiveFix = false;
            TrackerData.updateOne({ _id: data._id }, { $set: { status: 'Offline' } }).catch(() => {});
        } else {
            data.status = 'Online';
            data.isLiveFix = true;
        }

        // Filter path_history to points recorded today (since midnight) to eliminate stale old session packets
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        if (data.path_history && Array.isArray(data.path_history)) {
            data.path_history = data.path_history.filter(pt => {
                if (!pt || !pt.timestamp) return false;
                const ptDate = new Date(pt.timestamp);
                return ptDate >= startOfToday;
            });
        } else {
            data.path_history = [];
        }

        data.geofence = studentGeofence;
        data.geofences = studentGeofences;
        data.trackers = studentTrackers;
        return res.status(200).json(data);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// Retrieve all active and registered devices
const getActiveDevices = async (req, res) => {
    try {
        const devices = await TrackerData.find({}, 'imei status latitude longitude last_updated').sort({ last_updated: -1 }).lean();
        const deviceIds = devices.map(d => d.imei);
        return res.status(200).json(deviceIds);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// Update geofence safe zone(s) for a student
const updateGeofence = async (req, res) => {
    try {
        const { student_id } = req.params;
        const { lat, lng, radius, name, enabled, geofences } = req.body;
        
        let updateData = {};
        if (geofences && Array.isArray(geofences)) {
            const cappedGeofences = geofences.slice(0, 4); // Enforce max 4 safe zones
            updateData.geofences = cappedGeofences;
            if (cappedGeofences.length > 0) {
                updateData.geofence = cappedGeofences[0];
            }
        } else {
            updateData.geofence = { lat, lng, radius, name, enabled };
            updateData.geofences = [{ lat, lng, radius, name, enabled }];
        }

        const student = await Student.findByIdAndUpdate(
            student_id,
            updateData,
            { new: true }
        );
        if (!student) {
            return res.status(404).json({ message: "Student not found" });
        }
        return res.status(200).json({ 
            message: "Safe zones saved successfully", 
            geofence: student.geofence,
            geofences: student.geofences 
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

const getDistanceMeters = (lat1, lon1, lat2, lon2) => {
    const R = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const processGeofenceCheck = async (imei, lat, lng) => {
    if (!lat || !lng) return null;
    try {
        const student = await Student.findOne({ imei: String(imei) }).lean();
        if (!student) return null;

        const zones = [];
        if (student.geofences && Array.isArray(student.geofences)) {
            for (const gf of student.geofences) {
                if (gf.enabled && gf.lat && gf.lng) {
                    zones.push(gf);
                }
            }
        }
        if (zones.length === 0 && student.geofence && student.geofence.enabled && student.geofence.lat && student.geofence.lng) {
            zones.push(student.geofence);
        }

        if (zones.length === 0) return null;

        const hits = [];
        let closestZone = null;
        let minDistance = Infinity;

        for (const zone of zones) {
            const dist = getDistanceMeters(lat, lng, zone.lat, zone.lng);
            const radius = zone.radius || 10;
            const isInside = dist <= radius;

            if (dist < minDistance) {
                minDistance = dist;
                closestZone = { zone, dist, isInside };
            }

            if (isInside) {
                hits.push({
                    name: zone.name || "Safe Zone",
                    distanceMeters: Math.round(dist),
                    radiusMeters: radius,
                    lat: zone.lat,
                    lng: zone.lng
                });
            }
        }

        const isInsideAny = hits.length > 0;

        const alert = {
            studentName: student.name,
            isInside: isInsideAny,
            hits: hits,
            hitCount: hits.length,
            closestDistanceMeters: Math.round(minDistance),
            geofenceName: isInsideAny ? hits.map(h => h.name).join(', ') : (closestZone ? closestZone.zone.name : "Safe Zone"),
            distanceMeters: isInsideAny ? hits[0].distanceMeters : Math.round(minDistance),
            message: isInsideAny 
                ? `🚨 SAFE POINT HIT ALERT: Student ${student.name} arrived at safe point "${hits.map(h => h.name).join(', ')}" (${hits[0].distanceMeters}m from center)!`
                : `OUTSIDE SAFE ZONES: Student ${student.name} is ${Math.round(minDistance)}m away from closest safe zone "${closestZone ? closestZone.zone.name : ''}"`
        };

        if (isInsideAny) {
            console.log(`🚨 [GEOFENCE ALERT] ${alert.message}`);
        }

        return alert;
    } catch (e) {
        console.error("Geofence check error:", e.message);
    }
    return null;
};

// Upload BLE Telemetry from Mobile Android Gateway (BeaconACK Protocol)
const uploadBleTelemetry = async (req, res) => {
    try {
        const { imei, sequence, battery, batteryMv, latitude, longitude, speed } = req.body;

        if (!imei) {
            return res.status(400).json({ error: "IMEI is required" });
        }

        const now = new Date();
        const updatePayload = {
            imei: String(imei),
            battery: Number(battery) || 0,
            batteryMv: Number(batteryMv) || 0,
            sequence: Number(sequence) || 0,
            deviceType: 'BLE_BEACON',
            status: 'Online',
            last_updated: now
        };

        const lat = Number(latitude) || 0;
        const lng = Number(longitude) || 0;

        if (lat !== 0 && lng !== 0) {
            updatePayload.latitude = lat;
            updatePayload.longitude = lng;
            if (speed !== undefined) updatePayload.speed = Number(speed);
        }

        const mongoUpdate = { $set: updatePayload };

        if (lat !== 0 && lng !== 0) {
            mongoUpdate.$push = {
                path_history: {
                    $each: [{ lat, lng, timestamp: now, locationType: 'BLE', accuracy: 10, deviceType: 'BLE_BEACON' }],
                    $slice: -500 // Keep last 500 coordinates
                }
            };
        }

        await TrackerData.findOneAndUpdate(
            { imei: String(imei) },
            mongoUpdate,
            { upsert: true, new: true }
        );

        // Check live Geofence Safe Point Alert
        const geofenceAlert = await processGeofenceCheck(imei, lat, lng);

        // Generate a 32-bit unsigned integer receipt ID (uint32)
        const receiptId = (Date.now() & 0xFFFFFFFF) >>> 0;

        console.log(`[BLE TELEMETRY RECEIVE] IMEI: ${imei} | Seq: ${sequence} | Bat: ${battery}% (${batteryMv}mV) | Lat: ${latitude || 0} | Lng: ${longitude || 0} | ReceiptId: ${receiptId} (0x${receiptId.toString(16).toUpperCase()})`);

        return res.status(200).json({
            status: 1,
            message: "Beacon telemetry recorded successfully",
            receiptId,
            imei: String(imei),
            sequence: Number(sequence) || 0,
            geofenceAlert
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// Add a tracker to a student profile
const addStudentTracker = async (req, res) => {
    try {
        const { student_id } = req.params;
        const { imei, name, deviceType, isPrimary } = req.body;

        if (!imei) return res.status(400).json({ error: "Tracker IMEI is required" });

        const student = await Student.findById(student_id);
        if (!student) return res.status(404).json({ error: "Student not found" });

        if (!student.trackers) student.trackers = [];

        // Check if IMEI already exists in student's trackers
        const exists = student.trackers.some(t => t.imei === String(imei));
        if (!exists) {
            student.trackers.push({
                imei: String(imei),
                name: name || `Tracker ${student.trackers.length + 1}`,
                deviceType: deviceType || 'BLE_BEACON',
                isPrimary: isPrimary || (student.trackers.length === 0)
            });
        }
        
        // Also update primary imei field for backward compatibility
        student.imei = String(imei);
        await student.save();

        // Ensure tracker entry exists in MongoDB
        await TrackerData.findOneAndUpdate(
            { imei: String(imei) },
            { $set: { imei: String(imei), deviceType: deviceType || 'BLE_BEACON', status: 'Online' } },
            { upsert: true }
        );

        return res.status(200).json({ message: "Tracker linked successfully", student });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// Remove a tracker from a student profile
const removeStudentTracker = async (req, res) => {
    try {
        const { student_id, imei } = req.params;
        const student = await Student.findById(student_id);
        if (!student) return res.status(404).json({ error: "Student not found" });

        if (student.trackers) {
            student.trackers = student.trackers.filter(t => t.imei !== String(imei));
            if (student.trackers.length > 0) {
                student.imei = student.trackers[0].imei;
            }
            await student.save();
        }

        return res.status(200).json({ message: "Tracker unlinked successfully", student });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// Retrieve historical path history for a device date-filtered
const getDeviceHistory = async (req, res) => {
    try {
        const { device_id } = req.params;
        const requestedImei = req.query.imei;
        const targetDate = req.query.date; // e.g. "2026-08-24"

        let imei = requestedImei || device_id;
        try {
            const student = await Student.findById(device_id);
            if (student) {
                if (student.trackers && student.trackers.length > 0) {
                    const primary = student.trackers.find(t => t.isPrimary) || student.trackers[0];
                    imei = primary.imei;
                } else if (student.imei) {
                    imei = student.imei;
                }
            }
        } catch(e) {}

        const data = await TrackerData.findOne({ imei }).lean();
        if (!data || !data.path_history) {
            return res.status(200).json({ date: targetDate, points: [], totalDistanceMeters: 0 });
        }

        let points = data.path_history || [];
        if (targetDate) {
            points = points.filter(pt => {
                if (!pt || !pt.timestamp) return false;
                const ptDateStr = new Date(pt.timestamp).toISOString().split('T')[0];
                return ptDateStr === targetDate;
            });
        }

        // Sort chronologically (oldest to newest)
        points.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        // Calculate total trajectory distance in meters
        let totalDistance = 0;
        for (let i = 1; i < points.length; i++) {
            const lat1 = points[i - 1].lat;
            const lon1 = points[i - 1].lng;
            const lat2 = points[i].lat;
            const lon2 = points[i].lng;
            if (lat1 && lon1 && lat2 && lon2) {
                const rad = Math.PI / 180;
                const dLat = (lat2 - lat1) * rad;
                const dLon = (lon2 - lon1) * rad;
                const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                          Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
                          Math.sin(dLon / 2) * Math.sin(dLon / 2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                totalDistance += 6371000 * c;
            }
        }

        return res.status(200).json({
            imei: imei,
            date: targetDate || 'all',
            pointsCount: points.length,
            totalDistanceMeters: Math.round(totalDistance),
            points: points
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

module.exports = {
    getDeviceData,
    getActiveDevices,
    updateGeofence,
    uploadBleTelemetry,
    addStudentTracker,
    removeStudentTracker,
    getDeviceHistory
};
