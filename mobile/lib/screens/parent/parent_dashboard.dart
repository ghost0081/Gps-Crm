import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../providers/auth_provider.dart';
import '../auth/login_screen.dart';
import '../../theme.dart';

import 'parent_home.dart';
import 'parent_attendance.dart';
import 'parent_assignments.dart';
import 'parent_fees.dart';
import 'parent_tracking.dart';
import 'parent_shop.dart';
import 'parent_face_registration.dart';

import '../ble/ble_logs_screen.dart';

/*
 * ParentDashboard — Premium UI Rewrite
 * 
 * Replaces default Material Drawer with a stylized premium navigation drawer.
 */
class ParentDashboard extends StatefulWidget {
  const ParentDashboard({super.key});

  @override
  State<ParentDashboard> createState() => _ParentDashboardState();
}

class _ParentDashboardState extends State<ParentDashboard> {
  int _selectedIndex = 0;

  final List<Widget> _screens = [
    const ParentHome(),
    const ParentAttendance(),
    const ParentAssignments(),
    const ParentFees(),
    const ParentTracking(),
    const ParentShop(),
    const ParentFaceRegistration(),
    const BleLogsScreen(),
  ];

  final List<String> _titles = [
    'Parent Dashboard',
    'Attendance',
    'Assignments',
    'Fee Management',
    'Live Tracking',
    'School Shop',
    'Face Registration',
    'BLE System Logs',
  ];

  void _onItemTapped(int index) {
    setState(() {
      _selectedIndex = index;
    });
    Navigator.pop(context); // Close the drawer
  }

  void _logout() async {
    await Provider.of<AuthProvider>(context, listen: false).logout();
    if (mounted) {
      Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const LoginScreen()));
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = Provider.of<AuthProvider>(context).currentUser;

    return Scaffold(
      appBar: AppBar(
        title: Text(_titles[_selectedIndex]),
        elevation: 0,
        scrolledUnderElevation: 0,
      ),
      drawer: Drawer(
        backgroundColor: AppTheme.backgroundColor,
        child: Column(
          children: [
            // Premium Drawer Header
            Container(
              width: double.infinity,
              padding: EdgeInsets.only(
                top: MediaQuery.of(context).padding.top + 24,
                bottom: 24,
                left: 24,
                right: 24,
              ),
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
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.1),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: const Icon(
                      Icons.family_restroom_rounded,
                      size: 32,
                      color: AppTheme.primaryColor,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    user?.name ?? 'Parent Portal',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Parent of Student',
                    style: TextStyle(
                      color: Colors.white.withOpacity(0.8),
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
            
            // Drawer Items
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
                children: [
                  _buildDrawerItem(0, 'Dashboard', Icons.space_dashboard_rounded),
                  _buildDrawerItem(1, 'Attendance', Icons.fact_check_rounded),
                  _buildDrawerItem(2, 'Assignments', Icons.assignment_rounded),
                  _buildDrawerItem(3, 'Fee Management', Icons.payments_rounded),
                  _buildDrawerItem(4, 'Live Tracking', Icons.location_on_rounded),
                  _buildDrawerItem(5, 'School Shop', Icons.storefront_rounded),
                  _buildDrawerItem(6, 'Face Registration', Icons.face_retouching_natural_rounded),
                  _buildDrawerItem(7, 'BLE Gateway & Logs', Icons.bluetooth_audio_rounded),
                ],
              ),
            ),

            // Logout Button at bottom
            Padding(
              padding: const EdgeInsets.all(16.0),
              child: ListTile(
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                leading: const Icon(Icons.logout_rounded, color: Color(0xFFEF4444)),
                title: const Text(
                  'Sign Out',
                  style: TextStyle(
                    color: Color(0xFFEF4444),
                    fontWeight: FontWeight.w600,
                  ),
                ),
                tileColor: const Color(0xFFFEF2F2),
                onTap: _logout,
              ),
            ),
          ],
        ),
      ),
      body: _screens[_selectedIndex],
    );
  }

  Widget _buildDrawerItem(int index, String title, IconData icon) {
    final isSelected = _selectedIndex == index;
    
    return Padding(
      padding: const EdgeInsets.only(bottom: 4.0),
      child: ListTile(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        leading: Icon(
          icon, 
          color: isSelected ? AppTheme.primaryColor : AppTheme.textSecondary,
        ),
        title: Text(
          title,
          style: TextStyle(
            color: isSelected ? AppTheme.primaryColor : AppTheme.textPrimary,
            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
          ),
        ),
        selected: isSelected,
        tileColor: isSelected ? AppTheme.primaryLight : Colors.transparent,
        onTap: () => _onItemTapped(index),
      ),
    );
  }
}
