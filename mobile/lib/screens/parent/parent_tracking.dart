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
    final double lat = isLiveFix ? (_trackerData?['latitude'] ?? 0).toDouble() : 0.0;
    final double lng = isLiveFix ? (_trackerData?['longitude'] ?? 0).toDouble() : 0.0;

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

          // Status, Battery Level & Geofence Action Row
          Row(
            children: [
              // Online / Offline Status Pill
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
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
              const SizedBox(width: 6),

              // Prominent Battery Level Pill
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
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
              const SizedBox(width: 6),

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
                  icon: Icon(_isEditingGeofence ? Icons.close_rounded : Icons.security_rounded, size: 16),
                  label: Text(
                    _isEditingGeofence ? 'Done' : 'Safe Zones (${_geofences.length})',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 11),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _isEditingGeofence ? const Color(0xFFF59E0B) : AppTheme.primaryColor,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
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
                    if (polylinePoints.length > 1)
                      PolylineLayer(
                        polylines: [
                          Polyline(
                            points: polylinePoints,
                            color: AppTheme.primaryColor,
                            strokeWidth: 4.0,
                          ),
                        ],
                      ),
                    // Render ALL Safe Zones as Circles on Map
                    CircleLayer(
                      circles: _geofences.where((g) => g['enabled'] == true && g['lat'] != 0.0 && g['lng'] != 0.0).map((g) {
                        return CircleMarker(
                          point: LatLng((g['lat'] as num).toDouble(), (g['lng'] as num).toDouble()),
                          radius: (g['radius'] as num).toDouble(),
                          useRadiusInMeter: true,
                          color: const Color(0xFF10B981).withValues(alpha: 0.25),
                          borderColor: const Color(0xFF10B981),
                          borderStrokeWidth: 2.0,
                        );
                      }).toList(),
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
                          width: 44,
                          height: 44,
                          child: const Icon(
                            Icons.location_on_rounded,
                            color: AppTheme.primaryColor,
                            size: 40,
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
                const SizedBox(height: 16),
                _buildRow('Latitude', _trackerData?['latitude']?.toStringAsFixed(6) ?? '0.000000'),
                const Divider(height: 20, color: AppTheme.borderColor),
                _buildRow('Longitude', _trackerData?['longitude']?.toStringAsFixed(6) ?? '0.000000'),
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
