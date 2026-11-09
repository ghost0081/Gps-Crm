class TransportRouteModel {
  final String id;
  final String name;
  final String code;
  final String vehicleLabel;
  final String driverName;
  final String helperName;
  final List<TransportStopModel> stops;

  TransportRouteModel({
    required this.id,
    required this.name,
    required this.code,
    required this.vehicleLabel,
    required this.driverName,
    required this.helperName,
    required this.stops,
  });

  factory TransportRouteModel.fromJson(Map<String, dynamic> json) {
    return TransportRouteModel(
      id: json['_id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      code: json['code']?.toString() ?? '',
      vehicleLabel: json['vehicleLabel']?.toString() ?? 'School Bus',
      driverName: json['driverName']?.toString() ?? 'Unassigned',
      helperName: json['helperName']?.toString() ?? '',
      stops: (json['stops'] as List<dynamic>?)
              ?.map((s) => TransportStopModel.fromJson(Map<String, dynamic>.from(s as Map)))
              .toList() ??
          [],
    );
  }
}

class TransportStopModel {
  final String name;
  final int sequence;
  final double? lat;
  final double? lng;
  final int? etaMinutes;

  TransportStopModel({
    required this.name,
    required this.sequence,
    this.lat,
    this.lng,
    this.etaMinutes,
  });

  factory TransportStopModel.fromJson(Map<String, dynamic> json) {
    return TransportStopModel(
      name: json['name']?.toString() ?? '',
      sequence: (json['sequence'] as num?)?.toInt() ?? 0,
      lat: (json['lat'] as num?)?.toDouble(),
      lng: (json['lng'] as num?)?.toDouble(),
      etaMinutes: (json['etaMinutes'] as num?)?.toInt(),
    );
  }
}
