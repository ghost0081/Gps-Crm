import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Box, Typography, Button, Paper, TextField, MenuItem, Stack, Alert, Chip, CircularProgress,
} from '@mui/material';
import axios from 'axios';

const STATUSES = ['New', 'Contacted', 'Assessment', 'Interview', 'Offer', 'Enrolled', 'Lost'];

const AdmissionsPage = () => {
  const { currentUser } = useSelector((s) => s.user);
  const schoolId = currentUser?._id;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    studentName: '', classApplying: '', guardianName: '', guardianPhone: '', source: 'walk_in', notes: '',
  });

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const { data } = await axios.get(`${process.env.REACT_APP_BASE_URL || ''}/Admissions`, { params: { schoolId } });
      setRows(Array.isArray(data) ? data : []);
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
      await axios.post(`${process.env.REACT_APP_BASE_URL || ''}/Admissions`, { schoolId, ...form });
      setForm({ studentName: '', classApplying: '', guardianName: '', guardianPhone: '', source: 'walk_in', notes: '' });
      await load();
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    }
  };

  const setStatus = async (id, status) => {
    await axios.put(`${process.env.REACT_APP_BASE_URL || ''}/Admissions/${id}`, { status });
    await load();
  };

  return (
    <Box>
      <Typography variant="h1" sx={{ fontWeight: 800, mb: 1 }}>Admissions CRM</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Capture enquiries and move them through the pipeline.</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} flexWrap="wrap">
          <TextField size="small" label="Student name" value={form.studentName} onChange={(e) => setForm({ ...form, studentName: e.target.value })} />
          <TextField size="small" label="Class applying" value={form.classApplying} onChange={(e) => setForm({ ...form, classApplying: e.target.value })} />
          <TextField size="small" label="Guardian" value={form.guardianName} onChange={(e) => setForm({ ...form, guardianName: e.target.value })} />
          <TextField size="small" label="Phone" value={form.guardianPhone} onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })} />
          <Button variant="contained" onClick={create}>Add enquiry</Button>
        </Stack>
      </Paper>
      {loading ? <CircularProgress /> : rows.map((r) => (
        <Paper key={r._id} sx={{ p: 2, mb: 1, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <Box sx={{ flex: 1, minWidth: 200 }}>
            <Typography fontWeight={700}>{r.studentName} → {r.classApplying || 'Class TBD'}</Typography>
            <Typography variant="caption">{r.guardianName} · {r.guardianPhone} · {r.source}</Typography>
          </Box>
          <Chip label={r.status} size="small" />
          <TextField select size="small" value={r.status} onChange={(e) => setStatus(r._id, e.target.value)} sx={{ minWidth: 140 }}>
            {STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </TextField>
        </Paper>
      ))}
    </Box>
  );
};

export default AdmissionsPage;
