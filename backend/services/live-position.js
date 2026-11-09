function isValidCoordinate(latitude, longitude) {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
    if (Math.abs(lat) < 0.000001 && Math.abs(lng) < 0.000001) return false;
    return true;
}

function isGpsFix(latitude, longitude, gpsStatus) {
    if (!isValidCoordinate(latitude, longitude)) return false;
    const flag = String(gpsStatus ?? '').trim().toLowerCase();
    return !['0', 'v', 'false', 'invalid', 'nofix', 'no fix', 'none'].includes(flag);
}

function distanceMeters(lat1, lng1, lat2, lng2) {
    const toRad = Math.PI / 180;
    const dLat = (lat2 - lat1) * toRad;
    const dLng = (lng2 - lng1) * toRad;
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLng / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Turn a tower reading into a weight. Higher signal pulls the estimate harder.
 * Readings from 1 to 31 are GSM CSQ (about 2 dBm each). Negative readings are dBm.
 * A missing reading stays neutral so it does not pretend to be a weak tower.
 */
function signalWeight(signalStrength) {
    const signal = Number(signalStrength);
    if (!Number.isFinite(signal) || signal === 0) return 1;
    if (signal < 0) return Math.pow(10, signal / 10);
    if (signal <= 31) return Math.pow(10, (-113 + (2 * signal)) / 10);
    return Math.max(1, signal);
}

/**
 * Combine tower records the device actually reported and the index resolved.
 * The center is weighted by signal strength. A tower more than about 13 dB
 * weaker than the strongest one is left out of the radius, so a faint neighbor
 * does not stretch the circle across every tower.
 */
function combineKnownTowers(towers) {
    const known = (towers || []).filter((tower) => isValidCoordinate(tower.latitude, tower.longitude));
    if (known.length === 0) return null;

    if (known.length === 1) {
        const tower = known[0];
        const accuracy = Number(tower.accuracy);
        return {
            latitude: Number(tower.latitude),
            longitude: Number(tower.longitude),
            accuracy: Number.isFinite(accuracy) && accuracy > 0 ? accuracy : 0,
            resolvedCount: 1
        };
    }

    const weights = known.map((tower) => signalWeight(tower.signalStrength));
    let weightSum = 0;
    let latitude = 0;
    let longitude = 0;
    let maxWeight = 0;
    for (let i = 0; i < known.length; i += 1) {
        const weight = weights[i];
        if (weight > maxWeight) maxWeight = weight;
        weightSum += weight;
        latitude += Number(known[i].latitude) * weight;
        longitude += Number(known[i].longitude) * weight;
    }
    latitude /= weightSum;
    longitude /= weightSum;

    let listedAccuracy = 0;
    let reach = 0;
    for (let i = 0; i < known.length; i += 1) {
        if (weights[i] < maxWeight * 0.05) continue;
        const accuracy = Number(known[i].accuracy);
        if (Number.isFinite(accuracy) && accuracy > listedAccuracy) listedAccuracy = accuracy;
        reach = Math.max(reach, distanceMeters(latitude, longitude, known[i].latitude, known[i].longitude));
    }

    return {
        latitude,
        longitude,
        accuracy: Math.max(listedAccuracy, Math.round(reach)),
        resolvedCount: known.length
    };
}

/**
 * Choose the live map position. GPS wins when the fix is valid.
 * Otherwise a resolved cell estimate is used. 0,0 is never a position.
 * blockCell keeps a fresh Bluetooth gateway fix from being replaced.
 */
function selectLivePosition({ gpsLatitude, gpsLongitude, gpsStatus, cell, blockCell }) {
    if (isGpsFix(gpsLatitude, gpsLongitude, gpsStatus)) {
        return {
            placed: true,
            clearLive: false,
            lat: Number(gpsLatitude),
            lng: Number(gpsLongitude),
            locationType: 'GPS',
            accuracy: 10
        };
    }

    const cellReady = !!(cell && isValidCoordinate(cell.latitude, cell.longitude));
    if (cellReady && !blockCell) {
        const accuracy = Number(cell.accuracy);
        return {
            placed: true,
            clearLive: false,
            lat: Number(cell.latitude),
            lng: Number(cell.longitude),
            locationType: 'CELL_TOWER',
            accuracy: Number.isFinite(accuracy) && accuracy > 0 ? accuracy : 0
        };
    }

    if (cellReady && blockCell) {
        return { placed: false, clearLive: false, lat: 0, lng: 0, locationType: 'CELL_TOWER', accuracy: 0 };
    }

    if (cell) {
        return { placed: false, clearLive: true, lat: 0, lng: 0, locationType: 'CELL_TOWER', accuracy: 0 };
    }

    return { placed: false, clearLive: true, lat: 0, lng: 0, locationType: '', accuracy: 0 };
}

module.exports = {
    isValidCoordinate,
    isGpsFix,
    combineKnownTowers,
    selectLivePosition
};
