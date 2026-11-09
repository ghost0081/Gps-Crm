/**
 * Post-ingestion safety pipeline: normalize → geofence state → proximity/ETA events → optional FCM.
 * Designed to run after Mongo live update without blocking device ACK (fire-and-forget).
 */

const TrackerData = require('../models/trackerSchema');
const Student = require('../models/studentSchema');
const Parent = require('../models/parentSchema');
const SafetyEvent = require('../models/safetyEventSchema');
const { normalizeLocationRecord } = require('./location-normalize');
const { processGeofenceStates, zoneKey } = require('./geofence-state');
const { estimateDestination } = require('./destination-eta');
const { sendToTokens, fcmStatus } = require('./fcm-dispatch');

const DEFAULT_PROXIMITY_M = [1000, 500, 300];
const DEFAULT_ETA_MIN = [15, 10, 5];

function collectZones(student) {
  const zones = [];
  if (student.geofences && Array.isArray(student.geofences)) {
    for (const gf of student.geofences) {
      if (gf && gf.enabled !== false && gf.lat && gf.lng) zones.push(gf);
    }
  }
  if (zones.length === 0 && student.geofence && student.geofence.enabled && student.geofence.lat && student.geofence.lng) {
    zones.push(student.geofence);
  }
  return zones;
}

function classifyZoneName(name) {
  const n = String(name || '').toLowerCase();
  if (n.includes('school') || n.includes('campus')) return 'school';
  if (n.includes('home') || n.includes('house')) return 'home';
  return 'safe_zone';
}

function titleForEvent(type, zoneName, kind) {
  if (type === 'zone_arrival_confirmed') {
    if (kind === 'school') return 'School arrival confirmed';
    if (kind === 'home') return 'Home arrival confirmed';
    return `Arrived at ${zoneName}`;
  }
  if (type === 'zone_departure_confirmed') {
    if (kind === 'school') return 'School departure confirmed';
    if (kind === 'home') return 'Home departure confirmed';
    return `Left ${zoneName}`;
  }
  if (type === 'proximity_threshold') return `${zoneName} approaching`;
  if (type === 'eta_threshold') return `${zoneName} approaching`;
  return 'Safety update';
}

function bodyForEvent(type, payload) {
  if (type === 'zone_arrival_confirmed') {
    return `Your child has arrived at ${payload.zoneName}. Source: ${payload.source || 'unknown'}.`;
  }
  if (type === 'zone_departure_confirmed') {
    return `Your child has left ${payload.zoneName}. Source: ${payload.source || 'unknown'}.`;
  }
  if (type === 'proximity_threshold') {
    const dist = payload.distanceMeters != null ? `approximately ${payload.distanceMeters >= 1000 ? `${(payload.distanceMeters / 1000).toFixed(1)} km` : `${payload.distanceMeters} m`} from ${payload.zoneName}` : `approaching ${payload.zoneName}`;
    const eta = payload.etaLabel && payload.etaLabel !== 'ETA unavailable' ? ` Estimated arrival: ${payload.etaLabel}.` : '';
    return `Your child is ${dist}.${eta}`;
  }
  if (type === 'eta_threshold') {
    return `Your child is approaching ${payload.zoneName}. Estimated arrival: ${payload.etaLabel || 'soon'}.`;
  }
  return payload.message || 'Tracking update';
}

function prefsAllow(prefs, category, critical) {
  if (critical) return true;
  const p = prefs || {};
  if (category === 'arrival_departure') return p.arrivalDeparture !== false;
  if (category === 'proximity') return p.proximity !== false;
  if (category === 'eta') return p.eta !== false;
  if (category === 'route') return p.routeDeviation !== false;
  if (category === 'device') return p.deviceHealth !== false;
  return true;
}

function inQuietHours(prefs, critical) {
  if (critical || !prefs || !prefs.quietHoursEnabled) return false;
  // Best-effort IST quiet hours
  try {
    const now = new Date();
    const ist = new Date(now.getTime() + 330 * 60 * 1000);
    const hhmm = ist.toISOString().slice(11, 16);
    const start = prefs.quietHoursStart || '22:00';
    const end = prefs.quietHoursEnd || '06:00';
    if (start <= end) return hhmm >= start && hhmm < end;
    return hhmm >= start || hhmm < end;
  } catch (_) {
    return false;
  }
}

