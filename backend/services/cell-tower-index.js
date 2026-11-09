const fs = require('fs');
const path = require('path');
const https = require('https');
const readline = require('readline');

/**
 * India cell-tower positions from the lacells dataset
 * (Mozilla Location Service, public domain, and OpenCellID, CC-BY-SA).
 * https://wvengen.github.io/lacells/
 */
const DATA_DIR = path.join(__dirname, '..', 'data', 'cell-towers');
const SOURCES = [
    {
        file: 'lacells-mcc_404.csv',
        url: 'https://wvengen.github.io/lacells/lacells-mcc_404.csv'
    },
    {
        file: 'lacells-mcc_405.csv',
        url: 'https://wvengen.github.io/lacells/lacells-mcc_405.csv'
    }
];

const BUCKET_DEG = 0.01;
const MAX_SEARCH_METERS = 20000;
const SAME_SITE_METERS = 250;

const grid = new Map();
const byCell = new Map();
const byArea = new Map();
const placeCache = new Map();
const placeInflight = new Map();
let loadPromise = null;

function uniqueParts(parts) {
    const names = [];
    for (const part of parts) {
        const name = String(part || '').trim();
        if (!name) continue;
        if (names.some((existing) => existing.toLowerCase() === name.toLowerCase())) continue;
        names.push(name);
    }
    return names.join(', ');
}

function getJson(url, timeoutMs) {
    return new Promise((resolve) => {
        const req = https.get(url, {
            headers: {
                'User-Agent': 'crm-school-tracker/1.0 (student safety tracker)',
                Accept: 'application/json'
            },
            timeout: timeoutMs
        }, (res) => {
            let body = '';
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => {
                if (res.statusCode !== 200) return resolve(null);
                try {
                    resolve(JSON.parse(body));
                } catch (err) {
                    resolve(null);
                }
            });
        });
        req.on('error', () => resolve(null));
        req.on('timeout', () => {
            req.destroy();
            resolve(null);
        });
    });
}

function placeFromNominatim(data) {
    const address = data && data.address;
    if (!address) return '';
    return uniqueParts([
        address.road,
        address.neighbourhood,
        address.suburb,
        address.city_district,
        address.city || address.town || address.village,
        address.state
    ]);
}

function placeFromCloud(data) {
    if (!data) return '';
    return uniqueParts([
        data.locality,
        data.city,
        data.principalSubdivision,
        data.countryName
    ]);
}

async function lookupPlaceName(latitude, longitude) {
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}&zoom=16&addressdetails=1`;
    const nominatim = await getJson(nominatimUrl, 5000);
    const fromNominatim = placeFromNominatim(nominatim);
    if (fromNominatim) return fromNominatim;

    const cloudUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}&localityLanguage=en`;
    const cloud = await getJson(cloudUrl, 5000);
    return placeFromCloud(cloud);
}

function bucketKey(lat, lng) {
    return `${Math.floor(lat / BUCKET_DEG)}_${Math.floor(lng / BUCKET_DEG)}`;
}

function distanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function downloadFile(url, destination) {
    return new Promise((resolve, reject) => {
        const request = https.get(url, { headers: { 'User-Agent': 'crm-school-tracker' } }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                res.resume();
                downloadFile(res.headers.location, destination).then(resolve, reject);
                return;
            }
            if (res.statusCode !== 200) {
                res.resume();
                reject(new Error(`Cell tower download failed (${res.statusCode})`));
                return;
            }
            const tempPath = `${destination}.part`;
            const file = fs.createWriteStream(tempPath);
            res.pipe(file);
            file.on('finish', () => {
                file.close(() => {
                    fs.renameSync(tempPath, destination);
                    resolve();
                });
            });
            file.on('error', (err) => {
                fs.unlink(tempPath, () => reject(err));
            });
        });
        request.on('error', reject);
        request.setTimeout(120000, () => {
            request.destroy(new Error('Cell tower download timed out'));
        });
    });
}

async function ensureSourceFiles() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    for (const source of SOURCES) {
        const destination = path.join(DATA_DIR, source.file);
        if (fs.existsSync(destination) && fs.statSync(destination).size > 100000) {
            continue;
        }
        console.log(`[CELL TOWERS] Downloading ${source.file}`);
        await downloadFile(source.url, destination);
    }
}

