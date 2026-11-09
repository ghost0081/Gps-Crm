class CollectorModel {
  final String id;
  final String name;
  final String relation;
  final String phone;
  final String? photoUrl;
  final bool active;
  final bool approvedBySchool;
  final String? expiresAt;
  final String? studentId;

  CollectorModel({
    required this.id,
    required this.name,
    required this.relation,
    required this.phone,
    this.photoUrl,
    required this.active,
    required this.approvedBySchool,
    this.expiresAt,
    this.studentId,
  });

  factory CollectorModel.fromJson(Map<String, dynamic> json) {
    return CollectorModel(
      id: json['_id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      relation: json['relation']?.toString() ?? 'Guardian',
      phone: json['phone']?.toString() ?? '',
      photoUrl: json['photoUrl']?.toString(),
      active: json['active'] == true,
      approvedBySchool: json['approvedBySchool'] != false,
      expiresAt: json['expiresAt']?.toString(),
      studentId: json['student'] is Map ? json['student']['_id']?.toString() : json['student']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'name': name,
      'relation': relation,
      'phone': phone,
      if (photoUrl != null) 'photoUrl': photoUrl,
      'active': active,
      'approvedBySchool': approvedBySchool,
      if (expiresAt != null) 'expiresAt': expiresAt,
      if (studentId != null) 'student': studentId,
    };
  }
}
