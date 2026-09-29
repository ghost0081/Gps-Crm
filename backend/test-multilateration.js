const { estimatePosition } = require('./utils/multilateration');

const TRUE_LAT = 28.701500;
const TRUE_LON = 77.169000;
const METERS_PER_LAT = 111320;
const METERS_PER_LON = 111320 * Math.cos(TRUE_LAT * (Math.PI / 180));

// Helper: Given an offset in meters from the True Origin, generate a tower reading
function createTower(offsetX, offsetY, noise = 0, isOutlier = false) {
    const lat = TRUE_LAT + (offsetY / METERS_PER_LAT);
    const lon = TRUE_LON + (offsetX / METERS_PER_LON);
    let dist = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
    
    if (isOutlier) dist += 1000; // Inject a massive 1km error
    else dist += noise; // Inject subtle noise
    
    return { lat, lon, distance: dist };
}

// Distance between two geo-coordinates in meters (Haversine approximation for validation)
function geoDistance(lat1, lon1, lat2, lon2) {
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return 6371000 * c;
}

function runScenario(name, towers) {
    console.log(`\n--- Running Scenario: ${name} ---`);
    const result = estimatePosition(towers);
    
    if (!result) {
        console.log("Failed to estimate position.");
        return;
    }

    const posError = geoDistance(TRUE_LAT, TRUE_LON, result.lat, result.lon);
    
    console.log(`Expected : ${TRUE_LAT}, ${TRUE_LON}`);
    console.log(`Computed : ${result.lat.toFixed(6)}, ${result.lon.toFixed(6)}`);
    console.log(`Pos Error: ${posError.toFixed(2)} meters`);
    console.log(`Accuracy : ${result.accuracyRadiusMeters} meters (RMS)`);
    console.log(`Towers   : ${result.towersUsed} used, ${result.towersRejected} rejected`);
    
    if (posError < 5) console.log("âœ… TEST PASSED");
    else console.log("âŒ TEST FAILED (Error too high)");
}

// ============================================
// SCENARIO 1: 3 Towers Exact (Perfect Intersection)
// ============================================
const towers3Exact = [
    createTower(0, 100),    // 100m North
    createTower(86, -50),   // Bottom Right
    createTower(-86, -50),  // Bottom Left
];
runScenario("3 Towers Exact", towers3Exact);


// ============================================
// SCENARIO 2: 5 Towers Exact
// ============================================
const towers5Exact = [
    createTower(0, 100),
    createTower(100, 0),
    createTower(0, -100),
    createTower(-100, 0),
    createTower(70, 70)
];
runScenario("5 Towers Exact", towers5Exact);


// ============================================
// SCENARIO 3: 5 Towers with +/- 5m Noise
// ============================================
const towers5Noise = [
    createTower(0, 100, 5),   // Overestimated distance by 5m
    createTower(100, 0, -3),  // Underestimated distance by 3m
    createTower(0, -100, 2),  
    createTower(-100, 0, -4),
    createTower(70, 70, 1)
];
runScenario("5 Towers with Noise", towers5Noise);


// ============================================
// SCENARIO 4: 5 Towers with One Massive Outlier
// ============================================
const towers5Outlier = [
    createTower(0, 100, 2),
    createTower(100, 0, -1),
    createTower(0, -100, 3),
    createTower(-100, 0, 0, true), // OUTLIER: +1000m error injected
    createTower(70, 70, 1)
];
runScenario("5 Towers with One Outlier", towers5Outlier);
