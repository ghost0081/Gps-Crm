import { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box, Typography, Button, Paper, TextField, MenuItem, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, CircularProgress, Alert, Stack, Chip,
} from '@mui/material';
import axios from 'axios';
import { getAllSclasses } from '../../../redux/sclassRelated/sclassHandle';

const FeeInvoicesPage = () => {
  const dispatch = useDispatch();
  const { currentUser } = useSelector((s) => s.user);
  const { sclassesList } = useSelector((s) => s.sclass);
  const schoolId = currentUser?._id;
  const [classId, setClassId] = useState('');
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (schoolId) dispatch(getAllSclasses(schoolId, 'Sclass'));
  }, [dispatch, schoolId]);

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const { data } = await axios.get(`${process.env.REACT_APP_BASE_URL || ''}/FeeInvoices`, {
        params: { schoolId, classId: classId || undefined, month },
      });
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  }, [schoolId, classId, month]);

  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    setError('');
    setMsg('');
    if (!classId) {
      setError('Select a class');
      return;
    }
    try {
      const { data } = await axios.post(`${process.env.REACT_APP_BASE_URL || ''}/FeeInvoices/Generate`, {
        schoolId, classId, month,
      });
      setMsg(`Created ${data.created} invoices (₹${data.totalPerStudent} each). Skipped ${data.skipped} existing.`);
      await load();
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    }
  };

  const markPaid = async (id) => {
    await axios.put(`${process.env.REACT_APP_BASE_URL || ''}/FeeInvoices/${id}/Paid`, {});
    await load();
  };

  return (
    <Box>
      <Typography variant="h1" sx={{ fontWeight: 800, mb: 1 }}>Fee invoices</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Generate invoices from active Fee Heads for a class/month. Configure heads under Fee Heads first.
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {msg && <Alert severity="success" sx={{ mb: 2 }}>{msg}</Alert>}
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 3 }}>
        <TextField select size="small" label="Class" value={classId} onChange={(e) => setClassId(e.target.value)} sx={{ minWidth: 180 }}>
          {(sclassesList || []).map((c) => (
            <MenuItem key={c._id} value={c._id}>{c.sclassName}</MenuItem>
          ))}
        </TextField>
        <TextField size="small" label="Month (YYYY-MM)" value={month} onChange={(e) => setMonth(e.target.value)} />
        <Button variant="contained" onClick={generate}>Generate from fee heads</Button>
        <Button variant="outlined" onClick={load}>Refresh</Button>
      </Stack>
      {loading ? <CircularProgress /> : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Student</TableCell>
                <TableCell>Month</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell align="right">Paid</TableCell>
                <TableCell>Status</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r._id}>
                  <TableCell>{r.student?.name} (#{r.student?.rollNum})</TableCell>
                  <TableCell>{r.month}</TableCell>
                  <TableCell align="right">₹{r.total}</TableCell>
                  <TableCell align="right">₹{r.paidAmount}</TableCell>
                  <TableCell><Chip size="small" label={r.status} /></TableCell>
                  <TableCell>
                    {r.status !== 'Paid' && (
                      <Button size="small" onClick={() => markPaid(r._id)}>Mark paid</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!rows.length && <TableRow><TableCell colSpan={6}>No invoices for this filter.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default FeeInvoicesPage;
