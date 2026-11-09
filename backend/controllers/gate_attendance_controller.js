const GateAttendance = require('../models/gateAttendanceSchema');
const Student = require('../models/studentSchema');
require('../models/sclassSchema');
const Camera = require('../models/cameraSchema');
const SafetyEvent = require('../models/safetyEventSchema');
const Parent = require('../models/parentSchema');
const crypto = require('crypto');

// Default cooldown window in minutes to suppress rapid duplicate scans
const COOLDOWN_MINUTES = 10;

const recordGateRecognition = async (req, res) => {
  try {
    const { schoolId, cameraId, studentId, confidence, direction = 'IN', snapshotPath } = req.body;

    if (!schoolId || !studentId) {
      return res.status(400).json({ message: 'schoolId and studentId are required' });
    }

    const student = await Student.findOne({ _id: studentId, school: schoolId }).populate('sclassName');
    if (!student) {
      return res.status(404).json({ message: 'Student not found in specified school' });
    }

    let cameraName = 'Campus Gate Camera';
    let location = 'Campus Entrance';

    if (cameraId) {
      const cam = await Camera.findById(cameraId);
      if (cam) {
        cameraName = cam.name;
        location = cam.location;
        // Update camera status to online
        cam.status = 'online';
        cam.lastSeen = new Date();
        await cam.save().catch(() => {});
      }
    }

    // 1. Anti-Passback / Duplicate Suppression Check
    const cooldownThreshold = new Date(Date.now() - COOLDOWN_MINUTES * 60 * 1000);
    const recentRecord = await GateAttendance.findOne({
      student: studentId,
      direction,
      timestamp: { $gte: cooldownThreshold },
    }).sort({ timestamp: -1 });

    if (recentRecord) {
      return res.status(200).json({
        success: true,
        duplicate: true,
        message: `Duplicate ${direction} event suppressed (cooldown active: ${COOLDOWN_MINUTES} mins)`,
        lastRecordedAt: recentRecord.timestamp,
        student: {
          _id: student._id,
          name: student.name,
          rollNum: student.rollNum,
          className: student.sclassName?.sclassName || '',
        },
      });
    }

    // 2. Determine Attendance Status (e.g. Late Arrival after 8:30 AM if direction is IN)
    let status = 'Present';
    if (direction === 'IN') {
      const now = new Date();
      // Simple heuristic: if arrival is after 8:30 AM local time, mark Late
      const arrivalHour = now.getHours();
      const arrivalMin = now.getMinutes();
      if (arrivalHour > 8 || (arrivalHour === 8 && arrivalMin > 30)) {
        status = 'Late';
      }
    } else {
      status = 'Departed';
    }

    // 3. Save Gate Attendance
    const attendanceRecord = new GateAttendance({
      school: schoolId,
      student: studentId,
      camera: cameraId || null,
      cameraName,
      location,
      direction,
      confidence: confidence || 0.9,
      snapshotPath: snapshotPath || '',
      status,
    });

    const savedRecord = await attendanceRecord.save();

    // 4. Create Safety Notification for Parents
    try {
      const parents = await Parent.find({
        $or: [{ student: studentId }, { students: studentId }],
      });

      const parentRecipients = parents.map((p) => ({
        parentId: p._id,
        read: false,
      }));

      const actionText = direction === 'IN' ? 'entered campus' : 'departed campus';
      const eventId = `GATE-${studentId}-${direction}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

      await SafetyEvent.create({
        eventId,
        type: direction === 'IN' ? 'gate_face_arrival' : 'gate_face_departure',
        category: 'arrival_departure',
        student: studentId,
        school: schoolId,
        zoneName: location,
        title: `Gate Attendance: ${student.name}`,
        body: `${student.name} ${actionText} via ${cameraName} at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
        confidence: `${Math.round((confidence || 0.9) * 100)}%`,
        source: 'CCTV Face Recognition',
        recipients: parentRecipients,
        data: {
          gateAttendanceId: savedRecord._id,
          cameraName,
          location,
          direction,
          status,
        },
      });
    } catch (notifErr) {
      console.warn('SafetyEvent creation warning:', notifErr.message);
    }

    res.status(201).json({
      success: true,
      duplicate: false,
      message: `Gate attendance recorded (${direction})`,
      attendance: savedRecord,
      student: {
        _id: student._id,
        name: student.name,
        rollNum: student.rollNum,
        className: student.sclassName?.sclassName || '',
      },
    });
  } catch (err) {
    console.error('recordGateRecognition error:', err);
    res.status(500).json({ message: 'Failed to record gate recognition', error: err.message });
  }
};

