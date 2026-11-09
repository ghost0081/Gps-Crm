/**
 * Persistent geofence state machine with hysteresis and confirmation samples.
 * Cell ID alone never confirms arrival. BLE/GPS require quality + dwell.
 */

const { haversineMeters, isValidCoordinate } = require('./location-normalize');

const ZoneState = {
  OUTSIDE: 'outside',
  APPROACHING: 'approaching',
  ENTRY_CANDIDATE: 'entry_candidate',
  INSIDE: 'inside',
  EXIT_CANDIDATE: 'exit_candidate',
  UNKNOWN: 'unknown',
};

const DEFAULTS = {
  approachFactor: 2.5, // approaching when within radius * factor
  entryConfirmSamples: 2,
  exitConfirmSamples: 2,
  entryDwellMs: 45 * 1000,
  exitDwellMs: 60 * 1000,
  hysteresisExtraM: 25, // must go this far outside radius to start exit
  maxAccuracyVsRadius: 1.25, // accuracy must not dwarf the fence
};

function zoneKey(zone) {
  const name = String(zone.name || 'Safe Zone').trim().toLowerCase();
  const lat = Number(zone.lat).toFixed(5);
  const lng = Number(zone.lng).toFixed(5);
  return `${name}|${lat}|${lng}`;
}

function emptyZoneState(zone) {
  return {
    key: zoneKey(zone),
    name: zone.name || 'Safe Zone',
    state: ZoneState.UNKNOWN,
    confirmCount: 0,
    candidateSince: null,
    lastDistanceM: null,
    lastTransitionAt: null,
    lastEventId: null,
    journeyId: null,
  };
}

/**
 * Advance one zone's state given a normalized observation.
 * Returns { state, events[] } where events are transition payloads to emit once.
 */
