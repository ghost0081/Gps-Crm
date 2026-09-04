import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
import '../../services/ble_gateway_service.dart';
import 'package:flutter/services.dart';

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

class _DeviceLocatorState extends State<DeviceLocator> with TickerProviderStateMixin {
  late AnimationController _pulseController;
  late AnimationController _fadeController;
  Timer? _refreshTimer;
  
  double _lastDistance = -1;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat(reverse: false);

    _fadeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    )..forward();

    // Auto-start scanning if not scanning
    if (!BleGatewayService.instance.isScanning) {
      BleGatewayService.instance.startScanning();
    }

    _refreshTimer = Timer.periodic(const Duration(milliseconds: 300), (_) {
      if (mounted) _updateData();
    });
  }
  
  void _updateData() {
    final rssiMap = BleGatewayService.instance.latestRssiMap;
    final rssi = rssiMap[widget.imei] ?? 0;
    final distance = _calculateDistanceMeters(rssi);
    
    if (_lastDistance > 0 && distance > 0 && distance < 2.0 && _lastDistance - distance > 0.3) {
      HapticFeedback.lightImpact();
    }
    
    if (_lastDistance != distance) {
      setState(() {
        _lastDistance = distance;
      });
    }
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _fadeController.dispose();
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

  Color _getBackgroundColor(double distance) {
    if (distance < 0) return const Color(0xFF1C1C1E); // Black/Dark Grey
    if (distance <= 1.0) return const Color(0xFF10B981); // Green - Here
    if (distance <= 5.0) return const Color(0xFF007AFF); // Blue - Near
    return const Color(0xFF1C1C1E);
  }

  String _getProximityLabel(double distance) {
    if (distance < 0) return 'Searching for signal...';
    if (distance <= 1.0) return 'here';
    if (distance <= 5.0) return 'near';
    return 'far';
  }

  @override
  Widget build(BuildContext context) {
    final bgColor = _getBackgroundColor(_lastDistance);
    final label = _getProximityLabel(_lastDistance);
    
    return Scaffold(
      backgroundColor: bgColor,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
        title: Text(widget.deviceName, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
        centerTitle: true,
      ),
      body: SafeArea(
        child: Column(
          children: [
            const Spacer(flex: 1),
            if (_lastDistance > 0)
              FadeTransition(
                opacity: _fadeController,
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Text(
                          _lastDistance.toStringAsFixed(1),
                          style: const TextStyle(
                            fontSize: 100,
                            fontWeight: FontWeight.w200,
                            color: Colors.white,
                            letterSpacing: -4,
                          ),
                        ),
                        const SizedBox(width: 8),
                        const Text(
                          'm',
                          style: TextStyle(
                            fontSize: 32,
                            fontWeight: FontWeight.w500,
                            color: Colors.white70,
                          ),
                        ),
                      ],
                    ),
                    Text(
                      label,
                      style: const TextStyle(
                        fontSize: 36,
                        fontWeight: FontWeight.w400,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
              )
            else
              const Column(
                children: [
                  Text(
                    'Searching...',
                    style: TextStyle(
                      fontSize: 42,
                      fontWeight: FontWeight.w300,
                      color: Colors.white,
                    ),
                  ),
                  SizedBox(height: 12),
                  Text(
                    'Walk around to find the tracker',
                    style: TextStyle(
                      fontSize: 16,
                      color: Colors.white54,
                    ),
                  ),
                ],
              ),
            
            const Spacer(flex: 2),

            SizedBox(
              height: 300,
              child: AnimatedBuilder(
                animation: _pulseController,
                builder: (context, child) {
                  return Stack(
                    alignment: Alignment.center,
                    children: [
                      Container(
                        width: 20,
                        height: 20,
                        decoration: const BoxDecoration(
                          color: Colors.white,
                          shape: BoxShape.circle,
                        ),
                      ),
                      if (_lastDistance > 0)
                        Transform.scale(
                          scale: 1.0 + (_pulseController.value * 3),
                          child: Opacity(
                            opacity: 1.0 - _pulseController.value,
                            child: Container(
                              width: 60,
                              height: 60,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: Colors.white.withOpacity(0.6),
                                  width: 2,
                                ),
                              ),
                            ),
                          ),
                        )
                      else 
                        Transform.scale(
                          scale: 1.0 + (_pulseController.value * 1.5),
                          child: Opacity(
                            opacity: (1.0 - _pulseController.value) * 0.5,
                            child: Container(
                              width: 100,
                              height: 100,
                              decoration: const BoxDecoration(
                                shape: BoxShape.circle,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ),
                    ],
                  );
                }
              ),
            ),
            const Spacer(flex: 1),
            
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 32.0, vertical: 32.0),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 24),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(30),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.bluetooth_searching_rounded, color: Colors.white, size: 24),
                    const SizedBox(width: 12),
                    Text(
                      'IMEI: ',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w600,
                        fontSize: 16,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
