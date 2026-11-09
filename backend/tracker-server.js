const net = require('net');
const TrackerData = require('./models/trackerSchema');
const { lookupCellById, estimateLacArea, describePlace, warmupCellIndex } = require('./services/cell-tower-index');
const { lookupPublicCell } = require('./services/lbs-service');
const { isValidCoordinate, isGpsFix, combineKnownTowers, selectLivePosition } = require('./services/live-position');
const { lookupLearnedCell, rememberGpsCells, learnFromTrackerHistory } = require('./services/learned-cells');

const FRESH_MS = 3 * 60 * 1000;

/** Fire-and-forget safety pipeline after a placed live position update. */
function runSafetyPipeline(imei, position, extras = {}) {
    if (!imei || !position || !position.placed) return;
    setImmediate(() => {
        try {
            const { processLiveLocationUpdate } = require('./services/tracking-pipeline');
            processLiveLocationUpdate({
                imei: String(imei),
                lat: position.lat,
                lng: position.lng,
                locationType: position.locationType,
                accuracy: position.accuracy,
                speed: extras.speed,
                course: extras.course,
                battery: extras.battery,
                deviceTimestamp: extras.deviceTimestamp || new Date(),
                serverReceivedAt: new Date(),
            }).catch((err) => console.error(`[safety-pipeline] ${imei}:`, err.message));
        } catch (err) {
            console.error(`[safety-pipeline] load error:`, err.message);
        }
    });
}

function selectServingCell(cellTowers, fallback) {
    const towers = (cellTowers || []).filter((cell) => cell && cell.cellId > 0 && cell.lac > 0);
    if (towers.length === 0) {
        if (fallback && fallback.cellId > 0 && fallback.lac > 0) return fallback;
        return null;
    }
    let serving = towers[0];
    for (const tower of towers) {
        if ((tower.signalStrength || 0) > (serving.signalStrength || 0)) serving = tower;
    }
    return serving;
}

function batteryPercent(reportedPercent, volts) {
    const reported = Number(reportedPercent);
    if (Number.isFinite(reported) && reported > 0) {
        return Math.max(0, Math.min(100, Math.round(reported)));
    }
    if (Number.isFinite(volts) && volts >= 3.2 && volts <= 4.5) {
        return Math.max(0, Math.min(100, Math.round(((volts - 3.0) / 1.2) * 100)));
    }
    if (Number.isFinite(reported)) {
        return Math.max(0, Math.min(100, Math.round(reported)));
    }
    return 0;
}

async function applyChargeReading(imei, updatePayload, battery, charging) {
    const percent = Math.max(0, Math.min(100, Math.round(Number(battery) || 0)));
    updatePayload.battery = percent;
    if (typeof charging === 'boolean') {
        updatePayload.charging = charging;
    }
    if (!charging || percent < 100) return;
    const existing = await TrackerData.findOne({ imei }).select('battery').lean();
    const previous = existing ? Number(existing.battery) || 0 : 0;
    if (previous < 100) {
        updatePayload.lastFullChargeAt = new Date();
    }
}

async function fresherSourceBlocks(imei, incomingType) {
    // A newer GPS fix is applied by the caller before this check.
    // A fresh Bluetooth gateway fix stays on the map instead of a coarser cell estimate.
    if (incomingType !== 'CELL_TOWER') return false;
    const doc = await TrackerData.findOne({ imei }).select('locationType last_updated').lean();
    if (!doc || !doc.last_updated || doc.locationType !== 'BLE') return false;
    return Date.now() - new Date(doc.last_updated).getTime() <= FRESH_MS;
}

