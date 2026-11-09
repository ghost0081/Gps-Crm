const Camera = require('../models/cameraSchema');
const net = require('net');
const url = require('url');

/**
 * Helper to check TCP reachability of RTSP host and port
 */
const probeRtspHost = (rtspUrl, timeoutMs = 4000) => {
  return new Promise((resolve) => {
    try {
      // Handles rtsp://user:pass@host:port/path or rtsp://host/path
      const parsed = new url.URL(rtspUrl);
      const host = parsed.hostname;
      const port = parsed.port ? parseInt(parsed.port, 10) : 554;

      if (!host) {
        return resolve({ success: false, message: 'Invalid RTSP URL: Host missing' });
      }

      const socket = new net.Socket();
      socket.setTimeout(timeoutMs);

      socket.on('connect', () => {
        socket.destroy();
        resolve({ success: true, message: `RTSP host ${host}:${port} is reachable` });
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve({ success: false, message: `Connection timed out after ${timeoutMs}ms for ${host}:${port}` });
      });

      socket.on('error', (err) => {
        socket.destroy();
        resolve({ success: false, message: `Could not connect to ${host}:${port}: ${err.message}` });
      });

      socket.connect(port, host);
    } catch (e) {
      resolve({ success: false, message: `Malformed RTSP URL: ${e.message}` });
    }
  });
};

const createCamera = async (req, res) => {
  try {
    const { name, location, rtspUrl, direction, enabled, fps, notes, school } = req.body;
    const schoolId = school || req.params.schoolId;

    if (!schoolId) {
      return res.status(400).json({ message: 'School ID is required' });
    }
    if (!name || !rtspUrl) {
      return res.status(400).json({ message: 'Camera name and RTSP URL are required' });
    }

    const camera = new Camera({
      school: schoolId,
      name,
      location: location || 'Campus Entrance',
      rtspUrl,
      direction: direction || 'IN',
      enabled: enabled !== undefined ? enabled : true,
      fps: fps || 2,
      notes: notes || '',
      status: 'offline',
    });

    const saved = await camera.save();
    res.status(201).json({ message: 'Camera registered successfully', camera: saved });
  } catch (err) {
    console.error('createCamera error:', err);
    res.status(500).json({ message: 'Failed to create camera', error: err.message });
  }
};

const getCameras = async (req, res) => {
  try {
    const schoolId = req.params.schoolId;
    if (!schoolId) {
      return res.status(400).json({ message: 'School ID is required' });
    }

    const cameras = await Camera.find({ school: schoolId }).sort({ createdAt: -1 });
    res.json(cameras);
  } catch (err) {
    console.error('getCameras error:', err);
    res.status(500).json({ message: 'Failed to fetch cameras', error: err.message });
  }
};

const updateCamera = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    delete updateData._id;

    const updated = await Camera.findByIdAndUpdate(id, updateData, { new: true });
    if (!updated) {
      return res.status(404).json({ message: 'Camera not found' });
    }

    res.json({ message: 'Camera updated successfully', camera: updated });
  } catch (err) {
    console.error('updateCamera error:', err);
    res.status(500).json({ message: 'Failed to update camera', error: err.message });
  }
};

const deleteCamera = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Camera.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: 'Camera not found' });
    }

    res.json({ message: 'Camera deleted successfully' });
  } catch (err) {
    console.error('deleteCamera error:', err);
    res.status(500).json({ message: 'Failed to delete camera', error: err.message });
  }
};

const testCameraConnection = async (req, res) => {
  try {
    const { rtspUrl } = req.body;
    if (!rtspUrl) {
      return res.status(400).json({ message: 'rtspUrl is required for testing' });
    }

    const probeResult = await probeRtspHost(rtspUrl);
    res.json(probeResult);
  } catch (err) {
    console.error('testCameraConnection error:', err);
    res.status(500).json({ message: 'Error probing RTSP camera', error: err.message });
  }
};

module.exports = {
  createCamera,
  getCameras,
  updateCamera,
  deleteCamera,
  testCameraConnection,
};
