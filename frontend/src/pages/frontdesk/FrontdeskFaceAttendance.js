import React, { useRef, useState, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Box, Button, Typography, Paper, CircularProgress, Alert, Snackbar, MenuItem, Select, FormControl, InputLabel } from '@mui/material';
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

  const { currentUser } = useSelector(state => state.user);

  useEffect(() => {
    // Fetch subjects for attendance context
    const fetchSubjects = async () => {
      try {
        const res = await axios.get(`${process.env.REACT_APP_BASE_URL}/Subjects/${currentUser.school._id}`);
        if (res.data && res.data.length > 0) {
          setSubjects(res.data);
          setSelectedSubject(res.data[0]._id);
        }
      } catch (err) {
        console.error("Error fetching subjects", err);
      }
    };
    if (currentUser?.school?._id) {
      fetchSubjects();
    }
  }, [currentUser]);

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
      formData.append('schoolId', currentUser.school._id); 
      formData.append('subName', selectedSubject); 
      formData.append('status', 'Present');

      const response = await fetch(`${process.env.REACT_APP_BASE_URL}/Attendance/MarkFace`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setStatus(`✅ Present: ${data.student.name} (Roll: ${data.student.rollNum})`);
        setAlertInfo({ open: true, type: 'success', message: `Attendance marked for ${data.student.name}` });
        setTimeout(() => setStatus('Waiting for next student...'), 3500);
      } else {
        setStatus(`❌ Error: ${data.message}`);
        setAlertInfo({ open: true, type: 'error', message: data.message });
      }
    } catch (error) {
      console.error(error);
      setStatus('❌ Network error or backend is down.');
      setAlertInfo({ open: true, type: 'error', message: 'Network error or backend is down' });
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
        
        {subjects.length > 0 && (
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
        )}

        <Box sx={{ border: '4px solid #1976d2', borderRadius: 2, overflow: 'hidden', mb: 3 }}>
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
          startIcon={isLoading && <CircularProgress size={20} color="inherit" />}
          sx={{ px: 4, py: 1.5 }}
        >
          {isLoading ? 'Processing...' : 'Scan Student'}
        </Button>
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
