class ChildModel {
  final String id;
  final String name;
  final int rollNum;
  final String sclassName;
  final String? sclassId;
  final String? schoolId;

  ChildModel({
    required this.id,
    required this.name,
    required this.rollNum,
    required this.sclassName,
    this.sclassId,
    this.schoolId,
  });

  factory ChildModel.fromJson(Map<String, dynamic> json) {
    String extractClass(dynamic sclass) {
      if (sclass is Map) return sclass['sclassName']?.toString() ?? '';
      return sclass?.toString() ?? '';
    }

    String? extractClassId(dynamic sclass) {
      if (sclass is Map) return sclass['_id']?.toString();
      return null;
    }

    return ChildModel(
      id: json['_id']?.toString() ?? json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      rollNum: int.tryParse(json['rollNum']?.toString() ?? '0') ?? 0,
      sclassName: extractClass(json['sclassName']),
      sclassId: extractClassId(json['sclassName']),
      schoolId: json['school'] is Map ? json['school']['_id']?.toString() : json['school']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'name': name,
      'rollNum': rollNum,
      'sclassName': sclassName,
      if (sclassId != null) 'sclassId': sclassId,
      if (schoolId != null) 'school': schoolId,
    };
  }
}
