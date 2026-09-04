import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'theme.dart';
import 'providers/auth_provider.dart';
import 'screens/auth/login_screen.dart';
import 'screens/student/student_dashboard.dart';
import 'screens/teacher/teacher_dashboard.dart';
import 'screens/parent/parent_dashboard.dart';

import 'screens/admin/admin_dashboard.dart';
import 'screens/frontdesk/frontdesk_dashboard.dart';
import 'screens/guardian/guardian_gate_pass_screen.dart';

import 'services/background_ble_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    await BackgroundBleService.initializeService();
  } catch (e) {
    debugPrint("Background BLE Service init notice: $e");
  }

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
      ],
      child: const MyApp(),
    ),
  );
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'School CRM',
      theme: AppTheme.lightTheme,
      debugShowCheckedModeBanner: false,
      home: const AuthWrapper(),
    );
  }
}

class AuthWrapper extends StatefulWidget {
  const AuthWrapper({super.key});

  @override
  State<AuthWrapper> createState() => _AuthWrapperState();
}

class _AuthWrapperState extends State<AuthWrapper> {
  late Future<void> _initFuture;

  @override
  void initState() {
    super.initState();
    // Cache the future so it only runs once!
    _initFuture = Provider.of<AuthProvider>(context, listen: false).tryAutoLogin();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder(
      future: _initFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }

        return Consumer<AuthProvider>(
          builder: (context, auth, _) {
            if (auth.isAuthenticated) {
              if (auth.currentUser?.role == 'Student') return const StudentDashboard();
              if (auth.currentUser?.role == 'Teacher') return const TeacherDashboard();
              if (auth.currentUser?.role == 'Parent') return const ParentDashboard();
              if (auth.currentUser?.role == 'FrontDesk') return const FrontDeskDashboard();
              if (auth.currentUser?.role == 'Guardian') return const GuardianGatePassScreen();
            }
            return const LoginScreen();
          },
        );
      },
    );
  }
}
