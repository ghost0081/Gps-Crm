import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config.dart';

class ApiService {
  Future<Map<String, dynamic>> login(String role, String identifier, String password, {String? studentName}) async {
    String endpoint;
    if (role == 'Student') {
      endpoint = Config.studentLogin;
    } else if (role == 'Teacher') {
      endpoint = Config.teacherLogin;
    } else if (role == 'Parent') {
      endpoint = Config.parentLogin;
    } else if (role == 'FrontDesk') {
      endpoint = Config.frontdeskLogin;
    } else if (role == 'Guardian') {
      endpoint = Config.guardianLogin;
    } else {
      throw Exception('Invalid role specified');
    }

    try {
      // Build the request body — rollNum MUST be sent as an integer because the
      // backend MongoDB schema defines rollNum as Number. Sending a string causes
      // Mongoose findOne to return null (no match), giving "Student not found".
      final Map<String, dynamic> body = {};
      if (role == 'Student' || role == 'Parent') {
        body['rollNum'] = int.tryParse(identifier) ?? identifier;
      } else if (role == 'Guardian') {
        body['passCode'] = identifier;
      } else {
        body['email'] = identifier;
      }
      if (role == 'Student' && studentName != null) {
        body['studentName'] = studentName;
      }
      body['password'] = password;

      final response = await http.post(
        Uri.parse(endpoint),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(body),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200) {
        // A valid user response always has an '_id' field.
        // A backend error response has 'message' but NO '_id'.
        if (data is Map && data.containsKey('message') && !data.containsKey('_id')) {
          throw Exception(data['message']);
        }
        return Map<String, dynamic>.from(data);
      } else {
        throw Exception(data['message'] ?? 'Login failed (status ${response.statusCode})');
      }
    } catch (e) {
      rethrow;
    }
  }

  // --- Teacher API Methods ---
  Future<Map<String, dynamic>> getSubjectDetails(String id) async {
    if (id.isEmpty) throw Exception('Invalid ID');
    final response = await _getReq(Config.subjectDetails(id));
    if (response is Map) return response as Map<String, dynamic>;
    throw Exception('Invalid format');
  }

  Future<List<dynamic>> getClassStudents(String id) async {
    if (id.isEmpty) return [];
    final response = await _getReq(Config.classStudents(id));
    if (response is Map && response.containsKey('message')) return [];
    return response as List<dynamic>;
  }

  Future<List<dynamic>> getTeacherTimetable(String id) async {
    if (id.isEmpty) return [];
    final response = await _getReq(Config.teacherTimetable(id));
    if (response is Map && response.containsKey('message')) return [];
    return response as List<dynamic>;
  }

  Future<List<dynamic>> getTeacherAssignments(String id) async {
    if (id.isEmpty) return [];
    final response = await _getReq('${Config.baseUrl}/AssignmentList/teacher/$id');
    if (response is Map && response.containsKey('message')) return [];
    return response as List<dynamic>;
  }

  Future<List<dynamic>> getTeacherLeaves(String id) async {
    if (id.isEmpty) return [];
    final response = await _getReq(Config.teacherLeaves(id));
    if (response is Map && response.containsKey('message')) return [];
    return response as List<dynamic>;
  }

  Future<List<dynamic>> getTeacherPayroll(String id) async {
    if (id.isEmpty) return [];
    final response = await _getReq(Config.teacherPayroll(id));
    if (response is Map && response.containsKey('message')) return [];
    return response as List<dynamic>;
  }

  Future<Map<String, dynamic>> getTeacherProfile(String id) async {
    if (id.isEmpty) throw Exception('Invalid ID');
    final response = await _getReq(Config.teacherProfile(id));
    if (response is Map) return response as Map<String, dynamic>;
    throw Exception('Invalid format');
  }

