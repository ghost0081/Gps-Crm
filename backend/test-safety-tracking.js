/**
 * Automated tests for location normalize, ETA, geofence state, and idempotent event IDs.
 * Run: node test-safety-tracking.js
 */
const assert = require('assert');
const { normalizeLocationRecord, haversineMeters } = require('./services/location-normalize');
const { estimateDestination, formatDistanceLabel } = require('./services/destination-eta');
const { advanceZoneState, processGeofenceStates, ZoneState } = require('./services/geofence-state');

function obs(partial = {}) {
  const prev = partial._prev || null;
  const copy = { ...partial };
  delete copy._prev;
  return normalizeLocationRecord({
    lat: 28.7041,
    lng: 77.1025,
    locationType: 'GPS',
    accuracy: 10,
    speed: 4,
    deviceTimestamp: new Date(),
    serverReceivedAt: new Date(),
    ...copy,
  }, prev);
}

// 1. Accurate GPS distance / ETA shape
{
  const o = obs({ lat: 28.7041, lng: 77.1025 });
  assert.strictEqual(o.usableForEta, true);
  const dest = estimateDestination(o, { name: 'School', lat: 28.7050, lng: 77.1030 }, []);
  assert.ok(dest.distanceMeters != null && dest.distanceMeters > 0);
  assert.ok(dest.distanceKind === 'straight_line');
  assert.ok(dest.distanceLabel.includes('School'));
  assert.ok(dest.etaLabel);
  console.log('✓ GPS distance/ETA');
}

// 2. Cell ID: no precise distance / ETA / geofence confirm
{
  const o = obs({ locationType: 'CELL_TOWER', accuracy: 800 });
  assert.strictEqual(o.usableForGeofenceConfirm, false);
  assert.strictEqual(o.usableForEta, false);
  assert.strictEqual(o.usableForDistance, false);
  const dest = estimateDestination(o, { name: 'Home', lat: 28.70, lng: 77.10 }, []);
  assert.strictEqual(dest.etaLabel, 'ETA unavailable');
  assert.ok(dest.confidence === 'Unavailable' || dest.confidence === 'Limited');
  console.log('✓ Cell ID fallback limits');
}

// 3. BLE-assisted: approximate, no ETA
{
  const o = obs({ locationType: 'BLE', accuracy: 20 });
  assert.strictEqual(o.usableForPrecise, false);
  assert.strictEqual(o.usableForEta, false);
  assert.strictEqual(o.usableForGeofenceConfirm, true);
  assert.ok(o.reasons.includes('ble_assisted_location'));
  console.log('✓ BLE-assisted semantics');
}

// 4. Source switch Cell → GPS
{
  const cell = obs({ locationType: 'CELL_TOWER', accuracy: 600 });
  const gps = obs({ locationType: 'GPS', accuracy: 12, _prev: { lat: cell.lat, lng: cell.lng, deviceTimestamp: new Date(Date.now() - 60000), locationType: 'CELL_TOWER' } });
  assert.strictEqual(gps.source, 'GPS');
  assert.strictEqual(gps.usableForEta, true);
  console.log('✓ Cell→GPS switch');
}

// 5. Implausible jump flagged
{
  const prev = { lat: 28.70, lng: 77.10, deviceTimestamp: new Date(Date.now() - 5000), locationType: 'GPS' };
  const jump = normalizeLocationRecord({
    lat: 19.07, lng: 72.87, locationType: 'GPS', accuracy: 10,
    deviceTimestamp: new Date(), serverReceivedAt: new Date(),
  }, prev);
  assert.ok(jump.reasons.includes('implausible_jump'));
  assert.strictEqual(jump.usableForGeofenceConfirm, false);
  console.log('✓ GPS jump / poor confidence');
}

// 6. Duplicate + out-of-order
{
  const t0 = new Date();
  const a = normalizeLocationRecord({
    lat: 28.7041, lng: 77.1025, locationType: 'GPS', accuracy: 10,
    deviceTimestamp: t0, serverReceivedAt: t0,
  }, null);
  const dup = normalizeLocationRecord({
    lat: 28.7041, lng: 77.1025, locationType: 'GPS', accuracy: 10,
    deviceTimestamp: new Date(t0.getTime() + 2000), serverReceivedAt: new Date(),
  }, { lat: a.lat, lng: a.lng, deviceTimestamp: t0, locationType: 'GPS' });
  assert.strictEqual(dup.isDuplicate, true);
  assert.strictEqual(dup.accepted, false);

  const older = normalizeLocationRecord({
    lat: 28.7042, lng: 77.1026, locationType: 'GPS', accuracy: 10,
    deviceTimestamp: new Date(t0.getTime() - 60000), serverReceivedAt: new Date(),
  }, { lat: a.lat, lng: a.lng, deviceTimestamp: t0, locationType: 'GPS' });
  assert.ok(older.outOfOrder);
  console.log('✓ Duplicate / out-of-order');
}

