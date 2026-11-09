import React, { useState, useEffect, useRef } from 'react';
import {
    Container,
    Grid,
    Paper,
    Box,
    Typography,
    Card,
    CardContent,
    CircularProgress,
    Divider,
    Button,
    Slider,
    Alert,
    Chip,
    Snackbar
} from '@mui/material';
import axios from 'axios';
import { ensureMaps, mapsApi } from '../../utils/googleMaps';
import { useSelector } from 'react-redux';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import RefreshIcon from '@mui/icons-material/Refresh';
import MapIcon from '@mui/icons-material/Map';
import CellTowerIcon from '@mui/icons-material/CellTower';
import SecurityIcon from '@mui/icons-material/Security';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import SaveIcon from '@mui/icons-material/Save';

const ParentTracking = () => {
    const { currentUser } = useSelector(state => state.user);
    const [trackerData, setTrackerData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [mapEpoch, setMapEpoch] = useState(0);
    const [mapsError, setMapsError] = useState('');

    // Geofence State
    const [geofence, setGeofence] = useState({
        lat: 0,
        lng: 0,
        radius: 500,
        name: "Safe Zone",
        enabled: false
    });
    const [isEditingGeofence, setIsEditingGeofence] = useState(false);
    const [savingGeofence, setSavingGeofence] = useState(false);
    const [toastMsg, setToastMsg] = useState("");

    const mapRef = useRef(null);
    const markerRef = useRef(null);
    const polylineRef = useRef(null);
    const geofenceCircleRef = useRef(null);
    const cellCircleRef = useRef(null);
    const mapContainerRef = useRef(null);
    const pathHistoryRef = useRef([]);
    const lastMapPointRef = useRef(null);
    const seenFullChargeRef = useRef('');

    // Format ISO string to readable date
    const formatDate = (isoString) => {
        if (!isoString) return 'Unknown';
        try {
            return new Date(isoString).toLocaleString();
        } catch (e) {
            return isoString;
        }
    };

    // Haversine distance in meters between two coordinates
    const calculateDistanceMeters = (lat1, lon1, lat2, lon2) => {
        if (!lat1 || !lon1 || !lat2 || !lon2) return 999999;
        const R = 6371e3; // Earth radius in meters
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    const fetchTrackerData = async () => {
        if (!currentUser?.student) {
            setLoading(false);
            return;
        }
        
        try {
            const response = await axios.get(`${process.env.REACT_APP_BASE_URL}/api/admin/${currentUser.student}`);
            setTrackerData(response.data);
            if (response.data?.geofence && !isEditingGeofence) {
                setGeofence(response.data.geofence);
            }
            setError(null);
            setLoading(false);
        } catch (err) {
            console.error("Tracker API Error:", err);
            setError("Failed to fetch live wearable coordinates.");
            setLoading(false);
        }
    };

    useEffect(() => {
        let isMounted = true;
        fetchTrackerData();
        const intervalId = setInterval(() => {
            if (!isEditingGeofence) {
                fetchTrackerData();
            }
        }, 1000);

        return () => {
            isMounted = false;
            clearInterval(intervalId);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser, isEditingGeofence]);

    // Initialize the Google Map once the container is on screen
    useEffect(() => {
        if (loading || !mapContainerRef.current) return undefined;
        let cancelled = false;
        ensureMaps().then(() => {
            if (cancelled || !mapContainerRef.current || mapRef.current) return;
            mapRef.current = mapsApi().map(mapContainerRef.current, {
                center: [22.5, 79.0],
                zoom: 5
            });

            polylineRef.current = mapsApi().polyline([], {
                color: '#7B61FF',
                weight: 4,
                opacity: 0.85
            }).addTo(mapRef.current);

            mapRef.current.on('click', (e) => {
                setGeofence(prev => ({
                    ...prev,
                    lat: e.latlng.lat,
                    lng: e.latlng.lng,
                    enabled: true
                }));
            });
            setMapsError('');
            setMapEpoch((value) => value + 1);
            setTimeout(() => {
                if (mapRef.current) mapRef.current.invalidateSize();
            }, 300);
        }).catch(() => {
            if (!cancelled) setMapsError('Google Maps needs an API key in REACT_APP_GOOGLE_MAPS_API_KEY.');
        });
        return () => {
            cancelled = true;
        };
    }, [loading]);

    // Re-invalidate size whenever layout changes (banners appearing/disappearing)
    useEffect(() => {
        const timer = setTimeout(() => {
            if (mapRef.current) {
                mapRef.current.invalidateSize(true);
            }
        }, 200);
        return () => clearTimeout(timer);
    }, [isEditingGeofence, geofence, trackerData]);

    const clearCellOverlay = () => {
        if (cellCircleRef.current && mapRef.current) {
            mapRef.current.removeLayer(cellCircleRef.current);
            cellCircleRef.current = null;
        }
    };

    // Update map marker, polyline trail, and geofence circle when trackerData or geofence changes
    useEffect(() => {
        if (!mapsApi() || !mapRef.current || !trackerData) return;

        const lat = parseFloat(trackerData.latitude);
        const lng = parseFloat(trackerData.longitude);
        const hasFix = Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
        const isCell = trackerData.locationType === 'CELL_TOWER';
        const isBle = trackerData.locationType === 'BLE' || trackerData.deviceType === 'BLE_BEACON';

        if (!hasFix) {
            if (markerRef.current) {
                mapRef.current.removeLayer(markerRef.current);
                markerRef.current = null;
            }
            clearCellOverlay();
            return;
        }

        const latlng = [lat, lng];
        const previous = lastMapPointRef.current;
        const moved = !previous || previous[0] !== lat || previous[1] !== lng || previous[2] !== trackerData.locationType;
        if (moved && !isEditingGeofence) {
            const accuracy = Number(trackerData.accuracy) || 0;
            if (isCell && accuracy >= 80) {
                const pad = accuracy / 111320;
                mapRef.current.fitBounds([
                    [lat - pad, lng - pad],
                    [lat + pad, lng + pad]
                ], { padding: [28, 28], maxZoom: 16 });
            } else {
                mapRef.current.setView(latlng, Math.max(mapRef.current.getZoom() || 16, 16), { animate: true });
            }
            lastMapPointRef.current = [lat, lng, trackerData.locationType];
        }

        const markerColor = isBle ? '#2563EB' : (isCell ? '#D97706' : '#7B61FF');
        const sourceLabel = isBle ? 'Bluetooth' : (isCell ? 'Estimated Location (Cell ID)' : 'GPS');
        const accuracyText = isCell && Number(trackerData.accuracy) > 0
            ? `<br/>Uncertainty: about ${Math.round(Number(trackerData.accuracy))} m`
            : '';
        const studentIcon = mapsApi().divIcon({
            html: `<div style="background-color: ${markerColor}; width: 22px; height: 22px; border-radius: 50%; border: 3px solid #FFFFFF; box-shadow: 0 0 12px rgba(0,0,0,0.5);"></div>`,
            className: 'custom-student-marker',
            iconSize: [28, 28],
            iconAnchor: [14, 14]
        });
        const popup = `<b>${sourceLabel}</b><br/>IMEI: ${trackerData.imei || 'Assigned Device'}<br/>${lat.toFixed(6)}, ${lng.toFixed(6)}${accuracyText}<br/>Time: ${formatDate(trackerData.last_updated)}`;

        if (!markerRef.current) {
            markerRef.current = mapsApi().marker(latlng, { icon: studentIcon }).addTo(mapRef.current)
                .bindPopup(popup);
        } else {
            markerRef.current.setIcon(studentIcon);
            markerRef.current.setLatLng(latlng);
            markerRef.current.getPopup().setContent(popup);
        }

        clearCellOverlay();
        if (isCell && Number(trackerData.accuracy) > 0) {
            cellCircleRef.current = mapsApi().circle(latlng, {
                radius: Number(trackerData.accuracy),
                color: '#D97706',
                fillColor: '#F59E0B',
                fillOpacity: 0.16,
                weight: 2
            }).addTo(mapRef.current);
        }

        if (trackerData.path_history && trackerData.path_history.length > 0) {
            const fullTrail = trackerData.path_history
                .filter(pt => pt && pt.lat && pt.lng && pt.locationType !== 'CELL_TOWER' && pt.locationType !== 'BLE')
                .map(pt => [pt.lat, pt.lng]);
            pathHistoryRef.current = fullTrail;
            if (polylineRef.current) {
                polylineRef.current.setLatLngs(fullTrail);
            }
        } else if (!isCell && !isBle) {
            const history = pathHistoryRef.current;
            const lastCoord = history[history.length - 1];
            if (!lastCoord || lastCoord[0] !== lat || lastCoord[1] !== lng) {
                history.push(latlng);
                if (polylineRef.current) {
                    polylineRef.current.setLatLngs(history);
                }
            }
        }

        drawGeofenceCircle();
    }, [trackerData, geofence, isEditingGeofence, loading, mapEpoch]);

    const drawGeofenceCircle = () => {
        if (!mapsApi() || !mapRef.current) return;
        const hasZone = geofence && geofence.enabled && Number(geofence.lat) && Number(geofence.lng);
        if (!hasZone) {
            if (geofenceCircleRef.current) {
                geofenceCircleRef.current.remove();
                geofenceCircleRef.current = null;
            }
            return;
        }
        const center = [Number(geofence.lat), Number(geofence.lng)];
        const radius = Number(geofence.radius) || 500;
        if (!geofenceCircleRef.current) {
            geofenceCircleRef.current = mapsApi().circle(center, {
                radius,
                color: '#047857',
                fillColor: '#10B981',
                fillOpacity: 0.28,
                weight: 3
            }).addTo(mapRef.current);
        } else {
            geofenceCircleRef.current.setLatLng(center);
            geofenceCircleRef.current.setRadius(radius);
            geofenceCircleRef.current.setStyle({
                color: '#047857',
                fillColor: '#10B981',
                fillOpacity: 0.28,
                weight: 3
            });
        }
        if (isEditingGeofence) {
            mapRef.current.fitBounds(geofenceCircleRef.current.getBounds(), { padding: [28, 28], maxZoom: 17 });
        }
    };

    useEffect(() => {
        drawGeofenceCircle();
        // The circle follows the saved center and the radius the parent is setting.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [geofence, isEditingGeofence, loading]);

    // Save Geofence to DB
    const handleSaveGeofence = async () => {
        if (!currentUser?.student) return;
        const liveLat = parseFloat(trackerData?.latitude);
        const liveLng = parseFloat(trackerData?.longitude);
        const zone = {
            ...geofence,
            lat: Number.isFinite(liveLat) && liveLat !== 0 ? liveLat : geofence.lat,
            lng: Number.isFinite(liveLng) && liveLng !== 0 ? liveLng : geofence.lng,
            radius: Number(geofence.radius) || 500,
            enabled: true,
            name: geofence.name || 'Safe Zone'
        };
        if (!zone.lat || !zone.lng) {
            setToastMsg('Current location is not available yet.');
            return;
        }
        setGeofence(zone);
        setSavingGeofence(true);
        try {
            await axios.put(`${process.env.REACT_APP_BASE_URL}/api/student/${currentUser.student}/geofence`, zone);
            setIsEditingGeofence(false);
            setToastMsg("Safe Zone saved at the current location.");
        } catch (err) {
            console.error("Save Geofence Error:", err);
            setToastMsg("Failed to save safe zone.");
        } finally {
            setSavingGeofence(false);
        }
    };

    useEffect(() => {
        const stamp = trackerData?.lastFullChargeAt;
        if (!stamp || !currentUser?.student) return;
        const ageMs = Date.now() - new Date(stamp).getTime();
        if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > 12 * 60 * 60 * 1000) return;
        const storageKey = `fullChargeSeen:${currentUser.student}`;
        const seen = seenFullChargeRef.current || window.localStorage.getItem(storageKey);
        if (seen === stamp) return;
        seenFullChargeRef.current = stamp;
        window.localStorage.setItem(storageKey, stamp);
        const message = 'The tag is fully charged (100%). You can unplug the charger.';
        setToastMsg(message);
        if (typeof window.Notification === 'function') {
            const show = () => new window.Notification('Tag fully charged', { body: message });
            if (window.Notification.permission === 'granted') show();
            else if (window.Notification.permission !== 'denied') {
                window.Notification.requestPermission().then((permission) => {
                    if (permission === 'granted') show();
                });
            }
        }
    }, [trackerData?.lastFullChargeAt, currentUser?.student]);

    // Calculate distance and inside/outside status
    const isGeofenceActive = geofence?.enabled && geofence?.lat !== 0 && geofence?.lng !== 0;
    const currentDistance = isGeofenceActive && trackerData?.latitude
        ? calculateDistanceMeters(trackerData.latitude, trackerData.longitude, geofence.lat, geofence.lng)
        : null;
    const isInsideSafeZone = currentDistance !== null && currentDistance <= (geofence.radius || 500);

    if (!loading && (!trackerData || !trackerData.imei)) {
        return (
            <Container maxWidth="lg" sx={{ mt: 4 }}>
                <Paper sx={{ p: 4, borderRadius: '16px', border: '1px solid #EAEAEC' }}>
                    <Typography variant="h6" color="warning.main" sx={{ fontWeight: 'bold' }}>
                        No Hardware Wearable (BLE/GPS) Allotted Yet
                    </Typography>
                    <Typography variant="body1" sx={{ mt: 1, color: 'text.secondary' }}>
                        The school administrator has not yet allotted a physical hardware wearable tracker to your child. Once an IMEI / BLE wearable is assigned in the Admin panel, live GPS tracking and route history will appear here immediately.
                    </Typography>
                </Paper>
            </Container>
        );
    }

    return (
        <Container maxWidth="xl" sx={{ mt: 4, mb: 6, overflowX: 'hidden' }}>
            {/* Header Banner */}
            <Paper sx={{ p: 3, mb: 3, borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #EAEAEC' }}>
                <Grid container spacing={2} alignItems="center" justifyContent="space-between">
                    <Grid item xs={12} md={6}>
                        <Typography variant="h5" fontWeight="700" color="#1E1E1E">
                            Student Hardware Wearable Tracker (BLE/GPS)
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Live GPS telemetry and movement trail from your child's assigned wearable ID: <b>{trackerData?.imei || 'Loading...'}</b>
                        </Typography>
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                        <Box sx={{ display: 'flex', gap: 2, justifyContent: { md: 'flex-end', xs: 'flex-start' }, alignItems: 'center', flexWrap: 'wrap' }}>
                            {loading && <CircularProgress size={24} />}
                            
                            <Button 
                                variant={isEditingGeofence ? "outlined" : "contained"}
                                color={isEditingGeofence ? "warning" : "secondary"}
                                size="small"
                                startIcon={<SecurityIcon />}
                                onClick={() => {
                                    if (!isEditingGeofence) {
                                        const liveLat = parseFloat(trackerData?.latitude);
                                        const liveLng = parseFloat(trackerData?.longitude);
                                        setGeofence({
                                            ...geofence,
                                            lat: Number.isFinite(liveLat) && liveLat !== 0 ? liveLat : geofence.lat,
                                            lng: Number.isFinite(liveLng) && liveLng !== 0 ? liveLng : geofence.lng,
                                            radius: geofence.radius || 500,
                                            name: geofence.name || 'Safe Zone',
                                            enabled: true
                                        });
                                    }
                                    setIsEditingGeofence(!isEditingGeofence);
                                }}
                            >
                                {isEditingGeofence ? "Cancel Editing" : "📍 Set Safe Zone (Geo-Fence)"}
                            </Button>

                            <Button 
                                variant="contained"
                                size="small"
                                startIcon={<RefreshIcon />}
                                onClick={fetchTrackerData}
                            >
                                Refresh Live Data
                            </Button>
                        </Box>
                    </Grid>
                </Grid>
            </Paper>

            <Paper sx={{
                p: 2.5,
                mb: 3,
                borderRadius: '16px',
                bgcolor: trackerData?.charging === true ? '#E3F2FD' : '#F8FAFC',
                border: '1px solid',
                borderColor: trackerData?.charging === true ? '#64B5F6' : '#E2E8F0'
            }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                    <Box>
                        <Typography variant="subtitle1" fontWeight="800" color={trackerData?.charging === true ? '#1565C0' : '#334155'}>
                            {trackerData?.charging === true ? 'Charging' : (trackerData?.charging === false ? 'Disconnected from charger' : 'Waiting for charger status')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Current charge of the tag
                        </Typography>
                    </Box>
                    <Typography variant="h4" fontWeight="800" color={trackerData?.charging === true ? '#1565C0' : '#0F172A'}>
                        {trackerData?.battery !== undefined && trackerData?.battery !== null ? `${trackerData.battery}%` : '—'}
                    </Typography>
                </Box>
            </Paper>

            {/* GEO-FENCE EDITING BANNER AND CONTROLS */}
            {isEditingGeofence && (
                <Paper sx={{ p: 2.5, mb: 3, borderRadius: '16px', bgcolor: '#E8F5E9', border: '1px solid #81C784', overflow: 'hidden' }}>
                    <Typography variant="subtitle1" fontWeight="700" color="#2E7D32" sx={{ mb: 1 }}>
                        📍 Creating / Editing Child Safe Zone Geo-Fence
                    </Typography>
                    <Typography variant="body2" color="#1B5E20" sx={{ mb: 2 }}>
                        Save Zone uses the child’s current location
                        {trackerData?.latitude ? ` (${Number(trackerData.latitude).toFixed(6)}, ${Number(trackerData.longitude).toFixed(6)})` : ''}.
                        The green circle on the map is the exact radius of {geofence.radius || 500} meters.
                    </Typography>
                    
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} md={6}>
                            <Box sx={{ px: 1 }}>
                                <Typography variant="caption" fontWeight="600" color="#2E7D32">
                                    Safe Zone Radius: <b>{geofence.radius} meters</b>
                                </Typography>
                                <Slider
                                    value={geofence.radius || 500}
                                    min={100}
                                    max={3000}
                                    step={100}
                                    onChange={(e, val) => setGeofence({ ...geofence, radius: val, enabled: true })}
                                    valueLabelDisplay="auto"
                                    sx={{ color: '#2E7D32' }}
                                />
                            </Box>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <Box sx={{ display: 'flex', gap: 1.5, justifyContent: { md: 'flex-end', xs: 'flex-start' } }}>
                                <Button
                                    variant="outlined"
                                    color="error"
                                    size="small"
                                    onClick={() => setGeofence({ ...geofence, enabled: false, lat: 0, lng: 0 })}
                                >
                                    Disable Geo-Fence
                                </Button>

                                <Button
                                    variant="contained"
                                    color="success"
                                    size="small"
                                    startIcon={<SaveIcon />}
                                    disabled={savingGeofence}
                                    onClick={handleSaveGeofence}
                                >
                                    {savingGeofence ? "Saving..." : "Save Zone"}
                                </Button>
                            </Box>
                        </Grid>
                    </Grid>
                </Paper>
            )}

            {/* LIVE GEOFENCE ALERT STATUS BANNER */}
            {isGeofenceActive && (
                <Alert 
                    icon={isInsideSafeZone ? <VerifiedUserIcon fontSize="inherit" /> : <WarningAmberIcon fontSize="inherit" />}
                    severity={isInsideSafeZone ? "success" : "error"}
                    sx={{ mb: 3, borderRadius: '12px', fontWeight: 'bold' }}
                >
                    {isInsideSafeZone 
                        ? `🟢 CHILD IS SAFE: Currently inside the designated Safe Zone (${Math.round(currentDistance)}m from zone center).`
                        : `🚨 SAFETY ALERT: Child is OUTSIDE the designated Safe Zone! (${Math.round(currentDistance)}m away from safe zone center).`
                    }
                </Alert>
            )}

            {error && (
                <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>
            )}

            {/* Main Content Layout: 8 cols Map + 4 cols Telemetry */}
            <Grid container spacing={3} sx={{ position: 'relative', overflow: 'hidden' }}>
                {/* Map Panel */}
                <Grid item xs={12} lg={8} sx={{ width: '100%', maxWidth: '100%' }}>
                    <Paper sx={{ 
                        p: 2, 
                        borderRadius: '16px', 
                        boxShadow: '0 4px 20px rgba(0,0,0,0.03)', 
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        position: 'relative',
                        overflow: 'hidden',
                        border: '1px solid #EAEAEC'
                    }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, alignItems: 'center' }}>
                            <Typography variant="h6" fontWeight="600" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <MapIcon color="action" /> Live Location Map & Route Line
                            </Typography>
                            {trackerData?.locationType === 'CELL_TOWER' && (
                                <Chip
                                    size="small"
                                    label={Number(trackerData.latitude) ? 'Estimated Location (Cell ID)' : 'Cell ID unresolved'}
                                    sx={{ fontWeight: 'bold', color: '#B45309', borderColor: '#D97706' }}
                                    variant="outlined"
                                />
                            )}
                        </Box>
                        
                        {/* Map Canvas with strict clipping and relative positioning */}
                        <Box 
                            ref={mapContainerRef} 
                            id="parent-tracking-map" 
                            sx={{ 
                                height: '500px', 
                                width: '100%', 
                                position: 'relative',
                                overflow: 'hidden',
                                borderRadius: '12px',
                                border: '1px solid #EEEEEE',
                                zIndex: 1,
                                cursor: isEditingGeofence ? 'crosshair' : 'default'
                            }} 
                        />
                        {mapsError && (
                            <Typography variant="body2" color="error" sx={{ mt: 1 }}>{mapsError}</Typography>
                        )}
                    </Paper>
                </Grid>

                {/* Telemetry Metrics Panel */}
                <Grid item xs={12} lg={4}>
                    <Grid container spacing={3}>
                        {/* Safe Zone summary card if active */}
                        <Grid item xs={12}>
                            <Card sx={{ 
                                borderRadius: '16px', 
                                boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
                                borderLeft: isGeofenceActive ? '5px solid #4CAF50' : '5px solid #EAEAEC'
                            }}>
                                <CardContent sx={{ p: 3 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                        <Typography variant="h6" fontWeight="600" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <SecurityIcon color={isGeofenceActive ? "success" : "disabled"} /> Safe Zone Status
                                        </Typography>
                                    </Box>

                                    {isGeofenceActive ? (
                                        <>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                                <Typography variant="body2" color="text.secondary">Safe Zone Radius:</Typography>
                                                <Typography variant="body2" fontWeight="600">{geofence.radius} meters</Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                                <Typography variant="body2" color="text.secondary">Current Distance:</Typography>
                                                <Typography variant="body2" fontWeight="600">
                                                    {currentDistance !== null ? `${Math.round(currentDistance)} meters` : "Calculating..."}
                                                </Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                                                <Typography variant="body2" color="text.secondary">Safety State:</Typography>
                                                <Typography variant="body2" fontWeight="700" sx={{ color: isInsideSafeZone ? '#2E7D32' : '#C62828' }}>
                                                    {isInsideSafeZone ? "INSIDE ZONE" : "OUTSIDE ZONE"}
                                                </Typography>
                                            </Box>
                                        </>
                                    ) : (
                                        <Typography variant="body2" color="text.secondary">
                                            No Safe Zone set. Click "📍 Set Safe Zone (Geo-Fence)" above to protect an area around Home or School.
                                        </Typography>
                                    )}
                                </CardContent>
                            </Card>
                        </Grid>

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
                                        <Typography variant="body2" color="text.secondary">Charge:</Typography>
                                        <Typography variant="body2" fontWeight="700" sx={{
                                            color: (trackerData?.battery ?? 0) >= 100 ? '#2E7D32' : ((trackerData?.battery ?? 0) > 25 ? '#2E7D32' : '#C62828')
                                        }}>
                                            {trackerData?.battery !== undefined && trackerData?.battery !== null ? `${trackerData.battery}%` : '—'}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                        <Typography variant="body2" color="text.secondary">Charger:</Typography>
                                        <Typography variant="body2" fontWeight="700" sx={{
                                            color: trackerData?.charging ? '#1565C0' : '#6D4C41'
                                        }}>
                                            {trackerData?.charging === true ? 'Charging' : (trackerData?.charging === false ? 'Disconnected from charger' : 'Waiting for the tag')}
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
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                </Grid>
            </Grid>

            <Snackbar
                open={Boolean(toastMsg)}
                autoHideDuration={4000}
                onClose={() => setToastMsg("")}
                message={toastMsg}
            />
        </Container>
    );
};

export default ParentTracking;
