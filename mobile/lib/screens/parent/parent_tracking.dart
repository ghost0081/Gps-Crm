import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'dart:math' as math;
import 'dart:async';
import '../../../providers/auth_provider.dart';
import '../../../services/api_service.dart';
import '../../theme.dart';
import '../../widgets/premium_card.dart';
import '../../widgets/page_header.dart';
import 'device_locator.dart';

class ParentTracking extends StatefulWidget {
  const ParentTracking({super.key});

  @override
  State<ParentTracking> createState() => _ParentTrackingState();
}

class _ParentTrackingState extends State<ParentTracking> {
  bool _isLoading = true;
  bool _isSavingGeofence = false;
  Map<String, dynamic>? _trackerData;
  Timer? _timer;
  final MapController _mapController = MapController();

  List<Map<String, dynamic>> _geofences = [
    {
      'lat': 0.0,
      'lng': 0.0,
      'radius': 10,
      'name': 'Home Safe Zone',
      'enabled': false,
    }
  ];
  int _activeEditingIndex = 0;
  bool _isEditingGeofence = false;

  @override
  void initState() {
    super.initState();
    _fetchTrackerData();
    _timer = Timer.periodic(const Duration(seconds: 5), (timer) {
      if (!_isEditingGeofence) {
        _fetchTrackerData();
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  double _calculateDistanceMeters(double lat1, double lon1, double lat2, double lon2) {
    if (lat1 == 0 || lon1 == 0 || lat2 == 0 || lon2 == 0) return 999999;
    const r = 6371000.0;
    final dLat = (lat2 - lat1) * (math.pi / 180);
    final dLon = (lon2 - lon1) * (math.pi / 180);
    final a = math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(lat1 * (math.pi / 180)) *
            math.cos(lat2 * (math.pi / 180)) *
            math.sin(dLon / 2) *
            math.sin(dLon / 2);
    final c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
    return r * c;
  }

  Future<void> _fetchTrackerData() async {
    try {
      final user = Provider.of<AuthProvider>(context, listen: false).currentUser;
      if (user?.studentId != null) {
        final data = await ApiService().getDeviceData(user!.studentId!);
        if (mounted) {
          setState(() {
            _trackerData = data;
            if (!_isEditingGeofence) {
              if (data['geofences'] != null && (data['geofences'] as List).isNotEmpty) {
                _geofences = (data['geofences'] as List).map((gf) => {
                  'name': gf['name'] ?? 'Safe Zone',
                  'lat': (gf['lat'] ?? 0).toDouble(),
                  'lng': (gf['lng'] ?? 0).toDouble(),
                  'radius': (gf['radius'] ?? 10).toInt(),
                  'enabled': gf['enabled'] ?? true,
                }).toList().cast<Map<String, dynamic>>();
              } else if (data['geofence'] != null) {
                final gf = data['geofence'] as Map;
                if ((gf['lat'] ?? 0) != 0) {
                  _geofences = [{
                    'name': gf['name'] ?? 'Safe Zone',
                    'lat': (gf['lat'] ?? 0).toDouble(),
                    'lng': (gf['lng'] ?? 0).toDouble(),
                    'radius': (gf['radius'] ?? 10).toInt(),
                    'enabled': gf['enabled'] ?? false,
                  }];
                }
              }
            }
            _isLoading = false;
          });
        }
      }
    } catch (e) {
      debugPrint("Error fetching tracker data: $e");
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _saveGeofence() async {
    final user = Provider.of<AuthProvider>(context, listen: false).currentUser;
    if (user?.studentId == null) return;

    setState(() {
      _isSavingGeofence = true;
    });

    try {
      await ApiService().updateGeofence(user!.studentId!, {
        'geofences': _geofences,
      });
      setState(() {
        _isEditingGeofence = false;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('All Safe Zones saved successfully!'),
            backgroundColor: Color(0xFF10B981),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to save safe zones: $e'), backgroundColor: const Color(0xFFEF4444)),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isSavingGeofence = false;
        });
      }
    }
  }

  String _formatDate(String? isoString) {
    if (isoString == null) return 'Unknown';
    final date = DateTime.tryParse(isoString);
    if (date == null) return 'Unknown';
    return DateFormat('MMM dd, yyyy - hh:mm a').format(date);
  }

  Future<void> _showAddTrackerDialog() async {
    final imeiController = TextEditingController();
    final nameController = TextEditingController(text: 'Tracker');
    String selectedType = 'BLE_BEACON';

    await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Link New Tracker', style: TextStyle(fontWeight: FontWeight.bold)),
        content: StatefulBuilder(
          builder: (context, setDialogState) => Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameController,
                decoration: const InputDecoration(
                  labelText: 'Tracker Name (e.g. 🎒 Bag Tag, ⌚ Watch)',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: imeiController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Tracker IMEI Number',
                  hintText: 'e.g. 864163085121037',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: selectedType,
                decoration: const InputDecoration(
                  labelText: 'Tracker Hardware Type',
                  border: OutlineInputBorder(),
                ),
                items: const [
                  DropdownMenuItem(value: 'BLE_BEACON', child: Text('BLE Beacon Tag (BLE)')),
                  DropdownMenuItem(value: 'GT06', child: Text('GT06 Satellite Tracker (SIM)')),
                ],
                onChanged: (val) {
                  if (val != null) {
                    setDialogState(() => selectedType = val);
                  }
                },
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primaryColor),
            onPressed: () async {
              final imei = imeiController.text.trim();
              final name = nameController.text.trim();
              if (imei.isEmpty) return;
              Navigator.pop(ctx);

              final user = Provider.of<AuthProvider>(context, listen: false).currentUser;
              if (user?.studentId != null) {
                try {
                  await ApiService().addStudentTracker(
                    user!.studentId!,
                    imei,
                    name: name,
                    deviceType: selectedType,
                  );
                  _fetchTrackerData();
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Tracker "$name" linked successfully!'), backgroundColor: const Color(0xFF10B981)),
                    );
                  }
                } catch (e) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Failed to link tracker: $e'), backgroundColor: const Color(0xFFEF4444)),
                    );
                  }
                }
              }
            },
            child: const Text('Link Tracker', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(color: AppTheme.primaryColor),
      );
    }

    String status = _trackerData?['status'] ?? 'Offline';
    final lastUpdatedStr = _trackerData?['last_updated'];
    if (lastUpdatedStr != null) {
      final lastUpdatedDate = DateTime.tryParse(lastUpdatedStr.toString());
      if (lastUpdatedDate != null) {
        final diff = DateTime.now().toUtc().difference(lastUpdatedDate.toUtc()).inSeconds.abs();
        if (diff > 180) {
          status = 'Offline';
        }
      }
    } else {
      status = 'Offline';
    }
    final isOnline = status == 'Online';
    final bool isLiveFix = _trackerData?['isLiveFix'] ?? isOnline;
    final double lat = (_trackerData?['latitude'] != null) ? (_trackerData!['latitude'] as num).toDouble() : 0.0;
    final double lng = (_trackerData?['longitude'] != null) ? (_trackerData!['longitude'] as num).toDouble() : 0.0;

    final int batteryPct = (_trackerData?['battery'] ?? 0).toInt();
    final int batteryMv = (_trackerData?['batteryMv'] ?? 0).toInt();

    final List<Map<String, dynamic>> studentTrackers = [];
    if (_trackerData?['trackers'] != null && _trackerData!['trackers'] is List) {
      for (var tr in _trackerData!['trackers']) {
        if (tr is Map) {
          studentTrackers.add(Map<String, dynamic>.from(tr));
        }
      }
    }

    final List<LatLng> polylinePoints = [];
    if (_trackerData?['path_history'] != null && _trackerData!['path_history'] is List) {
      for (var pt in _trackerData!['path_history']) {
        if (pt is Map && pt['lat'] != null && pt['lng'] != null && pt['lat'] != 0 && pt['lng'] != 0) {
          polylinePoints.add(LatLng(pt['lat'].toDouble(), pt['lng'].toDouble()));
        }
      }
    }
    if (isLiveFix && lat != 0 && lng != 0) {
      if (polylinePoints.isEmpty || polylinePoints.last.latitude != lat || polylinePoints.last.longitude != lng) {
        polylinePoints.add(LatLng(lat, lng));
      }
    }

    final activeGeofences = _geofences.where((g) => g['enabled'] == true && g['lat'] != 0.0 && g['lng'] != 0.0).toList();
    final bool isGeofenceActive = activeGeofences.isNotEmpty;

    Map<String, dynamic>? hitZone;
    double? minDistanceToAnyZone;

    if (isLiveFix && lat != 0 && lng != 0 && isGeofenceActive) {
      for (var gz in activeGeofences) {
        final d = _calculateDistanceMeters(lat, lng, (gz['lat'] as num).toDouble(), (gz['lng'] as num).toDouble());
        if (minDistanceToAnyZone == null || d < minDistanceToAnyZone) {
          minDistanceToAnyZone = d;
        }
        if (d <= (gz['radius'] as num).toDouble()) {
          hitZone = gz;
          break;
        }
      }
    }

    final bool isInsideSafeZone = hitZone != null;

    if (_activeEditingIndex >= _geofences.length) {
      _activeEditingIndex = _geofences.isNotEmpty ? _geofences.length - 1 : 0;
    }
    final currentEditingZone = _geofences.isNotEmpty ? _geofences[_activeEditingIndex] : null;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          PageHeader(
            title: 'Live GPS Tracker',
            subtitle: 'Real-time telemetry, battery level & safe zone monitoring.',
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(
                  icon: const Icon(Icons.radar_rounded, color: Color(0xFF10B981)),
                  onPressed: () {
                    final currentImei = _trackerData?['imei']?.toString() ?? '';
                    if (currentImei.isNotEmpty) {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => DeviceLocator(imei: currentImei, deviceName: 'Student Tracker'),
                        ),
                      );
                    }
                  },
                  tooltip: 'BLE Signal Radar',
                ),
                IconButton(
                  icon: const Icon(Icons.refresh_rounded, color: AppTheme.primaryColor),
                  onPressed: _fetchTrackerData,
                  tooltip: 'Refresh GPS',
                ),
              ],
            ),
          ),

          // DYNAMIC TIERED BATTERY ALERT BANNERS (85%, 70%, 50%, 25%)
          if (batteryPct <= 85)
            Container(
              padding: const EdgeInsets.all(14),
              margin: const EdgeInsets.only(bottom: 14),
              decoration: BoxDecoration(
                color: batteryPct <= 25
                    ? const Color(0xFFFEE2E2)
                    : (batteryPct <= 50
                        ? const Color(0xFFFEF3C7)
                        : (batteryPct <= 70
                            ? const Color(0xFFFEF9C3)
                            : const Color(0xFFE0F2FE))),
                border: Border.all(
                  color: batteryPct <= 25
                      ? const Color(0xFFEF4444)
                      : (batteryPct <= 50
                          ? const Color(0xFFF59E0B)
                          : (batteryPct <= 70
                              ? const Color(0xFFEAB308)
                              : const Color(0xFF0284C7))),
                  width: 1.5,
                ),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Row(
                children: [
                  Icon(
                    batteryPct <= 25
                        ? Icons.battery_alert_rounded
                        : (batteryPct <= 50
                            ? Icons.battery_3_bar_rounded
                            : (batteryPct <= 70
                                ? Icons.battery_4_bar_rounded
                                : Icons.battery_5_bar_rounded)),
                    color: batteryPct <= 25
                        ? const Color(0xFFEF4444)
                        : (batteryPct <= 50
                            ? const Color(0xFFD97706)
                            : (batteryPct <= 70
                                ? const Color(0xFFCA8A04)
                                : const Color(0xFF0284C7))),
                    size: 28,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          batteryPct <= 25
                              ? '🚨 CRITICAL BATTERY LOW ALERT (25% or Less)'
                              : (batteryPct <= 50
                                  ? '⚠️ BATTERY MEDIUM ALERT (50% or Less)'
                                  : (batteryPct <= 70
                                      ? '🟡 BATTERY MODERATE ALERT (70% or Less)'
                                      : 'ℹ️ BATTERY ADVISORY (85% or Less)')),
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: batteryPct <= 25
                                ? const Color(0xFF991B1B)
                                : (batteryPct <= 50
                                    ? const Color(0xFF92400E)
                                    : (batteryPct <= 70
                                        ? const Color(0xFF854D0E)
                                        : const Color(0xFF075985))),
                            fontSize: 13,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Tracker battery is currently at $batteryPct%${batteryMv > 0 ? ' ($batteryMv mV)' : ''}. ${batteryPct <= 25 ? 'Please charge the tracker immediately to prevent loss of location tracking.' : (batteryPct <= 50 ? 'Consider charging the tracker soon.' : 'Battery is discharging gradually.')}',
                          style: TextStyle(
                            color: batteryPct <= 25
                                ? const Color(0xFF7F1D1D)
                                : (batteryPct <= 50
                                    ? const Color(0xFF78350F)
                                    : (batteryPct <= 70
                                        ? const Color(0xFF713F12)
                                        : const Color(0xFF0C4A6E))),
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

          // Status, Battery Level Badges (Scrollable horizontally if needed)
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                // Online / Offline Status Pill
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: isOnline ? const Color(0xFFD1FAE5) : const Color(0xFFFEE2E2),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        isOnline ? Icons.signal_cellular_alt_rounded : Icons.signal_cellular_connected_no_internet_0_bar_rounded,
                        size: 14,
                        color: isOnline ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        status,
                        style: TextStyle(
                          color: isOnline ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                          fontWeight: FontWeight.w700,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),

                // Prominent Battery Level Pill
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: batteryPct > 50 ? const Color(0xFFD1FAE5) : (batteryPct > 20 ? const Color(0xFFFEF3C7) : const Color(0xFFFEE2E2)),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        batteryPct > 50 ? Icons.battery_full_rounded : (batteryPct > 20 ? Icons.battery_4_bar_rounded : Icons.battery_alert_rounded),
                        size: 14,
                        color: batteryPct > 50 ? const Color(0xFF10B981) : (batteryPct > 20 ? const Color(0xFFD97706) : const Color(0xFFEF4444)),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '$batteryPct%${batteryMv > 0 ? ' ($batteryMv mV)' : ''}',
                        style: TextStyle(
                          color: batteryPct > 50 ? const Color(0xFF10B981) : (batteryPct > 20 ? const Color(0xFFD97706) : const Color(0xFFEF4444)),
                          fontWeight: FontWeight.w700,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),

                // Location Type Badge (GPS vs CELL_TOWER)
                if (_trackerData?['locationType'] == 'CELL_TOWER')
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF3C7),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.cell_tower_rounded, size: 14, color: Color(0xFFD97706)),
                        SizedBox(width: 4),
                        Text(
                          '📡 LBS Tower Fix',
                          style: TextStyle(
                            color: Color(0xFFD97706),
                            fontWeight: FontWeight.w700,
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 10),

          // Action Buttons Row (Equal 50/50 split)
          Row(
            children: [
              // Safe Zone Manager Action Button
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () {
                    if (!_isEditingGeofence && _geofences.isEmpty) {
                      _geofences.add({
                        'name': 'Home Safe Zone',
                        'lat': lat != 0 ? lat : 28.6139,
                        'lng': lng != 0 ? lng : 77.2090,
                        'radius': 10,
                        'enabled': true,
                      });
                    }
                    setState(() {
                      _isEditingGeofence = !_isEditingGeofence;
                    });
                  },
                  icon: Icon(_isEditingGeofence ? Icons.close_rounded : Icons.security_rounded, size: 15),
                  label: Text(
                    _isEditingGeofence ? 'Done' : 'Safe Zones (${_geofences.length})',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _isEditingGeofence ? const Color(0xFFF59E0B) : AppTheme.primaryColor,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 10),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
              const SizedBox(width: 10),

              // Route History Playback Action Button
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () {
                    final imei = _trackerData?['imei']?.toString() ?? '';
                    showModalBottomSheet(
                      context: context,
                      isScrollControlled: true,
                      backgroundColor: Colors.transparent,
                      builder: (_) => RoutePlaybackModal(imei: imei),
                    );
                  },
                  icon: const Icon(Icons.history_rounded, size: 15),
                  label: const Text('Route Playback', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF3B82F6),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 10),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
            ],
          ),

          // Multi-Trackers Chips Bar (If multiple trackers linked or link new tracker)
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                const Text('Trackers: ', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.grey)),
                ...studentTrackers.map((tr) {
                  final trImei = tr['imei']?.toString() ?? '';
                  final trName = tr['name'] ?? 'Tracker';
                  final trType = tr['deviceType'] ?? 'BLE';
                  final isSelected = (_trackerData?['imei']?.toString() == trImei);
                  final icon = trType == 'GT06' ? '⌚' : '🎒';
                  return Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: ChoiceChip(
                      selected: isSelected,
                      label: Text('$icon $trName ($trImei)', style: TextStyle(fontSize: 11, color: isSelected ? Colors.white : AppTheme.primaryColor)),
                      selectedColor: AppTheme.primaryColor,
                      backgroundColor: Colors.white,
                      onSelected: (selected) {
                        if (selected) {
                          setState(() {
                            _trackerData?['imei'] = trImei;
                          });
                          _fetchTrackerData();
                        }
                      },
                    ),
                  );
                }),
                Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: ActionChip(
                    avatar: const Icon(Icons.add_rounded, size: 14, color: AppTheme.primaryColor),
                    label: const Text('+ Link Tracker', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.primaryColor)),
                    backgroundColor: const Color(0xFFF1F5F9),
                    onPressed: _showAddTrackerDialog,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // MULTIPLE GEOFENCE EDITING BANNER
          if (_isEditingGeofence && currentEditingZone != null)
            Container(
              padding: const EdgeInsets.all(16),
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: const Color(0xFFD1FAE5),
                border: Border.all(color: const Color(0xFF10B981), width: 1.5),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Expanded(
                        child: Text(
                          '📍 Safe Zones',
                          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: Color(0xFF065F46)),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 4),
                      TextButton.icon(
                        style: TextButton.styleFrom(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                          minimumSize: Size.zero,
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                        onPressed: _geofences.length >= 4
                            ? () {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text('Maximum limit reached: You can add up to 4 Safe Zones only.'),
                                    backgroundColor: Color(0xFFF59E0B),
                                  ),
                                );
                              }
                            : () {
                                setState(() {
                                  _geofences.add({
                                    'name': 'Safe Zone ${_geofences.length + 1}',
                                    'lat': lat != 0 ? lat : 28.6139,
                                    'lng': lng != 0 ? lng : 77.2090,
                                    'radius': 10,
                                    'enabled': true,
                                  });
                                  _activeEditingIndex = _geofences.length - 1;
                                });
                              },
                        icon: Icon(
                          Icons.add_location_alt_rounded,
                          size: 16,
                          color: _geofences.length >= 4 ? Colors.grey : const Color(0xFF10B981),
                        ),
                        label: Text(
                          _geofences.length >= 4 ? 'Max 4' : '+ Add (${_geofences.length}/4)',
                          style: TextStyle(
                            color: _geofences.length >= 4 ? Colors.grey : const Color(0xFF10B981),
                            fontWeight: FontWeight.w700,
                            fontSize: 12,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),

                  // Zone Selector Tabs
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: List.generate(_geofences.length, (idx) {
                        final z = _geofences[idx];
                        final isSelected = idx == _activeEditingIndex;
                        return Padding(
                          padding: const EdgeInsets.only(right: 8.0),
                          child: ChoiceChip(
                            label: Text(z['name'] ?? 'Zone ${idx + 1}'),
                            selected: isSelected,
                            selectedColor: const Color(0xFF10B981),
                            labelStyle: TextStyle(
                              color: isSelected ? Colors.white : const Color(0xFF065F46),
                              fontWeight: FontWeight.w700,
                            ),
                            onSelected: (selected) {
                              if (selected) {
                                setState(() {
                                  _activeEditingIndex = idx;
                                });
                                if ((z['lat'] as num) != 0 && (z['lng'] as num) != 0) {
                                  _mapController.move(LatLng((z['lat'] as num).toDouble(), (z['lng'] as num).toDouble()), 15.0);
                                }
                              }
                            },
                          ),
                        );
                      }),
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Manual Pinpoint Latitude & Longitude Input Fields
                  Row(
                    children: [
                      Expanded(
                        child: TextFormField(
                          key: ValueKey('lat_${_activeEditingIndex}_${currentEditingZone['lat']}'),
                          initialValue: currentEditingZone['lat'] != 0.0 ? currentEditingZone['lat'].toString() : '',
                          keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true),
                          decoration: InputDecoration(
                            labelText: 'Manual Latitude',
                            hintText: '28.613900',
                            filled: true,
                            fillColor: Colors.white,
                            isDense: true,
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                          onChanged: (val) {
                            final parsedLat = double.tryParse(val);
                            if (parsedLat != null) {
                              setState(() {
                                currentEditingZone['lat'] = parsedLat;
                                currentEditingZone['enabled'] = true;
                              });
                              _mapController.move(LatLng(parsedLat, (currentEditingZone['lng'] as num).toDouble()), 15.0);
                            }
                          },
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextFormField(
                          key: ValueKey('lng_${_activeEditingIndex}_${currentEditingZone['lng']}'),
                          initialValue: currentEditingZone['lng'] != 0.0 ? currentEditingZone['lng'].toString() : '',
                          keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true),
                          decoration: InputDecoration(
                            labelText: 'Manual Longitude',
                            hintText: '77.209000',
                            filled: true,
                            fillColor: Colors.white,
                            isDense: true,
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                          onChanged: (val) {
                            final parsedLng = double.tryParse(val);
                            if (parsedLng != null) {
                              setState(() {
                                currentEditingZone['lng'] = parsedLng;
                                currentEditingZone['enabled'] = true;
                              });
                              _mapController.move(LatLng((currentEditingZone['lat'] as num).toDouble(), parsedLng), 15.0);
                            }
                          },
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),

                  // Safe Zone Name Input
                  TextFormField(
                    key: ValueKey('name_$_activeEditingIndex'),
                    initialValue: currentEditingZone['name'] ?? 'Safe Zone',
                    decoration: InputDecoration(
                      labelText: 'Safe Zone Name',
                      hintText: 'e.g. School Campus, Home, Tuition',
                      filled: true,
                      fillColor: Colors.white,
                      isDense: true,
                      prefixIcon: const Icon(Icons.label_rounded, color: Color(0xFF10B981), size: 20),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    onChanged: (val) {
                      setState(() {
                        currentEditingZone['name'] = val;
                      });
                    },
                  ),
                  const SizedBox(height: 12),

                  // Radius Slider (starting from 10m)
                  Text(
                    'Safe Zone Radius: ${currentEditingZone['radius']} meters',
                    style: const TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF065F46)),
                  ),
                  Slider(
                    value: ((currentEditingZone['radius'] ?? 10).toDouble()).clamp(10.0, 3000.0),
                    min: 10,
                    max: 3000,
                    divisions: 299,
                    label: '${currentEditingZone['radius']}m',
                    activeColor: const Color(0xFF10B981),
                    onChanged: (val) {
                      setState(() {
                        currentEditingZone['radius'] = val.toInt();
                        currentEditingZone['enabled'] = true;
                      });
                    },
                  ),
                  const SizedBox(height: 4),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      if (_geofences.length > 1)
                        IconButton(
                          icon: const Icon(Icons.delete_forever_rounded, color: Color(0xFFEF4444)),
                          tooltip: 'Delete this safe zone',
                          onPressed: () {
                            setState(() {
                              _geofences.removeAt(_activeEditingIndex);
                              if (_activeEditingIndex >= _geofences.length) {
                                _activeEditingIndex = _geofences.length - 1;
                              }
                            });
                          },
                        )
                      else
                        const SizedBox.shrink(),
                      ElevatedButton.icon(
                        onPressed: _isSavingGeofence ? null : _saveGeofence,
                        icon: const Icon(Icons.save_rounded, size: 18),
                        label: Text(_isSavingGeofence ? 'Saving...' : 'Save All Safe Zones (${_geofences.length})'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF10B981),
                          foregroundColor: Colors.white,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

          // GEOFENCE ALERT BANNER
          if (isGeofenceActive)
            Container(
              padding: const EdgeInsets.all(16),
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: isInsideSafeZone ? const Color(0xFFD1FAE5) : const Color(0xFFFEE2E2),
                border: Border.all(color: isInsideSafeZone ? const Color(0xFF10B981) : const Color(0xFFEF4444), width: 1.5),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Row(
                children: [
                  Icon(
                    isInsideSafeZone ? Icons.verified_user_rounded : Icons.warning_amber_rounded,
                    color: isInsideSafeZone ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                    size: 28,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      isInsideSafeZone
                          ? 'CHILD IS SAFE: Inside "${hitZone['name']}"'
                          : 'SAFETY ALERT: Child is OUTSIDE designated Safe Zones! (${(minDistanceToAnyZone ?? 0).round()}m away from nearest safe zone).',
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        color: isInsideSafeZone ? const Color(0xFF065F46) : const Color(0xFF991B1B),
                      ),
                    ),
                  ),
                ],
              ),
            ),

          // MAP
          PremiumCard(
            padding: EdgeInsets.zero,
            child: SizedBox(
              height: 380,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: FlutterMap(
                  mapController: _mapController,
                  options: MapOptions(
                    initialCenter: lat != 0 && lng != 0 ? LatLng(lat, lng) : const LatLng(28.6139, 77.2090),
                    initialZoom: 14.0,
                    onTap: (tapPosition, point) {
                      if (_isEditingGeofence && currentEditingZone != null) {
                        setState(() {
                          currentEditingZone['lat'] = point.latitude;
                          currentEditingZone['lng'] = point.longitude;
                          currentEditingZone['enabled'] = true;
                        });
                      }
                    },
                  ),
                  children: [
                    TileLayer(
                      urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                      userAgentPackageName: 'com.crm.school.mobile',
                    ),
                    // Render Safe Zone Circles + LBS Cell Tower Accuracy Radius Circle
                    CircleLayer(
                      circles: [
                        ..._geofences.where((g) => g['enabled'] == true && g['lat'] != 0.0 && g['lng'] != 0.0).map((g) {
                          return CircleMarker(
                            point: LatLng((g['lat'] as num).toDouble(), (g['lng'] as num).toDouble()),
                            radius: (g['radius'] as num).toDouble(),
                            useRadiusInMeter: true,
                            color: const Color(0xFF10B981).withValues(alpha: 0.25),
                            borderColor: const Color(0xFF10B981),
                            borderStrokeWidth: 2.0,
                          );
                        }),
                        if (_trackerData?['locationType'] == 'CELL_TOWER' && lat != 0 && lng != 0)
                          CircleMarker(
                            point: LatLng(lat, lng),
                            radius: (_trackerData?['accuracy'] ?? 450).toDouble(),
                            useRadiusInMeter: true,
                            color: const Color(0xFFF59E0B).withValues(alpha: 0.20),
                            borderColor: const Color(0xFFD97706),
                            borderStrokeWidth: 2.0,
                          ),
                      ],
                    ),
                    // Render ALL Safe Zone Pin Markers + Tracker Location Marker
                    MarkerLayer(
                      markers: [
                        ..._geofences.where((g) => g['enabled'] == true && g['lat'] != 0.0 && g['lng'] != 0.0).map((g) {
                          return Marker(
                            point: LatLng((g['lat'] as num).toDouble(), (g['lng'] as num).toDouble()),
                            width: 50,
                            height: 50,
                            child: Tooltip(
                              message: g['name'] ?? 'Safe Zone',
                              child: const Icon(
                                Icons.pin_drop_rounded,
                                color: Color(0xFF10B981),
                                size: 42,
                              ),
                            ),
                          );
                        }),
                        Marker(
                          point: lat != 0 && lng != 0 ? LatLng(lat, lng) : const LatLng(28.6139, 77.2090),
                          width: 48,
                          height: 48,
                          child: Tooltip(
                            message: _trackerData?['deviceType'] == 'BLE_BEACON' || _trackerData?['locationType'] == 'BLE'
                                ? '🎒 BLE Gateway Beacon'
                                : (_trackerData?['locationType'] == 'CELL_TOWER'
                                    ? '📡 Indoor Cell Tower Location (CellID: ${_trackerData?['cellId']})'
                                    : '🛰️ Satellite GPS Fix'),
                            child: Icon(
                              _trackerData?['deviceType'] == 'BLE_BEACON' || _trackerData?['locationType'] == 'BLE'
                                  ? Icons.bluetooth_searching_rounded
                                  : (_trackerData?['locationType'] == 'CELL_TOWER'
                                      ? Icons.cell_tower_rounded
                                      : Icons.location_on_rounded),
                              color: _trackerData?['deviceType'] == 'BLE_BEACON' || _trackerData?['locationType'] == 'BLE'
                                  ? const Color(0xFF3B82F6)
                                  : (_trackerData?['locationType'] == 'CELL_TOWER'
                                      ? const Color(0xFFD97706)
                                      : AppTheme.primaryColor),
                              size: 44,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 20),

          // Location Intel
          PremiumCard(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.explore_rounded, color: AppTheme.primaryColor, size: 20),
                    const SizedBox(width: 8),
                    Text('Location Telemetry', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontSize: 16)),
                  ],
                ),
                _buildRow(
                  'Position Source',
                  _trackerData?['deviceType'] == 'BLE_BEACON' || _trackerData?['locationType'] == 'BLE'
                      ? '🎒 BLE Gateway Fix'
                      : (_trackerData?['locationType'] == 'CELL_TOWER'
                          ? '📡 LBS Cell Tower Fix'
                          : '🛰️ Satellite GPS Fix'),
                ),
                const Divider(height: 20, color: AppTheme.borderColor),
                _buildRow('LAC (Location Area Code)', '${_trackerData?['lac'] ?? 0} (0x${(_trackerData?['lac'] ?? 0).toRadixString(16).toUpperCase()})'),
                const Divider(height: 20, color: AppTheme.borderColor),
                _buildRow('Cell ID (Tower ID)', '${_trackerData?['cellId'] ?? 0} (MCC:${_trackerData?['mcc'] ?? 404} MNC:${_trackerData?['mnc'] ?? 11})'),
                const Divider(height: 20, color: AppTheme.borderColor),
                _buildRow('Latitude', (_trackerData?['latitude'] ?? 0).toDouble().toStringAsFixed(6)),
                const Divider(height: 20, color: AppTheme.borderColor),
                _buildRow('Longitude', (_trackerData?['longitude'] ?? 0).toDouble().toStringAsFixed(6)),
                const Divider(height: 20, color: AppTheme.borderColor),
                _buildRow('Movement Speed', '${_trackerData?['speed'] ?? 0} km/h'),
                const Divider(height: 20, color: AppTheme.borderColor),
                _buildRow('Course Heading', '${_trackerData?['course'] ?? 0}°'),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Last Seen Card
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [AppTheme.primaryColor, Color(0xFF3B82F6)],
              ),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(Icons.sync_rounded, color: Colors.white, size: 20),
                    SizedBox(width: 8),
                    Text('Last Synced Telemetry', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Colors.white)),
                  ],
                ),
                const SizedBox(height: 12),
                const Text('The GT06 tracker last reported its coordinates at:', style: TextStyle(color: Colors.white70, fontSize: 13)),
                const SizedBox(height: 4),
                Text(_formatDate(_trackerData?['last_updated']), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Colors.white)),
                const SizedBox(height: 16),
                const Text('Hardware IMEI Number', style: TextStyle(color: Colors.white70, fontSize: 13)),
                const SizedBox(height: 2),
                Text(_trackerData?['imei'] ?? 'N/A', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Colors.white)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(color: AppTheme.textSecondary, fontWeight: FontWeight.w500)),
        Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
      ],
    );
  }
}

class RoutePlaybackModal extends StatefulWidget {
  final String imei;
  const RoutePlaybackModal({super.key, required this.imei});

  @override
  State<RoutePlaybackModal> createState() => _RoutePlaybackModalState();
}

class _RoutePlaybackModalState extends State<RoutePlaybackModal> {
  late String _selectedDateStr;
  List<Map<String, dynamic>> _points = [];
  int _distanceMeters = 0;
  bool _isLoading = true;
  bool _isPlaying = false;
  int _currentIndex = 0;
  int _playbackSpeed = 1;
  Timer? _timer;
  final MapController _mapController = MapController();

  @override
  void initState() {
    super.initState();
    _selectedDateStr = DateFormat('yyyy-MM-dd').format(DateTime.now());
    _fetchHistory();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _fetchHistory() async {
    if (widget.imei.isEmpty) {
      setState(() => _isLoading = false);
      return;
    }
    setState(() {
      _isLoading = true;
      _isPlaying = false;
      _currentIndex = 0;
    });
    _timer?.cancel();

    try {
      final res = await ApiService().getDeviceHistory(widget.imei, _selectedDateStr);
      if (mounted) {
        setState(() {
          final pts = res['points'] as List? ?? [];
          _points = pts.map((p) => Map<String, dynamic>.from(p)).toList();
          _distanceMeters = (res['totalDistanceMeters'] ?? 0).toInt();
          _isLoading = false;
        });

        if (_points.isNotEmpty) {
          Future.delayed(const Duration(milliseconds: 300), () {
            if (mounted) {
              final first = _points[0];
              _mapController.move(LatLng(first['lat'].toDouble(), first['lng'].toDouble()), 14.0);
            }
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  void _togglePlay() {
    if (_points.isEmpty) return;
    setState(() {
      _isPlaying = !_isPlaying;
    });

    if (_isPlaying) {
      _timer?.cancel();
      final intervalMs = (1000 / _playbackSpeed).round();
      _timer = Timer.periodic(Duration(milliseconds: intervalMs), (t) {
        if (_currentIndex >= _points.length - 1) {
          t.cancel();
          if (mounted) setState(() => _isPlaying = false);
        } else {
          if (mounted) {
            setState(() => _currentIndex++);
            final currentPt = _points[_currentIndex];
            _mapController.move(LatLng(currentPt['lat'].toDouble(), currentPt['lng'].toDouble()), _mapController.camera.zoom);
          }
        }
      });
    } else {
      _timer?.cancel();
    }
  }

  @override
  Widget build(BuildContext context) {
    final todayStr = DateFormat('yyyy-MM-dd').format(DateTime.now());
    final yesterdayStr = DateFormat('yyyy-MM-dd').format(DateTime.now().subtract(const Duration(days: 1)));

    final List<LatLng> allValidPoints = _points
        .where((p) => p['lat'] != null && p['lng'] != null && p['lat'] != 0 && p['lng'] != 0)
        .map((p) => LatLng((p['lat'] as num).toDouble(), (p['lng'] as num).toDouble()))
        .toList();

    final List<List<LatLng>> polylineSegments = [];
    List<LatLng> currentGpsSegment = [];
    final List<CircleMarker> playbackCircles = [];

    for (var p in _points) {
      if (p['lat'] == null || p['lng'] == null || p['lat'] == 0 || p['lng'] == 0) continue;
      final latVal = (p['lat'] as num).toDouble();
      final lngVal = (p['lng'] as num).toDouble();
      final ptLatLng = LatLng(latVal, lngVal);

      final locType = p['locationType']?.toString() ?? 'GPS';
      final devType = p['deviceType']?.toString() ?? '';
      final isGps = locType == 'GPS' || (locType != 'CELL_TOWER' && locType != 'BLE' && devType != 'BLE_BEACON');
      final isBle = locType == 'BLE' || devType == 'BLE_BEACON';

      if (isGps) {
        currentGpsSegment.add(ptLatLng);
      } else {
        if (currentGpsSegment.length > 1) {
          polylineSegments.add(List.from(currentGpsSegment));
        }
        currentGpsSegment.clear();

        // Add Coverage Circle in Playback
        playbackCircles.add(
          CircleMarker(
            point: ptLatLng,
            radius: isBle ? 10.0 : ((p['accuracy'] as num?)?.toDouble() ?? 300.0),
            useRadiusInMeter: true,
            color: isBle
                ? const Color(0xFF3B82F6).withValues(alpha: 0.25)
                : const Color(0xFFF59E0B).withValues(alpha: 0.25),
            borderColor: isBle ? const Color(0xFF2563EB) : const Color(0xFFD97706),
            borderStrokeWidth: 2.0,
          ),
        );
      }
    }
    if (currentGpsSegment.length > 1) {
      polylineSegments.add(List.from(currentGpsSegment));
    }

    return Container(
      height: MediaQuery.of(context).size.height * 0.9,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        children: [
          // Header handle & title
          Container(
            padding: const EdgeInsets.fromLTRB(20, 12, 12, 12),
            decoration: const BoxDecoration(
              border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0))),
            ),
            child: Row(
              children: [
                const Icon(Icons.history_rounded, color: AppTheme.primaryColor, size: 22),
                const SizedBox(width: 10),
                const Text(
                  'Route History Playback',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.close_rounded),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),

          // Date Selector Dropdown & Filter Bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            color: const Color(0xFFF8FAFC),
            child: Row(
              children: [
                const Icon(Icons.calendar_month_rounded, color: AppTheme.textSecondary, size: 18),
                const SizedBox(width: 8),
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFCBD5E1)),
                    ),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        value: (_selectedDateStr == todayStr || _selectedDateStr == yesterdayStr) ? _selectedDateStr : 'custom',
                        isExpanded: true,
                        icon: const Icon(Icons.arrow_drop_down_rounded, color: AppTheme.primaryColor),
                        items: [
                          DropdownMenuItem(value: todayStr, child: Text('📅 Today (${DateFormat('MMM dd').format(DateTime.now())})', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600))),
                          DropdownMenuItem(value: yesterdayStr, child: Text('📅 Yesterday (${DateFormat('MMM dd').format(DateTime.now().subtract(const Duration(days: 1)))})', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600))),
                          DropdownMenuItem(value: 'custom', child: Text('📅 ${_selectedDateStr == todayStr || _selectedDateStr == yesterdayStr ? "Select Custom Date..." : _selectedDateStr}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600))),
                        ],
                        onChanged: (val) async {
                          if (val == 'custom') {
                            final picked = await showDatePicker(
                              context: context,
                              initialDate: DateTime.now(),
                              firstDate: DateTime(2025),
                              lastDate: DateTime.now(),
                            );
                            if (picked != null) {
                              setState(() {
                                _selectedDateStr = DateFormat('yyyy-MM-dd').format(picked);
                              });
                              _fetchHistory();
                            }
                          } else if (val != null) {
                            setState(() {
                              _selectedDateStr = val;
                            });
                            _fetchHistory();
                          }
                        },
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Playback Statistics Banner
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
            color: const Color(0xFFEFF6FF),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(Icons.flag_rounded, size: 16, color: AppTheme.primaryColor),
                    const SizedBox(width: 6),
                    Text('${_points.length} Checkpoints', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppTheme.primaryColor)),
                  ],
                ),
                Row(
                  children: [
                    const Icon(Icons.straighten_rounded, size: 16, color: Color(0xFF10B981)),
                    const SizedBox(width: 6),
                    Text('${(_distanceMeters / 1000).toStringAsFixed(2)} km Traveled', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Color(0xFF10B981))),
                  ],
                ),
              ],
            ),
          ),

          // Map & Controls Section
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: AppTheme.primaryColor))
                : Column(
                    children: [
                      // Playback Map View
                      Expanded(
                        child: FlutterMap(
                          mapController: _mapController,
                          options: MapOptions(
                            initialCenter: allValidPoints.isNotEmpty ? allValidPoints[0] : const LatLng(28.6139, 77.2090),
                            initialZoom: 14.0,
                          ),
                          children: [
                            TileLayer(
                              urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                              userAgentPackageName: 'com.crm.school.mobile',
                            ),
                            CircleLayer(circles: playbackCircles),
                            if (polylineSegments.isNotEmpty)
                              PolylineLayer(
                                polylines: polylineSegments.map((segment) {
                                  return Polyline(
                                    points: segment,
                                    color: const Color(0xFF3B82F6),
                                    strokeWidth: 5.0,
                                  );
                                }).toList(),
                              ),
                            MarkerLayer(
                              markers: [
                                // Start Marker (🟢)
                                if (allValidPoints.isNotEmpty)
                                  Marker(
                                    point: allValidPoints[0],
                                    width: 32,
                                    height: 32,
                                    child: Container(
                                      decoration: const BoxDecoration(color: Color(0xFF10B981), shape: BoxShape.circle),
                                      child: const Center(child: Text('🟢', style: TextStyle(fontSize: 12))),
                                    ),
                                  ),
                                // End Marker (🔴)
                                if (allValidPoints.length > 1)
                                  Marker(
                                    point: allValidPoints.last,
                                    width: 32,
                                    height: 32,
                                    child: Container(
                                      decoration: const BoxDecoration(color: Color(0xFFEF4444), shape: BoxShape.circle),
                                      child: const Center(child: Text('🔴', style: TextStyle(fontSize: 12))),
                                    ),
                                  ),
                                // Moving Backpack Marker
                                if (_points.isNotEmpty && _currentIndex < _points.length)
                                  Marker(
                                    point: LatLng(_points[_currentIndex]['lat'].toDouble(), _points[_currentIndex]['lng'].toDouble()),
                                    width: 42,
                                    height: 42,
                                    child: Container(
                                      decoration: BoxDecoration(
                                        color: const Color(0xFF3B82F6),
                                        shape: BoxShape.circle,
                                        border: Border.all(color: Colors.white, width: 3),
                                        boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 8)],
                                      ),
                                      child: const Center(child: Text('🎒', style: TextStyle(fontSize: 18))),
                                    ),
                                  ),
                              ],
                            ),
                          ],
                        ),
                      ),

                      // Animation Control Bar
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        decoration: const BoxDecoration(
                          color: Colors.white,
                          border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
                        ),
                        child: Row(
                          children: [
                            IconButton(
                              icon: Icon(_isPlaying ? Icons.pause_circle_filled_rounded : Icons.play_circle_fill_rounded, size: 38, color: AppTheme.primaryColor),
                              onPressed: _togglePlay,
                            ),
                            IconButton(
                              icon: const Icon(Icons.replay_rounded, color: AppTheme.textSecondary),
                              onPressed: () {
                                _timer?.cancel();
                                setState(() {
                                  _isPlaying = false;
                                  _currentIndex = 0;
                                });
                                if (_points.isNotEmpty) {
                                  _mapController.move(LatLng(_points[0]['lat'].toDouble(), _points[0]['lng'].toDouble()), 14.0);
                                }
                              },
                            ),
                            Expanded(
                              child: Slider(
                                value: _currentIndex.toDouble().clamp(0.0, math.max(0.0, (_points.length - 1).toDouble())),
                                min: 0,
                                max: math.max(0.0, (_points.length - 1).toDouble()),
                                divisions: _points.length > 1 ? _points.length - 1 : 1,
                                activeColor: AppTheme.primaryColor,
                                onChanged: (val) {
                                  _timer?.cancel();
                                  setState(() {
                                    _isPlaying = false;
                                    _currentIndex = val.toInt();
                                  });
                                  if (_currentIndex < _points.length) {
                                    final pt = _points[_currentIndex];
                                    _mapController.move(LatLng(pt['lat'].toDouble(), pt['lng'].toDouble()), 14.0);
                                  }
                                },
                              ),
                            ),
                            Text(
                              '${_currentIndex + 1}/${_points.length}',
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}
