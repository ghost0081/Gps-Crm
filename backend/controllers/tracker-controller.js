const TrackerData = require('../models/trackerSchema');
const Student = require('../models/studentSchema');
const { describePlace } = require('../services/cell-tower-index');

function buildLocalization(data) {
    const isCell = data.locationType === 'CELL_TOWER';
    const latitude = Number(isCell ? (data.cellLatitude || data.latitude) : data.latitude) || 0;
    const longitude = Number(isCell ? (data.cellLongitude || data.longitude) : data.longitude) || 0;
    const accuracyMeters = Number(isCell ? (data.cellAccuracy || data.accuracy) : data.accuracy) || 0;
    const hasPoint = latitude !== 0 || longitude !== 0;
    const method = data.cellEstimateMethod || (isCell ? (hasPoint ? 'stored-estimate' : 'none') : (data.locationType || 'GPS'));
    let failure = '';
    if (isCell && !hasPoint) {
        failure = 'Cell ID was received, but no tower coordinates were found for it or for its location area.';
    } else if (method === 'lac-area') {
        failure = '';
    }
    return {
        receivedCellId: Number(data.cellId) > 0,
        mcc: data.mcc || 0,
        mnc: data.mnc || 0,
        lac: data.lac || 0,
        cellId: data.cellId || 0,
        method,
        latitude,
        longitude,
        accuracyMeters,
        place: data.cellLocation || '',
        updatedAt: data.cellTimestamp || data.last_updated || null,
        markerReady: hasPoint,
        circleReady: isCell && accuracyMeters > 0,
        failure
    };
}

async function fillCellReading(data) {
    if (!data) return;
    const updates = {};
    const hasCellFix = Number(data.cellLatitude) && Number(data.cellLongitude);
    const hasCellId = Number(data.cellId) > 0;

    if ((hasCellFix || hasCellId) && !data.cellTimestamp && data.last_updated) {
        data.cellTimestamp = data.last_updated;
        updates.cellTimestamp = data.last_updated;
    }

    if (hasCellFix && !data.cellLocation) {
        const place = await describePlace(data.cellLatitude, data.cellLongitude);
        if (place) {
            data.cellLocation = place;
            updates.cellLocation = place;
        }
    }

    if (data._id && Object.keys(updates).length > 0) {
        TrackerData.updateOne({ _id: data._id }, { $set: updates }).catch(() => {});
    }
}

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

        await fillCellReading(data);

        data.localization = buildLocalization(data);
        data.geofence = studentGeofence;
        data.geofences = studentGeofences;
        data.trackers = studentTrackers;
        return res.status(200).json(data);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// Retrieve all active and registered devices