function addTower(tower) {
    const key = bucketKey(tower.lat, tower.lng);
    let bucket = grid.get(key);
    if (!bucket) {
        bucket = [];
        grid.set(key, bucket);
    }
    bucket.push(tower);
    const idKey = `${tower.mcc}:${tower.mnc}:${tower.lac}:${tower.cellId}`;
    if (!byCell.has(idKey)) byCell.set(idKey, tower);
    const areaKey = `${tower.mcc}:${tower.mnc}:${tower.lac}`;
    let area = byArea.get(areaKey);
    if (!area) {
        area = [];
        byArea.set(areaKey, area);
    }
    area.push(tower);
}

async function loadCsv(filePath) {
    const stream = fs.createReadStream(filePath);
    const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });
    let isHeader = true;
    for await (const line of lines) {
        if (isHeader) {
            isHeader = false;
            continue;
        }
        if (!line) continue;
        const parts = line.split(',');
        if (parts.length < 6) continue;
        const lat = parseFloat(parts[5]);
        const lng = parseFloat(parts[4]);
        const cellId = parseInt(parts[3], 10);
        if (!lat || !lng || !cellId) continue;
        addTower({
            mcc: parseInt(parts[0], 10) || 0,
            mnc: parseInt(parts[1], 10) || 0,
            lac: parseInt(parts[2], 10) || 0,
            cellId,
            lat,
            lng,
            accuracy: parseFloat(parts[7]) || 0
        });
    }
}

async function ensureLoaded() {
    if (grid.size > 0) return;
    if (!loadPromise) {
        loadPromise = (async () => {
            await ensureSourceFiles();
            for (const source of SOURCES) {
                await loadCsv(path.join(DATA_DIR, source.file));
            }
            console.log(`[CELL TOWERS] Indexed ${countTowers()} towers`);
        })().catch((err) => {
            loadPromise = null;
            throw err;
        });
    }
    await loadPromise;
}

function countTowers() {
    let total = 0;
    for (const bucket of grid.values()) total += bucket.length;
    return total;
}

function minDistanceToUnsearched(lat, lng, ring) {
    const lat0 = Math.floor(lat / BUCKET_DEG) * BUCKET_DEG;
    const lng0 = Math.floor(lng / BUCKET_DEG) * BUCKET_DEG;
    const south = lat - (lat0 - ring * BUCKET_DEG);
    const north = (lat0 + (ring + 1) * BUCKET_DEG) - lat;
    const west = lng - (lng0 - ring * BUCKET_DEG);
    const east = (lng0 + (ring + 1) * BUCKET_DEG) - lng;
    const metersPerDegLng = 111320 * Math.cos(lat * Math.PI / 180);
    const dLat = Math.min(south, north) * 111320;
    const dLng = Math.min(west, east) * metersPerDegLng;
    return Math.max(0, Math.min(dLat, dLng));
}