const getGateAttendanceLogs = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { date, direction, limit = 50, page = 1 } = req.query;

    if (!schoolId) {
      return res.status(400).json({ message: 'schoolId is required' });
    }

    const filter = { school: schoolId };

    if (direction && ['IN', 'OUT'].includes(direction.toUpperCase())) {
      filter.direction = direction.toUpperCase();
    }

    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      filter.timestamp = { $gte: startOfDay, $lte: endOfDay };
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const parsedLimit = parseInt(limit, 10);

    const [logs, total] = await Promise.all([
      GateAttendance.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parsedLimit)
        .populate({
          path: 'student',
          select: 'name rollNum sclassName',
          populate: { path: 'sclassName', select: 'sclassName' },
        }),
      GateAttendance.countDocuments(filter),
    ]);

    res.json({
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / parsedLimit),
      logs,
    });
  } catch (err) {
    console.error('getGateAttendanceLogs error:', err);
    res.status(500).json({ message: 'Failed to fetch gate attendance logs', error: err.message });
  }
};

const getGateAttendanceStats = async (req, res) => {
  try {
    const { schoolId } = req.params;
    if (!schoolId) {
      return res.status(400).json({ message: 'schoolId is required' });
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const todayFilter = {
      school: schoolId,
      timestamp: { $gte: startOfToday, $lte: endOfToday },
    };

    const [totalIn, totalOut, recentLogs] = await Promise.all([
      GateAttendance.countDocuments({ ...todayFilter, direction: 'IN' }),
      GateAttendance.countDocuments({ ...todayFilter, direction: 'OUT' }),
      GateAttendance.find(todayFilter)
        .sort({ timestamp: -1 })
        .limit(10)
        .populate({
          path: 'student',
          select: 'name rollNum sclassName',
          populate: { path: 'sclassName', select: 'sclassName' },
        }),
    ]);

    const onCampus = Math.max(0, totalIn - totalOut);

    res.json({
      date: startOfToday.toISOString().split('T')[0],
      totalIn,
      totalOut,
      onCampus,
      recentLogs,
    });
  } catch (err) {
    console.error('getGateAttendanceStats error:', err);
    res.status(500).json({ message: 'Failed to fetch attendance stats', error: err.message });
  }
};

const getSchoolRegisteredFaces = async (req, res) => {
  try {
    const { schoolId } = req.params;
    if (!schoolId) {
      return res.status(400).json({ message: 'schoolId is required' });
    }

    const students = await Student.find({
      school: schoolId,
      faceEmbeddings: { $exists: true, $not: { $size: 0 } },
    }).select('_id name rollNum faceEmbeddings sclassName').populate('sclassName', 'sclassName');

    const formatted = students.map((s) => {
      let vectors = [];
      if (Array.isArray(s.faceEmbeddings) && s.faceEmbeddings.length > 0) {
        if (Array.isArray(s.faceEmbeddings[0])) {
          vectors = s.faceEmbeddings;
        } else {
          vectors = [s.faceEmbeddings];
        }
      }
      return {
        _id: s._id,
        name: s.name,
        rollNum: s.rollNum,
        className: s.sclassName?.sclassName || '',
        embeddings: vectors,
      };
    });

    res.json(formatted);
  } catch (err) {
    console.error('getSchoolRegisteredFaces error:', err);
    res.status(500).json({ message: 'Failed to fetch registered faces', error: err.message });
  }
};

module.exports = {
  recordGateRecognition,
  getGateAttendanceLogs,
  getGateAttendanceStats,
  getSchoolRegisteredFaces,
};