function advanceZoneState(prevState, zone, observation, options = {}) {
  const cfg = { ...DEFAULTS, ...options };
  const events = [];
  const next = { ...(prevState || emptyZoneState(zone)) };
  next.key = zoneKey(zone);
  next.name = zone.name || next.name || 'Safe Zone';

  if (!observation || !observation.accepted || !isValidCoordinate(observation.lat, observation.lng)) {
    next.state = ZoneState.UNKNOWN;
    return { state: next, events };
  }

  const radius = Math.max(5, Number(zone.radius) || 10);
  const dist = haversineMeters(observation.lat, observation.lng, zone.lat, zone.lng);
  next.lastDistanceM = Math.round(dist);

  const accuracy = Number(observation.accuracy) || 0;
  const qualityOkForConfirm = observation.usableForGeofenceConfirm
    && accuracy <= Math.max(radius * cfg.maxAccuracyVsRadius, radius + 40);

  // Cell ID / poor accuracy: approaching only, never confirm
  if (!qualityOkForConfirm) {
    if (dist <= radius * cfg.approachFactor) {
      if (next.state !== ZoneState.INSIDE && next.state !== ZoneState.ENTRY_CANDIDATE) {
        next.state = ZoneState.APPROACHING;
      }
    }
    return { state: next, events, reason: 'insufficient_confidence_for_confirm' };
  }

  const insideRadius = dist <= radius;
  const outsideHysteresis = dist > radius + cfg.hysteresisExtraM;
  const now = observation.deviceTimestamp instanceof Date
    ? observation.deviceTimestamp
    : new Date(observation.deviceTimestamp || Date.now());

  const ensureJourney = () => {
    if (!next.journeyId) {
      // Unique per visit so same-day re-entry can notify once per journey,
      // while retries of the same visit stay idempotent via eventId.
      next.journeyId = `${next.key}:${now.toISOString()}`;
    }
  };

  switch (next.state) {
    case ZoneState.UNKNOWN:
    case ZoneState.OUTSIDE:
      if (dist <= radius * cfg.approachFactor && !insideRadius) {
        next.state = ZoneState.APPROACHING;
        next.confirmCount = 0;
        next.candidateSince = null;
      } else if (insideRadius) {
        next.state = ZoneState.ENTRY_CANDIDATE;
        next.confirmCount = 1;
        next.candidateSince = now.toISOString();
      }
      break;

    case ZoneState.APPROACHING:
      if (insideRadius) {
        next.state = ZoneState.ENTRY_CANDIDATE;
        next.confirmCount = 1;
        next.candidateSince = now.toISOString();
      } else if (dist > radius * cfg.approachFactor) {
        next.state = ZoneState.OUTSIDE;
        next.confirmCount = 0;
        next.candidateSince = null;
        next.journeyId = null; // re-arm thresholds for a new approach
      }
      break;

    case ZoneState.ENTRY_CANDIDATE:
      if (!insideRadius) {
        next.state = dist <= radius * cfg.approachFactor ? ZoneState.APPROACHING : ZoneState.OUTSIDE;
        next.confirmCount = 0;
        next.candidateSince = null;
        break;
      }
      next.confirmCount = (next.confirmCount || 0) + 1;
      const sinceEntry = next.candidateSince ? new Date(next.candidateSince) : now;
      const dwellEntry = now.getTime() - sinceEntry.getTime();
      if (next.confirmCount >= cfg.entryConfirmSamples && dwellEntry >= cfg.entryDwellMs) {
        ensureJourney();
        next.state = ZoneState.INSIDE;
        next.lastTransitionAt = now.toISOString();
        const eventId = `arrive:${next.key}:${next.journeyId}`;
        if (next.lastEventId !== eventId) {
          next.lastEventId = eventId;
          events.push({
            type: 'zone_arrival_confirmed',
            eventId,
            zoneKey: next.key,
            zoneName: next.name,
            journeyId: next.journeyId,
            distanceMeters: next.lastDistanceM,
            source: observation.source,
            confidence: observation.confidence,
            at: now.toISOString(),
          });
        }
        next.confirmCount = 0;
        next.candidateSince = null;
      }
      break;

    case ZoneState.INSIDE:
      if (outsideHysteresis) {
        next.state = ZoneState.EXIT_CANDIDATE;
        next.confirmCount = 1;
        next.candidateSince = now.toISOString();
      }
      break;

    case ZoneState.EXIT_CANDIDATE:
      if (insideRadius) {
        next.state = ZoneState.INSIDE;
        next.confirmCount = 0;
        next.candidateSince = null;
        break;
      }
      if (!outsideHysteresis) break;
      next.confirmCount = (next.confirmCount || 0) + 1;
      const sinceExit = next.candidateSince ? new Date(next.candidateSince) : now;
      const dwellExit = now.getTime() - sinceExit.getTime();
      if (next.confirmCount >= cfg.exitConfirmSamples && dwellExit >= cfg.exitDwellMs) {
        ensureJourney();
        const eventId = `depart:${next.key}:${next.journeyId}:${now.toISOString().slice(0, 16)}`;
        next.state = ZoneState.OUTSIDE;
        next.lastTransitionAt = now.toISOString();
        next.journeyId = null; // new journey can re-arm proximity thresholds
        if (next.lastEventId !== eventId) {
          next.lastEventId = eventId;
          events.push({
            type: 'zone_departure_confirmed',
            eventId,
            zoneKey: next.key,
            zoneName: next.name,
            distanceMeters: next.lastDistanceM,
            source: observation.source,
            confidence: observation.confidence,
            at: now.toISOString(),
          });
        }
        next.confirmCount = 0;
        next.candidateSince = null;
      }
      break;

    default:
      next.state = ZoneState.UNKNOWN;
  }

  return { state: next, events };
}

/**
 * Process all zones for a student against one observation.
 * @param {object} trackingState - persisted { zones: { [key]: state } }
 */
function processGeofenceStates(trackingState, zones, observation, options = {}) {
  const bag = trackingState && typeof trackingState === 'object' ? { ...trackingState } : {};
  bag.zones = { ...(bag.zones || {}) };
  const allEvents = [];

  for (const zone of zones || []) {
    if (!zone || zone.enabled === false) continue;
    if (!isValidCoordinate(zone.lat, zone.lng)) continue;
    const key = zoneKey(zone);
    const prev = bag.zones[key] || emptyZoneState(zone);
    const { state, events } = advanceZoneState(prev, zone, observation, options);
    bag.zones[key] = state;
    if (events && events.length) allEvents.push(...events);
  }

  bag.updatedAt = new Date().toISOString();
  return { trackingState: bag, events: allEvents };
}

module.exports = {
  ZoneState,
  DEFAULTS,
  zoneKey,
  emptyZoneState,
  advanceZoneState,
  processGeofenceStates,
};
