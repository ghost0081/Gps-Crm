import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../providers/auth_provider.dart';
import '../../../services/api_service.dart';
import '../../theme.dart';
import '../../widgets/premium_card.dart';
import '../../widgets/page_header.dart';

class ParentAttendance extends StatefulWidget {
  const ParentAttendance({super.key});

  @override
  State<ParentAttendance> createState() => _ParentAttendanceState();
}

class _ParentAttendanceState extends State<ParentAttendance> {
  bool _isLoading = true;
  Map<String, dynamic>? _studentDetails;

  String? _lastLoadedChildId;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final childId = Provider.of<AuthProvider>(context).activeChildId;
    if (childId != _lastLoadedChildId) {
      _lastLoadedChildId = childId;
      _fetchData();
    }
  }

  Future<void> _fetchData() async {
    try {
      final childId = Provider.of<AuthProvider>(context, listen: false).activeChildId;
      if (childId != null) {
        _studentDetails = await ApiService().getStudentDetails(childId);
      }
    } catch (e) {
      debugPrint(e.toString());
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(color: AppTheme.primaryColor),
      );
    }

    final attendance = (_studentDetails?['attendance'] as List<dynamic>?) ?? [];
    int present = 0;
    int absent = 0;
    
    final Map<String, Map<String, int>> groupedAttendance = {};

    for (var a in attendance) {
      if (a['status'] == 'Present') present++;
      if (a['status'] == 'Absent') absent++;

      final subName = a['subName']?.toString() ?? 'General';
      if (!groupedAttendance.containsKey(subName)) {
        groupedAttendance[subName] = {'present': 0, 'absent': 0, 'total': 0};
      }
      
      groupedAttendance[subName]!['total'] = groupedAttendance[subName]!['total']! + 1;
      if (a['status'] == 'Present') {
        groupedAttendance[subName]!['present'] = groupedAttendance[subName]!['present']! + 1;
      } else if (a['status'] == 'Absent') {
        groupedAttendance[subName]!['absent'] = groupedAttendance[subName]!['absent']! + 1;
      }
    }

    final overallPercentage = attendance.isNotEmpty ? ((present / attendance.length) * 100).toStringAsFixed(1) : '0.0';

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const PageHeader(
            title: 'Attendance Records',
            subtitle: 'Track subject-wise and overall attendance consistency.',
          ),
          
          // Overall Card
          PremiumCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.analytics_rounded, color: AppTheme.primaryColor, size: 20),
                    const SizedBox(width: 8),
                    Text('Overall Attendance Rate', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontSize: 16)),
                  ],
                ),
                const SizedBox(height: 20),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '$overallPercentage%',
                          style: const TextStyle(fontSize: 40, fontWeight: FontWeight.w800, color: AppTheme.primaryColor, letterSpacing: -1),
                        ),
                        const SizedBox(height: 4),
                        const Text('Total classes recorded', style: TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
                      ],
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        _buildMiniBadge(Icons.check_circle_rounded, 'Present: $present', const Color(0xFF10B981), const Color(0xFFD1FAE5)),
                        const SizedBox(height: 8),
                        _buildMiniBadge(Icons.cancel_rounded, 'Absent: $absent', const Color(0xFFEF4444), const Color(0xFFFEE2E2)),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          Text(
            'Subject-wise Breakdown',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(fontSize: 18),
          ),
          const SizedBox(height: 12),
          
          if (groupedAttendance.isEmpty)
            const PremiumCard(
              child: Center(
                child: Padding(
                  padding: EdgeInsets.all(24.0),
                  child: Text('No attendance records found.', style: TextStyle(color: AppTheme.textSecondary)),
                ),
              ),
            )
          else
            ...groupedAttendance.entries.map((entry) {
              final subName = entry.key;
              final stats = entry.value;
              final subPercent = stats['total']! > 0 ? ((stats['present']! / stats['total']!) * 100).toStringAsFixed(1) : '0.0';
              final double parsedPercent = double.tryParse(subPercent) ?? 0.0;
              
              Color chipColor = const Color(0xFF10B981);
              Color bgColor = const Color(0xFFD1FAE5);
              if (parsedPercent < 50) {
                chipColor = const Color(0xFFEF4444);
                bgColor = const Color(0xFFFEE2E2);
              } else if (parsedPercent < 75) {
                chipColor = const Color(0xFFF59E0B);
                bgColor = const Color(0xFFFEF3C7);
              }

              return Padding(
                padding: const EdgeInsets.only(bottom: 12.0),
                child: PremiumCard(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(subName, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(color: bgColor, borderRadius: BorderRadius.circular(20)),
                            child: Text(
                              '$subPercent%',
                              style: TextStyle(color: chipColor, fontWeight: FontWeight.w700, fontSize: 13),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: LinearProgressIndicator(
                          value: stats['total']! > 0 ? (stats['present']! / stats['total']!) : 0,
                          backgroundColor: AppTheme.borderColor,
                          valueColor: AlwaysStoppedAnimation<Color>(chipColor),
                          minHeight: 8,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('Present: ${stats['present']} | Absent: ${stats['absent']}', 
                            style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13, fontWeight: FontWeight.w500)),
                          Text('Total: ${stats['total']}', 
                            style: const TextStyle(color: AppTheme.textDisabled, fontSize: 13, fontWeight: FontWeight.w600)),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
        ],
      ),
    );
  }

  Widget _buildMiniBadge(IconData icon, String value, Color color, Color bgColor) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 6),
          Text(
            value,
            style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 12),
          ),
        ],
      ),
    );
  }
}
