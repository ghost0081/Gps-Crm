import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../../providers/auth_provider.dart';
import '../../../services/api_service.dart';
import '../../theme.dart';
import '../../widgets/premium_card.dart';
import '../../widgets/page_header.dart';

class ParentAssignments extends StatefulWidget {
  const ParentAssignments({super.key});

  @override
  State<ParentAssignments> createState() => _ParentAssignmentsState();
}

class _ParentAssignmentsState extends State<ParentAssignments> {
  bool _isLoading = true;
  List<dynamic> _assignments = [];

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
        _assignments = await ApiService().getStudentAssignments(childId);
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

    final authProvider = Provider.of<AuthProvider>(context);
    final childId = authProvider.activeChildId;

    int submitted = 0;
    int pending = 0;

    for (var a in _assignments) {
      final statuses = (a['studentStatus'] as List<dynamic>?) ?? [];
      final myStatus = statuses.firstWhere(
        (ss) => (ss['student']?['_id'] ?? ss['student']) == childId,
        orElse: () => null,
      );
      if (myStatus != null && myStatus['status'] == 'Submitted') {
        submitted++;
      } else {
        pending++;
      }
    }

    return Padding(
      padding: const EdgeInsets.all(24.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const PageHeader(
            title: 'Assignments',
            subtitle: 'Review homework due dates, instructions, and submissions.',
          ),

          // Overview KPI Card
          PremiumCard(
            padding: const EdgeInsets.all(20),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${_assignments.length}',
                      style: const TextStyle(fontSize: 36, fontWeight: FontWeight.w800, color: AppTheme.primaryColor, letterSpacing: -1),
                    ),
                    const SizedBox(height: 4),
                    const Text('Total Assignments', style: TextStyle(color: AppTheme.textSecondary, fontSize: 13, fontWeight: FontWeight.w600)),
                  ],
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    _buildMiniBadge(Icons.task_alt_rounded, 'Submitted: $submitted', const Color(0xFF10B981), const Color(0xFFD1FAE5)),
                    const SizedBox(height: 6),
                    _buildMiniBadge(Icons.pending_actions_rounded, 'Pending: $pending', const Color(0xFFF59E0B), const Color(0xFFFEF3C7)),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // List
          Expanded(
            child: _assignments.isEmpty
                ? const PremiumCard(
                    child: Center(
                      child: Padding(
                        padding: EdgeInsets.all(24.0),
                        child: Text('No assignments posted yet.', style: TextStyle(color: AppTheme.textSecondary)),
                      ),
                    ),
                  )
                : ListView.builder(
                    itemCount: _assignments.length,
                    itemBuilder: (context, index) {
                      final a = _assignments[index];
                      final statuses = (a['studentStatus'] as List<dynamic>?) ?? [];
                      final myStatus = statuses.firstWhere(
                        (ss) => (ss['student']?['_id'] ?? ss['student']) == childId,
                        orElse: () => null,
                      );

                      final statusText = myStatus?['status'] ?? 'Pending';
                      final marks = myStatus?['marks'];
                      final dueDate = a['dueDate'] != null ? DateTime.tryParse(a['dueDate']) : null;
                      
                      final isOverdue = dueDate != null && dueDate.isBefore(DateTime.now()) && statusText != 'Submitted';

                      Color statusColor = const Color(0xFFF59E0B);
                      Color bgColor = const Color(0xFFFEF3C7);
                      if (statusText == 'Submitted') {
                        statusColor = const Color(0xFF10B981);
                        bgColor = const Color(0xFFD1FAE5);
                      } else if (isOverdue) {
                        statusColor = const Color(0xFFEF4444);
                        bgColor = const Color(0xFFFEE2E2);
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
                                  Expanded(
                                    child: Text(
                                      a['title'] ?? 'Untitled Assignment',
                                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                    decoration: BoxDecoration(color: bgColor, borderRadius: BorderRadius.circular(20)),
                                    child: Text(
                                      isOverdue ? 'Overdue' : statusText,
                                      style: TextStyle(color: statusColor, fontWeight: FontWeight.w700, fontSize: 12),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    'Subject: ${a['subject']?['subName'] ?? 'General'}',
                                    style: const TextStyle(color: AppTheme.textSecondary, fontWeight: FontWeight.w600, fontSize: 13),
                                  ),
                                  Text(
                                    'Due: ${dueDate != null ? DateFormat('MMM dd, yyyy').format(dueDate) : 'No due date'}',
                                    style: const TextStyle(color: AppTheme.textDisabled, fontWeight: FontWeight.w600, fontSize: 13),
                                  ),
                                ],
                              ),
                              if (a['description'] != null && a['description'].toString().isNotEmpty) ...[
                                const SizedBox(height: 10),
                                Text(
                                  a['description'],
                                  style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13, height: 1.4),
                                ),
                              ],
                              if (statusText == 'Submitted' && marks != null) ...[
                                const SizedBox(height: 12),
                                _buildMiniBadge(Icons.star_rounded, 'Marks Awarded: $marks', AppTheme.primaryColor, AppTheme.primaryLight),
                              ],
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
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
