import React, { useRef, useState, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { 
  Box, Button, Typography, Paper, CircularProgress, Alert, Snackbar, 
  MenuItem, Select, FormControl, InputLabel, List, ListItem, ListItemIcon, 
  ListItemText, Divider, Chip
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import FaceIcon from '@mui/icons-material/Face';
import { useSelector } from 'react-redux';
import axios from 'axios';

// Helper function: Converts Base64 Data URL to a File/Blob so Multer can read it
const dataURItoBlob = (dataURI) => {
  const byteString = atob(dataURI.split(',')[1]);
  const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeString });
};

const FrontdeskFaceAttendance = () => {
  const webcamRef = useRef(null);
  const [status, setStatus] = useState('Waiting for student...');
  const [isLoading, setIsLoading] = useState(false);
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [alertInfo, setAlertInfo] = useState({ open: false, type: 'info', message: '' });
  
  // Activity Log State
  const [logs, setLogs] = useState([]);

  const { currentUser } = useSelector(state => state.user);

  // For Admins and FrontDesk, their _id is the schoolId. 
  // For other roles, it's currentUser.school._id or currentUser.school
  const schoolId = (currentUser?.role === 'Admin' || currentUser?.role === 'FrontDesk')
    ? currentUser._id 
    : (currentUser?.school?._id || currentUser?.school || currentUser?._id);

  useEffect(() => {
    // Fetch subjects for attendance context
    const fetchSubjects = async () => {
      console.log("Fetching subjects for schoolId:", schoolId);
      try {
        const res = await axios.get(`${process.env.REACT_APP_BASE_URL}/AllSubjects/${schoolId}`);
        console.log("Response from AllSubjects:", res.data);
        if (Array.isArray(res.data) && res.data.length > 0) {
          setSubjects(res.data);
          setSelectedSubject(res.data[0]._id);
        } else {
          console.warn("Subjects API returned non-array or empty:", res.data);
        }
      } catch (err) {
        console.error("Error fetching subjects:", err);
      }
    };
    if (schoolId) {
      fetchSubjects();
    } else {
      console.log("Cannot fetch subjects: schoolId is falsy (", schoolId, ")! CurrentUser:", currentUser);
    }
  }, [schoolId, currentUser]);

  const addLog = (type, title, subtitle) => {
    setLogs(prev => [
      { id: Date.now(), time: new Date().toLocaleTimeString(), type, title, subtitle },
      ...prev
    ].slice(0, 50)); // keep last 50 logs
  };

  const captureAndMarkAttendance = useCallback(async () => {
    if (!webcamRef.current) return;
    if (!selectedSubject) {
      setAlertInfo({ open: true, type: 'error', message: 'Please select a subject first' });
      return;
    }
    
    setIsLoading(true);
    setStatus('Scanning face...');

    try {
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) throw new Error("Could not capture image from webcam");

      const imageBlob = dataURItoBlob(imageSrc);
      const formData = new FormData();
      formData.append('image', imageBlob, 'attendance_capture.jpg');
      formData.append('schoolId', schoolId); 
      formData.append('subName', selectedSubject); 
      formData.append('status', 'Present');

      const response = await fetch(`${process.env.REACT_APP_BASE_URL}/Attendance/MarkFace`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        const successMsg = `Present: ${data.student.name} (Roll: ${data.student.rollNum})`;
        setStatus(`✅ ${successMsg}`);
        setAlertInfo({ open: true, type: 'success', message: `Attendance marked for ${data.student.name}` });
        
        // Add Success Log
        addLog('success', data.student.name, `Roll No: ${data.student.rollNum} • Status: Present`);
        
        setTimeout(() => setStatus('Waiting for next student...'), 3500);
      } else {
        setStatus(`❌ Error: ${data.message}`);
        setAlertInfo({ open: true, type: 'error', message: data.message });
        
        // Add Error Log
        addLog('error', 'Unrecognized / Failed', data.message);
      }
    } catch (error) {
      console.error(error);
      setStatus('❌ Network error or backend is down.');
      setAlertInfo({ open: true, type: 'error', message: 'Network error or backend is down' });
      
      // Add Error Log
      addLog('error', 'System Error', error.message || 'Network disconnected');
    } finally {
      setIsLoading(false);
    }
  }, [webcamRef, currentUser, selectedSubject]);

  return (
    <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Typography variant="h4" gutterBottom>
        Auto Face Attendance
      </Typography>

      <Paper elevation={3} sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: 600 }}>
        
        {subjects.length > 0 ? (
          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>Subject / Period</InputLabel>
            <Select
              value={selectedSubject}
              label="Subject / Period"
              onChange={(e) => setSelectedSubject(e.target.value)}
            >
              {subjects.map((sub) => (
                <MenuItem key={sub._id} value={sub._id}>
                  {sub.subName} ({sub.subCode})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : (
          <Typography color="error" sx={{ mb: 3, fontWeight: 'bold' }}>
            No subjects found! You must create a Subject first to mark attendance.
          </Typography>
        )}

        <Box sx={{ border: '4px solid #1976d2', borderRadius: 2, overflow: 'hidden', mb: 3, position: 'relative' }}>
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            width={480}
            height={360}
            videoConstraints={{ facingMode: "user" }}
          />
        </Box>

        <Typography variant="h6" color="textSecondary" sx={{ mb: 3, height: 32 }}>
          {status}
        </Typography>

        <Button 
          variant="contained" 
          color="primary" 
          size="large"
          onClick={captureAndMarkAttendance} 
          disabled={isLoading || !selectedSubject}
          startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <FaceIcon />}
          sx={{ px: 4, py: 1.5, borderRadius: 2 }}
        >
          {isLoading ? 'Processing...' : 'Scan Student'}
        </Button>
      </Paper>

      {/* Activity Logs Section */}
      <Paper elevation={2} sx={{ mt: 4, p: 0, width: '100%', maxWidth: 600, overflow: 'hidden', borderRadius: 2 }}>
        <Box sx={{ bgcolor: '#f5f5f5', p: 2, borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 600 }}>
            Recent Scan Logs
          </Typography>
          <Chip label={`${logs.length} Scans`} size="small" color="primary" variant="outlined" />
        </Box>
        
        {logs.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="textSecondary">No scans recorded yet. Waiting for students...</Typography>
          </Box>
        ) : (
          <List sx={{ p: 0, maxHeight: 400, overflow: 'auto' }}>
            {logs.map((log, index) => (
              <React.Fragment key={log.id}>
                <ListItem sx={{ py: 1.5 }}>
                  <ListItemIcon>
                    {log.type === 'success' ? (
                      <CheckCircleIcon sx={{ color: '#10B981', fontSize: 32 }} />
                    ) : (
                      <ErrorIcon sx={{ color: '#EF4444', fontSize: 32 }} />
                    )}
                  </ListItemIcon>
                  <ListItemText 
                    primary={
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography sx={{ fontWeight: 'bold', color: log.type === 'success' ? '#10B981' : '#EF4444' }}>
                          {log.title}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {log.time}
                        </Typography>
                      </Box>
                    } 
                    secondary={log.subtitle} 
                  />
                </ListItem>
                {index < logs.length - 1 && <Divider component="li" />}
              </React.Fragment>
            ))}
          </List>
        )}
      </Paper>

      <Snackbar 
        open={alertInfo.open} 
        autoHideDuration={4000} 
        onClose={() => setAlertInfo({ ...alertInfo, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={alertInfo.type} variant="filled">
          {alertInfo.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default FrontdeskFaceAttendance;
