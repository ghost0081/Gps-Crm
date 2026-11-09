import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Box, Typography, Button, Paper, TextField, MenuItem, Stack, Alert, Chip, CircularProgress,
} from '@mui/material';
import axios from 'axios';

const WelfarePage = () => {
  const { currentUser } = useSelector((s) => s.user);
  const schoolId = currentUser?._id;
  const [rows, setRows] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    studentId: '', kind: 'medical', summary: '', detail: '', visibleToTeachers: false, teacherSafeSummary: '',
  });

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const [notes, stu] = await Promise.all([
        axios.get(`${process.env.REACT_APP_BASE_URL || ''}/Welfare/Notes`, { params: { schoolId } }),
        axios.get(`${process.env.REACT_APP_BASE_URL || ''}/Students/${schoolId}`),
      ]);
      setRows(Array.isArray(notes.data) ? notes.data : []);
      setStudents(Array.isArray(stu.data) ? stu.data : []);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setError('');
    try {
      await axios.post(`${process.env.REACT_APP_BASE_URL || ''}/Welfare/Notes`, {
        schoolId,
        ...form,
        createdBy: currentUser?.name || 'Admin',
      });
      setForm({ studentId: '', kind: 'medical', summary: '', detail: '', visibleToTeachers: false, teacherSafeSummary: '' });
      await load();
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    }
  };

  return (
    <Box>
      <Typography variant="h1" sx={{ fontWeight: 800, mb: 1 }}>Nurse / Counsellor</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Restricted welfare notes. Teachers only see “safe summaries” when you enable that flag.
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack spacing={2}>
          <TextField select size="small" label="Student" value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}>
            {students.map((s) => (
              <MenuItem key={s._id} value={s._id}>{s.name} (#{s.rollNum})</MenuItem>
            ))}
          </TextField>
          <TextField select size="small" label="Kind" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
            {['medical', 'counselling', 'incident', 'allergy_alert'].map((k) => <MenuItem key={k} value={k}>{k}</MenuItem>)}
          </TextField>
          <TextField size="small" label="Summary" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
          <TextField size="small" multiline minRows={2} label="Detail (restricted)" value={form.detail} onChange={(e) => setForm({ ...form, detail: e.target.value })} />
          <TextField size="small" label="Teacher-safe summary (optional)" value={form.teacherSafeSummary} onChange={(e) => setForm({ ...form, teacherSafeSummary: e.target.value })} />
          <Button variant="contained" onClick={create}>Save note</Button>
        </Stack>
      </Paper>
      {loading ? <CircularProgress /> : rows.map((r) => (
        <Paper key={r._id} sx={{ p: 2, mb: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
            <Typography fontWeight={700}>{r.student?.name}</Typography>
            <Chip size="small" label={r.kind} />
            {r.visibleToTeachers && <Chip size="small" color="warning" label="Teacher-visible" />}
          </Stack>
          <Typography variant="body2">{r.summary}</Typography>
        </Paper>
      ))}
    </Box>
  );
};

export default WelfarePage;
