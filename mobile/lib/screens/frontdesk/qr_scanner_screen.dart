import 'dart:convert';
import 'dart:developer' as developer;

import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:permission_handler/permission_handler.dart';

import '../../theme.dart';

// ─────────────────────────────────────────────────────────────────────────────
// QrScannerScreen — full-screen dedicated QR scanner.
//
// Returns a Map<String, dynamic> to the caller via Navigator.pop():
//   • {'_manualEntry': true}  → caller should open manual-entry dialog
//   • {'rollNum': …, …}       → valid QR payload to process
//   • null                    → user cancelled (back button)
// ─────────────────────────────────────────────────────────────────────────────
class QrScannerScreen extends StatefulWidget {
  const QrScannerScreen({super.key});

  @override
  State<QrScannerScreen> createState() => _QrScannerScreenState();
}

enum _ScreenState {
  checkingPermission,
  permissionDenied,
  permissionPermanentlyDenied,
  starting,
  active,
  error,
}

class _QrScannerScreenState extends State<QrScannerScreen>
    with WidgetsBindingObserver {
  _ScreenState _screenState = _ScreenState.checkingPermission;
  MobileScannerController? _controller;
  bool _hasScanned = false;
  int _retryCount = 0;
  static const int _maxRetries = 3;

  String _userFacingError = 'Camera unavailable';
  String _technicalError = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _log('Screen mounted');
    _checkPermissionAndStart();
  }

  @override
  void dispose() {
    _log('Screen disposing — releasing camera');
    WidgetsBinding.instance.removeObserver(this);
    _releaseController();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _log('App lifecycle changed: $state');
    switch (state) {
      case AppLifecycleState.resumed:
        if (_screenState == _ScreenState.active) {
          _controller?.start();
        } else if (_screenState == _ScreenState.permissionDenied ||
            _screenState == _ScreenState.permissionPermanentlyDenied) {
          _checkPermissionAndStart();
        }
        break;
      case AppLifecycleState.inactive:
      case AppLifecycleState.paused:
        _controller?.stop();
        break;
      default:
        break;
    }
  }

  Future<void> _checkPermissionAndStart() async {
    if (!mounted) return;
    _log('Checking camera permission...');
    setState(() => _screenState = _ScreenState.checkingPermission);

    PermissionStatus status = await Permission.camera.status;
    _log('Permission status: $status');

    if (status.isDenied) {
      _log('Requesting camera permission...');
      status = await Permission.camera.request();
      _log('Permission result: $status');
      if (!mounted) return;
    }

    if (status.isGranted) {
      _log('Permission GRANTED — starting camera');
      _startCamera();
    } else if (status.isPermanentlyDenied || status.isRestricted) {
      _log('Permission PERMANENTLY DENIED or RESTRICTED');
      if (mounted) setState(() => _screenState = _ScreenState.permissionPermanentlyDenied);
    } else {
      _log('Permission DENIED');
      if (mounted) setState(() => _screenState = _ScreenState.permissionDenied);
    }
  }

  void _startCamera() {
    if (!mounted) return;
    _releaseController();
    _log('Creating MobileScannerController (attempt ${_retryCount + 1})');
    _controller = MobileScannerController(
      facing: CameraFacing.back,
      torchEnabled: false,
      detectionSpeed: DetectionSpeed.noDuplicates,
    );
    _log('Controller created — activating MobileScanner widget');
    if (mounted) setState(() => _screenState = _ScreenState.active);
  }

  void _releaseController() {
    if (_controller != null) {
      _log('Disposing existing controller');
      _controller!.dispose();
      _controller = null;
    }
  }

  Future<void> _retry() async {
    if (_retryCount >= _maxRetries) {
      _log('Max retries reached');
      if (mounted) {
        setState(() {
          _screenState = _ScreenState.error;
          _userFacingError = 'Camera failed after $_maxRetries attempts';
        });
      }
      return;
    }
    _retryCount++;
    _hasScanned = false;
    _log('--- RETRY #$_retryCount ---');
    await _checkPermissionAndStart();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_hasScanned) return;
    for (final barcode in capture.barcodes) {
      final raw = barcode.rawValue;
      if (raw == null || raw.isEmpty) continue;

      _hasScanned = true;
      _log('QR detected — parsing payload');
      _controller?.stop();

      Map<String, dynamic> qrData;
      try {
        qrData = jsonDecode(raw) as Map<String, dynamic>;
        _log('QR parsed as JSON');
      } catch (_) {
        final rollNum = int.tryParse(raw) ?? raw;
        qrData = {'rollNum': rollNum, 'parentName': 'Scanned Visitor'};
        _log('QR parsed as plain text: rollNum=$rollNum');
      }

      if (mounted) Navigator.pop(context, qrData);
      return;
    }
  }

  void _onCameraError(MobileScannerException error) {
    final code = error.errorCode;
    final msg = error.errorDetails?.message ?? '';
    _log('CAMERA ERROR: code=${code.name} message=$msg', isError: true);
    if (!mounted) return;

    switch (code) {
      case MobileScannerErrorCode.permissionDenied:
        setState(() => _screenState = _ScreenState.permissionDenied);
        return;
      case MobileScannerErrorCode.unsupported:
        setState(() {
          _screenState = _ScreenState.error;
          _userFacingError = 'Camera not supported on this device';
          _technicalError = 'MobileScannerErrorCode.unsupported — $msg';
        });
        return;
      case MobileScannerErrorCode.controllerAlreadyInitialized:
        _log('Controller already initialized — restarting');
        _releaseController();
        Future.delayed(const Duration(milliseconds: 300), _startCamera);
        return;
      case MobileScannerErrorCode.genericError:
      default:
        setState(() {
          _screenState = _ScreenState.error;
          _userFacingError = 'Camera failed to start';
          _technicalError = 'code=${code.name} msg=$msg';
        });
    }
  }

  void _log(String msg, {bool isError = false}) {
    developer.log('[QR_SCANNER] $msg', name: 'QrScanner', level: isError ? 1000 : 800);
  }

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
        actions: _screenState == _ScreenState.active && _controller != null
            ? [
                IconButton(
                  icon: const Icon(Icons.flash_on_rounded, color: Colors.amber),
                  tooltip: 'Toggle torch',
                  onPressed: () => _controller?.toggleTorch(),
                ),
                IconButton(
                  icon: const Icon(Icons.cameraswitch_rounded, color: Colors.white),
                  tooltip: 'Switch camera',
                  onPressed: () => _controller?.switchCamera(),
                ),
              ]
            : null,
      ),
      body: Stack(
        alignment: Alignment.center,
        children: [
          _buildContent(),
          // Manual entry — always visible at bottom
          Positioned(
            bottom: 32,
            left: 24,
            right: 24,
            child: ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: Colors.black87,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
                elevation: 4,
              ),
              onPressed: () {
                _log('Manual entry selected');
                Navigator.pop(context, {'_manualEntry': true});
              },
              icon: const Icon(Icons.keyboard_rounded, color: Colors.black87),
              label: const Text('Enter Roll No Manually',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildContent() {
    switch (_screenState) {
      case _ScreenState.checkingPermission:
        return _loading('Checking camera permission…');
      case _ScreenState.starting:
        return _loading('Starting camera…');
      case _ScreenState.permissionDenied:
        return _permissionView(permanent: false);
      case _ScreenState.permissionPermanentlyDenied:
        return _permissionView(permanent: true);
      case _ScreenState.error:
        return _errorView();
      case _ScreenState.active:
        return _scannerView();
    }
  }

  Widget _loading(String label) => Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircularProgressIndicator(color: AppTheme.primaryColor),
            const SizedBox(height: 20),
            Text(label,
                style: const TextStyle(color: Colors.white70, fontSize: 14)),
          ],
        ),
      );

  Widget _permissionView({required bool permanent}) => Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 36),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                permanent
                    ? Icons.no_photography_rounded
                    : Icons.camera_alt_outlined,
                color: Colors.amber,
                size: 70,
              ),
              const SizedBox(height: 24),
              Text(
                permanent
                    ? 'Camera Permission Blocked'
                    : 'Camera Permission Required',
                style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 18),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              Text(
                permanent
                    ? 'Permission was permanently denied.\n\nOpen Settings → Apps → [App] → Permissions → Camera → Allow'
                    : 'Camera access is needed to scan QR codes.\nPlease allow the permission.',
                style: const TextStyle(color: Colors.grey, fontSize: 13),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 32),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primaryColor,
                  padding: const EdgeInsets.symmetric(
                      horizontal: 28, vertical: 14),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: permanent
                    ? () async {
                        _log('Opening app settings');
                        await openAppSettings();
                      }
                    : _checkPermissionAndStart,
                icon: Icon(
                  permanent
                      ? Icons.settings_rounded
                      : Icons.lock_open_rounded,
                  color: Colors.white,
                ),
                label: Text(
                  permanent ? 'Open Settings' : 'Grant Permission',
                  style: const TextStyle(
                      color: Colors.white, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
        ),
      );

  Widget _errorView() => Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.camera_alt_outlined,
                  color: Colors.amber, size: 64),
              const SizedBox(height: 24),
              Text(
                _userFacingError,
                style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 18),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 10),
              const Text(
                'We couldn\'t start the camera.\nClose other camera apps, then tap Try Again.',
                style: TextStyle(color: Colors.grey, fontSize: 13),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 28),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.primaryColor,
                      padding: const EdgeInsets.symmetric(
                          horizontal: 20, vertical: 13),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                    onPressed: () {
                      _retryCount = 0;
                      _hasScanned = false;
                      _log('User tapped Try Again');
                      _retry();
                    },
                    icon: const Icon(Icons.refresh_rounded, color: Colors.white),
                    label: const Text('Try Again',
                        style: TextStyle(
                            color: Colors.white, fontWeight: FontWeight.bold)),
                  ),
                  const SizedBox(width: 12),
                  OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: Colors.white54),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 13),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                    onPressed: () async {
                      _log('Opening app settings from error screen');
                      await openAppSettings();
                    },
                    icon: const Icon(Icons.settings_rounded,
                        color: Colors.white70, size: 18),
                    label: const Text('Settings',
                        style: TextStyle(
                            color: Colors.white70, fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            ],
          ),
        ),
      );

  Widget _scannerView() {
    if (_controller == null) return _loading('Initialising camera…');
    return Stack(
      alignment: Alignment.center,
      children: [
        MobileScanner(
          controller: _controller!,
          fit: BoxFit.cover,
          onDetect: _onDetect,
          errorBuilder: (context, error, child) {
            WidgetsBinding.instance
                .addPostFrameCallback((_) => _onCameraError(error));
            return const SizedBox.expand(
                child: ColoredBox(color: Colors.black));
          },
        ),
        // Scan frame
        Container(
          width: 260,
          height: 260,
          decoration: BoxDecoration(
            border: Border.all(color: AppTheme.primaryColor, width: 3),
            borderRadius: BorderRadius.circular(20),
            boxShadow: [
              BoxShadow(
                color: AppTheme.primaryColor.withValues(alpha: 0.3),
                blurRadius: 20,
                spreadRadius: 2,
              ),
            ],
          ),
        ),
        // Top badge
        Positioned(
          top: 32,
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
                Icon(Icons.center_focus_strong_rounded,
                    color: Colors.white, size: 16),
                SizedBox(width: 8),
                Text('Align Student Gate Pass QR in Frame',
                    style: TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.bold)),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
