const https = require('https');
const { isValidCoordinate } = require('./live-position');

// In-memory cache for resolved cell towers: key -> { latitude, longitude, accuracy }
const cellTowerCache = new Map();

/**
 * Helper to make HTTPS POST requests with JSON payload using native Node.js https module
 */
function httpsPostJson(hostname, path, payload, timeoutMs = 3000) {
    return new Promise((resolve, reject) => {
        const dataStr = JSON.stringify(payload);
        const options = {
            hostname: hostname,
            port: 443,
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(dataStr)
            },
            timeout: timeoutMs
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    resolve(json);
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.write(dataStr);
        req.end();
    });
}

/**
 * Resolves Cellular Tower (MCC, MNC, LAC, CellID) to approximate Latitude & Longitude using multiple towers for better triangulation
 * @param {Object} cellInfo - { mcc, mnc, cells: [{lac, cellId, signalStrength}] }
 * @returns {Promise<Object|null>} - { latitude, longitude, accuracy, locationType }
 */
async function resolveCellLocation({ mcc, mnc, cells }) {
    if (!cells || cells.length === 0 || !cells[0].cellId || cells[0].cellId <= 0) {
        return null;
    }

    const primaryCell = cells[0];
    // Cache key incorporates the primary cell and number of towers
    const cacheKey = `${mcc}_${mnc}_${primaryCell.lac}_${primaryCell.cellId}_x${cells.length}`;
    if (cellTowerCache.has(cacheKey)) {
        return cellTowerCache.get(cacheKey);
    }

    // Provider 1: Mozilla Geolocation API
    try {
        const hit = await lookupPublicCell({
            mcc,
            mnc,
            lac: primaryCell.lac,
            cellId: primaryCell.cellId
        });
        if (hit && hit.found && isValidCoordinate(hit.latitude, hit.longitude)) {
            const result = {
                latitude: hit.latitude,
                longitude: hit.longitude,
                accuracy: hit.accuracy || 800,
                locationType: 'CELL_TOWER'
            };
            cellTowerCache.set(cacheKey, result);
            return result;
        }
    } catch (err) {
        // The public lookup reports its own misses. A thrown error just means no fix.
    }

    return null;
}

const openCellCache = new Map();
const OPENCELL_HIT_MS = 24 * 60 * 60 * 1000;
const OPENCELL_MISS_MS = 30 * 60 * 1000;
let missingKeyLogged = false;

function httpsGet(hostname, requestPath, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname,
            port: 443,
            path: requestPath,
            method: 'GET',
            headers: {
                Accept: 'application/json',
                'User-Agent': 'crm-school-tracker/1.0'
            },
            timeout: timeoutMs
        }, (res) => {
            let body = '';
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => resolve({ status: res.statusCode || 0, body }));
        });
        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        req.end();
    });
}

function onHundredthDegree(value) {
    const scaled = Number(value) * 100;
    return Number.isFinite(scaled) && Math.abs(scaled - Math.round(scaled)) < 1e-6;
}

/**
 * OpenCellID rounds India coordinates (MCC 404–406) to two decimal places,
 * about 1.1 km. A point that lands on that grid keeps at least that radius.
 */
function coarseAccuracyMeters(latitude, longitude) {
    if (onHundredthDegree(latitude) && onHundredthDegree(longitude)) return 1100;
    return 0;
}

function parseOpenCellIdBody(status, body) {
    const text = String(body || '').trim();
    let data = null;
    if (text) {
        try {
            data = JSON.parse(text);
        } catch (err) {
            data = null;
        }
    }

    const latitude = data ? Number(data.lat) : NaN;
    const longitude = data ? Number(data.lon != null ? data.lon : data.lng) : NaN;
    if (isValidCoordinate(latitude, longitude)) {
        const range = Number(data.range);
        const listed = Number.isFinite(range) && range > 0 ? range : 0;
        return {
            found: true,
            latitude,
            longitude,
            accuracy: Math.max(listed, coarseAccuracyMeters(latitude, longitude)),
            range: listed,
            samples: Number(data.samples) || 0,
            radio: data.radio || '',
            status: status || 200
        };
    }

    const code = data ? Number(data.code) || 0 : 0;
    let reason = 'not-found';
    if (code === 2 || status === 401) reason = 'invalid-key';
    else if (code === 7 || status === 429) reason = 'limit';
    else if (code === 3 || status === 400) reason = 'invalid-input';
    else if (status >= 500 || code === 5) reason = 'unavailable';
    else if (code === 1 || status === 200) reason = 'not-found';
    return { found: false, reason, code, status: status || 0 };
}

/**
 * Look up one reported tower on OpenCellID.
 * Uses MCC, MNC, location area, and cell ID. Does not update the tracker.
 * Returns found:false when the cell is absent or the API key is not set.
 */
