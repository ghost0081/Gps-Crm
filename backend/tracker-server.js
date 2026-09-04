const net = require('net');
const TrackerData = require('./models/trackerSchema');
const { resolveCellLocation } = require('./services/lbs-service');

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
    return { valid: true, battery, response };
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
            mcc = data.readUInt16BE(22);
            mnc = data.readUInt8(24);
            lac = data.readUInt16BE(25);
            cellId = data.readUIntBE(27, 3);
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

function startTrackerServer() {
    const server = net.createServer((socket) => {
        let deviceImei = null;

        console.log(`Tracker Connected: ${socket.remoteAddress}:${socket.remotePort}`);

        socket.on('data', async (data) => {
            try {
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
                        
                        await TrackerData.findOneAndUpdate(
                            { imei: deviceImei },
                            { last_updated: new Date(), status: 'Online', battery: parsed.battery, deviceType: 'GT06' }
                        );
                        console.log(`GT06 Heartbeat Received: IMEI ${deviceImei} - Battery: ${parsed.battery}%`);
                    }
                }
                
                // Location Data Packet (0x12)
                else if (protocolNumber === 0x12) {
                    if (!deviceImei) return;

                    const parsed = parseLocationPacket(data);

                    let finalLat = 0;
                    let finalLng = 0;
                    let locationType = 'GPS';
                    let accuracy = 10;
                    let isLiveFix = false;

                    if (parsed.isGpsValid && parsed.latitude !== 0 && parsed.longitude !== 0) {
                        finalLat = parsed.latitude;
                        finalLng = parsed.longitude;
                        locationType = 'GPS';
                        accuracy = 10;
                        isLiveFix = true;
                    } else if (parsed.cellId > 0) {
                        // Resolve LBS Cell Tower location when GPS Satellite Fix is unavailable / indoor
                        try {
                            const lbsFix = await resolveCellLocation({
                                mcc: parsed.mcc,
                                mnc: parsed.mnc,
                                lac: parsed.lac,
                                cellId: parsed.cellId
                            });

                            if (lbsFix) {
                                finalLat = lbsFix.latitude;
                                finalLng = lbsFix.longitude;
                                locationType = 'CELL_TOWER';
                                accuracy = lbsFix.accuracy || 300;
                                isLiveFix = true;
                                console.log(`[CELL TOWER LBS FIX] IMEI ${deviceImei} - CellID: ${parsed.cellId}, LAC: ${parsed.lac} -> Resolved Lat: ${finalLat}, Lon: ${finalLng} (Indoor Cell Tower)`);
                            }
                        } catch (err) {
                            console.error(`LBS resolution error: ${err.message}`);
                        }
                    }

                    const updatePayload = {
                        deviceType: 'GT06',
                        speed: parsed.speed, 
                        course: parsed.course,
                        mcc: parsed.mcc,
                        mnc: parsed.mnc,
                        lac: parsed.lac,
                        cellId: parsed.cellId,
                        locationType: locationType,
                        accuracy: accuracy,
                        last_updated: parsed.gpsTimestamp,
                        status: 'Online'
                    };

                    if (isLiveFix && finalLat !== 0 && finalLng !== 0) {
                        updatePayload.latitude = finalLat;
                        updatePayload.longitude = finalLng;
                    }

                    const mongoUpdate = { 
                      $set: updatePayload,
                      $setOnInsert: { battery: 100 }
                    };
                    if (isLiveFix && finalLat !== 0 && finalLng !== 0) {
                        mongoUpdate.$push = {
                            path_history: {
                                $each: [{ lat: finalLat, lng: finalLng, timestamp: parsed.gpsTimestamp, locationType: locationType, accuracy: accuracy, cellId: parsed.cellId, lac: parsed.lac }],
                                $slice: -500 // Keep last 500 coordinates
                            }
                        };
                    }

                    // Update MongoDB
                    await TrackerData.findOneAndUpdate(
                        { imei: deviceImei },
                        mongoUpdate,
                        { upsert: true }
                    );
                    
                    if (locationType === 'GPS') {
                        console.log(`[SATELLITE GPS FIX] IMEI ${deviceImei} - Lat: ${finalLat}, Lon: ${finalLng}, Speed: ${parsed.speed}km/h, Course: ${parsed.course}° (Satellite Fix)`);
                    } else if (locationType === 'CELL_TOWER') {
                        console.log(`[CELL TOWER LBS FIX] IMEI ${deviceImei} - CellID: ${parsed.cellId}, LAC: ${parsed.lac} -> Resolved Lat: ${finalLat}, Lon: ${finalLng} (Indoor Cell Tower)`);
                    }
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
    });
}

startTrackerServer.parseIMEI = parseIMEI;
startTrackerServer.getCrc16 = getCrc16;
startTrackerServer.parseLoginPacket = parseLoginPacket;
startTrackerServer.parseHeartbeatPacket = parseHeartbeatPacket;
startTrackerServer.parseLocationPacket = parseLocationPacket;

module.exports = startTrackerServer;
