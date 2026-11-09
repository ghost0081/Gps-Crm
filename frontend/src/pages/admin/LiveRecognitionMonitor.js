import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Paper, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, IconButton, Tooltip,
  CircularProgress, Grid, Card, CardContent, TextField, MenuItem,
  Select, FormControl, InputLabel, Switch, FormControlLabel, Badge
} from '@mui/material';
import FaceIcon from '@mui/icons-material/Face';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import GroupsIcon from '@mui/icons-material/Groups';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import { useSelector } from 'react-redux';
import axios from 'axios';

const LiveRecognitionMonitor = () => {
  const { currentUser } = useSelector(state => state.user);
  const schoolId = (currentUser?.role === 'Admin' || currentUser?.role === 'FrontDesk')
    ? currentUser._id
    : (currentUser?.school?._id || currentUser?.school || currentUser?._id);

  const [stats, setStats] = useState({ totalIn: 0, totalOut: 0, onCampus: 0 });
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [directionFilter, setDirectionFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const timerRef = useRef(null);

  const fetchData = useCallback(async () => {
    if (!schoolId) return;
    try {
      const [statsRes, logsRes] = await Promise.all([
        axios.get(`${process.env.REACT_APP_BASE_URL || ''}/api/attendance/gate-stats/${schoolId}`),
        axios.get(`${process.env.REACT_APP_BASE_URL || ''}/api/attendance/gate-logs/${schoolId}?limit=50${directionFilter !== 'ALL' ? `&direction=${directionFilter}` : ''}`),
      ]);

      setStats(statsRes.data);
      setLogs(logsRes.data.logs || []);
    } catch (err) {
      console.error('Error fetching live attendance data:', err);
    } finally {
      setLoading(false);
    }
  }, [schoolId, directionFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh interval (every 5 seconds)
  useEffect(() => {
    if (autoRefresh) {
      timerRef.current = setInterval(() => {
        fetchData();
      }, 5000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoRefresh, fetchData]);

  const filteredLogs = logs.filter(log => {
    const studentName = log.student?.name?.toLowerCase() || '';
    const rollNum = String(log.student?.rollNum || '');
    const query = searchQuery.toLowerCase();
    return studentName.includes(query) || rollNum.includes(query);
  });

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <FaceIcon fontSize="large" /> Live Gate Attendance Monitor
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Real-time AI face recognition feed from campus gates, entry turnstiles, and CCTV cameras.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                color="success"
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <FiberManualRecordIcon
                  sx={{
                    color: autoRefresh ? '#10b981' : 'text.disabled',
                    fontSize: 12,
                    animation: autoRefresh ? 'pulse 1.5s infinite' : 'none',
                  }}
                />
                <Typography variant="caption" fontWeight={600}>
                  {autoRefresh ? 'Live Auto-Polling (5s)' : 'Paused'}
                </Typography>
              </Box>
            }
          />
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchData}>
            Refresh Now
          </Button>
        </Box>
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={2.5} sx={{ mb: 3.5 }}>
        <Grid item xs={12} sm={4}>
          <Card elevation={2} sx={{ borderRadius: 3, borderLeft: '5px solid #10b981', backgroundColor: '#f0fdf4' }}>
            <CardContent sx={{ py: 2.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>TOTAL ARRIVALS TODAY</Typography>
                  <Typography variant="h3" sx={{ fontWeight: 800, color: '#047857', my: 0.5 }}>
                    {stats.totalIn}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">Students verified via Entrance CCTV</Typography>
                </Box>
                <ArrowDownwardIcon sx={{ fontSize: 44, color: '#10b981', opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card elevation={2} sx={{ borderRadius: 3, borderLeft: '5px solid #f59e0b', backgroundColor: '#fffbeb' }}>
            <CardContent sx={{ py: 2.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>TOTAL DEPARTURES TODAY</Typography>
                  <Typography variant="h3" sx={{ fontWeight: 800, color: '#b45309', my: 0.5 }}>
                    {stats.totalOut}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">Students verified via Exit CCTV</Typography>
                </Box>
                <ArrowUpwardIcon sx={{ fontSize: 44, color: '#f59e0b', opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card elevation={2} sx={{ borderRadius: 3, borderLeft: '5px solid #3b82f6', backgroundColor: '#eff6ff' }}>
            <CardContent sx={{ py: 2.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>CURRENTLY ON CAMPUS</Typography>
                  <Typography variant="h3" sx={{ fontWeight: 800, color: '#1d4ed8', my: 0.5 }}>
                    {stats.onCampus}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">Estimated active headcount</Typography>
                </Box>
                <GroupsIcon sx={{ fontSize: 44, color: '#3b82f6', opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filter Toolbar */}
      <Paper elevation={1} sx={{ p: 2, mb: 3, borderRadius: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Search by student name or roll..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{ minWidth: 260 }}
        />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Filter Direction</InputLabel>
          <Select
            value={directionFilter}
            label="Filter Direction"
            onChange={(e) => setDirectionFilter(e.target.value)}
          >
            <MenuItem value="ALL">All Directions</MenuItem>
            <MenuItem value="IN">Only IN (Arrivals)</MenuItem>
            <MenuItem value="OUT">Only OUT (Departures)</MenuItem>
          </Select>
        </FormControl>
        <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
          Showing <b>{filteredLogs.length}</b> live recognition events
        </Typography>
      </Paper>

      {/* Live Activity Table */}
      <Paper elevation={2} sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead sx={{ backgroundColor: 'action.hover' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Time</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Student</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Class</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Direction</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Camera / Gate</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>AI Match Confidence</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={36} />
                  </TableCell>
                </TableRow>
              ) : filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary">No gate attendance records found for today.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => {
                  const isArrival = log.direction === 'IN';
                  const dateObj = new Date(log.timestamp);
                  const timeFormatted = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  const confidencePct = Math.round((log.confidence || 0.9) * 100);

                  return (
                    <TableRow key={log._id} hover>
                      <TableCell sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AccessTimeIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                        {timeFormatted}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Box
                            sx={{
                              width: 34,
                              height: 34,
                              borderRadius: '50%',
                              backgroundColor: isArrival ? '#dcfce7' : '#fef3c7',
                              color: isArrival ? '#15803d' : '#b45309',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: 14,
                            }}
                          >
                            {log.student?.name?.[0]?.toUpperCase() || 'S'}
                          </Box>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              {log.student?.name || 'Unknown Student'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Roll: {log.student?.rollNum || 'N/A'}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        {log.student?.sclassName?.sclassName || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={isArrival ? <ArrowDownwardIcon /> : <ArrowUpwardIcon />}
                          label={log.direction}
                          size="small"
                          color={isArrival ? 'success' : 'warning'}
                          sx={{ fontWeight: 800, borderRadius: 2 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {log.cameraName || 'Entrance Camera'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {log.location || 'Campus Gate'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={`${confidencePct}% Match`}
                          size="small"
                          color={confidencePct >= 80 ? 'primary' : 'default'}
                          variant="outlined"
                          sx={{ fontWeight: 700 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={log.status || 'Present'}
                          size="small"
                          color={log.status === 'Late' ? 'error' : 'success'}
                          variant="filled"
                          sx={{ fontWeight: 700 }}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default LiveRecognitionMonitor;
