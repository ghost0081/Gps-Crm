import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:permission_handler/permission_handler.dart';
import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';
import '../auth/login_screen.dart';
import '../../theme.dart';
import '../../widgets/premium_card.dart';

class FrontDeskDashboard extends StatefulWidget {
  const FrontDeskDashboard({super.key});

  @override
  State<FrontDeskDashboard> createState() => _FrontDeskDashboardState();
}

class _FrontDeskDashboardState extends State<FrontDeskDashboard> {
  final ApiService _apiService = ApiService();
  final TextEditingController _rollNoController = TextEditingController();
  final TextEditingController _parentNameController = TextEditingController();

  List<dynamic> _arrivals = [];
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _fetchArrivals();
  }

  @override
  void dispose() {
    _rollNoController.dispose();
    _parentNameController.dispose();
    super.dispose();
  }

  Future<void> _fetchArrivals() async {
    setState(() => _isLoading = true);
    try {
      final arrivals = await _apiService.getAllParentArrivals();
      if (mounted) {
        setState(() {
          _arrivals = arrivals;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _logParentArrival({Map<String, dynamic>? qrData}) async {
    try {
      final payload = qrData ??
          {
            'rollNum': int.tryParse(_rollNoController.text.trim()) ??
                _rollNoController.text.trim(),
            'parentName': _parentNameController.text.trim().isNotEmpty
                ? _parentNameController.text.trim()
                : 'Parent Visitor',
          };

      final authUser =
          Provider.of<AuthProvider>(context, listen: false).currentUser;
      final result = await _apiService.scanParentQr(
        payload,
        scannedBy: authUser?.name ?? 'FrontDesk Staff',
      );

      if (!mounted) return;

      _rollNoController.clear();
      _parentNameController.clear();

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('✅ ${result['message']}'),
          backgroundColor: const Color(0xFF10B981),
          behavior: SnackBarBehavior.floating,
        ),
      );

      _fetchArrivals();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
              '❌ Error: ${e.toString().replaceAll(RegExp(r'Exception:\s*'), '')}'),
          backgroundColor: Colors.red,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  void _openCameraQrScanner() {
    if (!mounted) return;
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (ctx) => _QrScannerScreen(
          onScanSuccess: (qrData) => _logParentArrival(qrData: qrData),
          onManualEntryTap: _showManualScanDialog,
        ),
      ),
    );
  }

  void _showManualScanDialog() {
    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: const Row(
            children: [
              Icon(Icons.qr_code_scanner_rounded, color: AppTheme.primaryColor),
              SizedBox(width: 10),
              Text('Log Parent Arrival',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Enter Student Roll No or scanned QR payload to alert class teacher.'),
              const SizedBox(height: 14),
              TextField(
                controller: _rollNoController,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: 'Student Roll Number',
                  hintText: 'e.g. 12',
                  prefixIcon: const Icon(Icons.numbers_rounded),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _parentNameController,
                decoration: InputDecoration(
                  labelText: 'Parent Name (Optional)',
                  hintText: 'e.g. John Doe',
                  prefixIcon: const Icon(Icons.person_rounded),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primaryColor,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: () {
                Navigator.pop(ctx);
                _logParentArrival();
              },
              child: const Text('Notify Class Teacher',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            ),
          ],
        );
      },
    );
  }

  void _logout() async {
    await Provider.of<AuthProvider>(context, listen: false).logout();
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = Provider.of<AuthProvider>(context).currentUser;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Row(
          children: [
            Icon(Icons.shield_outlined, color: AppTheme.primaryColor),
            SizedBox(width: 8),
            Text('FrontDesk Gatekeeper',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
          ],
        ),
        actions: [
          IconButton(icon: const Icon(Icons.refresh_rounded), onPressed: _fetchArrivals),
          IconButton(
              icon: const Icon(Icons.logout_rounded, color: Colors.redAccent),
              onPressed: _logout),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            PremiumCard(
              padding: const EdgeInsets.all(20),
              child: Row(
                children: [
                  Container(
                    width: 52, height: 52,
                    decoration: BoxDecoration(
                      color: AppTheme.primaryColor.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: const Icon(Icons.security_rounded, color: AppTheme.primaryColor, size: 28),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Welcome, ${user?.name ?? "FrontDesk Staff"}',
                            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 2),
                        const Text(
                          'Scan Student Gate Pass QR or search Roll No to notify Class Teacher.',
                          style: TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  flex: 2,
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.primaryColor,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                    onPressed: _openCameraQrScanner,
                    icon: const Icon(Icons.camera_alt_rounded, color: Colors.white),
                    label: const Text('Camera Scanner',
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15)),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  flex: 1,
                  child: OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      side: const BorderSide(color: AppTheme.primaryColor),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                    onPressed: _showManualScanDialog,
                    icon: const Icon(Icons.keyboard_rounded, color: AppTheme.primaryColor),
                    label: const Text('Manual',
                        style: TextStyle(color: AppTheme.primaryColor, fontWeight: FontWeight.bold, fontSize: 13)),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            const Row(
              children: [
                Icon(Icons.history_rounded, size: 20, color: AppTheme.primaryColor),
                SizedBox(width: 8),
                Text("Today's Parent Arrivals",
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              ],
            ),
            const SizedBox(height: 12),
            if (_isLoading)
              const Center(child: Padding(padding: EdgeInsets.all(24), child: CircularProgressIndicator()))
            else if (_arrivals.isEmpty)
              PremiumCard(
                padding: const EdgeInsets.all(32),
                child: Column(
                  children: [
                    Icon(Icons.check_circle_outline_rounded, size: 48, color: Colors.grey.shade400),
                    const SizedBox(height: 12),
                    const Text('No parent arrivals logged today.',
                        style: TextStyle(fontWeight: FontWeight.w600, color: AppTheme.textSecondary)),
                    const SizedBox(height: 4),
                    const Text(
                      "Scan a parent's student QR code at the front desk to notify their class teacher.",
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 12, color: AppTheme.textDisabled),
                    ),
                  ],
                ),
              )
            else
              ListView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _arrivals.length,
                itemBuilder: (ctx, index) {
                  final item = _arrivals[index];
                  final isDispatched = item['status'] == 'Student Dispatched';
                  return Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: isDispatched
                            ? const Color(0xFF10B981).withOpacity(0.4)
                            : const Color(0xFFF59E0B).withOpacity(0.4),
                      ),
                      boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 8, offset: const Offset(0, 2))],
                    ),
                    child: ListTile(
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      leading: CircleAvatar(
                        backgroundColor: isDispatched ? const Color(0xFFD1FAE5) : const Color(0xFFFEF3C7),
                        child: Icon(
                          isDispatched ? Icons.directions_walk_rounded : Icons.hourglass_top_rounded,
                          color: isDispatched ? const Color(0xFF059669) : const Color(0xFFD97706),
                        ),
                      ),
                      title: Text(
                        '${item['studentName']} (Roll #${item['rollNum'] ?? 0})',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                      ),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const SizedBox(height: 2),
                          Text('Class: ${item['sclassNameStr'] ?? "Class"} | Teacher: ${item['teacherName'] ?? "Unassigned"}'),
                          const SizedBox(height: 2),
                          Text('Parent: ${item['parentName']} (${item['parentPhone'] ?? "No Phone"})',
                              style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
                        ],
                      ),
                      trailing: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: isDispatched ? const Color(0xFFD1FAE5) : const Color(0xFFFEF3C7),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          item['status'] ?? 'Waiting',
                          style: TextStyle(
                            fontSize: 11, fontWeight: FontWeight.bold,
                            color: isDispatched ? const Color(0xFF059669) : const Color(0xFFD97706),
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
          ],
        ),
      ),
    );
  }
}

class _QrScannerScreen extends StatefulWidget {
  final Function(Map<String, dynamic> qrData) onScanSuccess;
  final VoidCallback onManualEntryTap;
  const _QrScannerScreen({required this.onScanSuccess, required this.onManualEntryTap});
  @override
  State<_QrScannerScreen> createState() => _QrScannerScreenState();
}

class _QrScannerScreenState extends State<_QrScannerScreen> with WidgetsBindingObserver {
  MobileScannerController? _controller;
  bool _hasScanned = false;
  bool _isRetrying = false;
  int _scannerGeneration = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initController();
  }

  void _initController() {
    _controller?.dispose();
    _controller = MobileScannerController(
      facing: CameraFacing.back,
      torchEnabled: false,
      detectionSpeed: DetectionSpeed.normal,
    );
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (_controller == null) return;
    switch (state) {
      case AppLifecycleState.paused:
      case AppLifecycleState.inactive:
        _controller!.stop();
        break;
      case AppLifecycleState.resumed:
        if (!_hasScanned) _controller!.start();
        break;
      default:
        break;
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _controller?.dispose();
    _controller = null;
    super.dispose();
  }

  Future<void> _retry() async {
    if (_isRetrying || !mounted) return;
    setState(() => _isRetrying = true);
    try { await _controller?.stop(); } catch (_) {}
    _controller?.dispose();
    _controller = null;
    await Future.delayed(const Duration(milliseconds: 500));
    if (!mounted) return;
    setState(() { _scannerGeneration++; _hasScanned = false; _isRetrying = false; });
    _initController();
  }

  String _userMessage(MobileScannerException error) {
    switch (error.errorCode) {
      case MobileScannerErrorCode.permissionDenied:
        return 'Camera permission is required.\n\nTap "Open Settings", enable Camera for this app, then come back and tap "Try Again".';
      case MobileScannerErrorCode.controllerAlreadyInitialized:
        return 'Camera is still starting. Wait a moment then tap Try Again.';
      case MobileScannerErrorCode.controllerDisposed:
      case MobileScannerErrorCode.controllerUninitialized:
        return 'Camera session ended unexpectedly.\nTap Try Again to restart.';
      case MobileScannerErrorCode.unsupported:
        return 'This device does not support QR scanning.\nPlease use Manual Entry.';
      case MobileScannerErrorCode.genericError:
        return 'Camera could not start.\n\nPossible causes:\n• Another app is using the camera -- close it first\n• Camera access is disabled in device Privacy Settings\n• Camera hardware error\n\nTap Try Again after closing other camera apps.';
    }
  }

  bool _isPermissionError(MobileScannerException error) =>
      error.errorCode == MobileScannerErrorCode.permissionDenied;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: const Row(
          children: [
            Icon(Icons.qr_code_scanner_rounded, color: AppTheme.primaryColor),
            SizedBox(width: 8),
            Text('Scan Parent Gate Pass QR',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          ],
        ),
        actions: [
          if (_controller != null)
            ValueListenableBuilder<MobileScannerState>(
              valueListenable: _controller!,
              builder: (_, state, __) {
                if (!state.isRunning) return const SizedBox.shrink();
                final on = state.torchState == TorchState.on;
                return IconButton(
                  icon: Icon(on ? Icons.flash_on_rounded : Icons.flash_off_rounded,
                      color: on ? Colors.amber : Colors.white54),
                  onPressed: () => _controller?.toggleTorch(),
                  tooltip: 'Toggle Flashlight',
                );
              },
            ),
          if (_controller != null)
            ValueListenableBuilder<MobileScannerState>(
              valueListenable: _controller!,
              builder: (_, state, __) {
                if (!state.isRunning) return const SizedBox.shrink();
                final multi = (state.availableCameras ?? 0) > 1;
                if (!multi) return const SizedBox.shrink();
                return IconButton(
                  icon: const Icon(Icons.cameraswitch_rounded, color: Colors.white),
                  onPressed: () => _controller?.switchCamera(),
                  tooltip: 'Switch Camera',
                );
              },
            ),
        ],
      ),
      body: _controller == null
          ? const Center(child: CircularProgressIndicator(color: AppTheme.primaryColor))
          : Stack(
              key: ValueKey(_scannerGeneration),
              fit: StackFit.expand,
              alignment: Alignment.center,
              children: [
                MobileScanner(
                  controller: _controller!,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, _) {
                    final msg = _userMessage(error);
                    final isPerm = _isPermissionError(error);
                    return Container(
                      color: const Color(0xFF0A0A18),
                      child: Center(
                        child: SingleChildScrollView(
                          padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 48),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.videocam_off_rounded, color: Colors.amber, size: 64),
                              const SizedBox(height: 20),
                              const Text('Camera Unavailable',
                                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 20),
                                  textAlign: TextAlign.center),
                              const SizedBox(height: 14),
                              Text(msg,
                                  style: const TextStyle(color: Colors.white70, fontSize: 13, height: 1.6),
                                  textAlign: TextAlign.center),
                              const SizedBox(height: 28),
                              if (!isPerm)
                                _ScannerButton(
                                  label: _isRetrying ? 'Retrying...' : 'Try Again',
                                  leading: _isRetrying
                                      ? const SizedBox(width: 18, height: 18,
                                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                                      : const Icon(Icons.refresh_rounded, color: Colors.white),
                                  backgroundColor: AppTheme.primaryColor,
                                  onPressed: _isRetrying ? null : _retry,
                                ),
                              if (isPerm)
                                _ScannerButton(
                                  label: 'Open Settings',
                                  leading: const Icon(Icons.settings_rounded, color: Colors.white),
                                  backgroundColor: Colors.deepOrangeAccent,
                                  onPressed: () async {
                                    await openAppSettings();
                                    if (mounted) await _retry();
                                  },
                                ),
                              const SizedBox(height: 6),
                              _ScannerButton(
                                label: 'Enter Roll No Manually',
                                leading: const Icon(Icons.keyboard_rounded, color: Colors.white70),
                                backgroundColor: Colors.transparent,
                                borderColor: Colors.white30,
                                textColor: Colors.white70,
                                onPressed: () { Navigator.pop(context); widget.onManualEntryTap(); },
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                  onDetect: (BarcodeCapture capture) {
                    if (_hasScanned) return;
                    for (final barcode in capture.barcodes) {
                      final raw = barcode.rawValue;
                      if (raw != null && raw.isNotEmpty) {
                        _hasScanned = true;
                        Navigator.pop(context);
                        Map<String, dynamic> qrData = {};
                        try { qrData = jsonDecode(raw); } catch (_) {
                          qrData = {'rollNum': int.tryParse(raw) ?? raw, 'parentName': 'Scanned Visitor'};
                        }
                        widget.onScanSuccess(qrData);
                        break;
                      }
                    }
                  },
                ),
                Center(
                  child: Container(
                    width: 260, height: 260,
                    decoration: BoxDecoration(
                      border: Border.all(color: AppTheme.primaryColor, width: 3),
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [BoxShadow(color: AppTheme.primaryColor.withOpacity(0.3), blurRadius: 20, spreadRadius: 2)],
                    ),
                  ),
                ),
                Positioned(
                  top: 40, left: 0, right: 0,
                  child: Center(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      decoration: BoxDecoration(
                        color: Colors.black87,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: Colors.white24),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.center_focus_strong_rounded, color: Colors.white, size: 16),
                          SizedBox(width: 8),
                          Text('Align Student Gate Pass QR in Frame',
                              style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
                        ],
                      ),
                    ),
                  ),
                ),
                Positioned(
                  bottom: 36, left: 24, right: 24,
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: Colors.black,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    onPressed: () { Navigator.pop(context); widget.onManualEntryTap(); },
                    icon: const Icon(Icons.keyboard_rounded, color: Colors.black),
                    label: const Text('Enter Roll No Manually',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                  ),
                ),
              ],
            ),
    );
  }
}

class _ScannerButton extends StatelessWidget {
  final String label;
  final Widget leading;
  final Color backgroundColor;
  final Color? borderColor;
  final Color? textColor;
  final VoidCallback? onPressed;
  const _ScannerButton({
    required this.label, required this.leading, required this.backgroundColor,
    this.borderColor, this.textColor, this.onPressed,
  });
  @override
  Widget build(BuildContext context) {
    final isOutlined = backgroundColor == Colors.transparent;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: SizedBox(
        width: double.infinity,
        child: isOutlined
            ? OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  side: BorderSide(color: borderColor ?? Colors.white38),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: onPressed,
                icon: leading,
                label: Text(label,
                    style: TextStyle(color: textColor ?? Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
              )
            : ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: backgroundColor,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  disabledBackgroundColor: backgroundColor.withOpacity(0.6),
                ),
                onPressed: onPressed,
                icon: leading,
                label: Text(label,
                    style: TextStyle(color: textColor ?? Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
              ),
      ),
    );
  }
}