async function recordAndNotify({
  eventId, type, category, imei, student, schoolId, zoneKey, zoneName, journeyId,
  title, body, confidence, source, distanceMeters, etaMinutes, thresholdMeters, data, critical,
}) {
  try {
    await SafetyEvent.create({
      eventId,
      type,
      category,
      imei,
      student: student._id,
      school: schoolId,
      zoneKey,
      zoneName,
      journeyId,
      title,
      body,
      confidence,
      source,
      distanceMeters,
      etaMinutes,
      thresholdMeters,
      data: data || {},
      critical: Boolean(critical),
      recipients: [],
      delivery: { attempted: false },
      occurredAt: new Date(),
    });
  } catch (e) {
    if (e && (e.code === 11000 || String(e.message || '').includes('duplicate'))) {
      return { duplicate: true };
    }
    console.error('[safety-event] create failed:', e.message);
    return { error: e.message };
  }

  const parents = await Parent.find({ student: student._id, school: schoolId }).lean();
  const recipientIds = [];
  const tokens = [];
  for (const parent of parents) {
    const prefs = parent.notificationPrefs || {};
    if (!prefsAllow(prefs, category, critical)) continue;
    if (inQuietHours(prefs, critical)) continue;
    recipientIds.push({ parentId: parent._id, read: false });
    for (const t of parent.fcmTokens || []) {
      if (t && t.token) tokens.push(t.token);
    }
  }

  await SafetyEvent.updateOne({ eventId }, { $set: { recipients: recipientIds } });

  const delivery = await sendToTokens(tokens, {
    title,
    body,
    data: {
      type,
      eventId,
      studentId: String(student._id),
      zoneName: zoneName || '',
      deepLink: `student/${student._id}/tracking`,
    },
    androidChannelId: critical ? 'safety_critical' : 'safety_alerts',
  });

  await SafetyEvent.updateOne({ eventId }, {
    $set: {
      delivery: {
        attempted: true,
        sent: delivery.sent || 0,
        failed: delivery.failed || 0,
        skipped: Boolean(delivery.skipped),
        reason: delivery.reason || '',
        at: new Date(),
      },
    },
  });

  // Cleanup invalid tokens
  if (delivery.invalidTokens && delivery.invalidTokens.length) {
    await Parent.updateMany(
      { student: student._id },
      { $pull: { fcmTokens: { token: { $in: delivery.invalidTokens } } } }
    );
  }

  return { duplicate: false, delivery };
}

function proximityThresholdsForParents(parents) {
  const set = new Set();
  for (const p of parents) {
    const list = (p.notificationPrefs && p.notificationPrefs.proximityThresholdsM) || DEFAULT_PROXIMITY_M;
    for (const m of list) {
      const n = Number(m);
      if (Number.isFinite(n) && n > 0) set.add(n);
    }
  }
  if (set.size === 0) DEFAULT_PROXIMITY_M.forEach((m) => set.add(m));
  return [...set].sort((a, b) => b - a);
}

function etaThresholdsForParents(parents) {
  const set = new Set();
  for (const p of parents) {
    const list = (p.notificationPrefs && p.notificationPrefs.etaThresholdsMin) || DEFAULT_ETA_MIN;
    for (const m of list) {
      const n = Number(m);
      if (Number.isFinite(n) && n > 0) set.add(n);
    }
  }
  if (set.size === 0) DEFAULT_ETA_MIN.forEach((m) => set.add(m));
  return [...set].sort((a, b) => b - a);
}

/**
 * Main entry: process one live location after it was written to TrackerData.
 */
