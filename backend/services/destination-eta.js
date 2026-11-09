/**
 * Confidence-aware straight-line distance and ETA.
 * Never labels haversine as road distance. No fabricated routing.
 */

const { haversineMeters, isValidCoordinate } = require('./location-normalize');

const CONFIDENCE = {
  RELIABLE: 'Reliable',
  APPROXIMATE: 'Approximate',
  LIMITED: 'Limited',
  UNAVAILABLE: 'Unavailable',
};

function roundDistanceMeters(meters, accuracyM = 0) {
  if (!Number.isFinite(meters) || meters < 0) return null;
  const step = accuracyM >= 200 ? 100 : accuracyM >= 50 ? 50 : meters >= 1000 ? 50 : 10;
  return Math.round(meters / step) * step;
}

function formatDistanceLabel(meters) {
  if (meters == null) return 'Distance unavailable — location accuracy is insufficient';
  if (meters >= 1000) {
    const km = meters / 1000;
    const rounded = km >= 10 ? Math.round(km) : Math.round(km * 10) / 10;
    return `approximately ${rounded} km away`;
  }
  return `approximately ${meters} m away`;
}

/**
 * Estimate ETA from recent valid movement samples toward a destination.
 * Uses recent GPS/BLE samples only; Cell ID does not produce ETA.
 */
