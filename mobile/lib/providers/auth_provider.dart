import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user_model.dart';
import '../models/child_model.dart';
import '../services/api_service.dart';

class AuthProvider with ChangeNotifier {
  UserModel? _currentUser;
  ChildModel? _activeChild;
  bool _isLoading = false;
  String? _error;

  UserModel? get currentUser => _currentUser;
  ChildModel? get activeChild => _activeChild;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get isAuthenticated => _currentUser != null;

  /// Effective student ID for current parent view (or student's own ID)
  String? get activeChildId => _activeChild?.id ?? _currentUser?.studentId;

  /// List of children for parent accounts
  List<ChildModel> get children => _currentUser?.children ?? [];

  final ApiService _apiService = ApiService();

  Future<void> login(String role, String identifier, String password, {String? studentName}) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final data = await _apiService.login(role, identifier, password, studentName: studentName);
      _currentUser = UserModel.fromJson(data);
      
      // Initialize active child for Parent
      if (_currentUser?.children.isNotEmpty == true) {
        _activeChild = _currentUser!.children.first;
      } else {
        _activeChild = null;
      }

      // Save locally
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('userData', jsonEncode(_currentUser!.toJson()));
      if (_activeChild != null) {
        await prefs.setString('activeChildId', _activeChild!.id);
      }
      
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _isLoading = false;
      // Strip all "Exception: " prefixes that may be nested by rethrow chains
      _error = e.toString().replaceAll(RegExp(r'Exception:\s*'), '').trim();
      if (_error!.isEmpty) _error = 'Login failed. Please try again.';
      notifyListeners();
      rethrow;
    }
  }

  /// Switch the active child for Parent dashboards
  Future<void> selectChild(String childId) async {
    if (_currentUser == null || _currentUser!.children.isEmpty) return;

    final found = _currentUser!.children.firstWhere(
      (c) => c.id == childId,
      orElse: () => _currentUser!.children.first,
    );
    _activeChild = found;

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('activeChildId', found.id);
    notifyListeners();
  }

  /// Fetch latest children list for parent from backend
  Future<void> refreshParentChildren() async {
    if (_currentUser == null || _currentUser!.role != 'Parent') return;
    try {
      final list = await _apiService.getParentChildren(_currentUser!.id);
      if (list.isNotEmpty) {
        final updatedChildren = list
            .map((c) => ChildModel.fromJson(Map<String, dynamic>.from(c as Map)))
            .toList();

        _currentUser = UserModel(
          id: _currentUser!.id,
          name: _currentUser!.name,
          email: _currentUser!.email,
          role: _currentUser!.role,
          sclassName: _currentUser!.sclassName,
          sclassId: _currentUser!.sclassId,
          teachSubjectId: _currentUser!.teachSubjectId,
          teachSubjectName: _currentUser!.teachSubjectName,
          studentId: _currentUser!.studentId,
          schoolId: _currentUser!.schoolId,
          children: updatedChildren,
        );

        if (_activeChild == null && updatedChildren.isNotEmpty) {
          _activeChild = updatedChildren.first;
        }

        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('userData', jsonEncode(_currentUser!.toJson()));
        notifyListeners();
      }
    } catch (e) {
      debugPrint("Could not refresh parent children: $e");
    }
  }

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('userData');
    await prefs.remove('activeChildId');
    _currentUser = null;
    _activeChild = null;
    notifyListeners();
  }

  Future<void> tryAutoLogin() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      if (!prefs.containsKey('userData')) return;

      final userDataStr = prefs.getString('userData');
      if (userDataStr == null || userDataStr.isEmpty) return;

      final extractedUserData = jsonDecode(userDataStr) as Map<String, dynamic>;
      _currentUser = UserModel.fromJson(extractedUserData);

      // Restore active child if Parent
      if (_currentUser?.children.isNotEmpty == true) {
        final savedChildId = prefs.getString('activeChildId');
        if (savedChildId != null) {
          _activeChild = _currentUser!.children.firstWhere(
            (c) => c.id == savedChildId,
            orElse: () => _currentUser!.children.first,
          );
        } else {
          _activeChild = _currentUser!.children.first;
        }
      }

      notifyListeners();
    } catch (e) {
      debugPrint("AutoLogin failed: $e");
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('userData');
      await prefs.remove('activeChildId');
      _currentUser = null;
      _activeChild = null;
      notifyListeners();
    }
  }
}
