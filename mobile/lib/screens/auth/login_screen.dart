import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../student/student_dashboard.dart';
import '../teacher/teacher_dashboard.dart';
import '../parent/parent_dashboard.dart';
import '../admin/admin_dashboard.dart';
import '../frontdesk/frontdesk_dashboard.dart';
import '../guardian/guardian_gate_pass_screen.dart';
import '../../theme.dart';
import '../../widgets/premium_card.dart';

/*
 * LoginScreen — Premium UI Rewrite
 * 
 * Updated to match the web application's premium authentication flow.
 * Includes a vibrant gradient background, elevated card, and stylized role selection.
 */
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  String _selectedRole = 'Student'; // Default role
  final _identifierController = TextEditingController();
  final _studentNameController = TextEditingController();
  final _passwordController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  final List<String> _roles = ['Student', 'Teacher', 'Parent', 'Admin', 'FrontDesk', 'Guardian'];

  @override
  void dispose() {
    _identifierController.dispose();
    _studentNameController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _submit() async {
    if (!_formKey.currentState!.validate()) return;

    final authProvider = Provider.of<AuthProvider>(context, listen: false);

    try {
      await authProvider.login(
        _selectedRole,
        _identifierController.text.trim(),
        _selectedRole == 'Guardian' ? 'PASSCODE' : _passwordController.text,
        studentName: _selectedRole == 'Student' ? _studentNameController.text.trim() : null,
      );

      if (!mounted) return;

      if (authProvider.currentUser?.role == 'Student') {
        Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const StudentDashboard()));
      } else if (authProvider.currentUser?.role == 'Teacher') {
        Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const TeacherDashboard()));
      } else if (authProvider.currentUser?.role == 'Parent') {
        Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const ParentDashboard()));
      } else if (authProvider.currentUser?.role == 'Admin') {
        Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const AdminDashboard()));
      } else if (authProvider.currentUser?.role == 'FrontDesk') {
        Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const FrontDeskDashboard()));
      } else if (authProvider.currentUser?.role == 'Guardian') {
        Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const GuardianGatePassScreen()));
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(authProvider.error ?? 'Login failed'),
          backgroundColor: Theme.of(context).colorScheme.error,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final isLoading = Provider.of<AuthProvider>(context).isLoading;

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              AppTheme.primaryColor,
              Color(0xFF3B82F6), // Blue 500
            ],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 48.0),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Logo/Brand Area
                  Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.1),
                          blurRadius: 20,
                          offset: const Offset(0, 10),
                        ),
                      ],
                    ),
                    child: const Icon(
                      Icons.school_rounded,
                      size: 40,
                      color: AppTheme.primaryColor,
                    ),
                  ),
                  const SizedBox(height: 24),
                  const Text(
                    'SchoolMS',
                    style: TextStyle(
                      fontSize: 32,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                      letterSpacing: -0.5,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Welcome back. Sign in to your account.',
                    style: TextStyle(
                      fontSize: 16,
                      color: Colors.white.withOpacity(0.8),
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 40),

                  // Login Form Card
                  PremiumCard(
                    padding: const EdgeInsets.all(32.0),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // Custom Segmented Control for Roles
                          Container(
                            padding: const EdgeInsets.all(4),
                            decoration: BoxDecoration(
                              color: AppTheme.backgroundColor,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: AppTheme.borderColor),
                            ),
                            child: Row(
                              children: _roles.map((role) {
                                final isSelected = _selectedRole == role;
                                return Expanded(
                                  child: GestureDetector(
                                    onTap: () {
                                      setState(() {
                                        _selectedRole = role;
                                        // Reset fields when changing roles to avoid validation errors on hidden fields
                                        _formKey.currentState?.reset();
                                        _identifierController.clear();
                                        _studentNameController.clear();
                                        _passwordController.clear();
                                      });
                                    },
                                    child: AnimatedContainer(
                                      duration: const Duration(milliseconds: 200),
                                      padding: const EdgeInsets.symmetric(vertical: 12),
                                      decoration: BoxDecoration(
                                        color: isSelected ? Colors.white : Colors.transparent,
                                        borderRadius: BorderRadius.circular(8),
                                        boxShadow: isSelected
                                            ? [
                                                BoxShadow(
                                                  color: Colors.black.withOpacity(0.04),
                                                  blurRadius: 4,
                                                  offset: const Offset(0, 2),
                                                )
                                              ]
                                            : null,
                                      ),
                                      child: Text(
                                        role,
                                        textAlign: TextAlign.center,
                                        style: TextStyle(
                                          fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
                                          color: isSelected ? AppTheme.primaryColor : AppTheme.textSecondary,
                                          fontSize: 14,
                                        ),
                                      ),
                                    ),
                                  ),
                                );
                              }).toList(),
                            ),
                          ),
                          const SizedBox(height: 24),

                          // Form Fields
                          TextFormField(
                            controller: _identifierController,
                            decoration: InputDecoration(
                              labelText: _selectedRole == 'Guardian'
                                  ? '24h Pass Code (e.g. G-498201)'
                                  : ((_selectedRole == 'Student' || _selectedRole == 'Parent') ? 'Roll Number' : 'Email Address'),
                              prefixIcon: Icon(_selectedRole == 'Guardian'
                                  ? Icons.key_rounded
                                  : ((_selectedRole == 'Student' || _selectedRole == 'Parent') ? Icons.numbers_rounded : Icons.email_outlined)),
                            ),
                            validator: (value) => value!.isEmpty ? 'This field is required' : null,
                          ),
                          if (_selectedRole == 'Student') ...[
                            const SizedBox(height: 16),
                            TextFormField(
                              controller: _studentNameController,
                              decoration: const InputDecoration(
                                labelText: 'Student Name',
                                prefixIcon: Icon(Icons.person_outline),
                              ),
                              validator: (value) => value!.isEmpty ? 'Student Name is required' : null,
                            ),
                          ],
                          if (_selectedRole != 'Guardian') ...[
                            const SizedBox(height: 16),
                            TextFormField(
                              controller: _passwordController,
                              decoration: const InputDecoration(
                                labelText: 'Password',
                                prefixIcon: Icon(Icons.lock_outline),
                              ),
                              obscureText: true,
                              validator: (value) => value!.isEmpty ? 'Password is required' : null,
                            ),
                          ],
                          const SizedBox(height: 32),

                          ElevatedButton(
                            onPressed: isLoading ? null : _submit,
                            child: isLoading
                                ? const SizedBox(
                                    height: 24,
                                    width: 24,
                                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                                  )
                                : const Text('Sign In'),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
