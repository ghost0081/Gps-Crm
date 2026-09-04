import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../providers/auth_provider.dart';
import '../../../services/api_service.dart';
import '../../theme.dart';
import '../../widgets/premium_card.dart';
import '../../widgets/page_header.dart';

class TeacherHome extends StatefulWidget {
  const TeacherHome({super.key});

  @override
  State<TeacherHome> createState() => _TeacherHomeState();
}

class _TeacherHomeState extends State<TeacherHome> {
  int _classStudents = 0;
  int _totalLessons = 0;
  List<dynamic> _parentArrivals = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchDashboardData();
  }

  Future<void> _fetchDashboardData() async {
    try {
      final user = Provider.of<AuthProvider>(context, listen: false).currentUser;
      
      final students = await ApiService().getClassStudents(user?.sclassId ?? '');
      _classStudents = students.length;

      if (user?.teachSubjectId != null && user!.teachSubjectId!.isNotEmpty) {
        final subjectDetails = await ApiService().getSubjectDetails(user.teachSubjectId!);
        _totalLessons = int.tryParse(subjectDetails['sessions']?.toString() ?? '0') ?? 0;
      }

      // Fetch active Parent Arrivals for this teacher
      final arrivals = await ApiService().getTeacherParentArrivals(user?.id ?? '');
      _parentArrivals = arrivals;
    } catch (e) {
      debugPrint(e.toString());
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _dispatchStudent(String arrivalId, String studentName) async {
    try {
      await ApiService().updateParentArrivalStatus(arrivalId, 'Student Dispatched');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('✅ $studentName marked as Dispatched!'),
          backgroundColor: const Color(0xFF10B981),
          behavior: SnackBarBehavior.floating,
        ),
      );
      _fetchDashboardData();
    } catch (e) {
      debugPrint("Error dispatching student: $e");
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator(color: AppTheme.primaryColor));
    }

    final user = Provider.of<AuthProvider>(context).currentUser;
    final waitingArrivals = _parentArrivals.where((a) => a['status'] == 'Waiting at Frontdesk').toList();

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          PageHeader(
            title: 'Welcome, ${user?.name ?? 'Teacher'}! 👨‍🏫',
            subtitle: 'Class: ${user?.sclassName ?? 'N/A'} • Subject: ${user?.teachSubjectName ?? 'N/A'}',
          ),

          // 🚨 REAL-TIME PARENT ARRIVAL ALERT BANNER
          if (waitingArrivals.isNotEmpty)
            ...waitingArrivals.map((arr) {
              return Container(
                margin: const EdgeInsets.only(bottom: 16),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF2F2),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFEF4444), width: 1.5),
                  boxShadow: [
                    BoxShadow(color: Colors.red.withOpacity(0.12), blurRadius: 10, offset: const Offset(0, 4)),
                  ],
                ),
                child: Row(
                  children: [
                    const Icon(Icons.notifications_active_rounded, color: Color(0xFFEF4444), size: 32),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '🚨 PARENT AT FRONT DESK!',
                            style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF991B1B), fontSize: 13),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Parent of ${arr['studentName']} (Roll #${arr['rollNum']}) is waiting at FrontDesk.',
                            style: const TextStyle(fontWeight: FontWeight.w600, color: Color(0xFF7F1D1D), fontSize: 13),
                          ),
                          const SizedBox(height: 2),
                          Text('Parent: ${arr['parentName'] ?? "Parent"}', style: TextStyle(fontSize: 11, color: Colors.red.shade700)),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFEF4444),
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      onPressed: () => _dispatchStudent(arr['_id'], arr['studentName']),
                      child: const Text('Dispatch', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12)),
                    ),
                  ],
                ),
              );
            }),

          // Teacher Banner
          Container(
            padding: const EdgeInsets.all(24.0),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [AppTheme.primaryColor, Color(0xFF4F46E5)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                  color: AppTheme.primaryColor.withOpacity(0.25),
                  blurRadius: 15,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 30,
                  backgroundColor: Colors.white.withOpacity(0.2),
                  child: const Icon(Icons.person_rounded, color: Colors.white, size: 32),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        user?.name ?? 'Teacher',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Class Educator • ${user?.sclassName ?? 'Unassigned'}',
                        style: TextStyle(
                          color: Colors.white.withOpacity(0.85),
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          Text('Overview Stats', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: 16),

          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 2,
            crossAxisSpacing: 16,
            mainAxisSpacing: 16,
            childAspectRatio: 1.1,
            children: [
              _buildStatCard('Class Students', '$_classStudents', Icons.groups_rounded, const Color(0xFF3B82F6), const Color(0xFFDBEAFE)),
              _buildStatCard('Total Lessons', '$_totalLessons', Icons.book_rounded, const Color(0xFF10B981), const Color(0xFFD1FAE5)),
              _buildStatCard('Tests Conducted', '24', Icons.assignment_turned_in_rounded, const Color(0xFFF59E0B), const Color(0xFFFEF3C7)),
              _buildStatCard('Teaching Hours', '30 hrs', Icons.access_time_filled_rounded, const Color(0xFF8B5CF6), const Color(0xFFEDE9FE)),
            ],
          ),
          const SizedBox(height: 24),

          PremiumCard(
            padding: const EdgeInsets.all(20),
            child: Row(
              children: const [
                Icon(Icons.notifications_none_rounded, color: AppTheme.textSecondary),
                SizedBox(width: 12),
                Text('No urgent teacher notices right now.', style: TextStyle(color: AppTheme.textSecondary, fontWeight: FontWeight.w500)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatCard(String title, String value, IconData icon, Color color, Color bgLight) {
    return PremiumCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: bgLight, borderRadius: BorderRadius.circular(12)),
            child: Icon(icon, size: 24, color: color),
          ),
          const SizedBox(height: 12),
          Text(title, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13, fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          Text(value, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: color)),
        ],
      ),
    );
  }
}