// Optional ?schoolId= filters to IMEIs linked to that school's students (multi-tenant safety).
const getActiveDevices = async (req, res) => {
    try {
        const { schoolId } = req.query;
        let devices = await TrackerData.find({}, 'imei status latitude longitude last_updated').sort({ last_updated: -1 }).lean();

        if (schoolId) {
            const students = await Student.find({ school: schoolId })
                .select('imei trackers.imei')
                .lean();
            const allowed = new Set();
            for (const s of students) {
                if (s.imei) allowed.add(String(s.imei));
                if (Array.isArray(s.trackers)) {
                    for (const t of s.trackers) {
                        if (t?.imei) allowed.add(String(t.imei));
                    }
                }
            }
            devices = devices.filter((d) => allowed.has(String(d.imei)));
        }

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
            // Single-zone update from web: preserve zones 2–4 instead of wiping them
            const primary = { lat, lng, radius, name, enabled };
            updateData.geofence = primary;
            const existing = await Student.findById(student_id).select('geofences').lean();
            const rest = Array.isArray(existing?.geofences) ? existing.geofences.slice(1) : [];
            updateData.geofences = [primary, ...rest].slice(0, 4);
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

/**
 * Legacy single-sample geofence snapshot for API responses.
 * Confirmed arrival/departure notifications are handled by tracking-pipeline
 * (hysteresis + dwell + idempotent event IDs) — this no longer fires alerts
 * on every inside sample.
 */
const processGeofenceCheck = async (imei, lat, lng) => {
    if (!lat || !lng) return null;
    try {
        const student = await Student.findOne({
            $or: [
                { imei: String(imei) },
                { 'trackers.imei': String(imei) },
            ],
        }).lean();
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

        return {
            studentName: student.name,
            isInside: isInsideAny,
            hits: hits,
            hitCount: hits.length,
            closestDistanceMeters: Math.round(minDistance),
            geofenceName: isInsideAny ? hits.map(h => h.name).join(', ') : (closestZone ? closestZone.zone.name : "Safe Zone"),
            distanceMeters: isInsideAny ? hits[0].distanceMeters : Math.round(minDistance),
            confirmed: false,
            message: isInsideAny
                ? `Inside "${hits.map(h => h.name).join(', ')}" (awaiting confirmation — not an alert)`
                : `Outside safe zones; closest ${Math.round(minDistance)}m from "${closestZone ? closestZone.zone.name : ''}"`
        };
    } catch (e) {
        console.error("Geofence check error:", e.message);
    }
    return null;
};

// Upload BLE Telemetry from Mobile Android Gateway (BeaconACK Protocol)
const uploadBleTelemetry = async (req, res) => {
    try {
        const { imei, sequence, battery, batteryMv, latitude, longitude, speed, charging, rssi } = req.body;

        if (!imei) {
            return res.status(400).json({ error: "IMEI is required" });
        }

        const now = new Date();
        const percent = Math.max(0, Math.min(100, Math.round(Number(battery) || 0)));
        const isCharging = charging === true || charging === 1 || charging === '1';
        const updatePayload = {
            imei: String(imei),
            battery: percent,
            batteryMv: Number(batteryMv) || 0,
            sequence: Number(sequence) || 0,
            deviceType: 'BLE_BEACON',
            status: 'Online',
            last_updated: now
        };
        if (charging !== undefined) {
            updatePayload.charging = isCharging;
        }
        if (isCharging && percent >= 100) {
            const existing = await TrackerData.findOne({ imei: String(imei) }).select('battery').lean();
            if (!existing || Number(existing.battery) < 100) {
                updatePayload.lastFullChargeAt = now;
            }
        }

        const lat = Number(latitude) || 0;
        const lng = Number(longitude) || 0;

        if (lat !== 0 && lng !== 0) {
            updatePayload.latitude = lat;
            updatePayload.longitude = lng;
            updatePayload.locationType = 'BLE';
            updatePayload.accuracy = 10;
            if (speed !== undefined) updatePayload.speed = Number(speed);
        }

        const mongoUpdate = { $set: updatePayload };

        if (lat !== 0 && lng !== 0) {
            mongoUpdate.$push = {
                path_history: {
                    $each: [{
                        lat,
                        lng,
                        timestamp: now,
                        locationType: 'BLE',
                        accuracy: 10,
                        deviceType: 'BLE_BEACON'
                    }],
                    $slice: -500 // Keep last 500 coordinates
                }
            };
        }

        await TrackerData.findOneAndUpdate(
            { imei: String(imei) },
            mongoUpdate,
            { upsert: true, new: true }
        );

        // Snapshot only — confirmed notifications run in tracking-pipeline
        const geofenceAlert = await processGeofenceCheck(imei, lat, lng);

        let safetyPipeline = null;
        if (lat !== 0 && lng !== 0) {
            try {
                const { processLiveLocationUpdate } = require('../services/tracking-pipeline');
                safetyPipeline = await processLiveLocationUpdate({
                    imei: String(imei),
                    lat,
                    lng,
                    locationType: 'BLE',
                    accuracy: 10,
                    speed: speed !== undefined ? Number(speed) : undefined,
                    battery: percent,
                    deviceTimestamp: now,
                    serverReceivedAt: now,
                });
            } catch (pipeErr) {
                console.error('[BLE] tracking pipeline error:', pipeErr.message);
            }
        }

        // Timetable attendance evidence (BLE ≠ auto-present without roster match)
        let attendanceEvidence = null;
        try {
            const { recordBleEvidenceByImei } = require('./attendance-session-controller');
            attendanceEvidence = await recordBleEvidenceByImei({
                imei: String(imei),
                rssi: rssi != null ? Number(rssi) : undefined,
            });
        } catch (attErr) {
            console.error('[BLE] attendance evidence error:', attErr.message);
        }

        // Generate a 32-bit unsigned integer receipt ID (uint32)
        const receiptId = (Date.now() & 0xFFFFFFFF) >>> 0;

        console.log(`[BLE TELEMETRY RECEIVE] IMEI: ${imei} | Seq: ${sequence} | Bat: ${battery}% (${batteryMv}mV) | Lat: ${latitude || 0} | Lng: ${longitude || 0} | ReceiptId: ${receiptId} (0x${receiptId.toString(16).toUpperCase()})`);

        return res.status(200).json({
            status: 1,
            message: "Beacon telemetry recorded successfully",
            receiptId,
            imei: String(imei),
            sequence: Number(sequence) || 0,
            geofenceAlert,
            attendanceEvidence,
            safetyEvents: safetyPipeline && safetyPipeline.events
                ? safetyPipeline.events.map((e) => e.type || e)
                : [],
            observation: safetyPipeline && safetyPipeline.observation
                ? {
                    confidence: safetyPipeline.observation.confidence,
                    trackingStatus: safetyPipeline.observation.trackingStatus,
                    source: safetyPipeline.observation.source,
                    reasons: safetyPipeline.observation.reasons,
                }
                : null,
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
        const makePrimary = Boolean(isPrimary) || student.trackers.length === 0;
        if (!exists) {
            if (makePrimary) {
                student.trackers.forEach((t) => { t.isPrimary = false; });
            }
            student.trackers.push({
                imei: String(imei),
                name: name || `Tracker ${student.trackers.length + 1}`,
                deviceType: deviceType || 'BLE_BEACON',
                isPrimary: makePrimary
            });
        } else if (makePrimary) {
            student.trackers.forEach((t) => {
                t.isPrimary = String(t.imei) === String(imei);
            });
        }

        // Only overwrite legacy primary imei when this device is (or becomes) primary
        if (makePrimary || !student.imei) {
            student.imei = String(imei);
        }
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
        const { buildActivityTimeline } = require('../services/route-activity-timeline');
        const { device_id } = req.params;
        const requestedImei = req.query.imei;
        const targetDate = req.query.date; // e.g. "2026-08-24"

        let imei = requestedImei || device_id;
        let student = null;
        try {
            student = await Student.findById(device_id);
            if (student && !requestedImei) {
                // Only fall back to primary tracker when caller did not specify ?imei=
                if (student.trackers && student.trackers.length > 0) {
                    const primary = student.trackers.find(t => t.isPrimary) || student.trackers[0];
                    imei = primary.imei;
                } else if (student.imei) {
                    imei = student.imei;
                }
            }
        } catch(e) {}

        if (!student) {
            student = await Student.findOne({
                $or: [
                    { imei: String(imei) },
                    { 'trackers.imei': String(imei) }
                ]
            });
        }

        let geofences = [];
        if (student) {
            if (student.geofences && student.geofences.length > 0) {
                geofences = student.geofences;
            } else if (student.geofence) {
                geofences = [student.geofence];
            }
        }

        const data = await TrackerData.findOne({ imei }).lean();
        if (!data || !data.path_history) {
            const emptyTimeline = buildActivityTimeline([], geofences);
            return res.status(200).json({
                date: targetDate,
                points: [],
                history: [],
                pointsCount: 0,
                count: 0,
                totalDistanceMeters: 0,
                distanceMeters: 0,
                geofences,
                activityTimeline: emptyTimeline
            });
        }

        let points = data.path_history || [];
        if (targetDate) {
            // Filter in Asia/Kolkata calendar day (IST, UTC+5:30) to match live UI "today"
            const toIstDateStr = (ts) => {
                const d = new Date(ts);
                if (Number.isNaN(d.getTime())) return '';
                const ist = new Date(d.getTime() + (330 * 60 * 1000));
                return ist.toISOString().split('T')[0];
            };
            points = points.filter(pt => {
                if (!pt || !pt.timestamp) return false;
                return toIstDateStr(pt.timestamp) === targetDate;
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

        const distanceMeters = Math.round(totalDistance);
        const activityTimeline = buildActivityTimeline(points, geofences);
        return res.status(200).json({
            imei: imei,
            date: targetDate || 'all',
            pointsCount: points.length,
            count: points.length,
            totalDistanceMeters: distanceMeters,
            distanceMeters,
            points,
            history: points,
            geofences,
            activityTimeline
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

const getTrackingSummary = async (req, res) => {
    try {
        const { student_id } = req.params;
        const imei = req.query.imei;
        const { buildTrackingSummary } = require('../services/tracking-pipeline');
        const summary = await buildTrackingSummary(student_id, imei);
        if (!summary) return res.status(404).json({ error: 'Student not found' });
        return res.status(200).json(summary);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

const getSafetyNotifications = async (req, res) => {
    try {
        const SafetyEvent = require('../models/safetyEventSchema');
        const Parent = require('../models/parentSchema');
        const { parent_id } = req.params;
        const parent = await Parent.findById(parent_id).lean();
        if (!parent) return res.status(404).json({ error: 'Parent not found' });

        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 40));
        const events = await SafetyEvent.find({ student: parent.student })
            .sort({ occurredAt: -1 })
            .limit(limit)
            .lean();

        const shaped = events.map((ev) => {
            const recip = (ev.recipients || []).find((r) => String(r.parentId) === String(parent._id));
            return {
                id: String(ev._id),
                eventId: ev.eventId,
                type: ev.type,
                category: ev.category,
                title: ev.title,
                body: ev.body,
                zoneName: ev.zoneName,
                confidence: ev.confidence,
                source: ev.source,
                distanceMeters: ev.distanceMeters,
                etaMinutes: ev.etaMinutes,
                critical: ev.critical,
                occurredAt: ev.occurredAt,
                read: recip ? Boolean(recip.read) : false,
                data: ev.data || {},
            };
        });

        return res.status(200).json({ notifications: shaped, count: shaped.length });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

const markSafetyNotificationRead = async (req, res) => {
    try {
        const SafetyEvent = require('../models/safetyEventSchema');
        const { parent_id, event_id } = req.params;
        const updated = await SafetyEvent.findOneAndUpdate(
            { _id: event_id, 'recipients.parentId': parent_id },
            { $set: { 'recipients.$.read': true, 'recipients.$.readAt': new Date() } },
            { new: true }
        );
        if (!updated) {
            // Still allow mark when parent was not listed (history for student)
            const Parent = require('../models/parentSchema');
            const parent = await Parent.findById(parent_id).lean();
            if (!parent) return res.status(404).json({ error: 'Not found' });
            const ev = await SafetyEvent.findOne({ _id: event_id, student: parent.student });
            if (!ev) return res.status(404).json({ error: 'Event not found' });
            const exists = (ev.recipients || []).some((r) => String(r.parentId) === String(parent_id));
            if (!exists) {
                ev.recipients.push({ parentId: parent_id, read: true, readAt: new Date() });
            } else {
                ev.recipients.forEach((r) => {
                    if (String(r.parentId) === String(parent_id)) {
                        r.read = true;
                        r.readAt = new Date();
                    }
                });
            }
            await ev.save();
            return res.status(200).json({ ok: true });
        }
        return res.status(200).json({ ok: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

const registerParentFcmToken = async (req, res) => {
    try {
        const Parent = require('../models/parentSchema');
        const { parent_id } = req.params;
        const { token, platform } = req.body || {};
        if (!token || typeof token !== 'string') {
            return res.status(400).json({ error: 'token is required' });
        }
        const parent = await Parent.findById(parent_id);
        if (!parent) return res.status(404).json({ error: 'Parent not found' });

        parent.fcmTokens = parent.fcmTokens || [];
        parent.fcmTokens = parent.fcmTokens.filter((t) => t.token !== token);
        parent.fcmTokens.push({
            token: String(token).trim(),
            platform: platform || 'android',
            updatedAt: new Date(),
        });
        // Cap tokens per parent
        if (parent.fcmTokens.length > 8) {
            parent.fcmTokens = parent.fcmTokens.slice(-8);
        }
        await parent.save();
        return res.status(200).json({ ok: true, tokenCount: parent.fcmTokens.length });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

const updateParentNotificationPrefs = async (req, res) => {
    try {
        const Parent = require('../models/parentSchema');
        const { parent_id } = req.params;
        const parent = await Parent.findById(parent_id);
        if (!parent) return res.status(404).json({ error: 'Parent not found' });

        const body = req.body || {};
        parent.notificationPrefs = parent.notificationPrefs || {};
        const allowed = [
            'arrivalDeparture', 'proximity', 'eta', 'routeDeviation', 'deviceHealth', 'dailySummary',
            'quietHoursEnabled', 'quietHoursStart', 'quietHoursEnd', 'proximityThresholdsM', 'etaThresholdsMin',
        ];
        for (const key of allowed) {
            if (body[key] !== undefined) parent.notificationPrefs[key] = body[key];
        }
        await parent.save();
        return res.status(200).json({ ok: true, notificationPrefs: parent.notificationPrefs });
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
    getDeviceHistory,
    getTrackingSummary,
    getSafetyNotifications,
    markSafetyNotificationRead,
    registerParentFcmToken,
    updateParentNotificationPrefs,
};