async function processLiveLocationUpdate({
  imei,
  lat,
  lng,
  locationType,
  accuracy,
  speed,
  course,
  battery,
  deviceTimestamp,
  serverReceivedAt,
}) {
  const imeiStr = String(imei);
  const student = await Student.findOne({
    $or: [{ imei: imeiStr }, { 'trackers.imei': imeiStr }],
  });
  if (!student) return { skipped: true, reason: 'no_student' };

  const tracker = await TrackerData.findOne({ imei: imeiStr });
  if (!tracker) return { skipped: true, reason: 'no_tracker' };

  const prevObs = (tracker.recentObservations || []).slice(-1)[0] || null;
  const previous = prevObs
    ? {
      lat: prevObs.lat,
      lng: prevObs.lng,
      deviceTimestamp: prevObs.deviceTimestamp,
      locationType: prevObs.locationType,
      source: prevObs.locationType,
    }
    : (tracker.lastReliableLocation
      ? {
        lat: tracker.lastReliableLocation.lat,
        lng: tracker.lastReliableLocation.lng,
        deviceTimestamp: tracker.lastReliableLocation.timestamp,
        locationType: tracker.lastReliableLocation.locationType,
      }
      : null);

  const observation = normalizeLocationRecord({
    imei: imeiStr,
    studentId: student._id,
    lat,
    lng,
    locationType,
    accuracy,
    speed,
    course,
    battery,
    deviceTimestamp: deviceTimestamp || tracker.last_updated,
    serverReceivedAt: serverReceivedAt || new Date(),
  }, previous);

  // Persist quality on latest path point is best-effort; pipeline focuses on state
  const recent = [...(tracker.recentObservations || [])];
  if (observation.accepted && observation.lat != null) {
    recent.push({
      lat: observation.lat,
      lng: observation.lng,
      deviceTimestamp: observation.deviceTimestamp,
      locationType: observation.source,
      accuracy: observation.accuracy,
      speed: observation.speed,
      usableForEta: observation.usableForEta,
      usableForDistance: observation.usableForDistance,
      usableForGeofenceConfirm: observation.usableForGeofenceConfirm,
      confidence: observation.confidence,
    });
    while (recent.length > 24) recent.shift();
  }

  let lastReliable = tracker.lastReliableLocation || null;
  if (observation.accepted && observation.usableForPrecise) {
    lastReliable = {
      lat: observation.lat,
      lng: observation.lng,
      timestamp: observation.deviceTimestamp,
      locationType: observation.source,
      accuracy: observation.accuracy,
      confidence: observation.confidence,
    };
  } else if (observation.accepted && observation.usableForGeofenceConfirm && !lastReliable) {
    lastReliable = {
      lat: observation.lat,
      lng: observation.lng,
      timestamp: observation.deviceTimestamp,
      locationType: observation.source,
      accuracy: observation.accuracy,
      confidence: observation.confidence,
    };
  }

  const zones = collectZones(student);
  const { trackingState, events: geoEvents } = processGeofenceStates(
    tracker.trackingState || { zones: {} },
    zones,
    observation
  );

  trackingState.proximity = trackingState.proximity || {};
  trackingState.lastObservation = {
    source: observation.source,
    confidence: observation.confidence,
    trackingStatus: observation.trackingStatus,
    quality: observation.quality,
    reasons: observation.reasons,
    at: observation.deviceTimestamp,
  };

  const parents = await Parent.find({ student: student._id, school: student.school }).lean();
  const proxThresholds = proximityThresholdsForParents(parents);
  const etaThresholds = etaThresholdsForParents(parents);

  const emitted = [];

  // Confirmed geofence transitions
  for (const ev of geoEvents) {
    const kind = classifyZoneName(ev.zoneName);
    const title = titleForEvent(ev.type, ev.zoneName, kind);
    const body = bodyForEvent(ev.type, ev);
    const result = await recordAndNotify({
      eventId: ev.eventId,
      type: ev.type,
      category: 'arrival_departure',
      imei: imeiStr,
      student,
      schoolId: student.school,
      zoneKey: ev.zoneKey,
      zoneName: ev.zoneName,
      journeyId: ev.journeyId,
      title,
      body,
      confidence: ev.confidence,
      source: ev.source,
      distanceMeters: ev.distanceMeters,
      critical: kind === 'school' && ev.type === 'zone_departure_confirmed',
      data: { kind },
    });
    emitted.push({ ...ev, result });
  }

  // Proximity + ETA thresholds (GPS/BLE distance only; never Cell ID precise)
  if (observation.accepted && observation.usableForDistance && !observation.isDuplicate) {
    for (const zone of zones) {
      const key = zoneKey(zone);
      const est = estimateDestination(observation, zone, recent);
      const zoneState = (trackingState.zones && trackingState.zones[key]) || {};
      const journeyId = zoneState.journeyId || `approach:${key}:${new Date().toISOString().slice(0, 10)}`;
      const arms = trackingState.proximity[key] || { firedDistance: [], firedEta: [], journeyId: null };

      // Re-arm when journey changes (after confirmed departure cleared journeyId)
      if (arms.journeyId && zoneState.journeyId == null && zoneState.state === 'outside') {
        arms.firedDistance = [];
        arms.firedEta = [];
        arms.journeyId = null;
      }
      if (!arms.journeyId) arms.journeyId = journeyId;

      if (est.distanceMeters != null && observation.confidence !== 'Unavailable') {
        for (const thr of proxThresholds) {
          // 100m only when precise GPS quality
          if (thr <= 100 && !observation.usableForPrecise) continue;
          if (est.distanceMeters <= thr && !arms.firedDistance.includes(thr)) {
            // Only while approaching / outside — not after confirmed inside
            if (zoneState.state === 'inside') continue;
            const eventId = `prox:${key}:${arms.journeyId}:${thr}`;
            const kind = classifyZoneName(zone.name);
            const payload = {
              zoneName: zone.name || 'Safe Zone',
              distanceMeters: est.distanceMeters,
              etaLabel: est.etaLabel,
              source: observation.source,
            };
            const result = await recordAndNotify({
              eventId,
              type: 'proximity_threshold',
              category: 'proximity',
              imei: imeiStr,
              student,
              schoolId: student.school,
              zoneKey: key,
              zoneName: zone.name,
              journeyId: arms.journeyId,
              title: titleForEvent('proximity_threshold', zone.name || 'Destination', kind),
              body: bodyForEvent('proximity_threshold', payload),
              confidence: est.confidence,
              source: observation.source,
              distanceMeters: est.distanceMeters,
              thresholdMeters: thr,
              etaMinutes: est.etaMinutes,
              data: { thresholdMeters: thr, kind },
            });
            if (!result.duplicate) {
              arms.firedDistance.push(thr);
              emitted.push({ type: 'proximity_threshold', thresholdMeters: thr, result });
            }
          }
        }
      }

      if (est.etaMinutes != null && est.confidence !== 'Unavailable' && observation.usableForEta) {
        for (const thr of etaThresholds) {
          if (est.etaMinutesHigh != null && est.etaMinutesHigh <= thr && !arms.firedEta.includes(thr)) {
            if (zoneState.state === 'inside') continue;
            const eventId = `eta:${key}:${arms.journeyId}:${thr}`;
            const kind = classifyZoneName(zone.name);
            const payload = {
              zoneName: zone.name || 'Safe Zone',
              etaLabel: est.etaLabel,
              source: observation.source,
            };
            const result = await recordAndNotify({
              eventId,
              type: 'eta_threshold',
              category: 'eta',
              imei: imeiStr,
              student,
              schoolId: student.school,
              zoneKey: key,
              zoneName: zone.name,
              journeyId: arms.journeyId,
              title: titleForEvent('eta_threshold', zone.name || 'Destination', kind),
              body: bodyForEvent('eta_threshold', payload),
              confidence: est.confidence,
              source: observation.source,
              distanceMeters: est.distanceMeters,
              etaMinutes: est.etaMinutes,
              thresholdMeters: thr,
              data: { thresholdMinutes: thr, kind },
            });
            if (!result.duplicate) {
              arms.firedEta.push(thr);
              emitted.push({ type: 'eta_threshold', thresholdMinutes: thr, result });
            }
          }
        }
      }

      trackingState.proximity[key] = arms;
    }
  }

  await TrackerData.updateOne(
    { imei: imeiStr },
    {
      $set: {
        recentObservations: recent,
        lastReliableLocation: lastReliable,
        trackingState,
      },
    }
  );

  return {
    observation,
    events: emitted,
    fcm: fcmStatus(),
    zones: zones.length,
  };
}

