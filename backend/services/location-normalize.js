/**
 * Shared location validation / normalization for GPS, BLE-assisted, and Cell ID.
 * Does not invent coordinates. Marks uncertain records instead of dropping safety events.
 */

const EARTH_RADIUS_M = 6371000;
const DEFAULTS = {
  maxGpsAccuracyM: 80,
  maxBleAccuracyM: 50,
  maxCellAccuracyM: 2500,
  maxPlausibleSpeedKmh: 160,
  maxJumpMeters: 25000,
  duplicateWindowMs: 8000,
  duplicateDistanceM: 8,
  staleLiveMs: 10 * 60 * 1000,
  maxClockSkewMs: 6 * 60 * 60 * 1000,
};

function haversineMeters(lat1, lng1, lat2, lng2) {
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLng = (lng2 - lng1) * toRad;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isValidCoordinate(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
  if (Math.abs(lat) < 0.000001 && Math.abs(lng) < 0.000001) return false;
  return true;
}

function normalizeSource(raw) {
  const s = String(raw || '').toUpperCase();
  if (s === 'GPS' || s === 'SATELLITE') return 'GPS';
  if (s === 'BLE' || s === 'BLE_BEACON' || s === 'BLE-ASSISTED') return 'BLE';
  if (s === 'CELL_TOWER' || s === 'CELL' || s === 'LBS' || s === 'CELL_ID') return 'CELL_TOWER';
  return s || 'UNKNOWN';
}

function parseTimestamp(value, fallback = null) {
  if (value == null || value === '') return fallback;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return d;
}

/**
 * Validate and normalize one incoming location observation.
 * @param {object} input
 * @param {object|null} previous - last accepted observation for this device
 * @param {object} [options]
 */
function normalizeLocationRecord(input, previous = null, options = {}) {
  const cfg = { ...DEFAULTS, ...options };
  const serverReceivedAt = parseTimestamp(input.serverReceivedAt, new Date()) || new Date();
  const deviceAt = parseTimestamp(input.deviceTimestamp || input.timestamp, serverReceivedAt);
  const source = normalizeSource(input.locationType || input.source);
  const reasons = [];
  let quality = 'ok';
  let accepted = true;
  let usableForPrecise = false;
  let usableForGeofenceConfirm = false;
  let usableForDistance = false;
  let usableForEta = false;

  const lat = Number(input.lat ?? input.latitude);
  const lng = Number(input.lng ?? input.longitude);
  const hasCoords = isValidCoordinate(lat, lng);

  if (!hasCoords) {
    accepted = false;
    quality = 'rejected';
    reasons.push('missing_or_invalid_coordinates');
  }

  let accuracy = Number(input.accuracy);
  if (!Number.isFinite(accuracy) || accuracy <= 0) {
    if (source === 'GPS') accuracy = 10;
    else if (source === 'BLE') accuracy = 25;
    else if (source === 'CELL_TOWER') accuracy = 800;
    else accuracy = 0;
    if (hasCoords) reasons.push('accuracy_defaulted');
  }

  // Clock skew: device far in future / past relative to server
  const skewMs = Math.abs(deviceAt.getTime() - serverReceivedAt.getTime());
  const clockUnreliable = skewMs > cfg.maxClockSkewMs;
  if (clockUnreliable) {
    reasons.push('device_clock_skew');
    quality = quality === 'rejected' ? quality : 'suspicious';
  }

  const offlineBacklog = Boolean(input.offlineBacklog)
    || (serverReceivedAt.getTime() - deviceAt.getTime() > 2 * 60 * 1000 && !clockUnreliable);
  if (offlineBacklog) reasons.push('delayed_or_offline_upload');

  // Duplicate detection against previous accepted point
  let isDuplicate = false;
  if (accepted && previous && isValidCoordinate(previous.lat, previous.lng)) {
    const prevTs = parseTimestamp(previous.deviceTimestamp || previous.timestamp);
    if (prevTs) {
      const dt = Math.abs(deviceAt.getTime() - prevTs.getTime());
      const dist = haversineMeters(lat, lng, previous.lat, previous.lng);
      const sameSource = normalizeSource(previous.locationType || previous.source) === source;
      if (sameSource && dt <= cfg.duplicateWindowMs && dist <= cfg.duplicateDistanceM) {
        isDuplicate = true;
        accepted = false;
        quality = 'rejected';
        reasons.push('duplicate_record');
      }
    }
  }

  // Out-of-order: keep for history but flag; prefer server order for live state if clock unreliable
  let outOfOrder = false;
  if (accepted && previous) {
    const prevTs = parseTimestamp(previous.deviceTimestamp || previous.timestamp);
    if (prevTs && !clockUnreliable && deviceAt.getTime() + 2000 < prevTs.getTime()) {
      outOfOrder = true;
      reasons.push('out_of_order_timestamp');
      quality = 'suspicious';
    }
  }

  let implausibleJump = false;

  // Implausible jump / speed (flags applied after source rules below)
  if (accepted && previous && isValidCoordinate(previous.lat, previous.lng)) {
    const prevTs = parseTimestamp(previous.deviceTimestamp || previous.timestamp, previous.serverReceivedAt);
    if (prevTs) {
      const dtMs = Math.max(1, deviceAt.getTime() - prevTs.getTime());
      const dist = haversineMeters(lat, lng, previous.lat, previous.lng);
      const speedKmh = (dist / 1000) / (dtMs / 3600000);
      if (dist > cfg.maxJumpMeters && speedKmh > cfg.maxPlausibleSpeedKmh) {
        implausibleJump = true;
        reasons.push('implausible_jump');
        quality = 'suspicious';
      }
      const reportedSpeed = Number(input.speed);
      if (Number.isFinite(reportedSpeed) && reportedSpeed > cfg.maxPlausibleSpeedKmh) {
        reasons.push('implausible_reported_speed');
        quality = quality === 'rejected' ? quality : 'suspicious';
      }
    }
  }

  // Source-specific usability
  if (accepted && hasCoords) {
    if (source === 'GPS') {
      usableForPrecise = accuracy <= cfg.maxGpsAccuracyM;
      usableForGeofenceConfirm = accuracy <= Math.max(cfg.maxGpsAccuracyM, 120);
      usableForDistance = accuracy <= 150;
      usableForEta = accuracy <= cfg.maxGpsAccuracyM;
      if (accuracy > cfg.maxGpsAccuracyM) {
        reasons.push('gps_accuracy_limited');
        quality = quality === 'ok' ? 'limited' : quality;
      }
    } else if (source === 'BLE') {
      // Phone-assisted BLE: proximity-quality, not meter-perfect tag GPS
      usableForPrecise = false;
      usableForGeofenceConfirm = accuracy <= cfg.maxBleAccuracyM;
      usableForDistance = accuracy <= 80;
      usableForEta = false; // BLE alone is not reliable for ETA
      reasons.push('ble_assisted_location');
      quality = quality === 'ok' ? 'approximate' : quality;
    } else if (source === 'CELL_TOWER') {
      usableForPrecise = false;
      usableForGeofenceConfirm = false; // never confirm arrival from Cell ID alone
      usableForDistance = false; // do not show precise meter distance from uncalibrated cell
      usableForEta = false;
      reasons.push('cell_id_coarse_only');
      quality = quality === 'ok' ? 'limited' : quality;
      if (accuracy > cfg.maxCellAccuracyM) {
        reasons.push('cell_accuracy_very_coarse');
      }
    } else {
      usableForPrecise = false;
      usableForGeofenceConfirm = false;
      usableForDistance = false;
      usableForEta = false;
      reasons.push('unknown_source');
      quality = 'limited';
    }
  }

  // Jump overrides: keep the point for audit, never confirm geofence / ETA from it
  if (implausibleJump) {
    usableForGeofenceConfirm = false;
    usableForEta = false;
    usableForPrecise = false;
    if (source !== 'GPS') usableForDistance = false;
  }

  const ageMs = Math.max(0, Date.now() - (clockUnreliable ? serverReceivedAt.getTime() : deviceAt.getTime()));
  const stale = ageMs > cfg.staleLiveMs;
  if (stale) {
    reasons.push('stale_location');
    if (quality === 'ok') quality = 'stale';
    usableForEta = false;
  }

  const confidence = !accepted
    ? 'Unavailable'
    : usableForPrecise
      ? 'Reliable'
      : usableForDistance || source === 'BLE'
        ? 'Approximate'
        : source === 'CELL_TOWER'
          ? 'Limited'
          : quality === 'suspicious'
            ? 'Limited'
            : 'Unavailable';

  const trackingStatus = !accepted
    ? 'Temporarily Unavailable'
    : stale
      ? 'Stale'
      : source === 'CELL_TOWER' || confidence === 'Limited'
        ? 'Approximate'
        : 'Live';

  return {
    accepted,
    isDuplicate,
    outOfOrder,
    offlineBacklog,
    clockUnreliable,
    quality,
    confidence,
    trackingStatus,
    reasons,
    source,
    lat: hasCoords ? lat : null,
    lng: hasCoords ? lng : null,
    accuracy,
    speed: Number.isFinite(Number(input.speed)) ? Number(input.speed) : null,
    heading: Number.isFinite(Number(input.course ?? input.heading)) ? Number(input.course ?? input.heading) : null,
    battery: Number.isFinite(Number(input.battery)) ? Number(input.battery) : null,
    deviceTimestamp: deviceAt,
    serverReceivedAt,
    locationType: source,
    usableForPrecise,
    usableForGeofenceConfirm,
    usableForDistance,
    usableForEta,
    imei: input.imei != null ? String(input.imei) : null,
    studentId: input.studentId || null,
  };
}

module.exports = {
  DEFAULTS,
  haversineMeters,
  isValidCoordinate,
  normalizeSource,
  normalizeLocationRecord,
};
