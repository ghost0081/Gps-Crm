const assert = require('assert');
const trackerServer = require('./tracker-server.js');

console.log("=== Running GT06 Protocol Unit Test Suite (0x01, 0x13, 0x12) ===\n");

// Test 1: Login Packet (0x01)
// Example from manual: 78 78 0D 01 03 53 41 90 33 41 28 36 00 0D 33 51 0D 0A
const loginHex = "78780D010353419033412836000D33510D0A";
const loginBuf = Buffer.from(loginHex, 'hex');
const loginResult = trackerServer.parseLoginPacket(loginBuf);

console.log("[Test 1] Testing Login Packet (0x01)...");
assert.strictEqual(loginResult.valid, true, "Login packet should be valid");
assert.strictEqual(loginResult.imei, "353419033412836", "IMEI should match 353419033412836");
assert.strictEqual(loginResult.response[0], 0x78, "ACK Start byte 1 should be 0x78");
assert.strictEqual(loginResult.response[1], 0x78, "ACK Start byte 2 should be 0x78");
assert.strictEqual(loginResult.response[2], 0x05, "ACK Length byte should be 0x05");
assert.strictEqual(loginResult.response[3], 0x01, "ACK Protocol byte should be 0x01");
console.log("  -> PASS: IMEI extracted correctly and valid ACK generated.\n");

// Test 2: Heartbeat Packet (0x13)
// Example from manual: 78 78 0A 13 40 04 04 00 02 00 0F DC EE 0D 0A
const heartbeatHex = "78780A134004040002000FDCEE0D0A";
const heartbeatBuf = Buffer.from(heartbeatHex, 'hex');
const heartbeatResult = trackerServer.parseHeartbeatPacket(heartbeatBuf);

console.log("[Test 2] Testing Heartbeat Packet (0x13)...");
assert.strictEqual(heartbeatResult.valid, true, "Heartbeat packet should be valid");
assert.strictEqual(heartbeatResult.battery, 70, "Voltage 0x04 should map to 70% battery");
assert.strictEqual(heartbeatResult.response[3], 0x13, "ACK Protocol byte should be 0x13");
console.log("  -> PASS: Voltage 0x04 mapped to 70% battery and valid ACK generated.\n");

// Test 3: Location Packet (0x12)
// Example from manual: 78 78 1F 12 0F 0C 1D 0B 0F 34 C6 02 7A C7 4C 0C 46 58 10 00 14 D4 01 CC 00 28 7D 00 1F 71 00 26 23 09 0D 0A
const locationHex = "78781F120F0C1D0B0F34C6027AC74C0C4658100014D401CC00287D001F71002623090D0A";
const locationBuf = Buffer.from(locationHex, 'hex');
const locationResult = trackerServer.parseLocationPacket(locationBuf);

console.log("[Test 3] Testing Location Packet (0x12)...");
assert.strictEqual(locationResult.valid, true, "Location packet should be valid");
// 0x0F = 15 (Year 2015), 0x0C = 12 (Month 12), 0x1D = 29 (Day 29), 0x0B = 11 (Hour 11), 0x0F = 15 (Min 15), 0x34 = 52 (Sec 52)
assert.strictEqual(locationResult.gpsTimestamp.toISOString(), "2015-12-29T11:15:52.000Z", "UTC Timestamp should be 2015-12-29T11:15:52.000Z");
assert.strictEqual(locationResult.isGpsValid, true, "GPS fix should be valid (Bit 4 = 1)");
assert.ok(locationResult.latitude > 0, "Latitude should be positive (North)");
assert.ok(locationResult.longitude > 0, "Longitude should be positive (East)");
console.log("  -> PASS: UTC timestamp 2015-12-29T11:15:52.000Z, coordinates, and fix status parsed correctly.\n");

const wide = Buffer.alloc(37);
wide.writeUInt16BE(0x7878, 0);
wide[2] = 0x20;
wide[3] = 0x12;
wide.writeUInt16BE(0x8000 | 404, 22);
wide.writeUInt16BE(862, 24);
wide.writeUInt16BE(1000, 26);
wide.writeUIntBE(0x1f7100, 28, 3);
wide.writeUInt16BE(0x0d0a, 35);
const wideResult = trackerServer.parseLocationPacket(wide);
assert.strictEqual(wideResult.mcc, 404, "wide MNC packet keeps the reported MCC");
assert.strictEqual(wideResult.mnc, 862, "MNC above 255 is read from the packet");
assert.strictEqual(wideResult.lac, 1000, "LAC follows the two-byte MNC");
assert.strictEqual(wideResult.cellId, 0x1f7100, "Cell ID follows the reported LAC");
console.log("  -> PASS: two-byte MNC is taken from the packet.\n");

console.log("=== ALL GT06 UNIT TESTS PASSED SUCCESSFULLY! ===");
