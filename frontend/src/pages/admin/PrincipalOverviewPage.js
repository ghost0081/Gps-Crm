import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Box, Typography, Paper, Grid, CircularProgress, Alert, Chip } from '@mui/material';
import axios from 'axios';

const Stat = ({ label, value }) => (
  <Paper sx={{ p: 2, borderRadius: 2, height: '100%' }}>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography variant="h4" sx={{ fontWeight: 800 }}>{value}</Typography>
  </Paper>
);

const PrincipalOverviewPage = () => {
  const { currentUser } = useSelector((s) => s.user);
  const schoolId = currentUser?._id;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      setLoading(true);
      try {
        const { data: d } = await axios.get(`${process.env.REACT_APP_BASE_URL || ''}/Principal/Overview`, {
          params: { schoolId },
        });
        setData(d);
      } catch (e) {
        setError(e.response?.data?.message || e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [schoolId]);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Typography variant="h1" sx={{ fontWeight: 800, mb: 1 }}>Principal overview</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Oversight dashboard — not unrestricted access to welfare or payroll detail.
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {data && (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6} md={2.4}><Stat label="Students" value={data.totals.students} /></Grid>
            <Grid item xs={6} md={2.4}><Stat label="Teachers" value={data.totals.teachers} /></Grid>
            <Grid item xs={6} md={2.4}><Stat label="Open pickups (24h)" value={data.totals.openPickups} /></Grid>
            <Grid item xs={6} md={2.4}><Stat label="Pending leave" value={data.totals.pendingLeaves} /></Grid>
            <Grid item xs={6} md={2.4}><Stat label="Unpaid invoices" value={data.totals.unpaidInvoices} /></Grid>
          </Grid>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Recent pickups</Typography>
          {(data.recentPickups || []).map((p) => (
            <Paper key={p._id || `${p.studentName}-${p.arrivalTime}`} sx={{ p: 1.5, mb: 1, display: 'flex', gap: 2, alignItems: 'center' }}>
              <Box sx={{ flex: 1 }}>
                <Typography fontWeight={700}>{p.studentName}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {p.parentName} · Teacher {p.teacherName || '—'}
                </Typography>
              </Box>
              <Chip size="small" label={p.status} />
            </Paper>
          ))}
          {!data.recentPickups?.length && <Typography color="text.secondary">No recent pickups.</Typography>}
        </>
      )}
    </Box>
  );
};

export default PrincipalOverviewPage;
