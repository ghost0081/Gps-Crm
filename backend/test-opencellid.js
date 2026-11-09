const assert = require('assert');
const { parseOpenCellIdBody } = require('./services/lbs-service');

const found = parseOpenCellIdBody(200, JSON.stringify({
    lat: 28.70,
    lon: 77.21,
    range: 500,
    samples: 4,
    radio: 'LTE',
    mcc: 404,
    mnc: 11,
    lac: 52576,
    cellid: 119175181
}));
assert.strictEqual(found.found, true);
assert.strictEqual(found.latitude, 28.7);
assert.strictEqual(found.longitude, 77.21);
assert.strictEqual(found.accuracy, 1100, 'a two-decimal India coordinate keeps the 1.1 km radius');
assert.strictEqual(found.radio, 'LTE');

const precise = parseOpenCellIdBody(200, JSON.stringify({
    lat: 28.7061053,
    lon: 77.2180213,
    range: 400,
    radio: 'LTE'
}));
assert.strictEqual(precise.found, true);
assert.strictEqual(precise.accuracy, 400);

const missing = parseOpenCellIdBody(200, '{"error":"Cell not found","code":1}');
assert.strictEqual(missing.found, false);
assert.strictEqual(missing.reason, 'not-found');
assert.strictEqual(missing.error, undefined);

const rejected = parseOpenCellIdBody(401, '{"error":"API Key not known: secret","code":2}');
assert.strictEqual(rejected.found, false);
assert.strictEqual(rejected.reason, 'invalid-key');
assert.strictEqual(JSON.stringify(rejected).includes('secret'), false);

const zero = parseOpenCellIdBody(200, '{"lat":0,"lon":0,"range":100}');
assert.strictEqual(zero.found, false);

const { parseMylnikovBody, parseMccMncBody, lookupPublicCell } = require('./services/lbs-service');
const mylnikov = parseMylnikovBody(200, JSON.stringify({
    result: 200,
    data: { lat: 30.458, lon: 78.075, range: 600 }
}));
assert.strictEqual(mylnikov.found, true);
assert.strictEqual(mylnikov.latitude, 30.458);
assert.strictEqual(mylnikov.source, 'mylnikov');
const mylnikovMiss = parseMylnikovBody(200, '{"result":404,"data":{}}');
assert.strictEqual(mylnikovMiss.found, false);
assert.strictEqual(mylnikovMiss.reason, 'not-found');

const mccHit = parseMccMncBody(200, JSON.stringify({
    data: [{ lat: 31.104, lon: 77.173, range: 900, radio: 'LTE' }]
}));
assert.strictEqual(mccHit.found, true);
assert.strictEqual(mccHit.longitude, 77.173);
const mccMiss = parseMccMncBody(200, '{"data":[]}');
assert.strictEqual(mccMiss.found, false);

lookupPublicCell({ mcc: 404, mnc: 0, lac: 1, cellId: 1 }).then((missingNetwork) => {
    assert.strictEqual(missingNetwork.reason, 'missing-network');
    console.log('opencellid parser tests passed');
}).catch((err) => {
    console.error(err);
    process.exit(1);
});
