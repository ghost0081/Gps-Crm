import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';
import '../../models/safety_notification_model.dart';
import '../../theme.dart';

class ParentSafetyAlertsScreen extends StatefulWidget {
  const ParentSafetyAlertsScreen({super.key});

  @override
  State<ParentSafetyAlertsScreen> createState() => _ParentSafetyAlertsScreenState();
}

class _ParentSafetyAlertsScreenState extends State<ParentSafetyAlertsScreen> {
  bool _isLoading = true;
  List<SafetyNotificationModel> _alerts = [];

  @override
  void initState() {
    super.initState();
    _fetchAlerts();
  }

  Future<void> _fetchAlerts() async {
    final user = Provider.of<AuthProvider>(context, listen: false).currentUser;
    if (user == null) return;

    setState(() => _isLoading = true);
    try {
      final list = await ApiService().getSafetyNotifications(user.id);
      if (mounted) {
        setState(() {
          _alerts = list
              .map((a) => SafetyNotificationModel.fromJson(Map<String, dynamic>.from(a as Map)))
              .toList();
        });
      }
    } catch (e) {
      debugPrint("Error fetching safety notifications: $e");
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _markRead(SafetyNotificationModel alert) async {
    final user = Provider.of<AuthProvider>(context, listen: false).currentUser;
    if (user == null) return;

    await ApiService().markSafetyNotificationRead(user.id, alert.id);
    _fetchAlerts();
  }

  IconData _iconForCategory(String category) {
    switch (category) {
      case 'arrival_departure':
        return Icons.meeting_room_rounded;
      case 'proximity':
        return Icons.radar_rounded;
      case 'eta':
        return Icons.timer_rounded;
      case 'route':
        return Icons.alt_route_rounded;
      case 'device':
        return Icons.battery_alert_rounded;
      case 'emergency':
        return Icons.warning_rounded;
      default:
        return Icons.shield_rounded;
    }
  }

  Color _colorForCategory(String category) {
    switch (category) {
      case 'emergency':
        return const Color(0xFFEF4444);
      case 'arrival_departure':
        return const Color(0xFF10B981);
      case 'proximity':
      case 'eta':
        return const Color(0xFF3B82F6);
      default:
        return const Color(0xFFF59E0B);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.primaryColor))
          : RefreshIndicator(
              onRefresh: _fetchAlerts,
              child: _alerts.isEmpty
                  ? ListView(
                      padding: const EdgeInsets.all(24),
                      children: [
                        const SizedBox(height: 60),
                        Center(
                          child: Column(
                            children: [
                              Icon(Icons.notifications_none_rounded, size: 64, color: Colors.grey.shade400),
                              const SizedBox(height: 16),
                              const Text(
                                'All Quiet!',
                                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                'No safety events or perimeter alerts have been recorded today.',
                                textAlign: TextAlign.center,
                                style: TextStyle(fontSize: 14, color: Colors.grey.shade600),
                              ),
                            ],
                          ),
                        ),
                      ],
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: _alerts.length,
                      itemBuilder: (ctx, i) {
                        final a = _alerts[i];
                        final color = _colorForCategory(a.category);

                        return Card(
                          margin: const EdgeInsets.only(bottom: 12),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                            side: a.critical
                                ? const BorderSide(color: Color(0xFFEF4444), width: 1.5)
                                : BorderSide.none,
                          ),
                          child: ListTile(
                            onTap: () => _markRead(a),
                            leading: Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: color.withOpacity(0.12),
                                shape: BoxShape.circle,
                              ),
                              child: Icon(_iconForCategory(a.category), color: color, size: 24),
                            ),
                            title: Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    a.title,
                                    style: TextStyle(
                                      fontWeight: a.isRead ? FontWeight.w600 : FontWeight.bold,
                                      color: AppTheme.textPrimary,
                                    ),
                                  ),
                                ),
                                if (!a.isRead)
                                  Container(
                                    width: 8,
                                    height: 8,
                                    decoration: const BoxDecoration(
                                      color: AppTheme.primaryColor,
                                      shape: BoxShape.circle,
                                    ),
                                  ),
                              ],
                            ),
                            subtitle: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const SizedBox(height: 4),
                                Text(a.body, style: TextStyle(fontSize: 13, color: Colors.grey.shade700)),
                                const SizedBox(height: 6),
                                Text(
                                  '${a.occurredAt.hour.toString().padLeft(2, '0')}:${a.occurredAt.minute.toString().padLeft(2, '0')} • ${a.category.replaceAll('_', ' ').toUpperCase()}',
                                  style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
            ),
    );
  }
}
