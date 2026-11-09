class TrackingSummaryModel {
  final String studentId;
  final String studentName;
  final String? imei;
  final bool online;
  final String? lastUpdated;
  final double lat;
  final double lng;
  final String locationType;
  final double? accuracy;
  final double? speed;
  final int? batteryPercentage;
  final bool isCharging;
  final String? transitState;
  final String? etaText;
  final List<Map<String, dynamic>> zones;
  final List<dynamic> recentActivity;

  TrackingSummaryModel({
    required this.studentId,
    required this.studentName,
    this.imei,
    required this.online,
    this.lastUpdated,
    required this.lat,
    required this.lng,
    required this.locationType,
    this.accuracy,
    this.speed,
    this.batteryPercentage,
    required this.isCharging,
    this.transitState,
    this.etaText,
    required this.zones,
    required this.recentActivity,
  });

  factory TrackingSummaryModel.fromJson(Map<String, dynamic> json) {
    final loc = json['location'] as Map<String, dynamic>? ?? {};
    final batt = json['battery'] as Map<String, dynamic>? ?? {};
    final eta = json['destinationEta'] as Map<String, dynamic>?;

    return TrackingSummaryModel(
      studentId: json['studentId']?.toString() ?? '',
      studentName: json['studentName']?.toString() ?? '',
      imei: json['imei']?.toString(),
      online: json['online'] == true,
      lastUpdated: json['lastUpdated']?.toString(),
      lat: (loc['lat'] ?? 0.0).toDouble(),
      lng: (loc['lng'] ?? 0.0).toDouble(),
      locationType: loc['type']?.toString() ?? 'UNKNOWN',
      accuracy: loc['accuracy'] != null ? (loc['accuracy'] as num).toDouble() : null,
      speed: loc['speed'] != null ? (loc['speed'] as num).toDouble() : null,
      batteryPercentage: batt['percentage'] != null ? (batt['percentage'] as num).toInt() : null,
      isCharging: batt['charging'] == true,
      transitState: json['transitState']?.toString(),
      etaText: eta != null ? eta['summary']?.toString() ?? eta['etaFormatted']?.toString() : null,
      zones: (json['zones'] as List<dynamic>?)?.map((e) => Map<String, dynamic>.from(e as Map)).toList() ?? [],
      recentActivity: json['recentActivity'] as List<dynamic>? ?? [],
    );
  }
}