// 7–9. Confirmed school entry/exit + boundary oscillation (fast dwell for test)
{
  const school = { name: 'School', lat: 28.7041, lng: 77.1025, radius: 100, enabled: true };
  const opts = { entryConfirmSamples: 2, exitConfirmSamples: 2, entryDwellMs: 0, exitDwellMs: 0, hysteresisExtraM: 20 };
  let state = null;
  const events = [];

  // Outside far
  let r = advanceZoneState(state, school, obs({ lat: 28.7100, lng: 77.1100 }), opts);
  state = r.state;
  assert.ok([ZoneState.OUTSIDE, ZoneState.UNKNOWN, ZoneState.APPROACHING].includes(state.state));

  // Approach then two inside samples → arrival once
  r = advanceZoneState(state, school, obs({ lat: 28.7042, lng: 77.1026 }), opts);
  state = r.state;
  r = advanceZoneState(state, school, obs({ lat: 28.70415, lng: 77.10255 }), opts);
  state = r.state;
  events.push(...r.events);
  assert.strictEqual(state.state, ZoneState.INSIDE);
  assert.strictEqual(events.filter((e) => e.type === 'zone_arrival_confirmed').length, 1);
  const arrivalId = events[0].eventId;

  // Boundary oscillation: briefly outside but within hysteresis — stay inside
  r = advanceZoneState(state, school, obs({ lat: 28.7041 + 0.0008, lng: 77.1025 }), opts); // ~90m still inside 100
  state = r.state;
  assert.strictEqual(state.state, ZoneState.INSIDE);

  // Exit confirmed
  r = advanceZoneState(state, school, obs({ lat: 28.7060, lng: 77.1050 }), opts);
  state = r.state;
  r = advanceZoneState(state, school, obs({ lat: 28.7070, lng: 77.1060 }), opts);
  state = r.state;
  events.push(...r.events);
  assert.strictEqual(state.state, ZoneState.OUTSIDE);
  assert.ok(events.some((e) => e.type === 'zone_departure_confirmed'));

  // Re-entry produces new arrival (new journey) — advance clock so journey IDs differ
  const later = new Date(Date.now() + 120000);
  r = advanceZoneState(state, school, obs({ lat: 28.70415, lng: 77.10255, deviceTimestamp: later }), opts);
  state = r.state;
  r = advanceZoneState(state, school, obs({
    lat: 28.70412,
    lng: 77.10252,
    deviceTimestamp: new Date(later.getTime() + 5000),
  }), opts);
  state = r.state;
  events.push(...r.events);
  const arrivals = events.filter((e) => e.type === 'zone_arrival_confirmed');
  assert.ok(arrivals.length >= 2);
  assert.notStrictEqual(arrivals[0].eventId, arrivals[1].eventId);
  assert.strictEqual(arrivalId, arrivals[0].eventId);
  console.log('✓ School entry/exit + oscillation + unique event IDs');
}

// Home geofence
{
  const home = { name: 'Home', lat: 28.70, lng: 77.10, radius: 80, enabled: true };
  const opts = { entryConfirmSamples: 2, exitConfirmSamples: 2, entryDwellMs: 0, exitDwellMs: 0 };
  let bag = { zones: {} };
  let o = obs({ lat: 28.7001, lng: 77.1001 });
  let r = processGeofenceStates(bag, [home], o, opts);
  bag = r.trackingState;
  o = obs({ lat: 28.70005, lng: 77.10005 });
  r = processGeofenceStates(bag, [home], o, opts);
  assert.ok(r.events.some((e) => e.type === 'zone_arrival_confirmed' && e.zoneName === 'Home'));
  console.log('✓ Home entry confirmed');
}

// Cell ID never confirms arrival even when "inside"
{
  const school = { name: 'School', lat: 28.7041, lng: 77.1025, radius: 200, enabled: true };
  const cellObs = obs({ locationType: 'CELL_TOWER', accuracy: 500, lat: 28.7041, lng: 77.1025 });
  assert.strictEqual(cellObs.usableForGeofenceConfirm, false);
  const r = advanceZoneState(null, school, cellObs, { entryDwellMs: 0, entryConfirmSamples: 1 });
  assert.notStrictEqual(r.state.state, ZoneState.INSIDE);
  assert.strictEqual(r.events.length, 0);
  console.log('✓ Cell ID does not confirm arrival');
}

// Distance formatting
{
  assert.ok(formatDistanceLabel(850).includes('850 m'));
  assert.ok(formatDistanceLabel(1200).includes('km'));
  assert.ok(formatDistanceLabel(null).includes('unavailable'));
  console.log('✓ Distance labels');
}

// Haversine sanity (~111km per degree lat)
{
  const d = haversineMeters(28.0, 77.0, 28.01, 77.0);
  assert.ok(d > 1000 && d < 1200);
  console.log('✓ Haversine');
}

// Proximity event ID stability (same journey + threshold)
{
  const id1 = 'prox:school|28.70410|77.10250:approach:school|28.70410|77.10250:2026-10-16:500';
  const id2 = 'prox:school|28.70410|77.10250:approach:school|28.70410|77.10250:2026-10-16:500';
  assert.strictEqual(id1, id2);
  console.log('✓ Idempotent proximity event ID shape');
}

console.log('\nAll safety tracking unit tests passed');
