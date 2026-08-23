import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../../../services/api_service.dart';
import '../../theme.dart';
import '../../widgets/premium_card.dart';
import '../../widgets/page_header.dart';

class AdminTracker extends StatefulWidget {
  const AdminTracker({super.key});

  @override
  State<AdminTracker> createState() => _AdminTrackerState();
}

class _AdminTrackerState extends State<AdminTracker> {
  final MapController _mapController = MapController();
  List<String> _activeDevices = [];
  String? _selectedDevice;
  Map<String, dynamic>? _trackerData;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchActiveDevices();
  }

  Future<void> _fetchActiveDevices() async {
    try {
      final rawDevices = await ApiService().getActiveDevices();
      _activeDevices = rawDevices.map((e) => e.toString()).toList();
      if (_activeDevices.isNotEmpty) {
        _selectedDevice = _activeDevices.first;
        _fetchDeviceTelemetry(_selectedDevice!);
      }
    } catch (e) {
      debugPrint(e.toString());
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _fetchDeviceTelemetry(String deviceId) async {
    try {
      final data = await ApiService().getDeviceData(deviceId);
      if (mounted) {
        setState(() {
          _trackerData = data;
        });
        if (data['latitude'] != null && data['longitude'] != null && data['latitude'] != 0) {
          _mapController.move(LatLng(data['latitude'].toDouble(), data['longitude'].toDouble()), 15.0);
        }
      }
    } catch (e) {
      debugPrint(e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator(color: AppTheme.primaryColor));
    }

    final double lat = (_trackerData?['latitude'] ?? 28.6139).toDouble();
    final double lng = (_trackerData?['longitude'] ?? 77.2090).toDouble();

    String status = _trackerData?['status'] ?? 'Offline';
    final lastUpdatedStr = _trackerData?['last_updated'];
    if (lastUpdatedStr != null) {
      final lastUpdatedDate = DateTime.tryParse(lastUpdatedStr.toString());
      if (lastUpdatedDate != null) {
        final diff = DateTime.now().toUtc().difference(lastUpdatedDate.toUtc()).inSeconds.abs();
        if (diff > 120) status = 'Offline';
      }
    } else {
      status = 'Offline';
    }
    final isOnline = status == 'Online';

    return Padding(
      padding: const EdgeInsets.all(24.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const PageHeader(
            title: 'Live GPS Wearable Map',
            subtitle: 'Monitor all GT06 & BLE student wearables in real-time.',
          ),

          // Device Selector Dropdown Card
          PremiumCard(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                const Icon(Icons.devices_rounded, color: AppTheme.primaryColor),
                const SizedBox(width: 12),
                Expanded(
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: _selectedDevice,
                      hint: const Text('Select Active Wearable'),
                      isExpanded: true,
                      items: _activeDevices.map((d) => DropdownMenuItem(value: d, child: Text('Device: $d'))).toList(),
                      onChanged: (val) {
                        if (val != null) {
                          setState(() => _selectedDevice = val);
                          _fetchDeviceTelemetry(val);
                        }
                      },
                    ),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.refresh_rounded, color: AppTheme.primaryColor),
                  onPressed: () {
                    if (_selectedDevice != null) _fetchDeviceTelemetry(_selectedDevice!);
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Status, Battery & Type Bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              color: isOnline ? const Color(0xFFD1FAE5) : const Color(0xFFFEE2E2),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Icon(
                  isOnline ? Icons.signal_cellular_alt_rounded : Icons.signal_cellular_connected_no_internet_0_bar_rounded,
                  color: isOnline ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                ),
                const SizedBox(width: 8),
                Text(
                  'Status: $status',
                  style: TextStyle(
                    color: isOnline ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const Spacer(),
                Icon(
                  (_trackerData?['battery'] ?? 0) > 50 ? Icons.battery_full_rounded : Icons.battery_alert_rounded,
                  size: 18,
                  color: (_trackerData?['battery'] ?? 0) > 50 ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                ),
                const SizedBox(width: 4),
                Text(
                  '${_trackerData?['battery'] ?? 0}% (${_trackerData?['deviceType'] ?? 'BLE'})',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Leaflet Map Container
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(20),
              child: Container(
                decoration: BoxDecoration(
                  border: Border.all(color: AppTheme.borderColor),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: FlutterMap(
                  mapController: _mapController,
                  options: MapOptions(
                    initialCenter: LatLng(lat, lng),
                    initialZoom: 14.0,
                  ),
                  children: [
                    TileLayer(
                      urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                      userAgentPackageName: 'com.crmschool.mobile',
                    ),
                    MarkerLayer(
                      markers: [
                        Marker(
                          point: LatLng(lat, lng),
                          width: 44,
                          height: 44,
                          child: Container(
                            decoration: BoxDecoration(
                              color: AppTheme.primaryColor,
                              shape: BoxShape.circle,
                              border: Border.all(color: Colors.white, width: 3),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withOpacity(0.2),
                                  blurRadius: 10,
                                ),
                               ],
                            ),
                            child: const Icon(Icons.directions_bus_rounded, color: Colors.white, size: 22),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
