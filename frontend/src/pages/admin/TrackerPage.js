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
    MenuItem
} from '@mui/material';
import axios from 'axios';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import RefreshIcon from '@mui/icons-material/Refresh';
import MapIcon from '@mui/icons-material/Map';
import CellTowerIcon from '@mui/icons-material/CellTower';

const TrackerPage = () => {
    const [devices, setDevices] = useState([]);
    const [selectedDevice, setSelectedDevice] = useState('student_device_001');
    const [customDevice, setCustomDevice] = useState('');
    const [isCustomMode, setIsCustomMode] = useState(false);
    
    const [loading, setLoading] = useState(false);
    const [trackerData, setTrackerData] = useState(null);
    const [error, setError] = useState(null);

    const mapRef = useRef(null);
    const markerRef = useRef(null);
    const polylineRef = useRef(null);
    const mapContainerRef = useRef(null);
    const pathHistoryRef = useRef([]);

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

    // Initial load and periodic polling
    useEffect(() => {
        fetchDevices();
        const interval = setInterval(fetchDevices, 10000); // Refresh devices list every 10s
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Set up polling for selected device details
    useEffect(() => {
        const deviceToFetch = isCustomMode ? customDevice : selectedDevice;
        if (!deviceToFetch) return;

        fetchTrackingData(deviceToFetch);
        const interval = setInterval(() => {
            fetchTrackingData(deviceToFetch);
        }, 5000); // poll telemetry details every 5 seconds

        // Reset path history on device change
        pathHistoryRef.current = [];
        if (polylineRef.current) {
            polylineRef.current.setLatLngs([]);
        }

        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedDevice, customDevice, isCustomMode]);

    // Initialize Leaflet Map
    useEffect(() => {
        if (!window.L || !mapContainerRef.current) return;

        if (!mapRef.current) {
            // Default center on India / Delhi coords
            mapRef.current = window.L.map(mapContainerRef.current).setView([28.6139, 77.2090], 13);
            
            window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(mapRef.current);

            polylineRef.current = window.L.polyline([], {
                color: '#7B61FF',
                weight: 4,
                opacity: 0.8
            }).addTo(mapRef.current);
        }

        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
                markerRef.current = null;
                polylineRef.current = null;
            }
        };
    }, []);

    // Handle map updates when new coordinates arrive
    useEffect(() => {
        if (!window.L || !mapRef.current || !trackerData?.latitude) return;

        const lat = parseFloat(trackerData.latitude);
        const lng = parseFloat(trackerData.longitude);
        
        // Skip invalid/zero coordinates
        if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return;

        const latlng = [lat, lng];

        // Center map view on new coordinate
        mapRef.current.setView(latlng, mapRef.current.getZoom() || 15);

        // Update or create device marker
        if (!markerRef.current) {
            const studentIcon = window.L.divIcon({
                html: `<div style="background-color: #7B61FF; width: 18px; height: 18px; border-radius: 50%; border: 3px solid #FFFFFF; box-shadow: 0 0 10px rgba(0,0,0,0.4);"></div>`,
                className: 'custom-student-marker',
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });

            markerRef.current = window.L.marker(latlng, { icon: studentIcon }).addTo(mapRef.current)
                .bindPopup(`<b>Device: ${trackerData.device_id}</b><br/>Time: ${formatDate(trackerData.last_updated)}`)
                .openPopup();
        } else {
            markerRef.current.setLatLng(latlng);
            markerRef.current.getPopup().setContent(`<b>Device: ${trackerData.device_id}</b><br/>Time: ${formatDate(trackerData.last_updated)}`);
        }

        // Use database path_history if available, otherwise append coordinate to polyline trail
        if (trackerData.path_history && trackerData.path_history.length > 0) {
            const fullTrail = trackerData.path_history.map(pt => [pt.lat, pt.lng]);
            pathHistoryRef.current = fullTrail;
            if (polylineRef.current) {
                polylineRef.current.setLatLngs(fullTrail);
            }
        } else {
            const history = pathHistoryRef.current;
            const lastCoord = history[history.length - 1];
            if (!lastCoord || lastCoord[0] !== lat || lastCoord[1] !== lng) {
                history.push(latlng);
                if (polylineRef.current) {
                    polylineRef.current.setLatLngs(history);
                }
            }
        }

    }, [trackerData]);

    // Format ISO string to readable localized date
    const formatDate = (isoString) => {
        if (!isoString) return 'Never';
        const date = new Date(isoString);
        return date.toLocaleString();
    };

    const activeDeviceId = isCustomMode ? customDevice : selectedDevice;

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
                            Live GPS telemetry from student wearables with GT06 binary protocol.
                        </Typography>
                    </Grid>
                    
                    <Grid item xs={12} md={7}>
                        <Box sx={{ display: 'flex', gap: 2, justifyContent: { md: 'flex-end', xs: 'flex-start' }, flexWrap: 'wrap' }}>
                            {!isCustomMode ? (
                                <FormControl sx={{ minWidth: 200 }} size="small">
                                    <InputLabel id="select-device-label">Select Active Wearable</InputLabel>
                                    <Select
                                        labelId="select-device-label"
                                        value={selectedDevice}
                                        label="Select Active Wearable"
                                        onChange={(e) => setSelectedDevice(e.target.value)}
                                    >
                                        {devices.length === 0 ? (
                                            <MenuItem value="student_device_001">student_device_001 (Default)</MenuItem>
                                        ) : (
                                            devices.map((dev) => (
                                                <MenuItem key={dev} value={dev}>{dev}</MenuItem>
                                            ))
                                        )}
                                    </Select>
                                </FormControl>
                            ) : (
                                <TextField
                                    label="Custom Device ID"
                                    size="small"
                                    value={customDevice}
                                    onChange={(e) => setCustomDevice(e.target.value)}
                                    sx={{ minWidth: 200 }}
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
                                }}
                            >
                                Refresh
                            </Button>
                        </Box>
                    </Grid>
                </Grid>
            </Paper>

            {error && (
                <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>
            )}

            <Grid container spacing={3}>
                {/* Map Panel */}
                <Grid item xs={12} lg={8}>
                    <Paper sx={{ p: 2, borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', height: '100%' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, alignItems: 'center' }}>
                            <Typography variant="h6" fontWeight="600" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <MapIcon color="action" /> Live Location Map
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
                                            backgroundColor: (() => {
                                                const isRecent = trackerData?.last_updated && (new Date().getTime() - new Date(trackerData.last_updated).getTime() <= 2 * 60 * 1000);
                                                return (trackerData?.status === 'Online' && isRecent) ? '#E8F5E9' : '#FFEBEE';
                                            })(),
                                            color: (() => {
                                                const isRecent = trackerData?.last_updated && (new Date().getTime() - new Date(trackerData.last_updated).getTime() <= 2 * 60 * 1000);
                                                return (trackerData?.status === 'Online' && isRecent) ? '#2E7D32' : '#C62828';
                                            })(),
                                            fontWeight: '700',
                                            fontSize: '0.75rem'
                                        }}>
                                            {(() => {
                                                const isRecent = trackerData?.last_updated && (new Date().getTime() - new Date(trackerData.last_updated).getTime() <= 2 * 60 * 1000);
                                                return (trackerData?.status === 'Online' && isRecent) ? 'Online' : 'Offline';
                                            })()}
                                        </Box>
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
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                        <Typography variant="body2" color="text.secondary">Speed:</Typography>
                                        <Typography variant="body2" fontWeight="500">
                                            {trackerData?.speed !== undefined ? `${trackerData.speed} km/h` : '0 km/h'}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                                        <Typography variant="body2" color="text.secondary">Course / Heading:</Typography>
                                        <Typography variant="body2" fontWeight="500">
                                            {trackerData?.course !== undefined ? `${trackerData.course}°` : '0°'}
                                        </Typography>
                                    </Box>

                                    <Divider sx={{ my: 1.5 }} />

                                    <Typography variant="caption" color="text.secondary">
                                        Live telemetry streamed from hardware ({trackerData?.deviceType || 'GT06'}) over TCP 5023 / HTTP 5000.
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                </Grid>
            </Grid>
        </Container>
    );
};

export default TrackerPage;
