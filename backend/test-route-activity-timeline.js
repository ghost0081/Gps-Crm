const { buildActivityTimeline, formatDuration } = require('./services/route-activity-timeline');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

const base = Date.parse('2026-10-13T10:00:00.000Z');
const points = [];

// Stationary at Rohini with GPS jitter / duplicate samples
for (let i = 0; i < 8; i += 1) {
    points.push({
        lat: 28.7376 + (i % 2 === 0 ? 0 : 0.00001),
        lng: 77.1299,
        timestamp: new Date(base + i * 60 * 1000).toISOString(),
        locationType: 'GPS',
        accuracy: 12,
        cellLocation: 'Rohini Stop'
    });
}
// Extra near-duplicates that previously littered the timeline
points.push({
    lat: 28.7376,
    lng: 77.1299,
    timestamp: new Date(base + 3 * 60 * 1000 + 5000).toISOString(),
    locationType: 'GPS',
    accuracy: 10,
    cellLocation: 'Rohini Stop'
});

// Continuous movement
for (let i = 0; i < 6; i += 1) {
    points.push({
        lat: 28.7376 + (i + 1) * 0.002,
        lng: 77.1299 + (i + 1) * 0.001,
        timestamp: new Date(base + (8 + i) * 60 * 1000).toISOString(),
        locationType: 'GPS',
        accuracy: 10
    });
}

// Stationary at school
for (let i = 0; i < 5; i += 1) {
    points.push({
        lat: 28.7500,
        lng: 77.1360,
        timestamp: new Date(base + (14 + i) * 60 * 1000).toISOString(),
        locationType: 'GPS',
        accuracy: 10,
        cellLocation: 'School Gate'
    });
}

// Return visit to Rohini later (must remain a separate stop)
for (let i = 0; i < 4; i += 1) {
    points.push({
        lat: 28.7376,
        lng: 77.1299,
        timestamp: new Date(base + (25 + i) * 60 * 1000).toISOString(),
        locationType: 'GPS',
        accuracy: 10,
        cellLocation: 'Rohini Stop'
    });
}

const geofences = [{
    name: 'Home',
    lat: 28.7376,
    lng: 77.1299,
    radius: 80,
    enabled: true
}];

const timeline = buildActivityTimeline(points, geofences);
assert(timeline.summary.stopCount >= 2, 'expected at least 2 stops');
assert(timeline.summary.moveCount >= 1, 'expected at least 1 move');
assert(timeline.summary.zoneVisitCount >= 1, 'expected a home zone visit');
assert(timeline.events.some((event) => event.type === 'arrive'), 'expected arrive events');
assert(timeline.events.some((event) => event.type === 'stop'), 'expected stop events');
assert(timeline.events.some((event) => event.type === 'zone_enter'), 'expected zone enter');
assert(formatDuration(120000) === '2m 0s', 'duration format failed');

assert(Array.isArray(timeline.journey) && timeline.journey.length > 0, 'expected journey timeline');
const journeyStops = timeline.journey.filter((j) => j.type === 'start' || j.type === 'stop' || j.type === 'destination');
assert(journeyStops.length >= 2, 'expected multiple journey stop visits');
// Journey should be much cleaner than legacy arrive+stop+depart triples
assert(timeline.journey.length < timeline.events.length, 'journey should be cleaner than legacy events');

const rohiniVisits = journeyStops.filter((j) => String(j.placeLabel).includes('Rohini'));
assert(rohiniVisits.length >= 2, 'returning to same place must create separate journey visits');

for (const stop of journeyStops) {
    assert(stop.arrivalTime, 'stop must have arrivalTime');
    assert(typeof stop.durationMs === 'number' && stop.durationMs >= 0, 'stop duration required');
    if (!stop.stillHere) {
        assert(stop.departureTime, 'completed stop must have departureTime');
    }
}

// Analysis should collapse jitter (fewer analysis points than raw)
assert(
    timeline.summary.analysisPointCount < timeline.summary.pointCount,
    'jitter collapse should reduce analysis point count'
);

console.log('route activity timeline tests passed', {
    rawPoints: timeline.summary.pointCount,
    analysisPoints: timeline.summary.analysisPointCount,
    stops: timeline.summary.stopCount,
    moves: timeline.summary.moveCount,
    zones: timeline.summary.zoneVisitCount,
    events: timeline.events.length,
    journey: timeline.journey.length,
    journeyStops: journeyStops.length
});
