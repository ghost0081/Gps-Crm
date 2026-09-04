import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../providers/auth_provider.dart';
import '../../../services/api_service.dart';
import '../../theme.dart';
import '../../widgets/premium_card.dart';
import '../../widgets/page_header.dart';

class ParentHome extends StatefulWidget {
  const ParentHome({super.key});

  @override
  State<ParentHome> createState() => _ParentHomeState();
}

class _ParentHomeState extends State<ParentHome> {
  bool _isLoading = true;
  Map<String, dynamic>? _studentDetails;
  List<dynamic> _assignments = [];

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    try {
      final user = Provider.of<AuthProvider>(context, listen: false).currentUser;
      if (user?.studentId != null) {
        _studentDetails = await ApiService().getStudentDetails(user!.studentId!);
        _assignments = await ApiService().getStudentAssignments(user.studentId!);
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

    final user = Provider.of<AuthProvider>(context).currentUser;
    final sName = _studentDetails?['name'] ?? 'Unknown';
    final sRoll = _studentDetails?['rollNum']?.toString() ?? 'N/A';
    final sClass = _studentDetails?['sclassName']?['sclassName'] ?? 'N/A';
    final sSchool = _studentDetails?['school']?['schoolName'] ?? 'N/A';

    // Calculate Attendance Stats
    final attendance = (_studentDetails?['attendance'] as List<dynamic>?) ?? [];
    int present = 0;
    int absent = 0;
    for (var a in attendance) {
      if (a['status'] == 'Present') present++;
      if (a['status'] == 'Absent') absent++;
    }
    final attendancePercentage = attendance.isNotEmpty 
        ? ((present / attendance.length) * 100).toStringAsFixed(1) 
        : '0';

    // Calculate Assignments Stats
    int submitted = 0;
    int pending = 0;
    for (var a in _assignments) {
      final statuses = (a['studentStatus'] as List<dynamic>?) ?? [];
      final myStatus = statuses.firstWhere(
        (ss) => (ss['student']?['_id'] ?? ss['student']) == user?.studentId,
        orElse: () => null,
      );
      if (myStatus != null && myStatus['status'] == 'Submitted') {
        submitted++;
      } else {
        pending++;
      }
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          PageHeader(
            title: 'Welcome, ${user?.name ?? 'Parent'}',
            subtitle: 'Here is an overview of your child\'s progress.',
          ),
          
          // Child Information
          PremiumCard(
            padding: EdgeInsets.zero,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                  decoration: const BoxDecoration(
                    color: AppTheme.backgroundColor,
                    borderRadius: BorderRadius.only(topLeft: Radius.circular(16), topRight: Radius.circular(16)),
                    border: Border(bottom: BorderSide(color: AppTheme.borderColor)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.person_rounded, color: AppTheme.primaryColor, size: 18),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          'Child Info',
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.titleLarge?.copyWith(fontSize: 15, fontWeight: FontWeight.bold),
                        ),
                      ),
                      const SizedBox(width: 4),
                      ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.primaryColor,
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          minimumSize: Size.zero,
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                        onPressed: () => _showStudentQrModal(context, sName, sRoll, sClass, user?.name),
                        icon: const Icon(Icons.qr_code_2_rounded, size: 14, color: Colors.white),
                        label: const Text('Pass QR', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
                      ),
                      const SizedBox(width: 4),
                      OutlinedButton.icon(
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          minimumSize: Size.zero,
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          side: const BorderSide(color: AppTheme.primaryColor),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                        onPressed: () => _showGuardianPassManagerModal(context),
                        icon: const Icon(Icons.group_add_rounded, size: 14, color: AppTheme.primaryColor),
                        label: const Text('24h Pass', style: TextStyle(color: AppTheme.primaryColor, fontSize: 11, fontWeight: FontWeight.bold)),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(24.0),
                  child: Column(
                    children: [
                      _buildInfoRow('Student Name', sName),
                      const Divider(height: 24, color: AppTheme.borderColor),
                      _buildInfoRow('Roll Number', sRoll),
                      const Divider(height: 24, color: AppTheme.borderColor),
                      _buildInfoRow('Class Enrolled', sClass),
                      const Divider(height: 24, color: AppTheme.borderColor),
                      _buildInfoRow('School', sSchool),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          
          // Row for KPIs
          Row(
            children: [
              // Attendance Overview
              Expanded(
                child: PremiumCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.fact_check_rounded, color: Color(0xFF10B981), size: 18),
                          const SizedBox(width: 8),
                          Text(
                            'Attendance',
                            style: Theme.of(context).textTheme.labelLarge,
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      Text(
                        '$attendancePercentage%',
                        style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w800, color: Color(0xFF10B981), letterSpacing: -1),
                      ),
                      const SizedBox(height: 16),
                      Wrap(
                        spacing: 8,
                        runSpacing: 4,
                        children: [
                          _buildMiniBadge(Icons.check_circle_rounded, '$present', const Color(0xFF10B981), const Color(0xFFD1FAE5)),
                          _buildMiniBadge(Icons.cancel_rounded, '$absent', const Color(0xFFEF4444), const Color(0xFFFEE2E2)),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 16),
              
              // Assignments Overview
              Expanded(
                child: PremiumCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.assignment_rounded, color: AppTheme.primaryColor, size: 18),
                          const SizedBox(width: 8),
                          Text(
                            'Assignments',
                            style: Theme.of(context).textTheme.labelLarge,
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      Text(
                        '${_assignments.length}',
                        style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w800, color: AppTheme.primaryColor, letterSpacing: -1),
                      ),
                      const SizedBox(height: 16),
                      Wrap(
                        spacing: 8,
                        runSpacing: 4,
                        children: [
                          _buildMiniBadge(Icons.task_alt_rounded, '$submitted', const Color(0xFF10B981), const Color(0xFFD1FAE5)),
                          _buildMiniBadge(Icons.pending_actions_rounded, '$pending', const Color(0xFFF59E0B), const Color(0xFFFEF3C7)),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),

          // Recent Attendance
          PremiumCard(
            padding: EdgeInsets.zero,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                  decoration: const BoxDecoration(
                    color: AppTheme.backgroundColor,
                    borderRadius: BorderRadius.only(topLeft: Radius.circular(16), topRight: Radius.circular(16)),
                    border: Border(bottom: BorderSide(color: AppTheme.borderColor)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.calendar_month_rounded, color: AppTheme.primaryColor, size: 20),
                      const SizedBox(width: 8),
                      Text(
                        'Recent Attendance Log',
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(fontSize: 16),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(8.0),
                  child: attendance.isEmpty
                    ? const Padding(
                        padding: EdgeInsets.all(32.0),
                        child: Center(
                          child: Text(
                            'No attendance records found.',
                            style: TextStyle(color: AppTheme.textSecondary),
                          ),
                        ),
                      )
                    : Column(
                        children: attendance.take(5).map((a) {
                          final isPresent = a['status'] == 'Present';
                          return ListTile(
                            leading: Container(
                              width: 40,
                              height: 40,
                              decoration: BoxDecoration(
                                color: isPresent ? const Color(0xFFD1FAE5) : const Color(0xFFFEE2E2),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Icon(
                                isPresent ? Icons.check_rounded : Icons.close_rounded,
                                color: isPresent ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                              ),
                            ),
                            title: Text(
                              a['date'] != null ? a['date'].toString().split('T')[0] : 'Unknown Date',
                              style: const TextStyle(fontWeight: FontWeight.w600),
                            ),
                            trailing: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                              decoration: BoxDecoration(
                                color: isPresent ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text(
                                a['status'] ?? 'Unknown',
                                style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700),
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(color: AppTheme.textSecondary, fontWeight: FontWeight.w500),
        ),
        Text(
          value,
          style: const TextStyle(color: AppTheme.textPrimary, fontWeight: FontWeight.w700),
        ),
      ],
    );
  }

  Widget _buildMiniBadge(IconData icon, String value, Color color, Color bgColor) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 4),
          Text(
            value,
            style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 12),
          ),
        ],
      ),
    );
  }

  void _showStudentQrModal(BuildContext context, String sName, String sRoll, String sClass, String? parentName) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Container(
          padding: const EdgeInsets.all(24),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2))),
              const SizedBox(height: 16),
              const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.qr_code_2_rounded, color: AppTheme.primaryColor, size: 28),
                  SizedBox(width: 10),
                  Text('Permanent Gate Pass QR', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                ],
              ),
              const SizedBox(height: 6),
              Text('Show this permanent QR code at the school FrontDesk to notify class teacher.',
                  textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
              const SizedBox(height: 20),
              
              // Stylized Permanent Gate Pass QR Card
              Container(
                padding: const EdgeInsets.all(20),
                width: double.infinity,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFFEFF6FF), Color(0xFFDBEAFE)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0xFF93C5FD), width: 1.5),
                  boxShadow: [
                    BoxShadow(color: const Color(0xFF3B82F6).withOpacity(0.12), blurRadius: 16, offset: const Offset(0, 4)),
                  ],
                ),
                child: Column(
                  children: [
                    // Mock QR Visual Block with Roll No
                    Container(
                      width: 180,
                      height: 180,
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFF2563EB), width: 2),
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.qr_code_2_rounded, size: 90, color: Color(0xFF1E40AF)),
                          const SizedBox(height: 4),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
                            decoration: BoxDecoration(color: const Color(0xFF1E40AF), borderRadius: BorderRadius.circular(6)),
                            child: Text('ROLL #$sRoll', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 11)),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(sName, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF1E3A8A))),
                    const SizedBox(height: 2),
                    Text('Class: $sClass | Roll No: $sRoll', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF2563EB))),
                    const SizedBox(height: 4),
                    Text('Parent: ${parentName ?? "Authorized Parent"}', style: TextStyle(fontSize: 12, color: Colors.grey.shade700)),
                  ],
                ),
              ),

              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      onPressed: () => Navigator.pop(ctx),
                      icon: const Icon(Icons.check_circle_rounded),
                      label: const Text('Close', style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.primaryColor,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      onPressed: () {
                        final shareMsg = "🏫 *School Student Gate Entry Pass*\n"
                            "👤 Student: $sName\n"
                            "🔢 Roll No: $sRoll | Class: $sClass\n"
                            "👨‍👩‍👦 Authorized Parent: ${parentName ?? 'Parent'}\n\n"
                            "Present this Gate Pass at the Front Desk scanner upon arrival.";
                        _showShareGatePassModal(
                          context,
                          title: 'Share Gate Pass QR',
                          message: shareMsg,
                        );
                      },
                      icon: const Icon(Icons.share_rounded, color: Colors.white),
                      label: const Text('Share Pass 📤', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  void _showGuardianPassManagerModal(BuildContext context) {
    final user = Provider.of<AuthProvider>(context, listen: false).currentUser;
    final nameController = TextEditingController();
    final phoneController = TextEditingController();
    List<dynamic> activePasses = [];
    bool loadingPasses = true;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (modalCtx, setModalState) {
            void loadPasses() async {
              if (user?.id != null) {
                final passes = await ApiService().getGuardianPasses(user!.id);
                if (modalCtx.mounted) {
                  setModalState(() {
                    activePasses = passes;
                    loadingPasses = false;
                  });
                }
              }
            }

            if (loadingPasses) {
              loadPasses();
            }

            void issuePass() async {
              if (nameController.text.trim().isEmpty) return;
              try {
                final result = await ApiService().createGuardianPass(
                  user!.id,
                  nameController.text.trim(),
                  guardianPhone: phoneController.text.trim(),
                );
                nameController.clear();
                phoneController.clear();
                loadPasses();
                if (modalCtx.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('✅ 24h Pass Issued! Passcode: ${result['passCode']}'),
                      backgroundColor: const Color(0xFF10B981),
                      behavior: SnackBarBehavior.floating,
                    ),
                  );
                }
              } catch (e) {
                debugPrint(e.toString());
              }
            }

            void revokePass(String passId) async {
              try {
                await ApiService().revokeGuardianPass(passId);
                loadPasses();
              } catch (e) {
                debugPrint(e.toString());
              }
            }

            return Container(
              padding: EdgeInsets.only(
                left: 24,
                right: 24,
                top: 24,
                bottom: MediaQuery.of(modalCtx).viewInsets.bottom + 24,
              ),
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2)))),
                    const SizedBox(height: 16),
                    const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.group_add_rounded, color: AppTheme.primaryColor, size: 26),
                        SizedBox(width: 10),
                        Text('Issue 24h Guardian Pass', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text('Guardians can log in with Passcode to ONLY view the Gate Pass QR code for 24 hours.',
                        textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                    const SizedBox(height: 20),

                    // Issue Pass Form
                    TextField(
                      controller: nameController,
                      decoration: InputDecoration(
                        labelText: 'Guardian Name (e.g. Driver Ramesh)',
                        prefixIcon: const Icon(Icons.person_outline),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: phoneController,
                      keyboardType: TextInputType.phone,
                      decoration: InputDecoration(
                        labelText: 'Guardian Phone Number (Optional)',
                        prefixIcon: const Icon(Icons.phone_outlined),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                    const SizedBox(height: 14),
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.primaryColor,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      onPressed: issuePass,
                      icon: const Icon(Icons.key_rounded, color: Colors.white),
                      label: const Text('Generate 24h Passcode', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    ),

                    const SizedBox(height: 24),
                    const Text('Active 24h Guardian Passes', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 10),

                    if (loadingPasses)
                      const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator()))
                    else if (activePasses.isEmpty)
                      const Text('No active guardian passes issued.', style: TextStyle(fontSize: 12, color: Colors.grey))
                    else
                      ...activePasses.map((p) {
                        return Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF1F5F9),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: const Color(0xFFCBD5E1)),
                          ),
                          child: Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                decoration: BoxDecoration(color: const Color(0xFF2563EB), borderRadius: BorderRadius.circular(8)),
                                child: Text(p['passCode'] ?? 'G-000000', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(p['guardianName'] ?? 'Guardian', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                                    const SizedBox(height: 2),
                                    const Text('Expires in 24h • Gate Pass QR Only', style: TextStyle(fontSize: 11, color: Colors.grey)),
                                  ],
                                ),
                              ),
                              IconButton(
                                icon: const Icon(Icons.share_rounded, color: AppTheme.primaryColor, size: 22),
                                tooltip: 'Share Passcode',
                                onPressed: () {
                                  final shareMsg = "🔑 *24-Hour Temporary School Guardian Pass*\n\n"
                                      "👤 Guardian: ${p['guardianName']}\n"
                                      "🏫 Student: ${p['studentName']} (Roll #${p['rollNum']})\n"
                                      "🔑 Passcode: ${p['passCode']}\n\n"
                                      "Log in to the School Mobile App using Role: Guardian and enter your 24h Passcode to view the Gate Entry Pass QR code!";
                                  _showShareGatePassModal(
                                    context,
                                    title: 'Share Guardian Passcode',
                                    message: shareMsg,
                                    passCode: p['passCode'],
                                  );
                                },
                              ),
                              IconButton(
                                icon: const Icon(Icons.block_rounded, color: Colors.redAccent, size: 22),
                                tooltip: 'Revoke Pass',
                                onPressed: () => revokePass(p['_id']),
                              ),
                            ],
                          ),
                        );
                      }),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  void _showShareGatePassModal(BuildContext context, {required String title, required String message, String? passCode}) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Container(
          padding: const EdgeInsets.all(24),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2))),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.share_rounded, color: AppTheme.primaryColor, size: 24),
                  const SizedBox(width: 8),
                  Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                ],
              ),
              const SizedBox(height: 6),
              Text('Share student gate pass & passcode with relatives or drivers via WhatsApp, Instagram, Telegram & more.',
                  textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
              const SizedBox(height: 16),

              // Message Preview Box
              Container(
                padding: const EdgeInsets.all(14),
                width: double.infinity,
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFCBD5E1)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.mark_chat_read_rounded, size: 14, color: AppTheme.primaryColor),
                        SizedBox(width: 6),
                        Text('Pass Details Preview', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppTheme.textPrimary)),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      message,
                      style: TextStyle(fontSize: 12, color: Colors.grey.shade800, height: 1.4),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 20),

              // Apps Share Grid (WhatsApp, Instagram, Telegram, SMS)
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _buildShareAppItem(
                    icon: Icons.chat_rounded,
                    label: 'WhatsApp',
                    color: const Color(0xFF25D366),
                    bgColor: const Color(0xFFDCFCE7),
                    onTap: () async {
                      Navigator.pop(ctx);
                      final url = Uri.parse('whatsapp://send?text=${Uri.encodeComponent(message)}');
                      if (await canLaunchUrl(url)) {
                        await launchUrl(url);
                      } else {
                        Share.share(message, subject: title);
                      }
                    },
                  ),
                  _buildShareAppItem(
                    icon: Icons.camera_alt_rounded,
                    label: 'Instagram',
                    color: const Color(0xFFE1306C),
                    bgColor: const Color(0xFFFCE7F3),
                    onTap: () async {
                      Navigator.pop(ctx);
                      await Clipboard.setData(ClipboardData(text: message));
                      if (!context.mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('📋 Pass copied! Opening Instagram to paste in DMs.'), backgroundColor: Color(0xFFE1306C)),
                      );
                      final url = Uri.parse('instagram://');
                      if (await canLaunchUrl(url)) {
                        await launchUrl(url);
                      } else {
                        Share.share(message, subject: title);
                      }
                    },
                  ),
                  _buildShareAppItem(
                    icon: Icons.send_rounded,
                    label: 'Telegram',
                    color: const Color(0xFF229ED9),
                    bgColor: const Color(0xFFE0F2FE),
                    onTap: () async {
                      Navigator.pop(ctx);
                      final url = Uri.parse('https://t.me/share/url?url=${Uri.encodeComponent(message)}');
                      if (await canLaunchUrl(url)) {
                        await launchUrl(url);
                      } else {
                        Share.share(message, subject: title);
                      }
                    },
                  ),
                  _buildShareAppItem(
                    icon: Icons.sms_rounded,
                    label: 'SMS',
                    color: const Color(0xFF6366F1),
                    bgColor: const Color(0xFFEEF2FF),
                    onTap: () async {
                      Navigator.pop(ctx);
                      final url = Uri.parse('sms:?body=${Uri.encodeComponent(message)}');
                      if (await canLaunchUrl(url)) {
                        await launchUrl(url);
                      } else {
                        Share.share(message, subject: title);
                      }
                    },
                  ),
                ],
              ),

              const SizedBox(height: 20),

              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      onPressed: () {
                        Clipboard.setData(ClipboardData(text: message));
                        Navigator.pop(ctx);
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('📋 Pass details copied to clipboard!'), backgroundColor: Color(0xFF10B981)),
                        );
                      },
                      icon: const Icon(Icons.copy_rounded, size: 18),
                      label: const Text('Copy Text', style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.primaryColor,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      onPressed: () {
                        Navigator.pop(ctx);
                        Share.share(message, subject: title);
                      },
                      icon: const Icon(Icons.share_rounded, color: Colors.white, size: 18),
                      label: const Text('More Apps', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildShareAppItem({
    required IconData icon,
    required String label,
    required Color color,
    required Color bgColor,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: bgColor,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(color: color.withOpacity(0.2), blurRadius: 10, offset: const Offset(0, 4)),
              ],
            ),
            child: Icon(icon, color: color, size: 26),
          ),
          const SizedBox(height: 6),
          Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey.shade800)),
        ],
      ),
    );
  }
}
