class UserModel {
  final String id;
  final String name;
  final String email;
  final String role; // 'Student', 'Teacher', 'Parent', 'FrontDesk', 'Guardian'
  final String? sclassName;
  final String? sclassId;
  final String? teachSubjectId;
  final String? teachSubjectName;
  final String? studentId;
  final String schoolId;

  // Guardian Specific Properties
  final String? passCode;
  final String? guardianName;
  final String? studentName;
  final int? rollNum;
  final String? sclassNameStr;
  final String? expiresAt;

  UserModel({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    this.sclassName,
    this.sclassId,
    this.teachSubjectId,
    this.teachSubjectName,
    this.studentId,
    required this.schoolId,
    this.passCode,
    this.guardianName,
    this.studentName,
    this.rollNum,
    this.sclassNameStr,
    this.expiresAt,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    String extractSchool(dynamic school) {
      if (school is Map) return school['_id']?.toString() ?? '';
      return school?.toString() ?? '';
    }

    String? extractClassName(dynamic sclass) {
      if (sclass == null) return null;
      if (sclass is Map) return sclass['sclassName']?.toString();
      return sclass.toString();
    }

    String? extractClassId(dynamic sclass) {
      if (sclass == null) return null;
      if (sclass is Map) return sclass['_id']?.toString();
      return sclass.toString();
    }

    String? extractSubjectId(dynamic subject) {
      if (subject == null) return null;
      if (subject is Map) return subject['_id']?.toString();
      return subject.toString();
    }

    String? extractSubjectName(dynamic subject) {
      if (subject == null) return null;
      if (subject is Map) return subject['subName']?.toString();
      return null;
    }

    return UserModel(
      id: json['_id']?.toString() ?? '',
      name: json['name']?.toString() ?? json['guardianName']?.toString() ?? '',
      email: json['email']?.toString() ?? json['rollNum']?.toString() ?? json['passCode']?.toString() ?? '',
      role: json['role']?.toString() ?? '',
      sclassName: extractClassName(json['sclassName'] ?? json['teachSclass']),
      sclassId: extractClassId(json['sclassName'] ?? json['teachSclass']),
      teachSubjectId: extractSubjectId(json['teachSubject']),
      teachSubjectName: extractSubjectName(json['teachSubject']),
      studentId: extractSubjectId(json['student'] ?? json['studentId']),
      schoolId: extractSchool(json['school']),
      passCode: json['passCode']?.toString(),
      guardianName: json['guardianName']?.toString(),
      studentName: json['studentName']?.toString(),
      rollNum: int.tryParse(json['rollNum']?.toString() ?? ''),
      sclassNameStr: json['sclassNameStr']?.toString() ?? extractClassName(json['sclassName']),
      expiresAt: json['expiresAt']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'name': name,
      'email': email,
      'role': role,
      'sclassName': {
        '_id': sclassId,
        'sclassName': sclassName,
      },
      'teachSubject': {
        '_id': teachSubjectId,
        'subName': teachSubjectName,
      },
      'student': studentId,
      'school': schoolId,
      'passCode': passCode,
      'guardianName': guardianName,
      'studentName': studentName,
      'rollNum': rollNum,
      'sclassNameStr': sclassNameStr,
      'expiresAt': expiresAt,
    };
  }
}