function estimateDestination(observation, destination, recentSamples = [], options = {}) {
  const name = destination?.name || 'Destination';
  const destLat = Number(destination?.lat);
  const destLng = Number(destination?.lng);

  if (!observation || !observation.usableForDistance || !isValidCoordinate(observation.lat, observation.lng)) {
    return {
      name,
      distanceMeters: null,
      distanceLabel: formatDistanceLabel(null),
      distanceKind: 'unavailable',
      etaMinutes: null,
      etaMinutesLow: null,
      etaMinutesHigh: null,
      etaLabel: 'ETA unavailable',
      arrivalWindowLabel: null,
      confidence: CONFIDENCE.UNAVAILABLE,
      source: observation?.source || observation?.locationType || null,
      lastUpdated: observation?.deviceTimestamp || null,
      reason: observation?.reasons?.join(',') || 'insufficient_location',
    };
  }

  if (!isValidCoordinate(destLat, destLng)) {
    return {
      name,
      distanceMeters: null,
      distanceLabel: 'Distance unavailable — destination not configured',
      distanceKind: 'unavailable',
      etaMinutes: null,
      etaMinutesLow: null,
      etaMinutesHigh: null,
      etaLabel: 'ETA unavailable',
      arrivalWindowLabel: null,
      confidence: CONFIDENCE.UNAVAILABLE,
      source: observation.source,
      lastUpdated: observation.deviceTimestamp,
      reason: 'destination_missing',
    };
  }

  const rawDist = haversineMeters(observation.lat, observation.lng, destLat, destLng);
  const rounded = roundDistanceMeters(rawDist, observation.accuracy || 0);
  const distanceLabel = `${name}: ${formatDistanceLabel(rounded)}`;

  let confidence = observation.confidence || CONFIDENCE.APPROXIMATE;
  if (observation.source === 'CELL_TOWER' || !observation.usableForEta) {
    return {
      name,
      distanceMeters: observation.usableForDistance ? rounded : null,
      distanceLabel: observation.usableForDistance ? distanceLabel : formatDistanceLabel(null),
      distanceKind: 'straight_line',
      etaMinutes: null,
      etaMinutesLow: null,
      etaMinutesHigh: null,
      etaLabel: 'ETA unavailable',
      arrivalWindowLabel: null,
      confidence: observation.usableForDistance ? CONFIDENCE.LIMITED : CONFIDENCE.UNAVAILABLE,
      source: observation.source,
      lastUpdated: observation.deviceTimestamp,
      reason: observation.usableForEta === false ? 'source_or_accuracy_insufficient_for_eta' : 'ok',
    };
  }

  // Approach speed from recent valid samples (toward destination)
  const samples = (recentSamples || [])
    .filter((s) => s && s.usableForEta && isValidCoordinate(s.lat, s.lng))
    .slice(-8);

  let approachMps = null;
  if (samples.length >= 2) {
    const first = samples[0];
    const last = samples[samples.length - 1];
    const dt = (new Date(last.deviceTimestamp).getTime() - new Date(first.deviceTimestamp).getTime()) / 1000;
    if (dt > 15) {
      const dFirst = haversineMeters(first.lat, first.lng, destLat, destLng);
      const dLast = haversineMeters(last.lat, last.lng, destLat, destLng);
      const closed = dFirst - dLast;
      if (closed > 20) {
        approachMps = closed / dt;
      } else if (closed < -30) {
        // Moving away
        return {
          name,
          distanceMeters: rounded,
          distanceLabel,
          distanceKind: 'straight_line',
          etaMinutes: null,
          etaMinutesLow: null,
          etaMinutesHigh: null,
          etaLabel: 'ETA unavailable',
          arrivalWindowLabel: null,
          confidence: CONFIDENCE.LIMITED,
          source: observation.source,
          lastUpdated: observation.deviceTimestamp,
          reason: 'moving_away_from_destination',
        };
      }
    }
  }

  const reportedSpeedKmh = Number(observation.speed);
  if ((!approachMps || approachMps < 0.3) && Number.isFinite(reportedSpeedKmh) && reportedSpeedKmh >= 2) {
    approachMps = (reportedSpeedKmh * 1000) / 3600;
  }

  // Conservative walking/vehicle range when moving but speed unknown
  const minWalkMps = options.minWalkMps || 0.7; // ~2.5 km/h
  const maxWalkMps = options.maxWalkMps || 1.6; // ~5.8 km/h
  const minDriveMps = options.minDriveMps || 4; // ~14 km/h urban
  const maxDriveMps = options.maxDriveMps || 12; // ~43 km/h

  let etaLow = null;
  let etaHigh = null;
  let etaReason = 'insufficient_movement';

  if (rounded != null && rounded <= 30) {
    return {
      name,
      distanceMeters: rounded,
      distanceLabel,
      distanceKind: 'straight_line',
      etaMinutes: 0,
      etaMinutesLow: 0,
      etaMinutesHigh: 1,
      etaLabel: 'at or near destination',
      arrivalWindowLabel: null,
      confidence: observation.usableForPrecise ? CONFIDENCE.RELIABLE : CONFIDENCE.APPROXIMATE,
      source: observation.source,
      lastUpdated: observation.deviceTimestamp,
      reason: 'near_destination',
    };
  }

  if (approachMps && approachMps >= 0.4) {
    const seconds = rounded / approachMps;
    const pad = Math.max(60, seconds * 0.25);
    etaLow = Math.max(1, Math.round((seconds - pad) / 60));
    etaHigh = Math.max(etaLow + 1, Math.round((seconds + pad) / 60));
    etaReason = 'recent_approach_speed';
    confidence = observation.usableForPrecise ? CONFIDENCE.RELIABLE : CONFIDENCE.APPROXIMATE;
  } else if (observation.usableForPrecise && rounded != null) {
    // Conservative range only — do not guarantee
    const useDrive = rounded > 800;
    const lo = rounded / (useDrive ? maxDriveMps : maxWalkMps);
    const hi = rounded / (useDrive ? minDriveMps : minWalkMps);
    etaLow = Math.max(1, Math.round(lo / 60));
    etaHigh = Math.max(etaLow + 1, Math.round(hi / 60));
    etaReason = 'conservative_speed_range';
    confidence = CONFIDENCE.APPROXIMATE;
  }

  if (etaLow == null) {
    return {
      name,
      distanceMeters: rounded,
      distanceLabel,
      distanceKind: 'straight_line',
      etaMinutes: null,
      etaMinutesLow: null,
      etaMinutesHigh: null,
      etaLabel: 'ETA unavailable',
      arrivalWindowLabel: null,
      confidence: CONFIDENCE.LIMITED,
      source: observation.source,
      lastUpdated: observation.deviceTimestamp,
      reason: etaReason,
    };
  }

  const mid = Math.round((etaLow + etaHigh) / 2);
  const now = observation.deviceTimestamp instanceof Date
    ? observation.deviceTimestamp
    : new Date(observation.deviceTimestamp || Date.now());
  const arriveLow = new Date(now.getTime() + etaLow * 60000);
  const arriveHigh = new Date(now.getTime() + etaHigh * 60000);
  const fmt = (d) => {
    try {
      return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
    } catch (_) {
      return d.toISOString();
    }
  };

  return {
    name,
    distanceMeters: rounded,
    distanceLabel,
    distanceKind: 'straight_line',
    etaMinutes: mid,
    etaMinutesLow: etaLow,
    etaMinutesHigh: etaHigh,
    etaLabel: etaLow === etaHigh ? `approximately ${etaLow} minutes` : `${etaLow}–${etaHigh} minutes`,
    arrivalWindowLabel: `${fmt(arriveLow)}–${fmt(arriveHigh)}`,
    confidence,
    source: observation.source,
    lastUpdated: observation.deviceTimestamp,
    reason: etaReason,
  };
}

function assessDestinations(observation, zones = [], recentSamples = []) {
  return (zones || [])
    .filter((z) => z && z.enabled !== false && isValidCoordinate(z.lat, z.lng))
    .map((z) => estimateDestination(observation, z, recentSamples));
}

module.exports = {
  CONFIDENCE,
  roundDistanceMeters,
  formatDistanceLabel,
  estimateDestination,
  assessDestinations,
};