async function resolveReportedCells(mcc, mnc, towers) {
    const reported = (towers || []).filter((cell) => cell && cell.cellId > 0 && cell.lac > 0);
    if (reported.length === 0) return null;

    const known = [];
    for (const tower of reported) {
        try {
            const hit = await lookupCellById({
                mcc,
                mnc,
                lac: tower.lac,
                cellId: tower.cellId
            });
            if (hit && isValidCoordinate(hit.latitude, hit.longitude)) {
                known.push({
                    ...hit,
                    signalStrength: tower.signalStrength || 0
                });
            }
        } catch (err) {
            console.error(`Cell lookup failed: ${err.message}`);
        }
    }

    const resolvedKeys = new Set(known.map((tower) => `${tower.lac}:${tower.cellId}`));
    let missing = reported.filter((tower) => !resolvedKeys.has(`${tower.lac}:${tower.cellId}`));
    if (missing.length > 0) {
        const stillMissing = [];
        for (const tower of missing) {
            try {
                const hit = await lookupLearnedCell({
                    mcc,
                    mnc,
                    lac: tower.lac,
                    cellId: tower.cellId
                });
                if (hit && isValidCoordinate(hit.latitude, hit.longitude)) {
                    known.push({
                        ...hit,
                        signalStrength: tower.signalStrength || 0
                    });
                    continue;
                }
            } catch (err) {
                console.error(`Learned cell lookup failed: ${err.message}`);
            }
            stillMissing.push(tower);
        }
        missing = stillMissing;
    }
    if (missing.length > 0) {
        const hits = await Promise.all(missing.map(async (tower) => {
            try {
                const hit = await lookupPublicCell({
                    mcc,
                    mnc,
                    lac: tower.lac,
                    cellId: tower.cellId
                });
                return { tower, hit };
            } catch (err) {
                console.error(`Public cell lookup failed: ${err.message}`);
                return { tower, hit: null };
            }
        }));
        for (const { tower, hit } of hits) {
            if (hit && hit.found && isValidCoordinate(hit.latitude, hit.longitude)) {
                known.push({
                    latitude: hit.latitude,
                    longitude: hit.longitude,
                    accuracy: hit.accuracy,
                    signalStrength: tower.signalStrength || 0,
                    cellId: tower.cellId,
                    lac: tower.lac,
                    source: hit.source || 'opencellid'
                });
            }
        }
    }

    let estimate = combineKnownTowers(known);
    if (estimate) {
        const sources = new Set(known.map((tower) => tower.source || 'index'));
        if (sources.size === 1 && sources.has('learned')) estimate.method = 'learned';
        else if (sources.size === 1 && !sources.has('index')) estimate.method = [...sources][0];
        else estimate.method = estimate.resolvedCount > 1 ? 'signal-weighted' : 'exact-cell';
    }
    if (!estimate) {
        const servingGuess = selectServingCell(reported, null) || reported[0];
        try {
            const area = await estimateLacArea({ mcc, mnc, lac: servingGuess.lac });
            if (area && isValidCoordinate(area.latitude, area.longitude)) {
                estimate = {
                    latitude: area.latitude,
                    longitude: area.longitude,
                    accuracy: area.accuracy,
                    resolvedCount: 0,
                    areaTowerCount: area.towerCount,
                    approximate: true,
                    method: 'lac-area'
                };
            }
        } catch (err) {
            console.error(`Cell area estimate failed: ${err.message}`);
        }
    }

    const serving = selectServingCell(reported, null) || reported[0];
    const latitude = estimate ? estimate.latitude : 0;
    const longitude = estimate ? estimate.longitude : 0;
    let approximateLocation = '';
    if (estimate) {
        approximateLocation = await describePlace(latitude, longitude);
    }
    return {
        mcc,
        mnc,
        lac: serving.lac,
        cellId: serving.cellId,
        latitude,
        longitude,
        accuracy: estimate ? estimate.accuracy : 0,
        resolvedCount: estimate ? estimate.resolvedCount : 0,
        reportedCount: reported.length,
        areaTowerCount: estimate ? (estimate.areaTowerCount || 0) : 0,
        approximate: !!(estimate && estimate.approximate),
        method: estimate ? (estimate.method || 'stored-estimate') : 'none',
        approximateLocation
    };
}

