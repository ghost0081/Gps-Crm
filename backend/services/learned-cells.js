const { isValidCoordinate } = require('./live-position');

/**
 * Cell sites the tags have already visited with a GPS fix.
 * The public tower list is dense in Delhi NCR and misses many
 * Uttarakhand and Himachal cells, so a later cell-only packet
 * would otherwise keep showing the last Delhi position.
 * A learned site is where the tag was, not a surveyed mast.
 */
const MIN_ACCURACY_METERS = 400;
const MAX_SITE_SHIFT_METERS = 30000;

const cache = new Map();
let loadPromise = null;

function cellKey(mcc, mnc, lac, cellId) {
    return `${Number(mcc) || 0}:${Number(mnc) || 0}:${Number(lac) || 0}:${Number(cellId) || 0}`;
}

function distanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function absorbSample(existing, latitude, longitude) {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!isValidCoordinate(lat, lng)) return existing || null;
    if (!existing) {
        return {
            latitude: lat,
            longitude: lng,
            samples: 1,
            spreadMeters: 0,
            accuracy: MIN_ACCURACY_METERS
        };
    }
    const shift = distanceMeters(existing.latitude, existing.longitude, lat, lng);
    if (existing.samples >= 2 && shift > MAX_SITE_SHIFT_METERS) return existing;
    const samples = existing.samples + 1;
    const nextLat = existing.latitude + (lat - existing.latitude) / samples;
    const nextLng = existing.longitude + (lng - existing.longitude) / samples;
    const spread = Math.max(existing.spreadMeters || 0, shift);
    return {
        latitude: nextLat,
        longitude: nextLng,
        samples,
        spreadMeters: spread,
        accuracy: Math.max(MIN_ACCURACY_METERS, Math.round(spread))
    };
}

function learnSamples(samples) {
    const learned = new Map();
    for (const sample of samples || []) {
        const id = Number(sample.cellId) || 0;
        const area = Number(sample.lac) || 0;
        if (!id || !area) continue;
        const key = cellKey(sample.mcc, sample.mnc, area, id);
        const next = absorbSample(learned.get(key), sample.latitude, sample.longitude);
        if (next) learned.set(key, next);
    }
    return learned;
}

function toHit(key, row) {
    const [mcc, mnc, lac, cellId] = key.split(':').map((part) => Number(part) || 0);
    return {
        mcc,
        mnc,
        lac,
        cellId,
        latitude: row.latitude,
        longitude: row.longitude,
        accuracy: row.accuracy || MIN_ACCURACY_METERS,
        samples: row.samples || 1,
        source: 'learned'
    };
}

function model() {
    const mongoose = require('mongoose');
    const name = 'learnedcells';
    if (mongoose.models[name]) return mongoose.models[name];
    const schema = new mongoose.Schema({
        key: { type: String, unique: true, index: true },
        mcc: Number,
        mnc: Number,
        lac: Number,
        cellId: Number,
        latitude: Number,
        longitude: Number,
        accuracy: Number,
        samples: Number,
        spreadMeters: Number,
        updatedAt: Date
    }, { collection: 'learnedcells' });
    return mongoose.model(name, schema);
}

async function ensureCache() {
    if (cache.size > 0) return;
    if (!loadPromise) {
        loadPromise = (async () => {
            const rows = await model().find({}).lean();
            for (const row of rows) {
                if (!row.key || !isValidCoordinate(row.latitude, row.longitude)) continue;
                cache.set(row.key, {
                    latitude: row.latitude,
                    longitude: row.longitude,
                    samples: row.samples || 1,
                    spreadMeters: row.spreadMeters || 0,
                    accuracy: row.accuracy || MIN_ACCURACY_METERS
                });
            }
        })().catch((err) => {
            loadPromise = null;
            throw err;
        });
    }
    await loadPromise;
}

async function persist(entries) {
    if (!entries.length) return;
    const Learned = model();
    const now = new Date();
    await Learned.bulkWrite(entries.map(([key, row]) => {
        const [mcc, mnc, lac, cellId] = key.split(':').map((part) => Number(part) || 0);
        return {
            updateOne: {
                filter: { key },
                update: {
                    $set: {
                        key, mcc, mnc, lac, cellId,
                        latitude: row.latitude,
                        longitude: row.longitude,
                        accuracy: row.accuracy,
                        samples: row.samples,
                        spreadMeters: row.spreadMeters,
                        updatedAt: now
                    }
                },
                upsert: true
            }
        };
    }));
}

