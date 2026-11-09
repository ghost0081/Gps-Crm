const assert = require('assert');
const { isGpsFix, combineKnownTowers, selectLivePosition } = require('./services/live-position');

assert.strictEqual(isGpsFix(0, 0, 'A'), false, '0,0 is not a GPS fix');
assert.strictEqual(isGpsFix(28.7, 77.2, 'V'), false, 'explicit invalid GPS status is not a fix');
assert.strictEqual(isGpsFix(28.7, 77.2, 'A'), true, 'a real coordinate with a valid status is GPS');
assert.strictEqual(isGpsFix(28.7, 77.2, '1'), true, 'numeric valid status keeps GPS');

const gps = selectLivePosition({
    gpsLatitude: 28.707731,
    gpsLongitude: 77.20816,
    gpsStatus: 'A',
    cell: { latitude: 28.71, longitude: 77.21, accuracy: 500 }
});
assert.strictEqual(gps.locationType, 'GPS');
assert.strictEqual(gps.placed, true);
assert.strictEqual(gps.lat, 28.707731);

const cell = selectLivePosition({
    gpsLatitude: 0,
    gpsLongitude: 0,
    gpsStatus: '0',
    cell: { latitude: 28.7061053, longitude: 77.2180213, accuracy: 500 }
});
assert.strictEqual(cell.locationType, 'CELL_TOWER');
assert.strictEqual(cell.placed, true);
assert.strictEqual(cell.lat, 28.7061053);
assert.strictEqual(cell.accuracy, 500);

const unresolved = selectLivePosition({
    gpsLatitude: 0,
    gpsLongitude: 0,
    gpsStatus: '1',
    cell: { latitude: 0, longitude: 0, accuracy: 0, cellId: 119175181 }
});
assert.strictEqual(unresolved.placed, false);
assert.strictEqual(unresolved.clearLive, true);
assert.strictEqual(unresolved.lat, 0);
assert.strictEqual(unresolved.locationType, 'CELL_TOWER');

const blocked = selectLivePosition({
    gpsLatitude: 0,
    gpsLongitude: 0,
    cell: { latitude: 28.7, longitude: 77.2, accuracy: 400 },
    blockCell: true
});
assert.strictEqual(blocked.placed, false);
assert.strictEqual(blocked.clearLive, false);

const single = combineKnownTowers([
    { latitude: 28.7061053, longitude: 77.2180213, accuracy: 500, signalStrength: 20 }
]);
assert.strictEqual(single.resolvedCount, 1);
assert.strictEqual(single.accuracy, 500);

const combined = combineKnownTowers([
    { latitude: 28.706, longitude: 77.218, accuracy: 200, signalStrength: 20 },
    { latitude: 28.707, longitude: 77.219, accuracy: 200, signalStrength: 19 }
]);
assert.strictEqual(combined.resolvedCount, 2);
assert.ok(combined.latitude > 28.706 && combined.latitude < 28.7066);
assert.ok(combined.accuracy >= 200 && combined.accuracy < 500);

const weakNeighbor = combineKnownTowers([
    { latitude: 28.7061053, longitude: 77.2180213, accuracy: 500, signalStrength: 22 },
    { latitude: 28.7054327, longitude: 77.1870947, accuracy: 500, signalStrength: 1 }
]);
assert.ok(Math.abs(weakNeighbor.latitude - 28.7061053) < 0.001, 'a faint tower must not pull the estimate');
assert.ok(Math.abs(weakNeighbor.longitude - 77.2180213) < 0.001);
assert.strictEqual(weakNeighbor.accuracy, 500, 'the circle stays at the strong tower, not the gap between them');

const none = combineKnownTowers([
    { latitude: 0, longitude: 0, cellId: 1 }
]);
assert.strictEqual(none, null);

console.log('live position tests passed');
