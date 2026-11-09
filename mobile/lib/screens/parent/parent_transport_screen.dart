import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';
import '../../models/transport_model.dart';
import '../../theme.dart';
import '../../widgets/premium_card.dart';

class ParentTransportScreen extends StatefulWidget {
  const ParentTransportScreen({super.key});

  @override
  State<ParentTransportScreen> createState() => _ParentTransportScreenState();
}

class _ParentTransportScreenState extends State<ParentTransportScreen> {
  bool _isLoading = true;
  TransportRouteModel? _route;
  String? _lastLoadedStudentId;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final childId = Provider.of<AuthProvider>(context).activeChildId;
    if (childId != _lastLoadedStudentId) {
      _lastLoadedStudentId = childId;
      _fetchTransport();
    }
  }

  Future<void> _fetchTransport() async {
    if (_lastLoadedStudentId == null) {
      setState(() => _isLoading = false);
      return;
    }

    setState(() => _isLoading = true);
    try {
      final res = await ApiService().getStudentTransport(_lastLoadedStudentId!);
      if (mounted) {
        setState(() {
          _route = res != null ? TransportRouteModel.fromJson(res) : null;
        });
      }
    } catch (e) {
      debugPrint("Error fetching transport: $e");
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator(color: AppTheme.primaryColor));
    }

    if (_route == null) {
      return RefreshIndicator(
        onRefresh: _fetchTransport,
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            const SizedBox(height: 60),
            Center(
              child: Column(
                children: [
                  Icon(Icons.directions_bus_outlined, size: 64, color: Colors.grey.shade400),
                  const SizedBox(height: 16),
                  const Text(
                    'No Bus Route Assigned',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'No school transport or bus route is currently registered for this student.',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 14, color: Colors.grey.shade600),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _fetchTransport,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          PremiumCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: const Color(0xFFEFF6FF),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(Icons.directions_bus_rounded, color: AppTheme.primaryColor),
                        ),
                        const SizedBox(width: 12),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _route!.name,
                              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
                            ),
                            if (_route!.code.isNotEmpty)
                              Text(
                                'Route Code: ${_route!.code}',
                                style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                              ),
                          ],
                        ),
                      ],
                    ),
                    Chip(
                      label: Text(_route!.vehicleLabel, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF1E40AF))),
                      backgroundColor: const Color(0xFFDBEAFE),
                    ),
                  ],
                ),
                const Divider(height: 24),
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Driver', style: TextStyle(fontSize: 11, color: AppTheme.textSecondary)),
                          const SizedBox(height: 2),
                          Text(_route!.driverName, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                        ],
                      ),
                    ),
                    if (_route!.helperName.isNotEmpty)
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Helper', style: TextStyle(fontSize: 11, color: AppTheme.textSecondary)),
                            const SizedBox(height: 2),
                            Text(_route!.helperName, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                          ],
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            'Route Stops & ETAs',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
          ),
          const SizedBox(height: 8),
          ..._route!.stops.map((stop) {
            return Card(
              margin: const EdgeInsets.symmetric(vertical: 4),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              elevation: 0,
              color: Colors.white,
              child: ListTile(
                leading: CircleAvatar(
                  radius: 14,
                  backgroundColor: const Color(0xFFEFF6FF),
                  child: Text(
                    '${stop.sequence + 1}',
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.primaryColor),
                  ),
                ),
                title: Text(stop.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                trailing: stop.etaMinutes != null
                    ? Chip(
                        label: Text('${stop.etaMinutes} min', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF047857))),
                        backgroundColor: const Color(0xFFD1FAE5),
                      )
                    : null,
              ),
            );
          }),
        ],
      ),
    );
  }
}
