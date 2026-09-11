import 'dart:io';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';
import '../../theme.dart';
import '../../config.dart';

class ParentFaceRegistration extends StatefulWidget {
  const ParentFaceRegistration({super.key});

  @override
  State<ParentFaceRegistration> createState() => _ParentFaceRegistrationState();
}

class _ParentFaceRegistrationState extends State<ParentFaceRegistration> {
  final List<XFile> _imageFiles = [];
  final ImagePicker _picker = ImagePicker();
  
  bool _isLoading = false;
  bool _isCheckingProfile = true;
  bool _hasExistingProfile = false;

  final List<String> _angles = [
    "Straight View",
    "Left Side",
    "Right Side",
    "Looking Up",
    "Looking Down"
  ];

  final List<IconData> _angleIcons = [
    Icons.face,
    Icons.turn_left,
    Icons.turn_right,
    Icons.arrow_upward,
    Icons.arrow_downward
  ];

  int get _currentAngleIndex => _imageFiles.length;

  @override
  void initState() {
    super.initState();
    _checkExistingProfile();
  }

  Future<void> _checkExistingProfile() async {
    try {
      final user = Provider.of<AuthProvider>(context, listen: false).currentUser;
      if (user?.studentId == null) return;

      final studentDetails = await ApiService().getStudentDetails(user!.studentId!);
      
      final faceEmbeddings = studentDetails['faceEmbeddings'];
      if (faceEmbeddings != null && faceEmbeddings is List && faceEmbeddings.isNotEmpty) {
        if (mounted) {
          setState(() {
            _hasExistingProfile = true;
          });
        }
      }
    } catch (e) {
      debugPrint("Error checking profile: $e");
    } finally {
      if (mounted) {
        setState(() {
          _isCheckingProfile = false;
        });
      }
    }
  }

