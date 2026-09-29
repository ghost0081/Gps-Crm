/**
 * Least-Squares Multilateration positioning logic.
 * Solves overdetermined systems (N > 3 towers) using Gauss-Newton refinement.
 */

// Inverts a 2x2 matrix
function invert2x2(m) {
    const det = m[0][0] * m[1][1] - m[0][1] * m[1][0];
    if (Math.abs(det) < 1e-9) return null; // Singular matrix fallback
    return [
        [m[1][1] / det, -m[0][1] / det],
        [-m[1][0] / det, m[0][0] / det]
    ];
}

// Fallback method when matrices are singular or towers < 3
function weightedCentroid(towers) {
    let sumW = 0, sumX = 0, sumY = 0;
    for (const t of towers) {
        // Weight by 1/d^2 so closer towers have exponentially more gravity
        const w = 1 / Math.pow(Math.max(t.d, 1), 2);
        sumW += w;
        sumX += w * t.x;
        sumY += w * t.y;
    }
    return { x: sumX / sumW, y: sumY / sumW };
}

// Core solver: Linearization + Gauss-Newton Refinement
function solveSystem(towers) {
    const N = towers.length;
    if (N < 3) return weightedCentroid(towers);

    // --- 1. Linearization (A*x = b) ---
    // Subtract the last tower's equation from the rest to cancel squared terms
    const ref = towers[N - 1];
    let AtWA = [[0, 0], [0, 0]];
    let AtWb = [0, 0];

    for (let i = 0; i < N - 1; i++) {
        const t = towers[i];
        const A0 = 2 * (ref.x - t.x);
        const A1 = 2 * (ref.y - t.y);
        const b = Math.pow(t.d, 2) - Math.pow(ref.d, 2)
                - Math.pow(t.x, 2) - Math.pow(t.y, 2)
                + Math.pow(ref.x, 2) + Math.pow(ref.y, 2);
        
        const w = 1 / Math.pow(Math.max(t.d, 1), 2);

        AtWA[0][0] += A0 * w * A0;
        AtWA[0][1] += A0 * w * A1;
        AtWA[1][0] += A1 * w * A0;
        AtWA[1][1] += A1 * w * A1;

        AtWb[0] += A0 * w * b;
        AtWb[1] += A1 * w * b;
    }

    const inv = invert2x2(AtWA);
    let estX = 0, estY = 0;
    
    if (!inv) {
        // If exact geometric intersection fails / singular, fall back to centroid
        const centroid = weightedCentroid(towers);
        estX = centroid.x; estY = centroid.y;
    } else {
        estX = inv[0][0] * AtWb[0] + inv[0][1] * AtWb[1];
        estY = inv[1][0] * AtWb[0] + inv[1][1] * AtWb[1];
    }

    // --- 2. Gauss-Newton Iterations ---
    // Refines the initial guess by minimizing nonlinear residuals
    for (let iter = 0; iter < 10; iter++) {
        let JtWJ = [[0, 0], [0, 0]];
        let JtWf = [0, 0];

        for (const t of towers) {
            const dx = estX - t.x;
            const dy = estY - t.y;
            let r = Math.sqrt(dx * dx + dy * dy);
            if (r < 1e-6) r = 1e-6;

            const f = r - t.d; // Actual computed distance minus given distance
            const J0 = dx / r;
            const J1 = dy / r;
            const w = 1 / Math.pow(Math.max(t.d, 1), 2);

            JtWJ[0][0] += J0 * w * J0;
            JtWJ[0][1] += J0 * w * J1;
            JtWJ[1][0] += J1 * w * J0;
            JtWJ[1][1] += J1 * w * J1;

            JtWf[0] += J0 * w * f;
            JtWf[1] += J1 * w * f;
        }

        const invJ = invert2x2(JtWJ);
        if (!invJ) break; // Reached a local minimum or singular Jacobian

        const deltaX = -(invJ[0][0] * JtWf[0] + invJ[0][1] * JtWf[1]);
        const deltaY = -(invJ[1][0] * JtWf[0] + invJ[1][1] * JtWf[1]);

        estX += deltaX;
        estY += deltaY;

        // Converged
        if (Math.abs(deltaX) < 0.05 && Math.abs(deltaY) < 0.05) break;
    }

    return { x: estX, y: estY };
}

