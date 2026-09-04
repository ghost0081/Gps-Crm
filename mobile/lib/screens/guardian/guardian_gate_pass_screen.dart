import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import '../../providers/auth_provider.dart';
import '../auth/login_screen.dart';
import '../../theme.dart';
import '../../widgets/premium_card.dart';

class GuardianGatePassScreen extends StatefulWidget {
  const GuardianGatePassScreen({super.key});

  @override
  State<GuardianGatePassScreen> createState() => _GuardianGatePassScreenState();
}

class _GuardianGatePassScreenState extends State<GuardianGatePassScreen> {
  Timer? _countdownTimer;
  Duration _remainingTime = Duration.zero;

  @override
  void initState() {
    super.initState();
    _startCountdown();
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    super.dispose();
  }

  void _startCountdown() {
    final user = Provider.of<AuthProvider>(context, listen: false).currentUser;
    if (user?.expiresAt != null) {
      try {
        final expiry = DateTime.parse(user!.expiresAt!);
        _calculateRemaining(expiry);

        _countdownTimer = Timer.periodic(const Duration(seconds: 1), (_) {
          if (mounted) _calculateRemaining(expiry);
        });
      } catch (e) {
        debugPrint(e.toString());
      }
    }
  }

  void _calculateRemaining(DateTime expiry) {
    final now = DateTime.now();
    final diff = expiry.difference(now);
    if (diff.isNegative) {
      _countdownTimer?.cancel();
      setState(() => _remainingTime = Duration.zero);
    } else {
      setState(() => _remainingTime = diff);
    }
  }

  void _logout() async {
    await Provider.of<AuthProvider>(context, listen: false).logout();
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
    );
  }

  String _formatDuration(Duration d) {
    if (d == Duration.zero) return 'PASS EXPIRED';
    final hours = d.inHours.toString().padLeft(2, '0');
    final minutes = (d.inMinutes % 60).toString().padLeft(2, '0');
    final seconds = (d.inSeconds % 60).toString().padLeft(2, '0');
    return '${hours}h ${minutes}m ${seconds}s';
  }

  @override
  Widget build(BuildContext context) {
    final user = Provider.of<AuthProvider>(context).currentUser;
    final isExpired = _remainingTime == Duration.zero;

    final sName = user?.studentName ?? 'Student';
    final sRoll = user?.rollNum?.toString() ?? 'N/A';
    final sClass = user?.sclassNameStr ?? 'Class';
    final gName = user?.guardianName ?? 'Guardian';
    final passCode = user?.passCode ?? 'G-000000';

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.shield_rounded, color: AppTheme.primaryColor),
            SizedBox(width: 8),
            Text('24h Temporary Guardian Pass', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout_rounded, color: Colors.redAccent),
            onPressed: _logout,
          ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            children: [
              // Restricted Access Privacy Banner
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF6FF),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFF93C5FD)),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.lock_clock_rounded, color: AppTheme.primaryColor, size: 20),
                    SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Restricted Pass View: Only Gate Pass QR is accessible to temporary guardians.',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF1E40AF)),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 20),

              // 24h Countdown Card
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: isExpired ? const Color(0xFFFEE2E2) : const Color(0xFFFEF3C7),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: isExpired ? const Color(0xFFEF4444) : const Color(0xFFF59E0B),
                    width: 1.5,
                  ),
                ),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          isExpired ? Icons.error_outline_rounded : Icons.timer_rounded,
                          color: isExpired ? const Color(0xFFEF4444) : const Color(0xFFD97706),
                          size: 22,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          isExpired ? 'PASS HAS EXPIRED' : 'PASS EXPIRES IN',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 13,
                            color: isExpired ? const Color(0xFF991B1B) : const Color(0xFF92400E),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      _formatDuration(_remainingTime),
                      style: TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 1,
                        color: isExpired ? const Color(0xFF991B1B) : const Color(0xFF78350F),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),

              // Student Gate Pass QR Card
              PremiumCard(
                padding: const EdgeInsets.all(24),
                child: Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: const Color(0xFFDBEAFE),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        'PASSCODE: $passCode',
                        style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF1E40AF), fontSize: 13),
                      ),
                    ),
                    const SizedBox(height: 20),

                    // QR Visual Matrix Container
                    Container(
                      width: 220,
                      height: 220,
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: AppTheme.primaryColor, width: 2.5),
                        boxShadow: [
                          BoxShadow(color: AppTheme.primaryColor.withOpacity(0.15), blurRadius: 16, offset: const Offset(0, 4)),
                        ],
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.qr_code_2_rounded, size: 120, color: AppTheme.primaryColor),
                          const SizedBox(height: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 3),
                            decoration: BoxDecoration(color: AppTheme.primaryColor, borderRadius: BorderRadius.circular(6)),
                            child: Text('ROLL #$sRoll', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12)),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 20),
                    Text(sName, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppTheme.textPrimary)),
                    const SizedBox(height: 4),
                    Text('Class: $sClass | Roll Number: $sRoll', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppTheme.primaryColor)),
                    const SizedBox(height: 6),
                    Text('Issued to Guardian: $gName', style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary)),
                  ],
                ),
              ),

              const SizedBox(height: 24),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        side: const BorderSide(color: Colors.redAccent),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      onPressed: _logout,
                      icon: const Icon(Icons.logout_rounded, color: Colors.redAccent),
                      label: const Text('Exit Pass View', style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold)),
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
                        final shareMsg = "🔑 *24-Hour School Temporary Guardian Pass*\n\n"
                            "👤 Guardian: $gName\n"
                            "🏫 Student: $sName (Roll #$sRoll | Class: $sClass)\n"
                            "🔑 Passcode: $passCode\n\n"
                            "Present this Passcode / QR code at the Front Desk scanner upon arrival.";
                        Share.share(shareMsg, subject: '24h Guardian Gate Pass');
                      },
                      icon: const Icon(Icons.share_rounded, color: Colors.white),
                      label: const Text('Share Pass 📤', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