function cellReadingTime(timestamp) {
    const parsed = timestamp instanceof Date ? timestamp : new Date(timestamp);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function applyDynamicCell(updatePayload, cell, timestamp) {
    if (!cell) return;
    const hasEstimate = isValidCoordinate(cell.latitude, cell.longitude);
    updatePayload.mcc = cell.mcc;
    updatePayload.mnc = cell.mnc;
    updatePayload.lac = cell.lac;
    updatePayload.cellId = cell.cellId;
    updatePayload.cellLatitude = hasEstimate ? cell.latitude : 0;
    updatePayload.cellLongitude = hasEstimate ? cell.longitude : 0;
    updatePayload.cellAccuracy = hasEstimate ? (cell.accuracy || 0) : 0;
    updatePayload.cellLocation = hasEstimate ? (cell.approximateLocation || '') : '';
    updatePayload.cellEstimateMethod = hasEstimate ? (cell.method || 'stored-estimate') : 'none';
    updatePayload.cellTimestamp = cellReadingTime(timestamp);
}

async function applyPositionPriority(imei, gpsLat, gpsLng, gpsStatus, cell) {
    const gpsOk = isGpsFix(gpsLat, gpsLng, gpsStatus);
    const blockCell = !gpsOk && await fresherSourceBlocks(imei, 'CELL_TOWER');
    return selectLivePosition({
        gpsLatitude: gpsLat,
        gpsLongitude: gpsLng,
        gpsStatus,
        cell,
        blockCell
    });
}

function logCellEstimate(imei, cell) {
    if (!cell) return;
    if (isValidCoordinate(cell.latitude, cell.longitude)) {
        const how = cell.approximate
            ? `area of LAC ${cell.lac} from ${cell.areaTowerCount || 0} known towers`
            : `${cell.resolvedCount || 0}/${cell.reportedCount || 0} reported towers`;
        console.log(`[CELL ID] IMEI ${imei} - CellID ${cell.cellId}, LAC ${cell.lac} -> ${cell.latitude}, ${cell.longitude} accuracy ${cell.accuracy || 0}m ${cell.method || ''} (${how}) ${cell.approximateLocation || ''}`);
        return;
    }
    console.log(`[CELL ID] IMEI ${imei} - CellID ${cell.cellId}, LAC ${cell.lac} -> unresolved (${cell.resolvedCount || 0}/${cell.reportedCount || 0} reported towers have coordinates)`);
}

function applyLivePosition(updatePayload, position) {
    // Never overwrite a good last-known fix with 0,0 when clearLive is set.
    // clearLive means "no usable placement this packet" — keep previous coords.
    if (!position || !position.placed) return;
    if (!Number.isFinite(Number(position.lat)) || !Number.isFinite(Number(position.lng))) return;
    if (Number(position.lat) === 0 && Number(position.lng) === 0) return;
    updatePayload.latitude = position.lat;
    updatePayload.longitude = position.lng;
    if (position.locationType) updatePayload.locationType = position.locationType;
    updatePayload.accuracy = position.accuracy;
}

// A mapping of socket connections to IMEIs
const activeDevices = {};

// CRC-ITU lookup table
const crctab16 = new Uint16Array([
    0x0000, 0x1189, 0x2312, 0x329B, 0x4624, 0x57AD, 0x6536, 0x74BF,
    0x8C48, 0x9DC1, 0xAF5A, 0xBED3, 0xCA6C, 0xDBE5, 0xE97E, 0xF8F7,
    0x1081, 0x0108, 0x3393, 0x221A, 0x56A5, 0x472C, 0x75B7, 0x643E,
    0x9CC9, 0x8D40, 0xBFDB, 0xAE52, 0xDAED, 0xCB64, 0xF9FF, 0xE876,
    0x2102, 0x308B, 0x0210, 0x1399, 0x6726, 0x76AF, 0x4434, 0x55BD,
    0xAD4A, 0xBCC3, 0x8E58, 0x9FD1, 0xEB6E, 0xFAE7, 0xC87C, 0xD9F5,
    0x3183, 0x200A, 0x1291, 0x0318, 0x77A7, 0x662E, 0x54B5, 0x453C,
    0xBDCB, 0xAC42, 0x9ED9, 0x8F50, 0xFBEF, 0xEA66, 0xD8FD, 0xC974,
    0x4204, 0x538D, 0x6116, 0x709F, 0x0420, 0x15A9, 0x2732, 0x36BB,
    0xCE4C, 0xDFC5, 0xED5E, 0xFCD7, 0x8868, 0x99E1, 0xAB7A, 0xBAF3,
    0x5285, 0x430C, 0x7197, 0x601E, 0x14A1, 0x0528, 0x37B3, 0x263A,
    0xDECD, 0xCF44, 0xFDDF, 0xEC56, 0x98E9, 0x8960, 0xBBFB, 0xAA72,
    0x6306, 0x728F, 0x4014, 0x519D, 0x2522, 0x34AB, 0x0630, 0x17B9,
    0xEF4E, 0xFEC7, 0xCC5C, 0xDDD5, 0xA96A, 0xB8E3, 0x8A78, 0x9BF1,
    0x7387, 0x620E, 0x5095, 0x411C, 0x35A3, 0x242A, 0x16B1, 0x0738,
    0xFFCF, 0xEE46, 0xDCDD, 0xCD54, 0xB9EB, 0xA862, 0x9AF9, 0x8B70,
    0x8408, 0x9581, 0xA71A, 0xB693, 0xC22C, 0xD3A5, 0xE13E, 0xF0B7,
    0x0840, 0x19C9, 0x2B52, 0x3ADB, 0x4E64, 0x5FED, 0x6D76, 0x7CFF,
    0x9489, 0x8500, 0xB79B, 0xA612, 0xD2AD, 0xC324, 0xF1BF, 0xE036,
    0x18C1, 0x0948, 0x3BD3, 0x2A5A, 0x5EE5, 0x4F6C, 0x7DF7, 0x6C7E,
    0xA50A, 0xB483, 0x8618, 0x9791, 0xE32E, 0xF2A7, 0xC03C, 0xD1B5,
    0x2942, 0x38CB, 0x0A50, 0x1BD9, 0x6F66, 0x7EEF, 0x4C74, 0x5DFD,
    0xB58B, 0xA402, 0x9699, 0x8710, 0xF3AF, 0xE226, 0xD0BD, 0xC134,
    0x39C3, 0x284A, 0x1AD1, 0x0B58, 0x7FE7, 0x6E6E, 0x5CF5, 0x4D7C,
    0xC60C, 0xD785, 0xE51E, 0xF497, 0x8028, 0x91A1, 0xA33A, 0xB2B3,
    0x4A44, 0x5BCD, 0x6956, 0x78DF, 0x0C60, 0x1DE9, 0x2F72, 0x3EFB,
    0xD68D, 0xC704, 0xF59F, 0xE416, 0x90A9, 0x8120, 0xB3BB, 0xA232,
    0x5AC5, 0x4B4C, 0x79D7, 0x685E, 0x1CE1, 0x0D68, 0x3FF3, 0x2E7A,
    0xE70E, 0xF687, 0xC41C, 0xD595, 0xA12A, 0xB0A3, 0x8238, 0x93B1,
    0x6B46, 0x7ACF, 0x4854, 0x59DD, 0x2D62, 0x3CEB, 0x0E70, 0x1FF9,
    0xF78F, 0xE606, 0xD49D, 0xC514, 0xB1AB, 0xA022, 0x92B9, 0x8330,
    0x7BC7, 0x6A4E, 0x58D5, 0x495C, 0x3DE3, 0x2C6A, 0x1EF1, 0x0F78
]);

function getCrc16(buffer) {
    let fcs = 0xFFFF;
    for (let i = 0; i < buffer.length; i++) {
        fcs = (fcs >> 8) ^ crctab16[(fcs ^ buffer[i]) & 0xFF];
    }
    return (~fcs) & 0xFFFF;
}

// Convert 8 bytes of hex into a 15-digit IMEI string
function parseIMEI(buffer) {
    let imei = '';
    for (let i = 0; i < buffer.length; i++) {
        let hex = buffer[i].toString(16).padStart(2, '0');
        imei += hex;
    }
    // Remove the leading '0' since it's 8 bytes (16 hex chars) but IMEI is 15 digits
    if (imei.startsWith('0')) {
        imei = imei.substring(1);
    }
    return imei;
}

// Parse Login Packet (0x01)
function parseLoginPacket(data) {
    const imeiBuffer = data.slice(4, 12);
    const parsedImei = parseIMEI(imeiBuffer);
    if (!/^\d{15}$/.test(parsedImei)) {
        return { valid: false, error: 'Invalid IMEI format' };
    }
    const serialNumber = data.slice(data.length - 6, data.length - 4);
    const response = Buffer.from([0x78, 0x78, 0x05, 0x01, serialNumber[0], serialNumber[1], 0x00, 0x00, 0x0D, 0x0A]);
    const crcBuf = Buffer.from([0x05, 0x01, serialNumber[0], serialNumber[1]]);
    const crc = getCrc16(crcBuf);
    response.writeUInt16BE(crc, 6);
    return { valid: true, imei: parsedImei, response };
}

// Parse Heartbeat Packet (0x13)
function parseHeartbeatPacket(data) {
    const terminalInfo = data[4] || 0;
    const charging = ((terminalInfo >> 2) & 1) === 1;
    const voltageLevel = data[5];
    const voltageMap = {
        0x06: 100,
        0x05: 85,
        0x04: 70,
        0x03: 50,
        0x02: 25,
        0x01: 10,
        0x00: 0
    };
    const battery = voltageMap[voltageLevel] !== undefined ? voltageMap[voltageLevel] : 100;
    const serialNumber = data.slice(data.length - 6, data.length - 4);
    const response = Buffer.from([0x78, 0x78, 0x05, 0x13, serialNumber[0], serialNumber[1], 0x00, 0x00, 0x0D, 0x0A]);
    const crcBuf = Buffer.from([0x05, 0x13, serialNumber[0], serialNumber[1]]);
    const crc = getCrc16(crcBuf);
    response.writeUInt16BE(crc, 6);
    return { valid: true, battery, charging, response };
}

// Parse Location Packet (0x12)
function parseLocationPacket(data) {
    // Extract UTC Date/Time from bytes 4 to 9
    const year = 2000 + data[4];
    const month = data[5] - 1; // JS months are 0-indexed
    const day = data[6];
    const hour = data[7];
    const minute = data[8];
    const second = data[9];
    const gpsTimestamp = new Date(Date.UTC(year, month, day, hour, minute, second));

    const latBuffer = data.readUInt32BE(11);
    const lonBuffer = data.readUInt32BE(15);
    const speed = data.readUInt8(19);

    let latitude = (latBuffer / 30000.0) / 60.0;
    let longitude = (lonBuffer / 30000.0) / 60.0;

    const courseStatus = data.readUInt16BE(20);
    const course = courseStatus & 0x03FF; // lower 10 bits

    // Extract Hemisphere signs & GPS fix status from Course/Status (BYTE 1)
    const byte1 = (courseStatus >> 8) & 0xFF;
    const isGpsValid = ((byte1 >> 4) & 1) === 1;
    const isWest = ((byte1 >> 3) & 1) === 1;
    const isNorth = ((byte1 >> 2) & 1) === 1;

    if (isWest) longitude = -longitude;
    if (!isNorth) latitude = -latitude;

    let mcc = 0, mnc = 0, lac = 0, cellId = 0;
    if (data.length >= 30) {
        try {
            const mccRaw = data.readUInt16BE(22);
            const mncIsWide = (mccRaw & 0x8000) !== 0;
            mcc = mccRaw & 0x7FFF;
            if (mncIsWide) {
                mnc = data.readUInt16BE(24);
            } else {
                mnc = data.readUInt8(24);
            }
            const lacOffset = 24 + (mncIsWide ? 2 : 1);
            lac = data.readUInt16BE(lacOffset);
            const cellOffset = lacOffset + 2;
            const cellBytes = (mncIsWide && data.length >= cellOffset + 4 + 6) ? 4 : 3;
            cellId = data.readUIntBE(cellOffset, cellBytes);
        } catch (e) {
            // Ignore if length is short
        }
    }

    return {
        valid: true,
        gpsTimestamp: !isNaN(gpsTimestamp.getTime()) ? gpsTimestamp : new Date(),
        latitude,
        longitude,
        speed,
        course,
        isGpsValid,
        mcc,
        mnc,
        lac,
        cellId
    };
}

function parseAsciiPacket(dataString) {
    if (!dataString.startsWith('$M,')) return null;

    const parts = dataString.split(',');
    if (parts.length < 26) return null;

    const imei = parts[1];
    
    // Parse Date (ddmmyy) and Time (hhmmss) GMT
    const gpsStatus = parts[5];
    const dateStr = parts[6];
    const timeStr = parts[7];
    
    let gpsTimestamp = new Date();
    if (dateStr && timeStr && dateStr.length === 6 && timeStr.length === 6) {
        const day = parseInt(dateStr.substring(0, 2), 10);
        const month = parseInt(dateStr.substring(2, 4), 10) - 1;
        const year = 2000 + parseInt(dateStr.substring(4, 6), 10);
        
        const hour = parseInt(timeStr.substring(0, 2), 10);
        const min = parseInt(timeStr.substring(2, 4), 10);
        const sec = parseInt(timeStr.substring(4, 6), 10);
        
        gpsTimestamp = new Date(Date.UTC(year, month, day, hour, min, sec));
    }

    let latitude = parseFloat(parts[8]) || 0;
    if (parts[9] === 'S') latitude = -latitude;
    
    let longitude = parseFloat(parts[10]) || 0;
    if (parts[11] === 'W') longitude = -longitude;

    const speed = parseFloat(parts[12]) || 0; 
    const course = parseFloat(parts[13]) || 0;
    
    const mcc = parseInt(parts[17], 10) || 0;
    const mnc = parseInt(parts[18], 10) || 0;
    
    // Dynamic Cell Tower Parsing
    const cellTowers = [];
    const endOfTowers = parts.length - 6; // Fixed tail is 6 fields (charging, battery, xxxx, frame*checksum)
    for (let i = 19; i < endOfTowers; i += 3) {
        const lac = parseInt(parts[i], 16);
        const cellId = parseInt(parts[i+1], 16);
        const signalStrength = parseInt(parts[i+2], 10) || 0;
        if (lac > 0 && cellId > 0) {
            cellTowers.push({ lac, cellId, signalStrength });
        }
    }

    const primaryLac = cellTowers.length > 0 ? cellTowers[0].lac : 0;
    const primaryCellId = cellTowers.length > 0 ? cellTowers[0].cellId : 0;
    
    // Fixed tail, counted from the end: charging, spare, battery volts, battery percent, reserved, checksum
    const chargeFlag = parts[parts.length - 6];
    const externalPower = parseFloat(parts[parts.length - 5]);
    const chargingRaw = parseInt(chargeFlag, 10) || 0;
    const flagText = String(chargeFlag || '').trim().toLowerCase();
    const batteryVolts = parseFloat(parts[parts.length - 4]) || 0;
    const battery = batteryPercent(parts[parts.length - 3], batteryVolts);
    // The charger flag is 1 while plugged in. Some firmware leaves that flag at 0 and
    // reports the charger voltage in the spare field instead (about 5V on USB).
    const charging = chargingRaw > 0
        || flagText === 'on'
        || flagText === 'true'
        || flagText === 'yes'
        || (Number.isFinite(externalPower) && externalPower >= 4.3);

    return {
        imei,
        gpsTimestamp,
        latitude,
        longitude,
        speed,
        course,
        mcc,
        mnc,
        lac: primaryLac,
        cellId: primaryCellId,
        cellTowers,
        battery,
        reportedBattery: parts[parts.length - 3],
        batteryMv: batteryVolts > 0 ? Math.round(batteryVolts * 1000) : 0,
        charging,
        chargeTail: parts.slice(-6).join('|'),
        gpsStatus
    };
}

function startTrackerServer() {
    learnFromTrackerHistory().catch((err) => {
        console.error(`[CELL ID] Learning cells from GPS history failed: ${err.message}`);
    });
    const server = net.createServer((socket) => {
        let deviceImei = null;

        console.log(`Tracker Connected: ${socket.remoteAddress}:${socket.remotePort}`);

        socket.on('data', async (data) => {
            try {
                // Check if it's the new ASCII Protocol
                if (data[0] === 0x24 && data[1] === 0x4D && data[2] === 0x2C) { // Starts with '$M,'
                    const dataStr = data.toString('utf8').trim();
                    const parsed = parseAsciiPacket(dataStr);
                    
                    if (parsed && parsed.imei) {
                        deviceImei = parsed.imei;
                        activeDevices[deviceImei] = socket;
                        
                        const packetTime = parsed.gpsTimestamp instanceof Date && !isNaN(parsed.gpsTimestamp.getTime())
                            ? parsed.gpsTimestamp
                            : new Date();
                        const existingCharge = await TrackerData.findOne({ imei: deviceImei }).select('battery last_updated').lean();
                        const storedTime = existingCharge && existingCharge.last_updated ? new Date(existingCharge.last_updated) : null;
                        // The tag uploads saved history after it reconnects. An older packet must not
                        // clear a newer "plugged in" state or rewind the live position.
                        if (storedTime && packetTime.getTime() + 2000 < storedTime.getTime()) {
                            console.log(`[ASCII PROTOCOL] IMEI ${deviceImei} skipped stale ${packetTime.toISOString()} < ${storedTime.toISOString()} Charging: ${parsed.charging} Tail: ${parsed.chargeTail}`);
                            return;
                        }

                        const reportedBattery = Number(parsed.reportedBattery);
                        let batteryReading = parsed.battery;
                        // While charging, this firmware sends percent 0. Keep the last real percentage
                        // instead of estimating one from the raised charging voltage.
                        if (parsed.charging && !(Number.isFinite(reportedBattery) && reportedBattery > 0)) {
                            const previousBattery = existingCharge ? Number(existingCharge.battery) || 0 : 0;
                            if (previousBattery > 0) batteryReading = previousBattery;
                        }
                        
                        const servingCell = selectServingCell(parsed.cellTowers, { lac: parsed.lac, cellId: parsed.cellId, signalStrength: 0 });
                        const reportedTowers = (parsed.cellTowers && parsed.cellTowers.length > 0)
                            ? parsed.cellTowers
                            : (servingCell ? [servingCell] : []);
                        if (isGpsFix(parsed.latitude, parsed.longitude, parsed.gpsStatus)) {
                            await rememberGpsCells({
                                mcc: parsed.mcc,
                                mnc: parsed.mnc,
                                towers: reportedTowers,
                                latitude: parsed.latitude,
                                longitude: parsed.longitude
                            });
                        }
                        const dynamicCell = await resolveReportedCells(parsed.mcc, parsed.mnc, reportedTowers);
                        const position = await applyPositionPriority(
                            deviceImei,
                            parsed.latitude,
                            parsed.longitude,
                            parsed.gpsStatus,
                            dynamicCell
                        );

                        if (parsed.cellTowers && parsed.cellTowers.length > 0) {
                            const towerDetails = parsed.cellTowers.map((t, i) => `T${i+1}[LAC:${t.lac.toString(16).toUpperCase()} CID:${t.cellId.toString(16).toUpperCase()} Sig:${t.signalStrength}]`).join(' | ');
                            console.log(`[MULTI-TOWER NETWORK] IMEI ${deviceImei} - ${parsed.cellTowers.length} towers: ${towerDetails}`);
                        }
                        logCellEstimate(deviceImei, dynamicCell);

                        const updatePayload = {
                            deviceType: 'ASCII_TRACKER',
                            speed: parsed.speed, 
                            course: parsed.course,
                            mcc: parsed.mcc,
                            mnc: parsed.mnc,
                            lac: servingCell ? servingCell.lac : parsed.lac,
                            cellId: servingCell ? servingCell.cellId : parsed.cellId,
                            last_updated: parsed.gpsTimestamp,
                            status: 'Online'
                        };
                        if (parsed.batteryMv > 0) updatePayload.batteryMv = parsed.batteryMv;
                        await applyChargeReading(deviceImei, updatePayload, batteryReading, parsed.charging);
                        applyDynamicCell(updatePayload, dynamicCell, parsed.gpsTimestamp);
                        applyLivePosition(updatePayload, position);

                        const mongoUpdate = { 
                          $set: updatePayload
                        };
                        
                        if (position.placed) {
                            mongoUpdate.$push = {
                                path_history: {
                                    $each: [{
                                        lat: position.lat,
                                        lng: position.lng,
                                        timestamp: parsed.gpsTimestamp,
                                        locationType: position.locationType,
                                        accuracy: position.accuracy,
                                        cellId: dynamicCell ? dynamicCell.cellId : parsed.cellId,
                                        lac: dynamicCell ? dynamicCell.lac : parsed.lac,
                                        mcc: parsed.mcc,
                                        mnc: parsed.mnc,
                                        cellLat: dynamicCell ? dynamicCell.latitude : 0,
                                        cellLng: dynamicCell ? dynamicCell.longitude : 0,
                                        cellLocation: dynamicCell ? dynamicCell.approximateLocation : ''
                                    }],
                                    $slice: -500
                                }
                            };
                        }

                        await TrackerData.findOneAndUpdate(
                            { imei: deviceImei },
                            mongoUpdate,
                            { upsert: true }
                        );

                        runSafetyPipeline(deviceImei, position, {
                            speed: parsed.speed,
                            course: parsed.course,
                            battery: batteryReading,
                            deviceTimestamp: parsed.gpsTimestamp,
                        });

                        console.log(`[ASCII PROTOCOL] IMEI ${deviceImei} - Time: ${packetTime.toISOString()}, Source: ${position.locationType || 'cell metadata only'}, Lat: ${position.lat}, Lon: ${position.lng}, Speed: ${parsed.speed}km/h, Battery: ${batteryReading}%, Charging: ${parsed.charging}, Tail: ${parsed.chargeTail}`);
                        
                        // Send ASCII Acknowledgment back if required (optional, many trackers just need TCP ACK)
                        // socket.write(`$M,ACK,${deviceImei}*\r\n`);
                    }
                    return; // Done processing ASCII
                }

                // Minimum GT06 packet is 10 bytes: Start(2) + Length(1) + Protocol(1) + Info(...) + Serial(2) + Error(2) + Stop(2)
                if (data.length < 10) return;

                // Check Start Bits 0x78 0x78
                if (data[0] !== 0x78 || data[1] !== 0x78) return;

                const protocolNumber = data[3];

                // Login Packet (0x01)
                if (protocolNumber === 0x01) {
                    const parsed = parseLoginPacket(data);
                    if (!parsed.valid) {
                        console.warn(`Tracker Login failed: ${parsed.error}`);
                        return;
                    }
                    deviceImei = parsed.imei;
                    activeDevices[deviceImei] = socket;
                    console.log(`Tracker Logged In: IMEI ${deviceImei}`);

                    socket.write(parsed.response);
                    
                    // Upsert default tracker state if not exists
                    await TrackerData.findOneAndUpdate(
                        { imei: deviceImei },
                        { 
                          $set: { imei: deviceImei, status: 'Online', deviceType: 'GT06' },
                          $setOnInsert: { battery: 100 }
                        },
                        { upsert: true }
                    );
                }
                
                // Heartbeat / Status Packet (0x13)
                else if (protocolNumber === 0x13) {
                    if (deviceImei) {
                        const parsed = parseHeartbeatPacket(data);
                        socket.write(parsed.response);
                        
                        const heartbeatUpdate = {
                            last_updated: new Date(),
                            status: 'Online',
                            deviceType: 'GT06'
                        };
                        await applyChargeReading(deviceImei, heartbeatUpdate, parsed.battery, parsed.charging);
                        await TrackerData.findOneAndUpdate(
                            { imei: deviceImei },
                            { $set: heartbeatUpdate }
                        );
                        console.log(`GT06 Heartbeat Received: IMEI ${deviceImei} - Battery: ${parsed.battery}% charging: ${parsed.charging}`);
                    }
                }
                
                // Location Data Packet (0x12)
                else if (protocolNumber === 0x12) {
                    if (!deviceImei) return;

                    const parsed = parseLocationPacket(data);

                    const gpsLat = (parsed.isGpsValid && parsed.latitude !== 0 && parsed.longitude !== 0) ? parsed.latitude : 0;
                    const gpsLng = (parsed.isGpsValid && parsed.latitude !== 0 && parsed.longitude !== 0) ? parsed.longitude : 0;
                    const servingCell = selectServingCell(
                        parsed.cellId > 0 ? [{ lac: parsed.lac, cellId: parsed.cellId, signalStrength: 0 }] : [],
                        null
                    );
                    if (isGpsFix(gpsLat, gpsLng, parsed.isGpsValid ? 'A' : '0')) {
                        await rememberGpsCells({
                            mcc: parsed.mcc,
                            mnc: parsed.mnc,
                            towers: servingCell ? [servingCell] : [],
                            latitude: gpsLat,
                            longitude: gpsLng
                        });
                    }
                    const dynamicCell = await resolveReportedCells(
                        parsed.mcc,
                        parsed.mnc,
                        servingCell ? [servingCell] : []
                    );
                    const position = await applyPositionPriority(
                        deviceImei,
                        gpsLat,
                        gpsLng,
                        parsed.isGpsValid ? 'A' : '0',
                        dynamicCell
                    );

                    const updatePayload = {
                        deviceType: 'GT06',
                        speed: parsed.speed, 
                        course: parsed.course,
                        mcc: parsed.mcc,
                        mnc: parsed.mnc,
                        lac: servingCell ? servingCell.lac : parsed.lac,
                        cellId: servingCell ? servingCell.cellId : parsed.cellId,
                        last_updated: parsed.gpsTimestamp,
                        status: 'Online'
                    };
                    applyDynamicCell(updatePayload, dynamicCell, parsed.gpsTimestamp);
                    applyLivePosition(updatePayload, position);

                    const mongoUpdate = { 
                      $set: updatePayload,
                      $setOnInsert: { battery: 100 }
                    };
                    if (position.placed) {
                        mongoUpdate.$push = {
                            path_history: {
                                $each: [{
                                    lat: position.lat,
                                    lng: position.lng,
                                    timestamp: parsed.gpsTimestamp,
                                    locationType: position.locationType,
                                    accuracy: position.accuracy,
                                    cellId: dynamicCell ? dynamicCell.cellId : parsed.cellId,
                                    lac: dynamicCell ? dynamicCell.lac : parsed.lac,
                                    mcc: parsed.mcc,
                                    mnc: parsed.mnc,
                                    cellLat: dynamicCell ? dynamicCell.latitude : 0,
                                    cellLng: dynamicCell ? dynamicCell.longitude : 0,
                                    cellLocation: dynamicCell ? dynamicCell.approximateLocation : ''
                                }],
                                $slice: -500
                            }
                        };
                    }

                    // Update MongoDB
                    await TrackerData.findOneAndUpdate(
                        { imei: deviceImei },
                        mongoUpdate,
                        { upsert: true }
                    );
                    
                    runSafetyPipeline(deviceImei, position, {
                        speed: parsed.speed,
                        course: parsed.course,
                        deviceTimestamp: parsed.gpsTimestamp,
                    });
                    
                    if (position.locationType === 'GPS' && position.placed) {
                        console.log(`[SATELLITE GPS FIX] IMEI ${deviceImei} - Lat: ${position.lat}, Lon: ${position.lng}, Speed: ${parsed.speed}km/h, Course: ${parsed.course}° (Satellite Fix)`);
                    } else if (position.locationType === 'CELL_TOWER' && position.placed) {
                        console.log(`[CELL TOWER FALLBACK] IMEI ${deviceImei} - CellID ${dynamicCell.cellId}, LAC ${dynamicCell.lac} -> ${position.lat}, ${position.lng}`);
                    }
                    logCellEstimate(deviceImei, dynamicCell);
                }

                // Peripheral Packet (0x90) - Arcmos Electronics Spec
                else if (protocolNumber === 0x90) {
                    if (deviceImei) {
                        const serialNumber = data.slice(data.length - 6, data.length - 4);
                        const response = Buffer.from([0x78, 0x78, 0x05, 0x90, serialNumber[0], serialNumber[1], 0x00, 0x00, 0x0D, 0x0A]);
                        const crcBuf = Buffer.from([0x05, 0x90, serialNumber[0], serialNumber[1]]);
                        const crc = getCrc16(crcBuf);
                        response.writeUInt16BE(crc, 6);
                        
                        socket.write(response);
                        console.log(`Arcmos Peripheral Alert Received: IMEI ${deviceImei}`);
                    }
                }
            } catch (err) {
                console.error("GT06 Parsing Error:", err);
            }
        });

        socket.on('close', async () => {
            console.log(`Tracker Disconnected: ${deviceImei || 'Unknown'}`);
            if (deviceImei) {
                delete activeDevices[deviceImei];
                try {
                    await TrackerData.findOneAndUpdate(
                        { imei: deviceImei },
                        { status: 'Offline' }
                    );
                } catch(e) {}
            }
        });

        socket.on('error', (err) => {
            console.error("Socket Error:", err.message);
        });
    });

    const PORT = 5023;
    server.listen(PORT, () => {
        console.log(`GT06 TCP Tracker Server listening on port ${PORT}`);
        warmupCellIndex()
            .catch((err) => console.error(`Cell tower index warmup failed: ${err.message}`));
    });
}

startTrackerServer.parseIMEI = parseIMEI;
startTrackerServer.getCrc16 = getCrc16;
startTrackerServer.parseLoginPacket = parseLoginPacket;
startTrackerServer.parseHeartbeatPacket = parseHeartbeatPacket;
startTrackerServer.parseLocationPacket = parseLocationPacket;

module.exports = startTrackerServer;
