import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
import '../../services/ble_gateway_service.dart';
import '../../theme.dart';
import '../../widgets/premium_card.dart';

class DeviceLocator extends StatefulWidget {
  final String imei;
  final String deviceName;

  const DeviceLocator({
    super.key,
    required this.imei,
    this.deviceName = 'Tracker Device',
  });

  @override
  State<DeviceLocator> createState() => _DeviceLocatorState();
}

class _DeviceLocatorState extends State<DeviceLocator> with SingleTickerProviderStateMixin {
  late AnimationController _pulseController;
  Timer? _refreshTimer;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat(reverse: true);

    // Auto-start scanning if not scanning
    if (!BleGatewayService.instance.isScanning) {
      BleGatewayService.instance.startScanning();
    }

    _refreshTimer = Timer.periodic(const Duration(milliseconds: 500), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _refreshTimer?.cancel();
    super.dispose();
  }

  double _calculateDistanceMeters(int rssi) {
    if (rssi == 0) return -1.0;
    // TxPower = -59 dBm at 1 meter, n = 2.0 (path-loss exponent)
    const int txPower = -59;
    final double ratio = (txPower - rssi) / 20.0;
    return pow(10, ratio).toDouble();
  }

  String _getProximityLabel(int rssi) {
    if (rssi == 0) return 'Searching for BLE signal...';
    if (rssi > -60) return '🔥 Immediate / Very Close (< 1m)';
    if (rssi > -75) return '⚡ Near (1 - 3m)';
    if (rssi > -88) return '📍 Far (3 - 8m)';
    return '🧊 Very Weak Signal / Out of Range (> 8m)';
  }

  Color _getProximityColor(int rssi) {
    if (rssi == 0) return Colors.grey;
    if (rssi > -60) return const Color(0xFF10B981);
    if (rssi > -75) return const Color(0xFF3B82F6);
    if (rssi > -88) return const Color(0xFFF59E0B);
    return const Color(0xFFEF4444);
  }

  @override
  Widget build(BuildContext context) {
    final rssiMap = BleGatewayService.instance.latestRssiMap;
    final rssi = rssiMap[widget.imei] ?? 0;
    final distanceMeters = _calculateDistanceMeters(rssi);
    final proximityText = _getProximityLabel(rssi);
    final proximityColor = _getProximityColor(rssi);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text('Find Tracker: ${widget.deviceName}'),
        backgroundColor: AppTheme.primaryColor,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          children: [
            // Radar Visual Header
            AnimatedBuilder(
              animation: _pulseController,
              builder: (context, child) {
                final scale = 1.0 + (_pulseController.value * 0.15);
                return Container(
                  height: 220,
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: proximityColor.withAlpha(25),
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: proximityColor.withAlpha(100), width: 2),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Transform.scale(
                        scale: scale,
                        child: Container(
                          padding: const EdgeInsets.all(24),
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: proximityColor.withAlpha(50),
                            boxShadow: [
                              BoxShadow(
                                color: proximityColor.withAlpha(80),
                                blurRadius: 20 * scale,
                                spreadRadius: 5 * scale,
                              ),
                            ],
                          ),
                          child: Icon(
                            Icons.radar_rounded,
                            size: 64,
                            color: proximityColor,
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        proximityText,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: proximityColor,
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
            const SizedBox(height: 20),

            // Live Proximity & Signal Metrics Card
            PremiumCard(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'BLE Signal Strength (RSSI)',
                        style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                      ),
                      Text(
                        rssi != 0 ? '$rssi dBm' : 'No Signal',
                        style: TextStyle(
                          fontWeight: FontWeight.w900,
                          fontSize: 16,
                          color: proximityColor,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  LinearProgressIndicator(
                    value: rssi != 0 ? ((rssi + 100) / 60).clamp(0.0, 1.0) : 0.0,
                    backgroundColor: Colors.grey.shade200,
                    color: proximityColor,
                    minHeight: 10,
                    borderRadius: BorderRadius.circular(5),
                  ),
                  const SizedBox(height: 20),
                  const Divider(),
                  const SizedBox(height: 12),

                  // Distance Estimation Meter
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: AppTheme.primaryColor.withAlpha(30),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(Icons.straighten_rounded, color: AppTheme.primaryColor),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Estimated Proximity Distance',
                              style: TextStyle(color: Colors.grey, fontSize: 12, fontWeight: FontWeight.w600),
                            ),
                            Text(
                              distanceMeters > 0
                                  ? '~ ${distanceMeters.toStringAsFixed(1)} meters away'
                                  : 'Bring mobile phone closer to BLE tracker',
                              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Tracker Details Info Card
            PremiumCard(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Device Info', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                  const SizedBox(height: 10),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Device Name', style: TextStyle(color: Colors.grey)),
                      Text(widget.deviceName, style: const TextStyle(fontWeight: FontWeight.w700)),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Tracker IMEI', style: TextStyle(color: Colors.grey)),
                      Text(widget.imei, style: const TextStyle(fontWeight: FontWeight.w700)),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Gateway Scan Mode', style: TextStyle(color: Colors.grey)),
                      Text(
                        BleGatewayService.instance.isScanning ? 'Scanning Live ⚡' : 'Idle',
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          color: BleGatewayService.instance.isScanning ? const Color(0xFF10B981) : Colors.grey,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
