import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Box, Typography, Button, Paper, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, Stack, Alert, Chip,
} from '@mui/material';
import axios from 'axios';

const TransportRoutesPage = () => {
  const { currentUser } = useSelector((s) => s.user);
  const schoolId = currentUser?._id;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '', code: '', vehicleLabel: '', driverName: '', helperName: '', capacity: 40, stopsText: '',
  });

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const { data } = await axios.get(`${process.env.REACT_APP_BASE_URL || ''}/Transport/Routes`, {
        params: { schoolId },
      });
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
    const stops = String(form.stopsText || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((name, i) => ({ name, sequence: i + 1 }));
    try {
      await axios.post(`${process.env.REACT_APP_BASE_URL || ''}/Transport/Routes`, {
        schoolId,
        name: form.name,
        code: form.code,
        vehicleLabel: form.vehicleLabel,
        driverName: form.driverName,
        helperName: form.helperName,
        capacity: Number(form.capacity) || 40,
        stops,
      });
      setForm({ name: '', code: '', vehicleLabel: '', driverName: '', helperName: '', capacity: 40, stopsText: '' });
      await load();
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    }
  };

  return (
    <Box>
      <Typography variant="h1" sx={{ fontWeight: 800, mb: 1 }}>Transport Routes</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Define buses, stops, and capacity. Student assignment and live trip manifests come next.
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField size="small" label="Route name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} sx={{ flex: 1 }} />
            <TextField size="small" label="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            <TextField size="small" label="Vehicle" value={form.vehicleLabel} onChange={(e) => setForm({ ...form, vehicleLabel: e.target.value })} />
            <TextField size="small" type="number" label="Capacity" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
          </Stack>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField size="small" label="Driver" value={form.driverName} onChange={(e) => setForm({ ...form, driverName: e.target.value })} />
            <TextField size="small" label="Helper" value={form.helperName} onChange={(e) => setForm({ ...form, helperName: e.target.value })} />
            <TextField size="small" label="Stops (comma-separated)" value={form.stopsText} onChange={(e) => setForm({ ...form, stopsText: e.target.value })} sx={{ flex: 1 }} />
            <Button variant="contained" onClick={create}>Add route</Button>
          </Stack>
        </Stack>
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Route</TableCell>
                <TableCell>Vehicle</TableCell>
                <TableCell>Driver / Helper</TableCell>
                <TableCell>Stops</TableCell>
                <TableCell>Students</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r._id}>
                  <TableCell>{r.name}{r.code ? ` (${r.code})` : ''}</TableCell>
                  <TableCell>{r.vehicleLabel || '—'} · cap {r.capacity}</TableCell>
                  <TableCell>{r.driverName || '—'} / {r.helperName || '—'}</TableCell>
                  <TableCell>{(r.stops || []).map((s) => s.name).join(' → ') || '—'}</TableCell>
                  <TableCell>{(r.studentIds || []).length}</TableCell>
                  <TableCell>
                    <Chip size="small" label={r.active ? 'Active' : 'Inactive'} color={r.active ? 'success' : 'default'} />
                  </TableCell>
                </TableRow>
              ))}
              {!rows.length && (
                <TableRow><TableCell colSpan={6}>No routes yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default TransportRoutesPage;