async function lookupLearnedCell({ mcc, mnc, lac, cellId }) {
    const id = Number(cellId) || 0;
    const area = Number(lac) || 0;
    if (!id || !area) return null;
    await ensureCache();
    const key = cellKey(mcc, mnc, area, id);
    const row = cache.get(key);
    if (!row) return null;
    return toHit(key, row);
}

async function rememberGpsCells({ mcc, mnc, towers, latitude, longitude }) {
    const samples = (towers || [])
        .filter((tower) => tower && tower.cellId > 0 && tower.lac > 0)
        .map((tower) => ({
            mcc,
            mnc,
            lac: tower.lac,
            cellId: tower.cellId,
            latitude,
            longitude
        }));
    if (samples.length === 0 || !isValidCoordinate(latitude, longitude)) return;
    await ensureCache();
    const changed = [];
    for (const sample of samples) {
        const key = cellKey(sample.mcc, sample.mnc, sample.lac, sample.cellId);
        const next = absorbSample(cache.get(key), sample.latitude, sample.longitude);
        if (!next || next === cache.get(key)) continue;
        cache.set(key, next);
        changed.push([key, next]);
    }
    await persist(changed);
}

async function learnFromTrackerHistory() {
    const TrackerData = require('../models/trackerSchema');
    await ensureCache();
    const trackers = await TrackerData.find({}, {
        imei: 1,
        latitude: 1,
        longitude: 1,
        locationType: 1,
        mcc: 1,
        mnc: 1,
        lac: 1,
        cellId: 1,
        cellLatitude: 1,
        path_history: 1
    }).lean();

    const fresh = new Map();
    for (const tracker of trackers) {
        for (const point of tracker.path_history || []) {
            if (point.locationType !== 'GPS') continue;
            const key = cellKey(point.mcc, point.mnc, point.lac, point.cellId);
            if (!key || cache.has(key) || !(Number(point.cellId) > 0) || !(Number(point.lac) > 0)) continue;
            const next = absorbSample(fresh.get(key), point.lat, point.lng);
            if (next) fresh.set(key, next);
        }
    }
    for (const [key, row] of fresh) cache.set(key, row);
    await persist([...fresh.entries()]);

    let restored = 0;
    for (const tracker of trackers) {
        if (tracker.locationType === 'GPS') continue;
        const hit = cache.get(cellKey(tracker.mcc, tracker.mnc, tracker.lac, tracker.cellId));
        if (!hit) continue;
        const liveLat = Number(tracker.latitude) || 0;
        const liveLng = Number(tracker.longitude) || 0;
        const cellLat = Number(tracker.cellLatitude) || 0;
        const drifted = !isValidCoordinate(liveLat, liveLng)
            || !cellLat
            || distanceMeters(liveLat, liveLng, hit.latitude, hit.longitude) > 1000;
        if (!drifted) continue;
        await TrackerData.updateOne({ imei: tracker.imei }, {
            $set: {
                latitude: hit.latitude,
                longitude: hit.longitude,
                locationType: 'CELL_TOWER',
                accuracy: hit.accuracy,
                cellLatitude: hit.latitude,
                cellLongitude: hit.longitude,
                cellAccuracy: hit.accuracy,
                cellEstimateMethod: 'learned'
            }
        });
        restored += 1;
        console.log(`[CELL ID] Restored ${tracker.imei} from a GPS visit to cell ${tracker.cellId} -> ${hit.latitude}, ${hit.longitude}`);
    }
    console.log(`[CELL ID] Learned ${fresh.size} new cell sites from GPS history, restored ${restored} live positions`);
    return { learned: fresh.size, restored };
}

module.exports = {
    absorbSample,
    learnSamples,
    lookupLearnedCell,
    rememberGpsCells,
    learnFromTrackerHistory,
    distanceMeters,
    MIN_ACCURACY_METERS
};
