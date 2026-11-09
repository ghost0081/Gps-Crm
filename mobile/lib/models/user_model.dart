import 'child_model.dart';

class UserModel {
  final String id;
  final String name;
  final String email;
  final String role; // 'Student', 'Teacher', 'Parent', 'FrontDesk', 'Guardian', 'Admin'
  final String? sclassName;
  final String? sclassId;
  final String? teachSubjectId;
  final String? teachSubjectName;
  final String? studentId;
  final String schoolId;
  final List<ChildModel> children;

  // Guardian Specific Properties
  final String? passCode;
  final String? guardianName;
  final String? studentName;
  final int? rollNum;
  final String? sclassNameStr;
  final String? expiresAt;
  final String? credentialId;
  final dynamic qrPayload;
  final String? qrString;

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
    this.children = const [],
    this.passCode,
    this.guardianName,
    this.studentName,
    this.rollNum,
    this.sclassNameStr,
    this.expiresAt,
    this.credentialId,
    this.qrPayload,
    this.qrString,
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

    // Parse children array if present (Parent role)
    List<ChildModel> parsedChildren = [];
    if (json['students'] != null && json['students'] is List) {
      parsedChildren = (json['students'] as List)
          .map((c) => ChildModel.fromJson(Map<String, dynamic>.from(c as Map)))
          .toList();
    } else if (json['student'] != null) {
      if (json['student'] is Map) {
        parsedChildren = [ChildModel.fromJson(Map<String, dynamic>.from(json['student']))];
      }
    }

    // Primary student ID (first child or direct student ID)
    String? primaryStudentId = extractSubjectId(json['student'] ?? json['studentId']);
    if ((primaryStudentId == null || primaryStudentId.isEmpty) && parsedChildren.isNotEmpty) {
      primaryStudentId = parsedChildren[0].id;
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
      studentId: primaryStudentId,
      schoolId: extractSchool(json['school']),
      children: parsedChildren,
      passCode: json['passCode']?.toString(),
      guardianName: json['guardianName']?.toString(),
      studentName: json['studentName']?.toString(),
      rollNum: int.tryParse(json['rollNum']?.toString() ?? ''),
      sclassNameStr: json['sclassNameStr']?.toString() ?? extractClassName(json['sclassName']),
      expiresAt: json['expiresAt']?.toString(),
      credentialId: json['credentialId']?.toString(),
      qrPayload: json['qrPayload'],
      qrString: json['qrString']?.toString(),
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
      'students': children.map((c) => c.toJson()).toList(),
      'passCode': passCode,
      'guardianName': guardianName,
      'studentName': studentName,
      'rollNum': rollNum,
      'sclassNameStr': sclassNameStr,
      'expiresAt': expiresAt,
      'credentialId': credentialId,
      'qrPayload': qrPayload,
      'qrString': qrString,
    };
  }
}
