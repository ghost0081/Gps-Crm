import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Switch, FormControlLabel,
  Chip, IconButton, Tooltip, CircularProgress, Alert, Snackbar,
  MenuItem, Select, FormControl, InputLabel, Card, CardContent, Grid
} from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useSelector } from 'react-redux';
import axios from 'axios';

const CameraManagement = () => {
  const { currentUser } = useSelector(state => state.user);
  const schoolId = (currentUser?.role === 'Admin' || currentUser?.role === 'FrontDesk')
    ? currentUser._id
    : (currentUser?.school?._id || currentUser?.school || currentUser?._id);

  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCamera, setEditingCamera] = useState(null);
  const [testingId, setTestingId] = useState(null);

  // Form State
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [rtspUrl, setRtspUrl] = useState('');
  const [direction, setDirection] = useState('IN');
  const [fps, setFps] = useState(2);
  const [enabled, setEnabled] = useState(true);
  const [notes, setNotes] = useState('');

  // Alerts
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  const fetchCameras = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const res = await axios.get(`${process.env.REACT_APP_BASE_URL || ''}/api/cameras/school/${schoolId}`);
      setCameras(res.data);
    } catch (err) {
      console.error('Failed to fetch cameras:', err);
      setSnackbar({ open: true, message: 'Failed to load cameras', severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    fetchCameras();
  }, [fetchCameras]);

  const handleOpenDialog = (cam = null) => {
    if (cam) {
      setEditingCamera(cam);
      setName(cam.name);
      setLocation(cam.location);
      setRtspUrl(cam.rtspUrl);
      setDirection(cam.direction || 'IN');
      setFps(cam.fps || 2);
      setEnabled(cam.enabled !== undefined ? cam.enabled : true);
      setNotes(cam.notes || '');
    } else {
      setEditingCamera(null);
      setName('');
      setLocation('Main Entrance');
      setRtspUrl('rtsp://');
      setDirection('IN');
      setFps(2);
      setEnabled(true);
      setNotes('');
    }
    setDialogOpen(true);
  };

  const handleSaveCamera = async () => {
    if (!name.trim() || !rtspUrl.trim()) {
      setSnackbar({ open: true, message: 'Please enter camera name and RTSP URL', severity: 'warning' });
      return;
    }

    try {
      const payload = {
        name,
        location,
        rtspUrl,
        direction,
        fps: parseInt(fps, 10) || 2,
        enabled,
        notes,
        school: schoolId,
      };

      if (editingCamera) {
        await axios.put(`${process.env.REACT_APP_BASE_URL || ''}/api/cameras/${editingCamera._id}`, payload);
        setSnackbar({ open: true, message: 'Camera updated successfully', severity: 'success' });
      } else {
        await axios.post(`${process.env.REACT_APP_BASE_URL || ''}/api/cameras`, payload);
        setSnackbar({ open: true, message: 'Camera added successfully', severity: 'success' });
      }

      setDialogOpen(false);
      fetchCameras();
    } catch (err) {
      console.error('Error saving camera:', err);
      setSnackbar({ open: true, message: err.response?.data?.message || 'Error saving camera', severity: 'error' });
    }
  };

  const handleDeleteCamera = async (id) => {
    if (!window.confirm('Are you sure you want to remove this camera?')) return;
    try {
      await axios.delete(`${process.env.REACT_APP_BASE_URL || ''}/api/cameras/${id}`);
      setSnackbar({ open: true, message: 'Camera removed successfully', severity: 'info' });
      fetchCameras();
    } catch (err) {
      console.error('Error deleting camera:', err);
      setSnackbar({ open: true, message: 'Failed to delete camera', severity: 'error' });
    }
  };

  const handleTestConnection = async (cam) => {
    setTestingId(cam._id);
    try {
      const res = await axios.post(`${process.env.REACT_APP_BASE_URL || ''}/api/cameras/test-stream`, {
        rtspUrl: cam.rtspUrl,
      });

      if (res.data.success) {
        setSnackbar({ open: true, message: `✅ ${res.data.message}`, severity: 'success' });
      } else {
        setSnackbar({ open: true, message: `⚠️ ${res.data.message}`, severity: 'warning' });
      }
    } catch (err) {
      setSnackbar({ open: true, message: '❌ Connection test failed', severity: 'error' });
    } finally {
      setTestingId(null);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <VideocamIcon fontSize="large" /> AI Camera Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Configure live CCTV, IP cameras, and RTSP streams for automated AI face recognition and campus gate attendance.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchCameras}>
            Refresh
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
            Add Camera
          </Button>
        </Box>
      </Box>

      {/* Summary KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Card elevation={1} sx={{ borderRadius: 3, borderLeft: '4px solid #3b82f6' }}>
            <CardContent sx={{ py: 2 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>Total Configured</Typography>
              <Typography variant="h5" fontWeight={800}>{cameras.length} Cameras</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card elevation={1} sx={{ borderRadius: 3, borderLeft: '4px solid #10b981' }}>
            <CardContent sx={{ py: 2 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>Active & Enabled</Typography>
              <Typography variant="h5" fontWeight={800} color="success.main">
                {cameras.filter(c => c.enabled).length} Enabled
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card elevation={1} sx={{ borderRadius: 3, borderLeft: '4px solid #8b5cf6' }}>
            <CardContent sx={{ py: 2 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>AI Detection FPS</Typography>
              <Typography variant="h5" fontWeight={800}>1 - 2 FPS (Sampled)</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Table */}
      <Paper elevation={2} sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead sx={{ backgroundColor: 'action.hover' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Camera Name</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Location</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Direction</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>RTSP Stream URL</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Target FPS</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Active</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={36} />
                  </TableCell>
                </TableRow>
              ) : cameras.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary">No cameras configured yet. Click "Add Camera" to connect an RTSP stream.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                cameras.map((cam) => (
                  <TableRow key={cam._id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{cam.name}</TableCell>
                    <TableCell>{cam.location}</TableCell>
                    <TableCell>
                      <Chip
                        label={cam.direction}
                        size="small"
                        color={cam.direction === 'IN' ? 'success' : cam.direction === 'OUT' ? 'warning' : 'default'}
                        variant="outlined"
                        sx={{ fontWeight: 700 }}
                      />
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {cam.rtspUrl}
                    </TableCell>
                    <TableCell>{cam.fps} FPS</TableCell>
                    <TableCell>
                      {cam.status === 'online' ? (
                        <Chip icon={<CheckCircleOutlineIcon />} label="Online" size="small" color="success" />
                      ) : (
                        <Chip icon={<ErrorOutlineIcon />} label="Standby" size="small" variant="outlined" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={cam.enabled}
                        size="small"
                        onChange={async (e) => {
                          try {
                            await axios.put(`${process.env.REACT_APP_BASE_URL || ''}/api/cameras/${cam._id}`, { enabled: e.target.checked });
                            fetchCameras();
                          } catch (_) {}
                        }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Test RTSP Connection">
                        <span>
                          <IconButton
                            color="primary"
                            disabled={testingId === cam._id}
                            onClick={() => handleTestConnection(cam)}
                          >
                            {testingId === cam._id ? <CircularProgress size={20} /> : <NetworkCheckIcon />}
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Edit Camera">
                        <IconButton color="secondary" onClick={() => handleOpenDialog(cam)}>
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete Camera">
                        <IconButton color="error" onClick={() => handleDeleteCamera(cam._id)}>
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>
          {editingCamera ? 'Edit Camera Configuration' : 'Add New CCTV / RTSP Camera'}
        </DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 2 }}>
          <TextField
            label="Camera Name"
            placeholder="e.g. Main Entrance Gate - Lane 1"
            fullWidth
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <TextField
            label="Location"
            placeholder="e.g. Front Campus Gate"
            fullWidth
            required
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
          <TextField
            label="RTSP URL"
            placeholder="rtsp://admin:password@192.168.1.50:554/ch01"
            helperText="RTSP stream URL from NVR or IP Camera (or webcam index 0 for USB testing)"
            fullWidth
            required
            value={rtspUrl}
            onChange={(e) => setRtspUrl(e.target.value)}
          />
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Attendance Direction</InputLabel>
                <Select
                  value={direction}
                  label="Attendance Direction"
                  onChange={(e) => setDirection(e.target.value)}
                >
                  <MenuItem value="IN">IN (Entering Campus)</MenuItem>
                  <MenuItem value="OUT">OUT (Departing Campus)</MenuItem>
                  <MenuItem value="GENERAL">GENERAL (Corridor / Hallway)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Sampling Rate (FPS)"
                type="number"
                inputProps={{ min: 1, max: 15 }}
                helperText="1–2 FPS recommended to save CPU"
                fullWidth
                value={fps}
                onChange={(e) => setFps(e.target.value)}
              />
            </Grid>
          </Grid>
          <TextField
            label="Notes / Comments"
            placeholder="Optional hardware details or notes"
            fullWidth
            multiline
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <FormControlLabel
            control={<Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />}
            label="Camera Enabled for Live AI Recognition"
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveCamera}>
            {editingCamera ? 'Update Camera' : 'Save & Connect'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar Alerts */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default CameraManagement;
