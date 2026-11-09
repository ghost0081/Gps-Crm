import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Box, Typography, Button, Paper, TextField, MenuItem,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, CircularProgress, Stack, Alert,
} from '@mui/material';
import axios from 'axios';

const CATEGORIES = ['admission', 'tuition', 'transport', 'examination', 'activity', 'meals', 'books', 'other'];
const CYCLES = ['monthly', 'quarterly', 'term', 'annual', 'one_time'];

const FeeHeadsPage = () => {
  const { currentUser } = useSelector((s) => s.user);
  const schoolId = currentUser?._id;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(null);
  const [form, setForm] = useState({
    code: '', name: '', category: 'tuition', defaultAmount: 0, billingCycle: 'monthly',
  });
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const { data } = await axios.get(`${process.env.REACT_APP_BASE_URL || ''}/FeeHeads`, {
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
    try {
      await axios.post(`${process.env.REACT_APP_BASE_URL || ''}/FeeHeads`, {
        schoolId,
        ...form,
        defaultAmount: Number(form.defaultAmount) || 0,
      });
      setForm({ code: '', name: '', category: 'tuition', defaultAmount: 0, billingCycle: 'monthly' });
      await load();
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    }
  };

  const runPreview = async () => {
    try {
      const { data } = await axios.get(`${process.env.REACT_APP_BASE_URL || ''}/FeeHeads/Preview`, {
        params: { schoolId },
      });
      setPreview(data);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    }
  };

  return (
    <Box>
      <Typography variant="h1" sx={{ fontWeight: 800, mb: 1 }}>Fee Heads</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configure reusable fee heads. Amounts feed invoice previews; historical invoices are never silently rewritten.
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField size="small" label="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <TextField size="small" label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} sx={{ flex: 1 }} />
          <TextField size="small" select label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} sx={{ minWidth: 140 }}>
            {CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </TextField>
          <TextField size="small" select label="Cycle" value={form.billingCycle} onChange={(e) => setForm({ ...form, billingCycle: e.target.value })} sx={{ minWidth: 130 }}>
            {CYCLES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </TextField>
          <TextField size="small" type="number" label="Default amount" value={form.defaultAmount} onChange={(e) => setForm({ ...form, defaultAmount: e.target.value })} />
          <Button variant="contained" onClick={create}>Add</Button>
          <Button variant="outlined" onClick={runPreview}>Preview</Button>
        </Stack>
      </Paper>

      {preview && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Preview total: ₹{preview.total} across {preview.lines?.length || 0} active heads — {preview.note}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Code</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Cycle</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r._id}>
                  <TableCell>{r.code}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>{r.category}</TableCell>
                  <TableCell>{r.billingCycle}</TableCell>
                  <TableCell align="right">₹{r.defaultAmount}</TableCell>
                  <TableCell>
                    <Chip size="small" label={r.active ? 'Active' : 'Inactive'} color={r.active ? 'success' : 'default'} />
                  </TableCell>
                </TableRow>
              ))}
              {!rows.length && (
                <TableRow><TableCell colSpan={6}>No fee heads yet — add tuition, transport, etc.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default FeeHeadsPage;
