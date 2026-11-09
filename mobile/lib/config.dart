import 'package:flutter/foundation.dart' show kIsWeb;
import 'dart:io' show Platform;

class Config {
  /// Toggle for local development vs live server.
  /// Set to true when running local backend on http://localhost:5000.
  static const bool useLocalServer = false;

  static String get baseUrl {
    if (!useLocalServer) {
      return 'http://200.141.9.19:5000';
    }
    if (kIsWeb) {
      return 'http://localhost:5000';
    }
    // Android emulator cannot access 127.0.0.1 (it refers to emulator itself)
    // 10.0.2.2 routes directly to host machine localhost
    try {
      if (Platform.isAndroid) {
        return 'http://10.0.2.2:5000';
      }
    } catch (_) {}
    return 'http://localhost:5000';
  }
  
  // Auth API endpoints
  static String get studentLogin => '$baseUrl/StudentLogin';
  static String get teacherLogin => '$baseUrl/TeacherLogin';
  static String get parentLogin => '$baseUrl/ParentLogin';
  static String get frontdeskLogin => '$baseUrl/FrontDeskLogin';
  static String get guardianLogin => '$baseUrl/GuardianLogin';
  static String get adminLogin => '$baseUrl/AdminLogin';

  // Frontdesk & Gate endpoints
  static String get lookupStudentQr => '$baseUrl/Visitors/LookupStudentQR';
  static String get scanParentQr => '$baseUrl/Visitors/ScanParentQR';
  static String get parentArrivals => '$baseUrl/Visitors/ParentArrivals';
  static String teacherPickupNotifications(String teacherId) => '$baseUrl/Visitors/TeacherPickupNotifications?teacherId=$teacherId';

  // Parent Multi-Child & Gate Credential Endpoints
  static String parentChildren(String parentId) => '$baseUrl/Parent/Children/$parentId';
  static String parentCollectors(String parentId) => '$baseUrl/Parent/Collectors/$parentId';
  static String studentCollectors(String studentId) => '$baseUrl/Parent/StudentCollectors/$studentId';
  static String get createCollector => '$baseUrl/Parent/Collector';
  static String revokeCollector(String id) => '$baseUrl/Parent/Collector/$id/Revoke';
  static String get ensureParentCredential => '$baseUrl/Parent/Credential/Ensure';
  static String get replaceParentCredential => '$baseUrl/Parent/Credential/Replace';

  // Student Endpoints
  static String studentDetails(String id) => '$baseUrl/Student/$id';
  static String classSubjects(String classId) => '$baseUrl/ClassSubjects/$classId';
  static String studentAssignments(String id) => '$baseUrl/AssignmentList/student/$id';
  static String classTimetable(String classId) => '$baseUrl/TimetableClass/$classId';
  static String complainList(String schoolId) => '$baseUrl/ComplainList/$schoolId';
  static String get complainCreate => '$baseUrl/ComplainCreate';
  static String studentFeeHistory(String id) => '$baseUrl/Fees/Student/$id';
  static String noticeList(String schoolId) => '$baseUrl/NoticeList/$schoolId';

  // Transport & Bus
  static String studentTransport(String studentId) => '$baseUrl/Transport/Student/$studentId';

  // Safety & Tracker Endpoints
  static String trackingSummary(String studentId) => '$baseUrl/api/student/$studentId/tracking-summary';
  static String safetyNotifications(String parentId) => '$baseUrl/api/parent/$parentId/safety-notifications';
  static String markSafetyNotificationRead(String parentId, String eventId) => '$baseUrl/api/parent/$parentId/safety-notifications/$eventId/read';
  static String parentFcmToken(String parentId) => '$baseUrl/api/parent/$parentId/fcm-token';
  static String get activeDevices => '$baseUrl/api/tracker/devices';
  static String get bleTelemetry => '$baseUrl/api/tracker/ble-telemetry';

  // Teacher Endpoints
  static String subjectDetails(String id) => '$baseUrl/Subject/$id';
  static String classStudents(String id) => '$baseUrl/Sclass/Students/$id';
  static String teacherTimetable(String id) => '$baseUrl/TimetableTeacher/$id';
  static String get assignmentCreate => '$baseUrl/AssignmentCreate';
  static String get assignmentSetStatus => '$baseUrl/AssignmentSetStatus';
  static String get leaveCreate => '$baseUrl/LeaveCreate';
  static String teacherLeaves(String id) => '$baseUrl/LeaveList/teacher/$id';
  static String teacherPayroll(String id) => '$baseUrl/Payroll/Employee/Teacher/$id';
  static String teacherProfile(String id) => '$baseUrl/Teacher/$id';
}