async function lookupOpenCellId({ mcc, mnc, lac, cellId }) {
    const apiKey = String(process.env.OPENCELLID_API_KEY || '').trim();
    const country = Number(mcc) || 0;
    const network = Number(mnc) || 0;
    const area = Number(lac) || 0;
    const id = Number(cellId) || 0;
    if (!area || !id) return { found: false, reason: 'invalid-cell', status: 0 };
    if (!apiKey) {
        if (!missingKeyLogged) {
            console.error('OpenCellID lookup skipped: OPENCELLID_API_KEY is not set');
            missingKeyLogged = true;
        }
        return { found: false, reason: 'missing-key', status: 0 };
    }

    const cacheKey = `${country}:${network}:${area}:${id}`;
    const cached = openCellCache.get(cacheKey);
    if (cached && Date.now() - cached.at < cached.ttl) return cached.value;

    const requestPath = `/cell/get?key=${encodeURIComponent(apiKey)}&mcc=${country}&mnc=${network}&lac=${area}&cellid=${id}&format=json`;
    let response;
    try {
        response = await httpsGet('opencellid.org', requestPath, 5000);
    } catch (err) {
        return { found: false, reason: 'unavailable', status: 0 };
    }

    const parsed = parseOpenCellIdBody(response.status, response.body);
    if (parsed.reason === 'invalid-key' || parsed.reason === 'limit' || parsed.reason === 'unavailable') {
        return parsed;
    }
    openCellCache.set(cacheKey, {
        at: Date.now(),
        ttl: parsed.found ? OPENCELL_HIT_MS : OPENCELL_MISS_MS,
        value: parsed
    });
    return parsed;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry(fn) {
    let result = { found: false, reason: 'unavailable', status: 0 };
    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            result = await fn();
        } catch (err) {
            result = { found: false, reason: 'unavailable', status: 0 };
        }
        if (!result || result.found || result.reason !== 'unavailable') {
            return result || { found: false, reason: 'not-found', status: 0 };
        }
        if (attempt < 2) await sleep(250 * (attempt + 1));
    }
    return result;
}

function parseMylnikovBody(status, body) {
    let data = null;
    try {
        data = JSON.parse(String(body || ''));
    } catch (err) {
        data = null;
    }
    const point = data && data.data;
    const latitude = point ? Number(point.lat) : NaN;
    const longitude = point ? Number(point.lon) : NaN;
    if (Number(data && data.result) === 200 && isValidCoordinate(latitude, longitude)) {
        const range = Number(point.range);
        return {
            found: true,
            latitude,
            longitude,
            accuracy: Math.max(Number.isFinite(range) && range > 0 ? range : 0, coarseAccuracyMeters(latitude, longitude), 400),
            source: 'mylnikov',
            status: status || 200
        };
    }
    if (!status || status >= 500) return { found: false, reason: 'unavailable', status: status || 0 };
    return { found: false, reason: 'not-found', status: status || 0 };
}

function parseMccMncBody(status, body) {
    let data = null;
    try {
        data = JSON.parse(String(body || ''));
    } catch (err) {
        data = null;
    }
    const row = data && Array.isArray(data.data) ? data.data[0] : null;
    const latitude = row ? Number(row.lat) : NaN;
    const longitude = row ? Number(row.lon) : NaN;
    if (isValidCoordinate(latitude, longitude)) {
        const range = Number(row.range);
        return {
            found: true,
            latitude,
            longitude,
            accuracy: Math.max(Number.isFinite(range) && range > 0 ? range : 0, coarseAccuracyMeters(latitude, longitude), 400),
            source: 'mcc-mnc',
            status: status || 200
        };
    }
    if (status === 429 || !status || status >= 500) {
        return { found: false, reason: 'unavailable', status: status || 0 };
    }
    return { found: false, reason: 'not-found', status: status || 0 };
}

async function lookupMylnikov({ mcc, mnc, lac, cellId }) {
    const requestPath = `/geolocation/cell?v=1.1&data=open&mcc=${mcc}&mnc=${mnc}&lac=${lac}&cellid=${cellId}`;
    const response = await httpsGet('api.mylnikov.org', requestPath, 5000);
    return parseMylnikovBody(response.status, response.body);
}

async function lookupMccMncOrg({ mcc, mnc, lac, cellId }) {
    const requestPath = `/api/v1/cells?mcc=${mcc}&mnc=${mnc}&area=${lac}&cell=${cellId}`;
    const response = await httpsGet('mcc-mnc.org', requestPath, 5000);
    return parseMccMncBody(response.status, response.body);
}

const publicCache = new Map();

/**
 * Resolve one tower from the identifiers the tag reported.
 * MCC, MNC, LAC/TAC and Cell ID are taken from the packet.
 * Nothing is substituted when one of them is missing.
 */
async function lookupPublicCell({ mcc, mnc, lac, cellId }) {
    const country = Number(mcc) || 0;
    const network = Number(mnc) || 0;
    const area = Number(lac) || 0;
    const id = Number(cellId) || 0;
    if (!country || !network || !area || !id) {
        return { found: false, reason: 'missing-network', status: 0 };
    }

    const cacheKey = `${country}:${network}:${area}:${id}`;
    const cached = publicCache.get(cacheKey);
    if (cached && Date.now() - cached.at < cached.ttl) return cached.value;

    const sources = [
        () => lookupOpenCellId({ mcc: country, mnc: network, lac: area, cellId: id }),
        () => lookupMylnikov({ mcc: country, mnc: network, lac: area, cellId: id }),
        () => lookupMccMncOrg({ mcc: country, mnc: network, lac: area, cellId: id })
    ];
    let result = { found: false, reason: 'not-found', status: 0 };
    for (const source of sources) {
        result = await withRetry(source);
        if (result && result.found) break;
    }
    const settled = result && result.reason !== 'unavailable' && result.reason !== 'limit' && result.reason !== 'missing-key';
    if (settled) {
        publicCache.set(cacheKey, {
            at: Date.now(),
            ttl: result.found ? OPENCELL_HIT_MS : OPENCELL_MISS_MS,
            value: result
        });
    }
    return result;
}

module.exports = {
    resolveCellLocation,
    lookupOpenCellId,
    lookupPublicCell,
    parseOpenCellIdBody,
    parseMylnikovBody,
    parseMccMncBody
};