/**
 * Build parent-facing tracking summary for UI card.
 */
async function buildTrackingSummary(studentId, imeiHint) {
  const student = await Student.findById(studentId).lean();
  if (!student) return null;

  let imei = imeiHint || student.imei;
  if (!imeiHint && student.trackers && student.trackers.length) {
    const primary = student.trackers.find((t) => t.isPrimary) || student.trackers[0];
    imei = primary.imei;
  }
  const tracker = imei ? await TrackerData.findOne({ imei: String(imei) }).lean() : null;
  const zones = collectZones(student);

  const lastObs = tracker && tracker.recentObservations && tracker.recentObservations.length
    ? tracker.recentObservations[tracker.recentObservations.length - 1]
    : null;

  const observation = lastObs
    ? normalizeLocationRecord({
      lat: lastObs.lat,
      lng: lastObs.lng,
      locationType: lastObs.locationType,
      accuracy: lastObs.accuracy,
      speed: lastObs.speed,
      deviceTimestamp: lastObs.deviceTimestamp,
      serverReceivedAt: tracker.last_updated,
    }, null)
    : normalizeLocationRecord({
      lat: tracker?.latitude,
      lng: tracker?.longitude,
      locationType: tracker?.locationType,
      accuracy: tracker?.accuracy,
      speed: tracker?.speed,
      deviceTimestamp: tracker?.last_updated,
      serverReceivedAt: new Date(),
    }, null);

  // Prefer last reliable for display when current is cell-only coarse
  let displayObs = observation;
  if ((!observation.usableForDistance || observation.source === 'CELL_TOWER')
    && tracker?.lastReliableLocation?.lat) {
    const reliable = normalizeLocationRecord({
      lat: tracker.lastReliableLocation.lat,
      lng: tracker.lastReliableLocation.lng,
      locationType: tracker.lastReliableLocation.locationType,
      accuracy: tracker.lastReliableLocation.accuracy,
      deviceTimestamp: tracker.lastReliableLocation.timestamp,
      serverReceivedAt: new Date(),
    }, null);
    // Mark as stale if older than live cell receipt
    if (reliable.accepted) {
      displayObs = {
        ...reliable,
        trackingStatus: observation.source === 'CELL_TOWER' ? 'Approximate' : reliable.trackingStatus,
        reasons: [...(reliable.reasons || []), 'displaying_last_reliable'],
      };
    }
  }

  const recent = tracker?.recentObservations || [];
  const destinations = zones.map((z) => estimateDestination(displayObs, z, recent));

  // Pick primary destination: first school-named, else first zone, else null
  let primary = destinations.find((d) => /school|campus/i.test(d.name)) || destinations[0] || null;

  return {
    imei: imei ? String(imei) : null,
    studentId: String(student._id),
    studentName: student.name,
    observation: {
      lat: displayObs.lat,
      lng: displayObs.lng,
      source: displayObs.source,
      locationType: displayObs.locationType,
      accuracy: displayObs.accuracy,
      confidence: displayObs.confidence,
      trackingStatus: displayObs.trackingStatus,
      lastUpdated: displayObs.deviceTimestamp,
      reasons: displayObs.reasons,
      liveSource: observation.source,
      liveConfidence: observation.confidence,
    },
    lastReliable: tracker?.lastReliableLocation || null,
    destination: primary,
    destinations,
    trackingState: tracker?.trackingState || null,
    deviceStatus: tracker?.status || 'Unknown',
    battery: tracker?.battery,
    fcm: fcmStatus(),
  };
}

module.exports = {
  processLiveLocationUpdate,
  buildTrackingSummary,
  collectZones,
  fcmStatus,
};