  Future<dynamic> _getReq(String endpoint) async {
    try {
      final response = await http.get(Uri.parse(endpoint));
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      }
      throw Exception('Failed to load data');
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  Future<Map<String, dynamic>> getStudentDetails(String id) async {
    if (id.isEmpty) throw Exception('Invalid ID');
    final response = await _getReq(Config.studentDetails(id));
    if (response is Map) return response as Map<String, dynamic>;
    throw Exception('Invalid response format');
  }

  Future<List<dynamic>> getClassSubjects(String classId) async {
    if (classId.isEmpty) return [];
    final response = await _getReq(Config.classSubjects(classId));
    if (response is Map && response.containsKey('message')) return [];
    return response as List<dynamic>;
  }

  Future<List<dynamic>> getStudentAssignments(String id) async {
    if (id.isEmpty) return [];
    final response = await _getReq(Config.studentAssignments(id));
    if (response is Map && response.containsKey('message')) return [];
    return response as List<dynamic>;
  }

  Future<List<dynamic>> getClassTimetable(String classId) async {
    if (classId.isEmpty) return [];
    final response = await _getReq(Config.classTimetable(classId));
    if (response is Map && response.containsKey('message')) return [];
    return response as List<dynamic>;
  }

  Future<List<dynamic>> getComplains(String schoolId) async {
    if (schoolId.isEmpty) return [];
    final response = await _getReq(Config.complainList(schoolId));
    if (response is Map && response.containsKey('message')) return [];
    return response as List<dynamic>;
  }

  Future<List<dynamic>> getStudentFeeHistory(String studentId) async {
    if (studentId.isEmpty) return [];
    final response = await _getReq(Config.studentFeeHistory(studentId));
    if (response is Map && response.containsKey('message')) return [];
    return response as List<dynamic>;
  }

  Future<List<dynamic>> getNotices(String schoolId) async {
    if (schoolId.isEmpty) return [];
    final response = await _getReq(Config.noticeList(schoolId));
    if (response is Map && response.containsKey('message')) return [];
    return response as List<dynamic>;
  }

  // --- Tracker API Methods ---
  Future<List<dynamic>> getActiveDevices() async {
    final response = await _getReq(Config.activeDevices);
    if (response is List) return response;
    return [];
  }

  Future<Map<String, dynamic>> getDeviceData(String deviceId) async {
    if (deviceId.isEmpty) throw Exception('Invalid device ID');
    final response = await _getReq('${Config.baseUrl}/api/admin/$deviceId');
    if (response is Map) return response as Map<String, dynamic>;
    throw Exception('Invalid response format');
  }

  Future<Map<String, dynamic>> updateGeofence(String studentId, Map<String, dynamic> geofence) async {
    try {
      final response = await http.put(
        Uri.parse('${Config.baseUrl}/api/student/$studentId/geofence'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(geofence),
      );
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        throw Exception('Failed to update geofence');
      }
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  Future<void> createComplain(String user, String date, String complaint, String school) async {
    try {
      final response = await http.post(
        Uri.parse(Config.complainCreate),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'user': user,
          'date': date,
          'complaint': complaint,
          'school': school,
        }),
      );
      if (response.statusCode != 200) {
        throw Exception('Failed to submit complain');
      }
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  // --- Shop / Stationery Methods ---
  Future<List<dynamic>> getStationery(String schoolId) async {
    if (schoolId.isEmpty) return [];
    final response = await _getReq('${Config.baseUrl}/Stationery/$schoolId');
    if (response is Map && response.containsKey('message')) return [];
    return response as List<dynamic>;
  }

  Future<void> createInvoice(Map<String, dynamic> payload) async {
    try {
      final response = await http.post(
        Uri.parse('${Config.baseUrl}/Invoice'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(payload),
      );
      if (response.statusCode != 200) {
        throw Exception('Failed to create invoice');
      }
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  Future<Map<String, dynamic>> uploadBleTelemetry(Map<String, dynamic> payload) async {
    try {
      final response = await http.post(
        Uri.parse(Config.bleTelemetry),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(payload),
      );
      final data = jsonDecode(response.body);
      if (response.statusCode == 200) {
        return Map<String, dynamic>.from(data);
      } else {
        throw Exception(data['error'] ?? data['message'] ?? 'Failed to upload BLE telemetry');
      }
    } catch (e) {
      throw Exception(e.toString().replaceAll(RegExp(r'Exception:\s*'), ''));
    }
  }

  Future<Map<String, dynamic>> addStudentTracker(String studentId, String imei, {String? name, String? deviceType}) async {
    try {
      final response = await http.post(
        Uri.parse('${Config.baseUrl}/api/student/$studentId/tracker'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'imei': imei,
          'name': name ?? 'Tracker',
          'deviceType': deviceType ?? 'BLE_BEACON',
        }),
      );
      return Map<String, dynamic>.from(jsonDecode(response.body));
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  Future<Map<String, dynamic>> removeStudentTracker(String studentId, String imei) async {
    try {
      final response = await http.delete(
        Uri.parse('${Config.baseUrl}/api/student/$studentId/tracker/$imei'),
        headers: {'Content-Type': 'application/json'},
      );
      return Map<String, dynamic>.from(jsonDecode(response.body));
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  Future<Map<String, dynamic>> getDeviceHistory(String deviceId, String date) async {
    try {
      final response = await _getReq('${Config.baseUrl}/api/admin/history/$deviceId?date=$date');
      if (response is Map) return Map<String, dynamic>.from(response);
      return {'points': [], 'totalDistanceMeters': 0};
    } catch (e) {
      return {'points': [], 'totalDistanceMeters': 0};
    }
  }

  // --- FrontDesk & Parent Gate Pass API Methods ---
  Future<Map<String, dynamic>> scanParentQr(Map<String, dynamic> qrData, {String? scannedBy}) async {
    try {
      final body = {
        ...qrData,
        'scannedBy': scannedBy ?? 'FrontDesk Staff'
      };
      final response = await http.post(
        Uri.parse(Config.scanParentQr),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(body),
      );
      final data = jsonDecode(response.body);
      if (response.statusCode == 200) {
        return Map<String, dynamic>.from(data);
      } else {
        throw Exception(data['message'] ?? 'Failed to log parent arrival');
      }
    } catch (e) {
      throw Exception(e.toString().replaceAll(RegExp(r'Exception:\s*'), ''));
    }
  }

  Future<List<dynamic>> getTeacherParentArrivals(String teacherId) async {
    try {
      final response = await _getReq('${Config.parentArrivals}?teacherId=$teacherId');
      if (response is List) return response;
      return [];
    } catch (e) {
      return [];
    }
  }

  Future<List<dynamic>> getAllParentArrivals() async {
    try {
      final response = await _getReq(Config.parentArrivals);
      if (response is List) return response;
      return [];
    } catch (e) {
      return [];
    }
  }

  Future<Map<String, dynamic>> updateParentArrivalStatus(String arrivalId, String status) async {
    try {
      final response = await http.put(
        Uri.parse('${Config.parentArrivals}/$arrivalId'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'status': status}),
      );
      return Map<String, dynamic>.from(jsonDecode(response.body));
    } catch (e) {
      throw Exception(e.toString().replaceAll(RegExp(r'Exception:\s*'), ''));
    }
  }

  // --- 24h Guardian Pass API Methods ---
  Future<Map<String, dynamic>> createGuardianPass(String parentId, String guardianName, {String? guardianPhone, String? relation}) async {
    try {
      final response = await http.post(
        Uri.parse('${Config.baseUrl}/Parent/CreateGuardianPass'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'parentId': parentId,
          'guardianName': guardianName,
          'guardianPhone': guardianPhone ?? '',
          'relation': relation ?? 'Guardian',
        }),
      );
      final data = jsonDecode(response.body);
      if (response.statusCode == 200) {
        return Map<String, dynamic>.from(data);
      } else {
        throw Exception(data['message'] ?? 'Failed to issue Guardian pass');
      }
    } catch (e) {
      throw Exception(e.toString().replaceAll(RegExp(r'Exception:\s*'), ''));
    }
  }

  Future<List<dynamic>> getGuardianPasses(String parentId) async {
    try {
      final response = await _getReq('${Config.baseUrl}/Parent/GuardianPasses/$parentId');
      if (response is List) return response;
      return [];
    } catch (e) {
      return [];
    }
  }

  Future<Map<String, dynamic>> revokeGuardianPass(String passId) async {
    try {
      final response = await http.put(
        Uri.parse('${Config.baseUrl}/Parent/RevokeGuardianPass/$passId'),
        headers: {'Content-Type': 'application/json'},
      );
      return Map<String, dynamic>.from(jsonDecode(response.body));
    } catch (e) {
      throw Exception(e.toString().replaceAll(RegExp(r'Exception:\s*'), ''));
    }
  }
}
