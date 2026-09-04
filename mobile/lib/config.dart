class Config {
  static String get baseUrl {
    return 'http://200.141.9.19:5000';
  }
  
  // API endpoints
  static String get studentLogin => '$baseUrl/StudentLogin';
  static String get teacherLogin => '$baseUrl/TeacherLogin';
  static String get parentLogin => '$baseUrl/ParentLogin';
  static String get frontdeskLogin => '$baseUrl/FrontDeskLogin';
  static String get guardianLogin => '$baseUrl/GuardianLogin';
  static String get scanParentQr => '$baseUrl/Visitors/ScanParentQR';
  static String get parentArrivals => '$baseUrl/Visitors/ParentArrivals';

  static String studentDetails(String id) => '$baseUrl/Student/$id';
  static String classSubjects(String classId) => '$baseUrl/ClassSubjects/$classId';
  static String studentAssignments(String id) => '$baseUrl/AssignmentList/student/$id';
  static String classTimetable(String classId) => '$baseUrl/TimetableClass/$classId';
  static String complainList(String schoolId) => '$baseUrl/ComplainList/$schoolId';
  static String get complainCreate => '$baseUrl/ComplainCreate';
  static String studentFeeHistory(String id) => '$baseUrl/Fees/Student/$id';
  static String noticeList(String schoolId) => '$baseUrl/NoticeList/$schoolId';
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
