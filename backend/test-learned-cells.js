const assert = require('assert');
const { absorbSample, learnSamples, MIN_ACCURACY_METERS } = require('./services/learned-cells');

const first = absorbSample(null, 30.45855, 78.0721);
assert.strictEqual(first.samples, 1);
assert.strictEqual(first.accuracy, MIN_ACCURACY_METERS);
assert.strictEqual(first.latitude, 30.45855);

const second = absorbSample(first, 30.45867, 78.07211);
assert.strictEqual(second.samples, 2);
assert.ok(second.accuracy >= MIN_ACCURACY_METERS);
assert.ok(Math.abs(second.latitude - 30.4586) < 0.001);

const far = absorbSample(second, 28.58, 77.14);
assert.strictEqual(far.samples, 2, 'a Delhi reading must not move a cell already learned in the hills');
assert.ok(far.latitude > 30);

const learned = learnSamples([
    { mcc: 404, mnc: 56, lac: 60560, cellId: 106169120, latitude: 30.45855, longitude: 78.0721 },
    { mcc: 404, mnc: 56, lac: 60560, cellId: 106169120, latitude: 30.45868, longitude: 78.07211 },
    { mcc: 404, mnc: 10, lac: 524, cellId: 30447, latitude: 0, longitude: 0 }
]);
assert.strictEqual(learned.size, 1);
assert.strictEqual(learned.get('404:56:60560:106169120').samples, 2);

console.log('learned cell tests passed');