  Future<void> _deleteExistingProfile() async {
    setState(() {
      _isLoading = true;
    });

    try {
      final user = Provider.of<AuthProvider>(context, listen: false).currentUser;
      if (user?.studentId == null) throw Exception("Student ID not found");

      await ApiService().updateStudent(user!.studentId!, {
        "faceEmbeddings": []
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Profile deleted successfully!'),
            backgroundColor: Color(0xFF10B981),
          ),
        );
        setState(() {
          _hasExistingProfile = false;
          _imageFiles.clear();
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('❌ Error: ${e.toString()}'),
            backgroundColor: const Color(0xFFEF4444),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _takePicture() async {
    if (_currentAngleIndex >= 5) return;

    final XFile? photo = await _picker.pickImage(
      source: ImageSource.camera,
      preferredCameraDevice: CameraDevice.front,
      imageQuality: 70,
    );

    if (photo != null) {
      setState(() {
        _imageFiles.add(photo);
      });
    }
  }

  void _retakeCurrent() {
    if (_imageFiles.isNotEmpty) {
      setState(() {
        _imageFiles.removeLast();
      });
      _takePicture();
    }
  }

  void _resetAll() {
    setState(() {
      _imageFiles.clear();
    });
  }

  Future<void> _registerFace() async {
    if (_imageFiles.length != 5) return;
    
    setState(() {
      _isLoading = true;
    });

    try {
      final user = Provider.of<AuthProvider>(context, listen: false).currentUser;
      if (user?.studentId == null) {
        throw Exception("Student ID not found");
      }

      final request = http.MultipartRequest(
        'POST',
        Uri.parse('${Config.baseUrl}/Attendance/RegisterFace/${user!.studentId}'),
      );

      for (int i = 0; i < _imageFiles.length; i++) {
        if (kIsWeb) {
          final bytes = await _imageFiles[i].readAsBytes();
          request.files.add(http.MultipartFile.fromBytes(
            'images',
            bytes,
            filename: _imageFiles[i].name,
          ));
        } else {
          request.files.add(await http.MultipartFile.fromPath(
            'images',
            _imageFiles[i].path,
          ));
        }
      }

      final streamedResponse = await request.send();
      final response = await http.Response.fromStream(streamedResponse);
      final data = jsonDecode(response.body);

      if (response.statusCode == 200) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('✅ 3D Face Profile registered successfully!'),
              backgroundColor: Color(0xFF10B981),
            ),
          );
          setState(() {
            _hasExistingProfile = true;
            _imageFiles.clear();
          });
        }
      } else {
        throw Exception(data['message'] ?? 'Failed to register face');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('❌ Error: ${e.toString()}'),
            backgroundColor: const Color(0xFFEF4444),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  Widget _buildExistingProfileView() {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        const Icon(
          Icons.verified_user_rounded,
          size: 100,
          color: Colors.green,
        ),
        const SizedBox(height: 24),
        const Text(
          'Face Profile Active',
          style: TextStyle(
            fontSize: 28,
            fontWeight: FontWeight.bold,
            color: AppTheme.textPrimary,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 16),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 24.0),
          child: Text(
            'A 3D Face Profile is currently registered and active for this student. Automatic front desk attendance is enabled.',
            style: TextStyle(
              fontSize: 16,
              color: AppTheme.textSecondary,
              height: 1.5,
            ),
            textAlign: TextAlign.center,
          ),
        ),
        const SizedBox(height: 48),
        if (_isLoading)
          const CircularProgressIndicator(color: AppTheme.primaryColor)
        else
          Column(
            children: [
              ElevatedButton.icon(
                onPressed: () {
                  setState(() {
                    _hasExistingProfile = false;
                    _imageFiles.clear();
                  });
                },
                icon: const Icon(Icons.camera_alt_rounded, color: Colors.white),
                label: const Text('Create New Profile', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primaryColor,
                  padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  elevation: 0,
                  minimumSize: const Size(250, 50),
                ),
              ),
              const SizedBox(height: 16),
              TextButton.icon(
                onPressed: _deleteExistingProfile,
                icon: const Icon(Icons.delete_forever_rounded, color: Colors.redAccent),
                label: const Text('Delete Profile', style: TextStyle(color: Colors.redAccent, fontSize: 16, fontWeight: FontWeight.bold)),
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                  minimumSize: const Size(250, 50),
                ),
              ),
            ],
          ),
      ],
    );
  }

  Widget _buildRegistrationView() {
    bool isComplete = _currentAngleIndex == 5;

    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Icon(
          isComplete ? Icons.verified_user_rounded : _angleIcons[isComplete ? 4 : _currentAngleIndex],
          size: 80,
          color: isComplete ? Colors.green : AppTheme.primaryColor,
        ),
        const SizedBox(height: 16),
        Text(
          isComplete ? 'All Angles Captured!' : 'Step ${_currentAngleIndex + 1} of 5',
          style: const TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.bold,
            color: AppTheme.textPrimary,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 12),
        Text(
          isComplete 
            ? 'Your child\'s face profile is ready to be securely uploaded to the school system.'
            : 'Please capture a clear photo of your child from the angle: ${_angles[_currentAngleIndex]}',
          style: const TextStyle(
            fontSize: 16,
            color: AppTheme.textSecondary,
            height: 1.5,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 32),
        
        // Image Preview or Placeholder
        Container(
          height: 250,
          width: 250,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: isComplete ? Colors.green : AppTheme.primaryLight, width: 3),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.05),
                blurRadius: 15,
                offset: const Offset(0, 5),
              )
            ],
          ),
          child: _currentAngleIndex > 0
              ? ClipRRect(
                  borderRadius: BorderRadius.circular(17),
                  child: kIsWeb 
                      ? Image.network(
                          _imageFiles[_currentAngleIndex - 1].path, 
                          fit: BoxFit.cover,
                        )
                      : Image.file(
                          File(_imageFiles[_currentAngleIndex - 1].path), 
                          fit: BoxFit.cover,
                        ),
                )
              : Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.camera_alt_outlined, size: 48, color: Colors.grey.shade400),
                    const SizedBox(height: 8),
                    Text('Ready to Start', style: TextStyle(color: Colors.grey.shade500)),
                  ],
                ),
        ),
        
        const SizedBox(height: 32),

        // Progress Indicator
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(5, (index) {
            return Container(
              margin: const EdgeInsets.symmetric(horizontal: 4),
              width: 12,
              height: 12,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: index < _currentAngleIndex 
                    ? Colors.green 
                    : (index == _currentAngleIndex ? AppTheme.primaryColor : Colors.grey.shade300),
              ),
            );
          }),
        ),

        const SizedBox(height: 32),

        if (_isLoading)
          const CircularProgressIndicator(color: AppTheme.primaryColor)
        else if (!isComplete)
          Column(
            children: [
              ElevatedButton.icon(
                onPressed: _takePicture,
                icon: const Icon(Icons.camera_front_rounded, color: Colors.white),
                label: Text('Take Photo (${_angles[_currentAngleIndex]})', style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primaryColor,
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  elevation: 0,
                ),
              ),
              if (_currentAngleIndex > 0) ...[
                const SizedBox(height: 12),
                TextButton.icon(
                  onPressed: _retakeCurrent,
                  icon: const Icon(Icons.refresh_rounded),
                  label: const Text('Retake Previous'),
                  style: TextButton.styleFrom(
                    foregroundColor: AppTheme.textSecondary,
                  ),
                ),
              ]
            ],
          )
        else
          Column(
            children: [
              ElevatedButton.icon(
                onPressed: _registerFace,
                icon: const Icon(Icons.cloud_upload_rounded, color: Colors.white),
                label: const Text('Securely Upload Profile', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF10B981),
                  padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  elevation: 0,
                ),
              ),
              const SizedBox(height: 12),
              TextButton.icon(
                onPressed: _resetAll,
                icon: const Icon(Icons.restart_alt_rounded),
                label: const Text('Start Over'),
                style: TextButton.styleFrom(
                  foregroundColor: AppTheme.textSecondary,
                ),
              ),
            ],
          ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: AppBar(
        title: const Text('Face Registration'),
        backgroundColor: AppTheme.primaryColor,
        foregroundColor: Colors.white,
      ),
      body: Center(
        child: _isCheckingProfile
            ? const CircularProgressIndicator(color: AppTheme.primaryColor)
            : SingleChildScrollView(
                padding: const EdgeInsets.all(24.0),
                child: _hasExistingProfile ? _buildExistingProfileView() : _buildRegistrationView(),
              ),
      ),
    );
  }
}