/**
 * Main estimatePosition exported entrypoint.
 * Accepts N towers: { lat, lon, distance, signalStrength }
 */
function estimatePosition(inputTowers) {
    // 1. Validation & Data Sanitization
    const validTowers = [];
    for (const it of inputTowers) {
        if (isNaN(it.lat) || isNaN(it.lon) || it.lat === 0 || it.lon === 0) continue;
        
        let d = it.distance;
        if (d === undefined || isNaN(d)) {
            if (it.signalStrength !== undefined && !isNaN(it.signalStrength)) {
                // Generic fallback: map signal strength to approx distance
                const sig = Math.abs(it.signalStrength);
                d = Math.pow(10, (sig - 30) / 20); 
            } else {
                continue; // Stale / bad
            }
        }
        if (d < 0) d = Math.abs(d); // Reject negative, use absolute
        
        validTowers.push({ lat: it.lat, lon: it.lon, d: d, orig: it });
    }

    if (validTowers.length === 0) return null;

    // 2. Local Flat Plane Projection
    // Use the first valid tower as the origin point for the Cartesian plane
    const origin = validTowers[0];
    const metersPerLat = 111320; 
    const metersPerLon = 111320 * Math.cos(origin.lat * (Math.PI / 180));

    for (const t of validTowers) {
        t.x = (t.lon - origin.lon) * metersPerLon;
        t.y = (t.lat - origin.lat) * metersPerLat;
    }

    let activeTowers = [...validTowers];
    let rejected = 0;
    let finalX = 0, finalY = 0;

    // 3. Outlier Rejection Loop
    while (activeTowers.length >= 3) {
        const res = solveSystem(activeTowers);
        finalX = res.x;
        finalY = res.y;

        const residuals = activeTowers.map(t => {
            const computedDist = Math.sqrt(Math.pow(finalX - t.x, 2) + Math.pow(finalY - t.y, 2));
            return { t, error: Math.abs(computedDist - t.d) };
        });

        residuals.sort((a, b) => a.error - b.error);
        const medianError = residuals[Math.floor(residuals.length / 2)].error;
        const worst = residuals[residuals.length - 1];

        // Drop the worst tower if its error is significantly worse than median and > 20m threshold
        if (worst.error > Math.max(20, 2 * medianError) && activeTowers.length > 3) {
            activeTowers = activeTowers.filter(t => t !== worst.t);
            rejected++;
        } else {
            break; // No outliers found, system is stable
        }
    }

    // 4. Graceful Fallback if dropped below 3 towers
    if (activeTowers.length < 3) {
        const res = solveSystem(activeTowers); // Will trigger weighted centroid
        finalX = res.x;
        finalY = res.y;
    }

    // 5. Calculate Final RMS Accuracy
    let sumSq = 0;
    for (const t of activeTowers) {
        const dist = Math.sqrt(Math.pow(finalX - t.x, 2) + Math.pow(finalY - t.y, 2));
        sumSq += Math.pow(dist - t.d, 2);
    }
    let rms = activeTowers.length > 0 ? Math.sqrt(sumSq / activeTowers.length) : 9999;
    
    // Confidence penalty for utilizing < 3 towers
    if (activeTowers.length < 3) rms += 500; 

    // 6. Reverse Projection to Global Coordinates
    const finalLat = origin.lat + (finalY / metersPerLat);
    const finalLon = origin.lon + (finalX / metersPerLon);

    return {
        lat: finalLat,
        lon: finalLon,
        accuracyRadiusMeters: parseFloat(rms.toFixed(2)),
        towersUsed: activeTowers.length,
        towersRejected: rejected
    };
}

module.exports = { estimatePosition };
