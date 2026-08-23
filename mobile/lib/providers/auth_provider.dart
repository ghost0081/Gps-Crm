import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user_model.dart';
import '../services/api_service.dart';

class AuthProvider with ChangeNotifier {
  UserModel? _currentUser;
  bool _isLoading = false;
  String? _error;

  UserModel? get currentUser => _currentUser;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get isAuthenticated => _currentUser != null;

  final ApiService _apiService = ApiService();

  Future<void> login(String role, String identifier, String password, {String? studentName}) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final data = await _apiService.login(role, identifier, password, studentName: studentName);
      _currentUser = UserModel.fromJson(data);
      
      // Save locally
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('userData', jsonEncode(_currentUser!.toJson()));
      
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

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('userData');
    _currentUser = null;
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
      notifyListeners();
    } catch (e) {
      debugPrint("AutoLogin failed: $e");
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('userData');
      _currentUser = null;
      notifyListeners();
    }
  }
}
