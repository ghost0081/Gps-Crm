import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';
import '../../models/collector_model.dart';
import '../../theme.dart';

class ParentCollectorsScreen extends StatefulWidget {
  const ParentCollectorsScreen({super.key});

  @override
  State<ParentCollectorsScreen> createState() => _ParentCollectorsScreenState();
}

class _ParentCollectorsScreenState extends State<ParentCollectorsScreen> {
  bool _isLoading = true;
  List<CollectorModel> _collectors = [];

  @override
  void initState() {
    super.initState();
    _fetchCollectors();
  }

  Future<void> _fetchCollectors() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final user = auth.currentUser;
    if (user == null) return;

    setState(() => _isLoading = true);
    try {
      final list = await ApiService().getParentCollectors(user.id);
      if (mounted) {
        setState(() {
          _collectors = list
              .map((c) => CollectorModel.fromJson(Map<String, dynamic>.from(c as Map)))
              .toList();
        });
      }
    } catch (e) {
      debugPrint("Error fetching collectors: $e");
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showAddCollectorDialog() {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final user = auth.currentUser;
    final childId = auth.activeChildId;
    if (user == null || childId == null) return;

    final nameController = TextEditingController();
    final phoneController = TextEditingController();
    String selectedRelation = 'Grandparent';
    final relations = ['Grandparent', 'Family Member', 'Driver', 'Babysitter', 'Guardian'];

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text('Add Authorised Collector'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: nameController,
                  decoration: const InputDecoration(labelText: 'Full Name *', prefixIcon: Icon(Icons.person_outline)),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: phoneController,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(labelText: 'Phone Number *', prefixIcon: Icon(Icons.phone_outlined)),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: selectedRelation,
                  decoration: const InputDecoration(labelText: 'Relationship'),
                  items: relations.map((r) => DropdownMenuItem(value: r, child: Text(r))).toList(),
                  onChanged: (v) {
                    if (v != null) setDialogState(() => selectedRelation = v);
                  },
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () async {
                final name = nameController.text.trim();
                final phone = phoneController.text.trim();
                if (name.isEmpty || phone.isEmpty) return;

                Navigator.pop(ctx);
                try {
                  await ApiService().createCollector({
                    'parentId': user.id,
                    'studentId': childId,
                    'name': name,
                    'phone': phone,
                    'relation': selectedRelation,
                  });
                  _fetchCollectors();
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Collector added successfully!'), backgroundColor: Color(0xFF10B981)),
                    );
                  }
                } catch (e) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Failed: $e'), backgroundColor: const Color(0xFFEF4444)),
                    );
                  }
                }
              },
              child: const Text('Save Collector'),
            ),
          ],
        ),
      ),
    );
  }

  void _revokeCollector(String id) async {
    try {
      await ApiService().revokeCollector(id);
      _fetchCollectors();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Collector access revoked'), backgroundColor: Color(0xFFF59E0B)),
        );
      }
    } catch (e) {
      debugPrint("Error revoking collector: $e");
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.primaryColor))
          : RefreshIndicator(
              onRefresh: _fetchCollectors,
              child: _collectors.isEmpty
                  ? ListView(
                      padding: const EdgeInsets.all(24),
                      children: [
                        const SizedBox(height: 60),
                        Center(
                          child: Column(
                            children: [
                              Icon(Icons.badge_outlined, size: 64, color: Colors.grey.shade400),
                              const SizedBox(height: 16),
                              const Text(
                                'No Authorised Collectors',
                                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                'You have not added any authorised pickup collectors (e.g. driver, grandparents) for your children.',
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
                      itemCount: _collectors.length,
                      itemBuilder: (ctx, i) {
                        final c = _collectors[i];
                        return Card(
                          margin: const EdgeInsets.only(bottom: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          child: ListTile(
                            contentPadding: const EdgeInsets.all(12),
                            leading: CircleAvatar(
                              backgroundColor: c.active ? const Color(0xFFEFF6FF) : Colors.grey.shade200,
                              child: Icon(
                                Icons.person,
                                color: c.active ? AppTheme.primaryColor : Colors.grey,
                              ),
                            ),
                            title: Text(c.name, style: const TextStyle(fontWeight: FontWeight.bold)),
                            subtitle: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const SizedBox(height: 4),
                                Text('${c.relation} • ${c.phone}', style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                                const SizedBox(height: 4),
                                Chip(
                                  label: Text(
                                    c.active ? 'Authorised' : 'Revoked',
                                    style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.bold,
                                      color: c.active ? const Color(0xFF047857) : const Color(0xFFB91C1C),
                                    ),
                                  ),
                                  backgroundColor: c.active ? const Color(0xFFD1FAE5) : const Color(0xFFFEE2E2),
                                  padding: EdgeInsets.zero,
                                  materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                ),
                              ],
                            ),
                            trailing: c.active
                                ? IconButton(
                                    icon: const Icon(Icons.remove_circle_outline, color: Color(0xFFEF4444)),
                                    tooltip: 'Revoke Access',
                                    onPressed: () => _revokeCollector(c.id),
                                  )
                                : null,
                          ),
                        );
                      },
                    ),
            ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showAddCollectorDialog,
        backgroundColor: AppTheme.primaryColor,
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('Add Collector', style: TextStyle(color: Colors.white)),
      ),
    );
  }
}
