import React, { useState, useEffect, useRef } from 'react';
import {
    Container,
    Grid,
    Paper,
    Box,
    Typography,
    TextField,
    Button,
    Card,
    CardContent,
    CircularProgress,
    Divider,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Tab,
    Tabs,
    IconButton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip
} from '@mui/material';
import axios from 'axios';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import RefreshIcon from '@mui/icons-material/Refresh';
import MapIcon from '@mui/icons-material/Map';
import CellTowerIcon from '@mui/icons-material/CellTower';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import HistoryIcon from '@mui/icons-material/History';
import ReplayIcon from '@mui/icons-material/Replay';

const TrackerPage = () => {
    const [devices, setDevices] = useState([]);
    const [selectedDevice, setSelectedDevice] = useState('student_device_001');
    const [customDevice, setCustomDevice] = useState('');
    const [isCustomMode, setIsCustomMode] = useState(false);
    
    const [viewTab, setViewTab] = useState(0); // 0: Live Tracking, 1: Route Playback
    const [loading, setLoading] = useState(false);
    const [trackerData, setTrackerData] = useState(null);
    const [error, setError] = useState(null);

    // Playback state
    const [playbackDate, setPlaybackDate] = useState(new Date().toISOString().split('T')[0]);
    const [playbackPoints, setPlaybackPoints] = useState([]);
    const [playbackMeta, setPlaybackMeta] = useState({ count: 0, distance: 0 });
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackIndex, setPlaybackIndex] = useState(0);
    const [playbackSpeed, setPlaybackSpeed] = useState(1); // 1x, 2x, 4x
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Refs
    const mapRef = useRef(null);
    const markerRef = useRef(null);
    const mapContainerRef = useRef(null);

    const playbackMapRef = useRef(null);
    const playbackMarkerRef = useRef(null);
    const playbackPolylineRef = useRef(null);
    const playbackStartMarkerRef = useRef(null);
    const playbackEndMarkerRef = useRef(null);
    const playbackContainerRef = useRef(null);
    const animationTimerRef = useRef(null);

    const activeDeviceId = isCustomMode ? customDevice : selectedDevice;

    // Fetch list of active devices in RAM
    const fetchDevices = async () => {
        try {
            const res = await axios.get(`${process.env.REACT_APP_BASE_URL}/api/tracker/devices`);
            setDevices(res.data || []);
            if (res.data && res.data.length > 0 && !isCustomMode) {
                if (!res.data.includes(selectedDevice)) {
                    setSelectedDevice(res.data[0]);
                }
            }
        } catch (err) {
            console.error("Error fetching device list:", err);
        }
    };

    // Fetch tracking data for the selected device
    const fetchTrackingData = async (deviceId) => {
        if (!deviceId) return;
        setLoading(true);
        try {
            const res = await axios.get(`${process.env.REACT_APP_BASE_URL}/api/admin/${deviceId}`);
            setTrackerData(res.data);
            setError(null);
        } catch (err) {
            console.error("Error fetching tracking data:", err);
            setError("Failed to fetch tracking data. Make sure backend is running.");
        } finally {
            setLoading(false);
        }
    };

    // Fetch date-filtered playback history
    const fetchHistoryData = async (deviceId, dateStr) => {
        if (!deviceId) return;
        setLoadingHistory(true);
        setIsPlaying(false);
        setPlaybackIndex(0);
        try {
            const res = await axios.get(`${process.env.REACT_APP_BASE_URL}/api/admin/history/${deviceId}?date=${dateStr}`);
            const points = res.data?.points || [];
            setPlaybackPoints(points);
            setPlaybackMeta({
                count: points.length,
                distance: res.data?.totalDistanceMeters || 0
            });
        } catch (err) {
            console.error("Error fetching history data:", err);
        } finally {
            setLoadingHistory(false);
        }
    };

    // Initial load and periodic polling
    useEffect(() => {
        fetchDevices();
        const interval = setInterval(fetchDevices, 10000);
        return () => clearInterval(interval);
    }, []);

    // Set up polling for selected device details in Live Mode
    useEffect(() => {
        if (!activeDeviceId) return;

        fetchTrackingData(activeDeviceId);
        const interval = setInterval(() => {
            fetchTrackingData(activeDeviceId);
        }, 5000);

        return () => clearInterval(interval);
    }, [activeDeviceId]);

    // Fetch history whenever playback date or device changes
    useEffect(() => {
        if (viewTab === 1 && activeDeviceId) {
            fetchHistoryData(activeDeviceId, playbackDate);
        }
    }, [viewTab, activeDeviceId, playbackDate]);

    // Initialize Live Leaflet Map (CLEAN LIVE MAP: NO TRAIL LINES)
    useEffect(() => {
        if (viewTab !== 0 || !window.L || !mapContainerRef.current) return;

        if (!mapRef.current) {
            mapRef.current = window.L.map(mapContainerRef.current).setView([28.6139, 77.2090], 13);
            
            window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap'
            }).addTo(mapRef.current);
        }

        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
                markerRef.current = null;
            }
        };
    }, [viewTab]);

    // Handle live map updates when new coordinates arrive (ONLY MARKER PIN, NO LINES)
    useEffect(() => {
        if (viewTab !== 0 || !window.L || !mapRef.current || !trackerData?.latitude) return;

        const lat = parseFloat(trackerData.latitude);
        const lng = parseFloat(trackerData.longitude);
        
        if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return;

        const latlng = [lat, lng];
        mapRef.current.setView(latlng, mapRef.current.getZoom() || 15);

        const isCellTower = trackerData.locationType === 'CELL_TOWER';
        const iconHtml = isCellTower 
            ? `<div style="background-color: #D97706; width: 24px; height: 24px; border-radius: 50%; border: 3px solid #FFFFFF; box-shadow: 0 0 12px rgba(217, 119, 6, 0.6); display: flex; align-items: center; justify-content: center; color: white; font-size: 11px; font-weight: bold;">📡</div>`
            : `<div style="background-color: #7B61FF; width: 22px; height: 22px; border-radius: 50%; border: 3px solid #FFFFFF; box-shadow: 0 0 10px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; color: white; font-size: 10px;">🎒</div>`;

        const studentIcon = window.L.divIcon({
            html: iconHtml,
            className: 'custom-student-marker',
            iconSize: [28, 28],
            iconAnchor: [14, 14]
        });

        const popupContent = `
            <div style="font-family: sans-serif; padding: 4px; min-width: 180px;">
                <b>Device IMEI:</b> ${trackerData.imei || trackerData.device_id || activeDeviceId}<br/>
                <b>Source:</b> ${isCellTower ? '📡 Indoor Cell Tower LBS' : '🛰️ Satellite GPS Fix'}<br/>
                <b>Latitude:</b> ${lat.toFixed(6)}<br/>
                <b>Longitude:</b> ${lng.toFixed(6)}<br/>
                ${isCellTower ? `<b>Cell ID:</b> ${trackerData.cellId || 0} (LAC: ${trackerData.lac || 0})<br/>` : ''}
                <b>Last Fix:</b> ${formatDate(trackerData.last_updated)}
            </div>
        `;

        if (!markerRef.current) {
            markerRef.current = window.L.marker(latlng, { icon: studentIcon }).addTo(mapRef.current)
                .bindPopup(popupContent)
                .openPopup();
        } else {
            markerRef.current.setIcon(studentIcon);
            markerRef.current.setLatLng(latlng);
            markerRef.current.getPopup().setContent(popupContent);
        }
    }, [trackerData, viewTab, activeDeviceId]);

    // Initialize Route Playback Leaflet Map
    useEffect(() => {
        if (viewTab !== 1 || !window.L || !playbackContainerRef.current) return;

        if (!playbackMapRef.current) {
            playbackMapRef.current = window.L.map(playbackContainerRef.current).setView([28.6139, 77.2090], 13);
            
            window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap'
            }).addTo(playbackMapRef.current);

            playbackPolylineRef.current = window.L.polyline([], {
                color: '#2563EB',
                weight: 5,
                opacity: 0.8
            }).addTo(playbackMapRef.current);
        }

        return () => {
            if (playbackMapRef.current) {
                playbackMapRef.current.remove();
                playbackMapRef.current = null;
                playbackMarkerRef.current = null;
                playbackPolylineRef.current = null;
                playbackStartMarkerRef.current = null;
                playbackEndMarkerRef.current = null;
            }
        };
    }, [viewTab]);

    // Update Playback Map Route & Markers when history data arrives
    useEffect(() => {
        if (viewTab !== 1 || !window.L || !playbackMapRef.current) return;

        // Clear existing markers & polyline
        if (playbackPolylineRef.current) playbackPolylineRef.current.setLatLngs([]);
        if (playbackStartMarkerRef.current) { playbackMapRef.current.removeLayer(playbackStartMarkerRef.current); playbackStartMarkerRef.current = null; }
        if (playbackEndMarkerRef.current) { playbackMapRef.current.removeLayer(playbackEndMarkerRef.current); playbackEndMarkerRef.current = null; }
        if (playbackMarkerRef.current) { playbackMapRef.current.removeLayer(playbackMarkerRef.current); playbackMarkerRef.current = null; }

        if (!playbackPoints || playbackPoints.length === 0) return;

        const coords = playbackPoints.map(pt => [pt.lat, pt.lng]);
        playbackPolylineRef.current.setLatLngs(coords);
        playbackMapRef.current.fitBounds(playbackPolylineRef.current.getBounds(), { padding: [40, 40] });

        // Start Marker (🟢)
        const startIcon = window.L.divIcon({
            html: `<div style="background-color: #10B981; width: 22px; height: 22px; border-radius: 50%; border: 3px solid #FFF; color: white; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold;">🟢</div>`,
            className: 'start-marker',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });
        playbackStartMarkerRef.current = window.L.marker(coords[0], { icon: startIcon }).addTo(playbackMapRef.current)
            .bindPopup(`<b>Start Point</b><br/>Time: ${formatDate(playbackPoints[0].timestamp)}`);

        // End Marker (🔴)
        if (coords.length > 1) {
            const endIcon = window.L.divIcon({
                html: `<div style="background-color: #EF4444; width: 22px; height: 22px; border-radius: 50%; border: 3px solid #FFF; color: white; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold;">🔴</div>`,
                className: 'end-marker',
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });
            playbackEndMarkerRef.current = window.L.marker(coords[coords.length - 1], { icon: endIcon }).addTo(playbackMapRef.current)
                .bindPopup(`<b>End Point</b><br/>Time: ${formatDate(playbackPoints[playbackPoints.length - 1].timestamp)}`);
        }

        // Moving Animated Marker
        const carIcon = window.L.divIcon({
            html: `<div style="background-color: #3B82F6; width: 30px; height: 30px; border-radius: 50%; border: 3px solid #FFF; box-shadow: 0 0 12px rgba(59,130,246,0.7); display: flex; align-items: center; justify-content: center; font-size: 14px;">🎒</div>`,
            className: 'playback-moving-marker',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });

        const initialPoint = coords[playbackIndex] || coords[0];
        playbackMarkerRef.current = window.L.marker(initialPoint, { icon: carIcon }).addTo(playbackMapRef.current);

    }, [playbackPoints, viewTab]);

    // Handle Playback Animation Timer
    useEffect(() => {
        if (isPlaying && playbackPoints.length > 0) {
            const intervalMs = Math.max(200, 1000 / playbackSpeed);
            animationTimerRef.current = setInterval(() => {
                setPlaybackIndex(prev => {
                    if (prev >= playbackPoints.length - 1) {
                        setIsPlaying(false);
                        return prev;
                    }
                    return prev + 1;
                });
            }, intervalMs);
        } else {
            if (animationTimerRef.current) clearInterval(animationTimerRef.current);
        }

        return () => {
            if (animationTimerRef.current) clearInterval(animationTimerRef.current);
        };
    }, [isPlaying, playbackPoints, playbackSpeed]);

    // Update Moving Marker position when playbackIndex changes
    useEffect(() => {
        if (playbackPoints.length > 0 && playbackIndex < playbackPoints.length) {
            const pt = playbackPoints[playbackIndex];
            if (pt && pt.lat && pt.lng && playbackMarkerRef.current) {
                playbackMarkerRef.current.setLatLng([pt.lat, pt.lng]);
                if (isPlaying && playbackMapRef.current) {
                    playbackMapRef.current.panTo([pt.lat, pt.lng]);
                }
            }
        }
    }, [playbackIndex, playbackPoints, isPlaying]);

    // Format ISO string to readable localized date
    const formatDate = (isoString) => {
        if (!isoString) return 'Never';
        const date = new Date(isoString);
        return date.toLocaleString();
    };

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            {/* Header & Device Selection */}
            <Paper sx={{ p: 3, mb: 3, borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                <Grid container spacing={2} alignItems="center" justifyContent="space-between">
                    <Grid item xs={12} md={5}>
                        <Typography variant="h5" component="h2" fontWeight="700" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LocationOnIcon color="primary" /> Student Tracking System (GT06)
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Live GPS telemetry & historical route playback from student wearables.
                        </Typography>
                    </Grid>

                    <Grid item xs={12} md={7}>
                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', justifyContent: { xs: 'flex-start', md: 'flex-end' }, flexWrap: 'wrap' }}>
                            {!isCustomMode ? (
                                <FormControl size="small" sx={{ minWidth: 200 }}>
                                    <InputLabel>Select Active Wearable</InputLabel>
                                    <Select
                                        value={selectedDevice}
                                        label="Select Active Wearable"
                                        onChange={(e) => setSelectedDevice(e.target.value)}
                                    >
                                        {devices.map((id) => (
                                            <MenuItem key={id} value={id}>{id}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            ) : (
                                <TextField 
                                    size="small"
                                    label="Custom IMEI Number"
                                    value={customDevice}
                                    onChange={(e) => setCustomDevice(e.target.value)}
                                    placeholder="e.g. 864163085121037"
                                    sx={{ width: 200 }}
                                />
                            )}

                            <Button 
                                variant="outlined" 
                                size="small"
                                onClick={() => setIsCustomMode(!isCustomMode)}
                            >
                                {isCustomMode ? "Select Active" : "Input Custom ID"}
                            </Button>

                            <Button 
                                variant="contained"
                                size="small"
                                startIcon={<RefreshIcon />}
                                onClick={() => {
                                    fetchDevices();
                                    fetchTrackingData(activeDeviceId);
                                    if (viewTab === 1) fetchHistoryData(activeDeviceId, playbackDate);
                                }}
                            >
                                Refresh
                            </Button>
                        </Box>
                    </Grid>
                </Grid>

                {/* View Tabs: Live Location vs Route Playback */}
                <Box sx={{ borderBottom: 1, borderColor: 'divider', mt: 2 }}>
                    <Tabs value={viewTab} onChange={(e, val) => setViewTab(val)} indicatorColor="primary" textColor="primary">
                        <Tab icon={<LocationOnIcon />} iconPosition="start" label="Live Location Map (No Lines)" />
                        <Tab icon={<HistoryIcon />} iconPosition="start" label="📜 Route History Playback" />
                    </Tabs>
                </Box>
            </Paper>

            {error && (
                <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>
            )}

            {/* TAB 0: CLEAN LIVE LOCATION MAP */}
            {viewTab === 0 && (
                <Grid container spacing={3}>
                    {/* Map Panel */}
                    <Grid item xs={12} lg={8}>
                        <Paper sx={{ p: 2, borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', height: '100%' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, alignItems: 'center' }}>
                                <Typography variant="h6" fontWeight="600" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <MapIcon color="action" /> Live Location Map (Pin Marker Only)
                                </Typography>
                                {loading && <CircularProgress size={20} />}
                            </Box>
                            
                            {/* Map Canvas */}
                            <Box 
                                ref={mapContainerRef} 
                                id="map" 
                                sx={{ 
                                    height: '480px', 
                                    width: '100%', 
                                    borderRadius: '12px',
                                    border: '1px solid #EEEEEE',
                                    zIndex: 1 
                                }} 
                            />
                        </Paper>
                    </Grid>

                    {/* Telemetry Metrics Panel */}
                    <Grid item xs={12} lg={4}>
                        <Grid container spacing={3}>
                            {/* GPS details card */}
                            <Grid item xs={12}>
                                <Card sx={{ borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                                    <CardContent sx={{ p: 3 }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                            <Typography variant="h6" fontWeight="600" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <LocationOnIcon color="primary" /> Location Telemetry
                                            </Typography>
                                        </Box>
                                        
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                            <Typography variant="body2" color="text.secondary">Latitude:</Typography>
                                            <Typography variant="body2" fontWeight="500">
                                                {trackerData?.latitude ? parseFloat(trackerData.latitude).toFixed(6) : "0.000000"}
                                            </Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                                            <Typography variant="body2" color="text.secondary">Longitude:</Typography>
                                            <Typography variant="body2" fontWeight="500">
                                                {trackerData?.longitude ? parseFloat(trackerData.longitude).toFixed(6) : "0.000000"}
                                            </Typography>
                                        </Box>

                                        <Divider sx={{ my: 1.5 }} />

                                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <Typography variant="caption" color="text.secondary">Last Updated:</Typography>
                                            <Typography variant="caption" fontWeight="500">
                                                {formatDate(trackerData?.last_updated)}
                                            </Typography>
                                        </Box>
                                    </CardContent>
                                </Card>
                            </Grid>

                            {/* Wearable Info card */}
                            <Grid item xs={12}>
                                <Card sx={{ borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                                    <CardContent sx={{ p: 3 }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                            <Typography variant="h6" fontWeight="600" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <CellTowerIcon color="primary" /> Hardware State
                                            </Typography>
                                            <Box sx={{
                                                px: 1.5,
                                                py: 0.5,
                                                borderRadius: '12px',
                                                backgroundColor: trackerData?.status === 'Online' ? '#E8F5E9' : '#FFEBEE',
                                                color: trackerData?.status === 'Online' ? '#2E7D32' : '#C62828',
                                                fontWeight: '700',
                                                fontSize: '0.75rem'
                                            }}>
                                                {trackerData?.status || 'Offline'}
                                            </Box>
                                        </Box>

                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                            <Typography variant="body2" color="text.secondary">Location Source:</Typography>
                                            <Typography variant="body2" fontWeight="700" sx={{
                                                color: trackerData?.locationType === 'CELL_TOWER' ? '#D97706' : '#2E7D32'
                                            }}>
                                                {trackerData?.locationType === 'CELL_TOWER' 
                                                    ? `📡 LBS Cell Tower Fix` 
                                                    : '🛰️ Satellite GPS Fix'}
                                            </Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                            <Typography variant="body2" color="text.secondary">LAC (Location Area Code):</Typography>
                                            <Typography variant="body2" fontWeight="600">
                                                {trackerData?.lac !== undefined ? `${trackerData.lac} (0x${(trackerData.lac || 0).toString(16).toUpperCase()})` : '0 (0x0000)'}
                                            </Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                            <Typography variant="body2" color="text.secondary">Cell ID (Tower ID):</Typography>
                                            <Typography variant="body2" fontWeight="600">
                                                {trackerData?.cellId !== undefined ? `${trackerData.cellId} (MCC:${trackerData.mcc || 404} MNC:${trackerData.mnc || 11})` : '0'}
                                            </Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                            <Typography variant="body2" color="text.secondary">Hardware Protocol Type:</Typography>
                                            <Typography variant="body2" fontWeight="700" color="primary">
                                                {trackerData?.deviceType || 'GT06'}
                                            </Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                            <Typography variant="body2" color="text.secondary">Battery Level:</Typography>
                                            <Typography variant="body2" fontWeight="600" sx={{
                                                color: (trackerData?.battery ?? 0) > 25 ? '#2E7D32' : '#C62828'
                                            }}>
                                                {trackerData?.battery !== undefined ? `${trackerData.battery}%` : '100%'}
                                                {trackerData?.batteryMv ? ` (${trackerData.batteryMv} mV)` : ''}
                                            </Typography>
                                        </Box>
                                    </CardContent>
                                </Card>
                            </Grid>
                        </Grid>
                    </Grid>
                </Grid>
            )}

            {/* TAB 1: DEDICATED ROUTE HISTORY PLAYBACK */}
            {viewTab === 1 && (
                <Grid container spacing={3}>
                    {/* Playback Controls & Map */}
                    <Grid item xs={12} lg={8}>
                        <Paper sx={{ p: 3, borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <Typography variant="h6" fontWeight="600" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <HistoryIcon color="primary" /> Route History Playback
                                    </Typography>
                                    <TextField 
                                        type="date"
                                        size="small"
                                        label="Select Date"
                                        value={playbackDate}
                                        onChange={(e) => setPlaybackDate(e.target.value)}
                                        InputLabelProps={{ shrink: true }}
                                    />
                                </Box>

                                {/* Animation Control Buttons */}
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <IconButton 
                                        color="primary" 
                                        onClick={() => setIsPlaying(!isPlaying)}
                                        disabled={playbackPoints.length === 0}
                                        sx={{ backgroundColor: '#EFF6FF' }}
                                    >
                                        {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
                                    </IconButton>
                                    <IconButton 
                                        onClick={() => { setPlaybackIndex(0); setIsPlaying(false); }}
                                        disabled={playbackPoints.length === 0}
                                    >
                                        <ReplayIcon />
                                    </IconButton>
                                    <Button 
                                        size="small" 
                                        variant={playbackSpeed === 1 ? 'contained' : 'outlined'}
                                        onClick={() => setPlaybackSpeed(1)}
                                    >1x</Button>
                                    <Button 
                                        size="small" 
                                        variant={playbackSpeed === 2 ? 'contained' : 'outlined'}
                                        onClick={() => setPlaybackSpeed(2)}
                                    >2x</Button>
                                    <Button 
                                        size="small" 
                                        variant={playbackSpeed === 4 ? 'contained' : 'outlined'}
                                        onClick={() => setPlaybackSpeed(4)}
                                    >4x</Button>
                                </Box>
                            </Box>

                            {/* Playback Map Canvas */}
                            <Box 
                                ref={playbackContainerRef} 
                                id="playbackMap" 
                                sx={{ 
                                    height: '460px', 
                                    width: '100%', 
                                    borderRadius: '12px',
                                    border: '1px solid #EEEEEE',
                                    zIndex: 1 
                                }} 
                            />
                        </Paper>
                    </Grid>

                    {/* Playback Statistics & Checkpoint Table */}
                    <Grid item xs={12} lg={4}>
                        <Grid container spacing={3}>
                            {/* Summary Card */}
                            <Grid item xs={12}>
                                <Card sx={{ borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                                    <CardContent sx={{ p: 3 }}>
                                        <Typography variant="h6" fontWeight="600" sx={{ mb: 2 }}>
                                            📊 Trajectory Summary ({playbackDate})
                                        </Typography>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                            <Typography variant="body2" color="text.secondary">Recorded Points:</Typography>
                                            <Typography variant="body2" fontWeight="700">{playbackMeta.count}</Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                            <Typography variant="body2" color="text.secondary">Estimated Distance:</Typography>
                                            <Typography variant="body2" fontWeight="700" color="primary">
                                                {(playbackMeta.distance / 1000).toFixed(2)} km ({playbackMeta.distance} m)
                                            </Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                            <Typography variant="body2" color="text.secondary">Current Checkpoint:</Typography>
                                            <Typography variant="body2" fontWeight="700">
                                                {playbackIndex + 1} of {playbackPoints.length}
                                            </Typography>
                                        </Box>
                                    </CardContent>
                                </Card>
                            </Grid>

                            {/* Checkpoints List */}
                            <Grid item xs={12}>
                                <Card sx={{ borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                                    <CardContent sx={{ p: 2 }}>
                                        <Typography variant="subtitle2" fontWeight="700" sx={{ mb: 1.5 }}>
                                            📍 Checkpoint Timeline ({playbackPoints.length})
                                        </Typography>
                                        <TableContainer sx={{ maxHeight: 300 }}>
                                            <Table size="small" stickyHeader>
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell>Time</TableCell>
                                                        <TableCell>Lat, Lng</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {playbackPoints.map((pt, idx) => (
                                                        <TableRow 
                                                            key={pt._id || idx}
                                                            selected={idx === playbackIndex}
                                                            onClick={() => { setPlaybackIndex(idx); setIsPlaying(false); }}
                                                            sx={{ cursor: 'pointer' }}
                                                        >
                                                            <TableCell sx={{ fontSize: '0.75rem' }}>
                                                                {new Date(pt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                            </TableCell>
                                                            <TableCell sx={{ fontSize: '0.75rem' }}>
                                                                {pt.lat.toFixed(4)}, {pt.lng.toFixed(4)}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                    {playbackPoints.length === 0 && (
                                                        <TableRow>
                                                            <TableCell colSpan={2} align="center">
                                                                No route history recorded for this date.
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </TableContainer>
                                    </CardContent>
                                </Card>
                            </Grid>
                        </Grid>
                    </Grid>
                </Grid>
            )}
        </Container>
    );
};

export default TrackerPage;