function searchGrid(lat, lng, mcc, mnc, reportedKeys) {
    const latBucket = Math.floor(lat / BUCKET_DEG);
    const lngBucket = Math.floor(lng / BUCKET_DEG);
    let nearest = null;
    let nearestReported = null;
    const maxRing = 30;

    for (let ring = 0; ring <= maxRing; ring++) {
        for (let dy = -ring; dy <= ring; dy++) {
            for (let dx = -ring; dx <= ring; dx++) {
                if (ring > 0 && Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
                const bucket = grid.get(`${latBucket + dy}_${lngBucket + dx}`);
                if (!bucket) continue;
                for (const tower of bucket) {
                    if (mcc && tower.mcc !== mcc) continue;
                    if (mnc && tower.mnc !== mnc) continue;
                    const dist = distanceMeters(lat, lng, tower.lat, tower.lng);
                    if (dist > MAX_SEARCH_METERS) continue;
                    const candidate = { tower, distanceMeters: dist };
                    if (!nearest || dist < nearest.distanceMeters) nearest = candidate;
                    if (reportedKeys.has(`${tower.lac}:${tower.cellId}`)) {
                        if (!nearestReported || dist < nearestReported.distanceMeters) {
                            nearestReported = candidate;
                        }
                    }
                }
            }
        }

        if (nearest && nearest.distanceMeters <= minDistanceToUnsearched(lat, lng, ring)) {
            break;
        }
    }

    if (
        nearestReported &&
        nearest &&
        nearestReported.distanceMeters <= nearest.distanceMeters + SAME_SITE_METERS
    ) {
        return nearestReported;
    }
    return nearest;
}

function toResult(match) {
    if (!match) return null;
    const tower = match.tower;
    return {
        mcc: tower.mcc,
        mnc: tower.mnc,
        lac: tower.lac,
        cellId: tower.cellId,
        latitude: tower.lat,
        longitude: tower.lng,
        accuracy: tower.accuracy || Math.max(Math.round(match.distanceMeters), 100),
        distanceMeters: Math.round(match.distanceMeters),
        locationType: 'CELL_TOWER'
    };
}

/**
 * Looks up the coordinates of the Cell ID the device is actually connected to.
 * Does not substitute a different tower.
 */
/**
 * When the exact Cell ID is not in the tower index, estimate the area from the
 * known towers that share its MCC, MNC, and location area code.
 * The result is the center of those towers. Accuracy is how far the farthest
 * known tower sits from that center. It is not the exact antenna position.
 */
async function estimateLacArea({ mcc, mnc, lac }) {
    const areaCode = Number(lac);
    if (!areaCode) return null;
    await ensureLoaded();
    const towers = byArea.get(`${Number(mcc) || 0}:${Number(mnc) || 0}:${areaCode}`);
    if (!towers || towers.length === 0) return null;

    let latitude = 0;
    let longitude = 0;
    for (const tower of towers) {
        latitude += tower.lat;
        longitude += tower.lng;
    }
    latitude /= towers.length;
    longitude /= towers.length;

    let spread = 0;
    for (const tower of towers) {
        spread = Math.max(spread, distanceMeters(latitude, longitude, tower.lat, tower.lng));
    }

    return {
        mcc: Number(mcc) || 0,
        mnc: Number(mnc) || 0,
        lac: areaCode,
        latitude,
        longitude,
        accuracy: Math.max(Math.round(spread), 100),
        towerCount: towers.length
    };
}

async function lookupCellById({ mcc, mnc, lac, cellId }) {
    const id = Number(cellId);
    const area = Number(lac);
    if (!id || !area) return null;
    await ensureLoaded();
    const tower = byCell.get(`${Number(mcc) || 0}:${Number(mnc) || 0}:${area}:${id}`);
    if (!tower) return null;
    return {
        mcc: tower.mcc,
        mnc: tower.mnc,
        lac: tower.lac,
        cellId: tower.cellId,
        latitude: tower.lat,
        longitude: tower.lng,
        accuracy: tower.accuracy || 500
    };
}

function describePlace(latitude, longitude) {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!lat || !lng) return Promise.resolve('');
    const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    const cached = placeCache.get(cacheKey);
    if (cached && (cached.value || Date.now() - cached.at < 30000)) {
        return Promise.resolve(cached.value);
    }
    if (placeInflight.has(cacheKey)) return placeInflight.get(cacheKey);

    const pending = lookupPlaceName(lat, lng)
        .then((name) => {
            placeCache.set(cacheKey, { value: name || '', at: Date.now() });
            return name || '';
        })
        .catch(() => '')
        .finally(() => {
            placeInflight.delete(cacheKey);
        });
    placeInflight.set(cacheKey, pending);
    return pending;
}

/**
 * Finds the cell tower closest to the tracker's real position.
 * When the device reported a tower on that same site, that Cell ID is kept.
 * @param {Object} query - { latitude, longitude, mcc, mnc, reportedCells }
 */
async function findNearestCellTower({ latitude, longitude, mcc, mnc, reportedCells }) {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!lat || !lng) return null;

    await ensureLoaded();

    const reportedKeys = new Set(
        (reportedCells || [])
            .filter((cell) => cell && cell.lac > 0 && cell.cellId > 0)
            .map((cell) => `${cell.lac}:${cell.cellId}`)
    );

    const networkMcc = Number(mcc) || 0;
    const networkMnc = Number(mnc) || 0;

    if (networkMcc && networkMnc) {
        const sameNetwork = searchGrid(lat, lng, networkMcc, networkMnc, reportedKeys);
        if (sameNetwork) return toResult(sameNetwork);
    }

    if (networkMcc) {
        return toResult(searchGrid(lat, lng, networkMcc, 0, reportedKeys));
    }

    const primary = searchGrid(lat, lng, 404, 0, reportedKeys);
    const secondary = searchGrid(lat, lng, 405, 0, reportedKeys);
    if (!primary) return toResult(secondary);
    if (!secondary) return toResult(primary);
    return toResult(primary.distanceMeters <= secondary.distanceMeters ? primary : secondary);
}

function warmupCellIndex() {
    return ensureLoaded();
}

module.exports = {
    findNearestCellTower,
    lookupCellById,
    estimateLacArea,
    describePlace,
    distanceMeters,
    warmupCellIndex
};
