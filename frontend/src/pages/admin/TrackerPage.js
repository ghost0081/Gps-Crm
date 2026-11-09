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
    Chip,
    Alert
} from '@mui/material';
import axios from 'axios';
import { ensureMaps, mapsApi } from '../../utils/googleMaps';
import {
    ACTIVITY_STYLES,
    eventActiveAtIndex,
    findActiveEvent,
    formatClock,
    formatClockRange,
    formatDuration
} from '../../utils/routeActivityTimeline';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import RefreshIcon from '@mui/icons-material/Refresh';
import MapIcon from '@mui/icons-material/Map';
import CellTowerIcon from '@mui/icons-material/CellTower';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import HistoryIcon from '@mui/icons-material/History';
import ReplayIcon from '@mui/icons-material/Replay';
import BatteryAlertIcon from '@mui/icons-material/BatteryAlert';
import { useSelector } from 'react-redux';

const TrackerPage = () => {
    const { currentUser } = useSelector((state) => state.user);
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
    const [activityTimeline, setActivityTimeline] = useState({
        events: [],
        stops: [],
        moves: [],
        zoneVisits: [],
        geofences: [],
        summary: {
            stopCount: 0,
            moveCount: 0,
            zoneVisitCount: 0,
            totalStopMs: 0,
            totalMoveMs: 0,
            totalActiveMs: 0
        }
    });
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackIndex, setPlaybackIndex] = useState(0);
    const [playbackSpeed, setPlaybackSpeed] = useState(1); // 1x, 2x, 4x
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [mapEpoch, setMapEpoch] = useState(0);
    const [mapsError, setMapsError] = useState('');
    const [timelineFilter, setTimelineFilter] = useState('all');

    // Refs
    const mapRef = useRef(null);
    const markerRef = useRef(null);
    const liveCircleRef = useRef(null);
    const towerMarkerRef = useRef(null);
    const towerLineRef = useRef(null);
    const mapContainerRef = useRef(null);

    const playbackMapRef = useRef(null);
    const playbackMarkerRef = useRef(null);
    const playbackPolylineRef = useRef(null);
    const playbackPolylinesGroupRef = useRef([]);
    const playbackCirclesRef = useRef([]);
    const playbackStartMarkerRef = useRef(null);
    const playbackEndMarkerRef = useRef(null);
    const playbackStopMarkersRef = useRef([]);
    const playbackZoneCirclesRef = useRef([]);
    const playbackContainerRef = useRef(null);
    const animationTimerRef = useRef(null);
    const timelineListRef = useRef(null);

    const activeDeviceId = isCustomMode ? customDevice : selectedDevice;
    const [resolvedPlace, setResolvedPlace] = useState('');
    const placeKeyRef = useRef('');
    const liveFrameRef = useRef('');

    // Fetch list of active devices (scoped to current school when available)
    const fetchDevices = async () => {
        try {
            const schoolId = currentUser?._id;
            const url = schoolId
                ? `${process.env.REACT_APP_BASE_URL}/api/tracker/devices?schoolId=${schoolId}`
                : `${process.env.REACT_APP_BASE_URL}/api/tracker/devices`;
            const res = await axios.get(url);
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

    // Fetch telemetry data for selected IMEI
    const fetchTrackingData = async (deviceId) => {
        if (!deviceId) return;
        try {
            setLoading(true);
            const res = await axios.get(`${process.env.REACT_APP_BASE_URL}/api/admin/${deviceId}`);
            if (res.data) {
                setTrackerData(res.data);
                setError(null);
            }
        } catch (err) {
            console.error("Error fetching tracker data:", err);
            setError("Failed to fetch location data for device: " + deviceId);
        } finally {
            setLoading(false);
        }
    };

    // Fetch Route History for selected Date
    const fetchHistoryData = async (deviceId, dateStr) => {
        if (!deviceId) return;
        try {
            setLoadingHistory(true);
            const res = await axios.get(`${process.env.REACT_APP_BASE_URL}/api/admin/history/${deviceId}?date=${dateStr}`);
            if (res.data) {
                const points = res.data.history || res.data.points || [];
                setPlaybackPoints(points);
                setPlaybackMeta({
                    count: res.data.count || res.data.pointsCount || points.length,
                    distance: res.data.distanceMeters || res.data.totalDistanceMeters || 0
                });
                setActivityTimeline(res.data.activityTimeline || {
                    events: [],
                    stops: [],
                    moves: [],
                    zoneVisits: [],
                    geofences: res.data.geofences || [],
                    summary: {
                        stopCount: 0,
                        moveCount: 0,
                        zoneVisitCount: 0,
                        totalStopMs: 0,
                        totalMoveMs: 0,
                        totalActiveMs: 0
                    }
                });
                setPlaybackIndex(0);
                setIsPlaying(false);
            }
        } catch (err) {
            console.error("Error fetching history data:", err);
        } finally {
            setLoadingHistory(false);
        }
    };

    useEffect(() => {
        fetchDevices();
    }, []);

    useEffect(() => {
        const lat = Number(trackerData?.cellLatitude);
        const lng = Number(trackerData?.cellLongitude);
        if (trackerData?.cellLocation || !lat || !lng) {
            setResolvedPlace('');
            return undefined;
        }
        const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
        if (placeKeyRef.current === key) return undefined;
        placeKeyRef.current = key;
        let cancelled = false;
        const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
        fetch(url)
            .then((response) => (response.ok ? response.json() : null))
            .then((data) => {
                if (cancelled || !data) return;
                const parts = [data.locality, data.city, data.principalSubdivision]
                    .map((part) => String(part || '').trim())
                    .filter((part, index, all) => part && all.findIndex((item) => item.toLowerCase() === part.toLowerCase()) === index);
                setResolvedPlace(parts.join(', '));
            })
            .catch(() => {
                if (placeKeyRef.current === key) placeKeyRef.current = '';
            });
        return () => { cancelled = true; };
    }, [trackerData?.cellLatitude, trackerData?.cellLongitude, trackerData?.cellLocation]);

    useEffect(() => {
        if (activeDeviceId) {
            fetchTrackingData(activeDeviceId);
            if (viewTab === 1) fetchHistoryData(activeDeviceId, playbackDate);
        }
        const interval = setInterval(() => {
            if (activeDeviceId && viewTab === 0) {
                fetchTrackingData(activeDeviceId);
            }
        }, 5000);
        return () => clearInterval(interval);
    }, [selectedDevice, customDevice, isCustomMode, viewTab, playbackDate]);

    // Initialize the live Google Map
    useEffect(() => {
        if (viewTab !== 0 || !mapContainerRef.current) return undefined;
        let cancelled = false;
        ensureMaps().then(() => {
            if (cancelled || !mapContainerRef.current || mapRef.current) return;
            mapRef.current = mapsApi().map(mapContainerRef.current).setView([22.5, 79.0], 5);
            setMapsError('');
            setMapEpoch((value) => value + 1);
        }).catch(() => {
            if (!cancelled) setMapsError('Google Maps needs an API key in REACT_APP_GOOGLE_MAPS_API_KEY.');
        });

        return () => {
            cancelled = true;
            liveFrameRef.current = '';
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
                markerRef.current = null;
                liveCircleRef.current = null;
                towerMarkerRef.current = null;
                towerLineRef.current = null;
            }
        };
    }, [viewTab]);

    // Handle live map updates when new coordinates arrive (ONLY MARKER PIN & CELL/BLE CIRCLES)
    useEffect(() => {
        if (viewTab !== 0 || !mapsApi() || !mapRef.current) return;

        const isCellTower = trackerData?.locationType === 'CELL_TOWER';
        const cellLat = parseFloat(trackerData?.cellLatitude);
        const cellLng = parseFloat(trackerData?.cellLongitude);
        const hasCellPoint = isCellTower && Number.isFinite(cellLat) && Number.isFinite(cellLng) && !(cellLat === 0 && cellLng === 0);
        const lat = hasCellPoint ? cellLat : parseFloat(trackerData?.latitude);
        const lng = hasCellPoint ? cellLng : parseFloat(trackerData?.longitude);
        
        if (!trackerData || isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
            if (markerRef.current) {
                mapRef.current.removeLayer(markerRef.current);
                markerRef.current = null;
            }
            if (liveCircleRef.current) {
                mapRef.current.removeLayer(liveCircleRef.current);
                liveCircleRef.current = null;
            }
            if (towerMarkerRef.current) {
                mapRef.current.removeLayer(towerMarkerRef.current);
                towerMarkerRef.current = null;
            }
            if (towerLineRef.current) {
                mapRef.current.removeLayer(towerLineRef.current);
                towerLineRef.current = null;
            }
            return;
        }

        const latlng = [lat, lng];
        const isBle = trackerData.locationType === 'BLE' || trackerData.deviceType === 'BLE_BEACON';
        const accuracyMeters = isCellTower
            ? (Number(trackerData.cellAccuracy) || Number(trackerData.accuracy) || 0)
            : (Number(trackerData.accuracy) || 0);
        const frameKey = `${viewTab}:${activeDeviceId}`;
        if (liveFrameRef.current !== frameKey) {
            liveFrameRef.current = frameKey;
            const map = mapRef.current;
            map.invalidateSize();
            const frameOnTag = () => {
                if (!mapRef.current || mapRef.current !== map) return;
                if (isCellTower && accuracyMeters >= 80) {
                    const latPad = accuracyMeters / 111320;
                    const lngPad = latPad / Math.max(0.2, Math.cos(lat * Math.PI / 180));
                    map.fitBounds(
                        [[lat - latPad, lng - lngPad], [lat + latPad, lng + lngPad]],
                        { padding: [48, 48], maxZoom: 16 }
                    );
                } else {
                    map.setView(latlng, isBle ? 18 : 16);
                }
            };
            frameOnTag();
            requestAnimationFrame(frameOnTag);
        }

        // Manage coverage circle for Cell Tower or BLE
        if (liveCircleRef.current) {
            mapRef.current.removeLayer(liveCircleRef.current);
            liveCircleRef.current = null;
        }

        if ((isCellTower && accuracyMeters > 0) || isBle) {
            const circleColor = isBle ? '#3B82F6' : '#F59E0B';
            const radiusMeters = isBle ? 10 : accuracyMeters;
            liveCircleRef.current = mapsApi().circle(latlng, {
                radius: radiusMeters,
                color: circleColor,
                fillColor: circleColor,
                fillOpacity: 0.2,
                weight: 2
            }).addTo(mapRef.current);
        }

        const iconHtml = isBle
            ? `<div style="background-color: #3B82F6; width: 24px; height: 24px; border-radius: 50%; border: 3px solid #FFFFFF; box-shadow: 0 0 12px rgba(59, 130, 246, 0.6); display: flex; align-items: center; justify-content: center; color: white; font-size: 11px; font-weight: bold;">🎒</div>`
            : (isCellTower 
                ? `<div style="background-color: #D97706; width: 24px; height: 24px; border-radius: 50%; border: 3px solid #FFFFFF; box-shadow: 0 0 12px rgba(217, 119, 6, 0.6); display: flex; align-items: center; justify-content: center; color: white; font-size: 11px; font-weight: bold;">📡</div>`
                : `<div style="background-color: #7B61FF; width: 22px; height: 22px; border-radius: 50%; border: 3px solid #FFFFFF; box-shadow: 0 0 10px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; color: white; font-size: 10px;">🛰️</div>`);

        const studentIcon = mapsApi().divIcon({
            html: iconHtml,
            className: 'custom-student-marker',
            iconSize: [28, 28],
            iconAnchor: [14, 14]
        });

        const hasNearestTower = hasCellPoint;

        const popupContent = `
            <div style="font-family: sans-serif; padding: 4px; min-width: 180px;">
                <b>Device IMEI:</b> ${trackerData.imei || trackerData.device_id || activeDeviceId}<br/>
                <b>Source:</b> ${isBle ? '🎒 Bluetooth' : (isCellTower ? '📡 Estimated Location (Cell ID)' : '🛰️ GPS')}<br/>
                <b>Latitude:</b> ${lat.toFixed(6)}<br/>
                <b>Longitude:</b> ${lng.toFixed(6)}<br/>
                ${isCellTower && accuracyMeters > 0 ? `<b>Uncertainty:</b> about ${Math.round(accuracyMeters)} m<br/>` : ''}
                ${trackerData.cellId ? `<b>Cell ID:</b> ${trackerData.cellId} (LAC: ${trackerData.lac || 0})<br/>` : ''}
                ${hasNearestTower ? `<b>Cell tower:</b> ${cellLat.toFixed(6)}, ${cellLng.toFixed(6)}<br/>` : ''}
                ${(trackerData.cellLocation || resolvedPlace) ? `<b>Area:</b> ${trackerData.cellLocation || resolvedPlace}<br/>` : ''}
                <b>Last Fix:</b> ${formatDate(trackerData.last_updated)}
            </div>
        `;

        if (towerMarkerRef.current) {
            mapRef.current.removeLayer(towerMarkerRef.current);
            towerMarkerRef.current = null;
        }
        if (towerLineRef.current) {
            mapRef.current.removeLayer(towerLineRef.current);
            towerLineRef.current = null;
        }
        if (hasNearestTower) {
            const towerIcon = mapsApi().divIcon({
                html: `<div style="background-color: #D97706; width: 18px; height: 18px; border-radius: 4px; border: 2px solid #FFFFFF; box-shadow: 0 0 8px rgba(217, 119, 6, 0.7); display: flex; align-items: center; justify-content: center; color: white; font-size: 10px;">📡</div>`,
                className: 'nearest-cell-tower-marker',
                iconSize: [18, 18],
                iconAnchor: [9, 9]
            });
            towerLineRef.current = mapsApi().polyline([[lat, lng], [cellLat, cellLng]], {
                color: '#D97706',
                weight: 2,
                dashArray: '4 6',
                opacity: 0.8
            }).addTo(mapRef.current);
            towerMarkerRef.current = mapsApi().marker([cellLat, cellLng], { icon: towerIcon }).addTo(mapRef.current)
                .bindPopup(`<b>Detected cell tower</b><br/>Cell ID: ${trackerData.cellId || 'N/A'}<br/>LAC: ${trackerData.lac || 0}<br/>${cellLat.toFixed(6)}, ${cellLng.toFixed(6)}<br/>${trackerData.cellLocation || resolvedPlace || ''}`);
        }

        if (!markerRef.current) {
            markerRef.current = mapsApi().marker(latlng, { icon: studentIcon }).addTo(mapRef.current)
                .bindPopup(popupContent);
        } else {
            markerRef.current.setIcon(studentIcon);
            markerRef.current.setLatLng(latlng);
            markerRef.current.getPopup().setContent(popupContent);
        }
    }, [trackerData, viewTab, activeDeviceId, resolvedPlace, mapEpoch]);

    // Initialize the route playback Google Map
    useEffect(() => {
        if (viewTab !== 1 || !playbackContainerRef.current) return undefined;
        let cancelled = false;
        ensureMaps().then(() => {
            if (cancelled || !playbackContainerRef.current || playbackMapRef.current) return;
            playbackMapRef.current = mapsApi().map(playbackContainerRef.current).setView([22.5, 79.0], 5);
            setMapsError('');
            setMapEpoch((value) => value + 1);
        }).catch(() => {
            if (!cancelled) setMapsError('Google Maps needs an API key in REACT_APP_GOOGLE_MAPS_API_KEY.');
        });

        return () => {
            cancelled = true;
            if (playbackMapRef.current) {
                playbackMapRef.current.remove();
                playbackMapRef.current = null;
                playbackMarkerRef.current = null;
                playbackPolylineRef.current = null;
                playbackPolylinesGroupRef.current = [];
                playbackCirclesRef.current = [];
                playbackStopMarkersRef.current = [];
                playbackZoneCirclesRef.current = [];
                playbackStartMarkerRef.current = null;
                playbackEndMarkerRef.current = null;
            }
        };
    }, [viewTab]);

    // Update Playback Map Route & Markers when history data arrives
    useEffect(() => {
        if (viewTab !== 1 || !mapsApi() || !playbackMapRef.current) return;

        // Clear existing markers, polylines & coverage circles
        if (playbackPolylineRef.current) playbackPolylineRef.current.setLatLngs([]);
        playbackPolylinesGroupRef.current.forEach(p => playbackMapRef.current.removeLayer(p));
        playbackPolylinesGroupRef.current = [];
        playbackCirclesRef.current.forEach(c => playbackMapRef.current.removeLayer(c));
        playbackCirclesRef.current = [];
        playbackStopMarkersRef.current.forEach((marker) => playbackMapRef.current.removeLayer(marker));
        playbackStopMarkersRef.current = [];
        playbackZoneCirclesRef.current.forEach((circle) => playbackMapRef.current.removeLayer(circle));
        playbackZoneCirclesRef.current = [];

        if (playbackStartMarkerRef.current) { playbackMapRef.current.removeLayer(playbackStartMarkerRef.current); playbackStartMarkerRef.current = null; }
        if (playbackEndMarkerRef.current) { playbackMapRef.current.removeLayer(playbackEndMarkerRef.current); playbackEndMarkerRef.current = null; }
        if (playbackMarkerRef.current) { playbackMapRef.current.removeLayer(playbackMarkerRef.current); playbackMarkerRef.current = null; }

        if (!playbackPoints || playbackPoints.length === 0) return;

        const coords = playbackPoints.map(pt => [pt.lat, pt.lng]);

        // Group consecutive GPS points into sub-polylines so lines ONLY connect Satellite fixes!
        let currentGpsSegment = [];
        playbackPoints.forEach((pt) => {
            const isGpsPt = pt.locationType === 'GPS' || (!pt.locationType && pt.accuracy !== 300);
            const isCellPt = pt.locationType === 'CELL_TOWER';
            const isBlePt = pt.locationType === 'BLE' || pt.deviceType === 'BLE_BEACON';

            if (isGpsPt) {
                currentGpsSegment.push([pt.lat, pt.lng]);
            } else {
                if (currentGpsSegment.length > 1) {
                    const poly = mapsApi().polyline(currentGpsSegment, { color: '#2563EB', weight: 5, opacity: 0.8 }).addTo(playbackMapRef.current);
                    playbackPolylinesGroupRef.current.push(poly);
                }
                currentGpsSegment = [];

                // Render coverage circle for Cell Tower or BLE point in playback
                const circleColor = isBlePt ? '#3B82F6' : '#F59E0B';
                const circleRadius = isBlePt ? 10 : (pt.accuracy || 300);
                const circlePopup = isBlePt 
                    ? `<b>🎒 Connected to BLE Gateway</b><br/>Time: ${formatDate(pt.timestamp)}`
                    : `<b>📡 Connected to Cell Tower</b><br/>Cell ID: ${pt.cellId || 'N/A'}<br/>Time: ${formatDate(pt.timestamp)}`;
                
                const circle = mapsApi().circle([pt.lat, pt.lng], {
                    radius: circleRadius,
                    color: circleColor,
                    fillColor: circleColor,
                    fillOpacity: 0.25,
                    weight: 2
                }).addTo(playbackMapRef.current).bindPopup(circlePopup);
                
                playbackCirclesRef.current.push(circle);
            }
        });
        if (currentGpsSegment.length > 1) {
            const poly = mapsApi().polyline(currentGpsSegment, { color: '#2563EB', weight: 5, opacity: 0.8 }).addTo(playbackMapRef.current);
            playbackPolylinesGroupRef.current.push(poly);
        }

        // Start Marker (🟢)
        const startIcon = mapsApi().divIcon({
            html: `<div style="background-color: #10B981; width: 22px; height: 22px; border-radius: 50%; border: 3px solid #FFF; color: white; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold;">🟢</div>`,
            className: 'start-marker',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });
        playbackStartMarkerRef.current = mapsApi().marker(coords[0], { icon: startIcon }).addTo(playbackMapRef.current)
            .bindPopup(`<b>Start Point</b><br/>Time: ${formatDate(playbackPoints[0].timestamp)}`);

        // End Marker (🔴)
        if (coords.length > 1) {
            const endIcon = mapsApi().divIcon({
                html: `<div style="background-color: #EF4444; width: 22px; height: 22px; border-radius: 50%; border: 3px solid #FFF; color: white; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold;">🔴</div>`,
                className: 'end-marker',
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });
            playbackEndMarkerRef.current = mapsApi().marker(coords[coords.length - 1], { icon: endIcon }).addTo(playbackMapRef.current)
                .bindPopup(`<b>End Point</b><br/>Time: ${formatDate(playbackPoints[playbackPoints.length - 1].timestamp)}`);
        }

        // Moving Animated Marker
        const carIcon = mapsApi().divIcon({
            html: `<div style="background-color: #3B82F6; width: 30px; height: 30px; border-radius: 50%; border: 3px solid #FFF; box-shadow: 0 0 12px rgba(59,130,246,0.7); display: flex; align-items: center; justify-content: center; font-size: 14px;">🎒</div>`,
            className: 'playback-moving-marker',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });

        const initialPoint = coords[playbackIndex] || coords[0];
        playbackMarkerRef.current = mapsApi().marker(initialPoint, { icon: carIcon }).addTo(playbackMapRef.current);

        (activityTimeline.geofences || []).forEach((zone) => {
            if (!zone || zone.lat == null || zone.lng == null) return;
            const circle = mapsApi().circle([zone.lat, zone.lng], {
                radius: zone.radius || 50,
                color: '#7C3AED',
                fillColor: '#8B5CF6',
                fillOpacity: 0.12,
                weight: 2,
                dashArray: '6 6'
            }).addTo(playbackMapRef.current).bindPopup(`<b>Safe Zone</b><br/>${zone.name || 'Zone'}`);
            playbackZoneCirclesRef.current.push(circle);
        });

        (activityTimeline.stops || []).forEach((stop, index) => {
            const stopIcon = mapsApi().divIcon({
                html: `<div style="background-color:#F59E0B;width:24px;height:24px;border-radius:50%;border:3px solid #FFF;box-shadow:0 0 8px rgba(245,158,11,0.55);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;">${index + 1}</div>`,
                className: 'stop-marker',
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });
            const marker = mapsApi().marker([stop.lat, stop.lng], { icon: stopIcon }).addTo(playbackMapRef.current)
                .bindPopup(`<b>Stop ${index + 1}</b><br/>${stop.placeLabel || ''}<br/>${formatDuration(stop.durationMs)}<br/>${formatClockRange(stop.startTime, stop.endTime)}`);
            playbackStopMarkersRef.current.push(marker);
        });

        playbackMapRef.current.fitBounds(mapsApi().latLngBounds(coords), { padding: [40, 40] });
    }, [playbackPoints, viewTab, mapEpoch, activityTimeline]);

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

    useEffect(() => {
        const active = findActiveEvent(activityTimeline.events || [], playbackIndex);
        if (!timelineListRef.current || !active) return;
        const node = timelineListRef.current.querySelector(`[data-event-id="${active.id}"]`);
        if (node && typeof node.scrollIntoView === 'function') {
            node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }, [activityTimeline.events, playbackIndex, timelineFilter]);

    // Format ISO string to readable localized date
    const formatDate = (isoString) => {
        if (!isoString) return 'Never';
        const date = new Date(isoString);
        return date.toLocaleString();
    };

    const journeySteps = Array.isArray(activityTimeline.journey) ? activityTimeline.journey : [];
    const legacyEvents = activityTimeline.events || [];
    const activeActivity = findActiveEvent(
        (journeySteps.length ? journeySteps : legacyEvents),
        playbackIndex
    );
    // Prefer clean journey timeline when available (collapses arrive/stop/depart noise).
    const timelineEvents = (journeySteps.length
        ? journeySteps
        : legacyEvents
    ).filter((event) => {
        if (timelineFilter === 'all') return true;
        if (timelineFilter === 'stops') {
            return ['stop', 'start', 'destination', 'arrive', 'depart'].includes(event.type);
        }
        if (timelineFilter === 'moves') return event.type === 'move' || event.type === 'gap';
        if (timelineFilter === 'zones') return String(event.type).startsWith('zone_');
        return true;
    });

    const seekToEvent = (event) => {
        if (!event || event.startIndex == null) return;
        setPlaybackIndex(Math.max(0, Number(event.startIndex)));
        setIsPlaying(false);
        const pt = playbackPoints[event.startIndex];
        if (pt && playbackMapRef.current) {
            playbackMapRef.current.panTo([pt.lat, pt.lng]);
        }
    };

    return (
        <Container maxWidth={false} disableGutters sx={{ width: '100%', maxWidth: '100%', mt: { xs: 0, md: 1 }, mb: 2 }}>
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
                        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', justifyContent: { xs: 'flex-start', md: 'flex-end' }, flexWrap: 'wrap', width: '100%' }}>
                            {!isCustomMode ? (
                                <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 200 }, width: { xs: '100%', sm: 'auto' } }}>
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
                                    sx={{ width: { xs: '100%', sm: 200 } }}
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
                    <Tabs value={viewTab} onChange={(e, val) => setViewTab(val)} indicatorColor="primary" textColor="primary" variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile>
                        <Tab icon={<LocationOnIcon />} iconPosition="start" label="Live Location Map (No Lines)" />
                        <Tab icon={<HistoryIcon />} iconPosition="start" label="📜 Route History Playback" />
                    </Tabs>
                </Box>
            </Paper>

            {error && (
                <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>
            )}

            {/* DYNAMIC TIERED BATTERY ALERT BANNER (85%, 70%, 50%, 25%) */}
            {trackerData && (trackerData.battery ?? 100) <= 85 && (
                <Alert 
                    severity={
                        (trackerData.battery ?? 100) <= 25 ? "error" :
                        (trackerData.battery ?? 100) <= 50 ? "warning" :
                        (trackerData.battery ?? 100) <= 70 ? "warning" : "info"
                    } 
                    icon={<BatteryAlertIcon fontSize="inherit" />} 
                    sx={{ mb: 3, borderRadius: '12px', fontWeight: 600 }}
                >
                    {(trackerData.battery ?? 100) <= 25 && `🚨 CRITICAL BATTERY LOW ALERT: Tracker battery level is at ${trackerData.battery}% ${trackerData.batteryMv ? `(${trackerData.batteryMv} mV)` : ''}. Please charge the tracker immediately!`}
                    {(trackerData.battery ?? 100) > 25 && (trackerData.battery ?? 100) <= 50 && `⚠️ BATTERY MEDIUM ALERT: Tracker battery level is at ${trackerData.battery}% ${trackerData.batteryMv ? `(${trackerData.batteryMv} mV)` : ''}. Consider charging soon.`}
                    {(trackerData.battery ?? 100) > 50 && (trackerData.battery ?? 100) <= 70 && `🟡 BATTERY MODERATE ALERT: Tracker battery level is at ${trackerData.battery}% ${trackerData.batteryMv ? `(${trackerData.batteryMv} mV)` : ''}.`}
                    {(trackerData.battery ?? 100) > 70 && (trackerData.battery ?? 100) <= 85 && `ℹ️ BATTERY ADVISORY: Tracker battery is at ${trackerData.battery}% ${trackerData.batteryMv ? `(${trackerData.batteryMv} mV)` : ''}.`}
                </Alert>
            )}

            {/* TAB 0: CLEAN LIVE LOCATION MAP */}
            {viewTab === 0 && (
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
                            <Box sx={{ position: 'relative' }}>
                            <Box 
                                ref={mapContainerRef} 
                                id="map" 
                                sx={{ 
                                    height: { xs: '280px', sm: '380px', md: '480px' }, 
                                    width: '100%', 
                                    borderRadius: '12px',
                                    border: '1px solid #EEEEEE',
                                    zIndex: 1 
                                }} 
                            />
                            {mapsError && (
                                <Typography variant="body2" color="error" sx={{ mt: 1 }}>{mapsError}</Typography>
                            )}
                            {trackerData?.locationType === 'CELL_TOWER' && Number(trackerData.cellLatitude) ? (
                                <Box sx={{
                                    position: 'absolute',
                                    left: 12,
                                    bottom: 12,
                                    zIndex: 500,
                                    maxWidth: 'calc(100% - 24px)',
                                    px: 1.5,
                                    py: 1,
                                    borderRadius: '10px',
                                    backgroundColor: 'rgba(255,255,255,0.95)',
                                    border: '1px solid #F59E0B',
                                    boxShadow: '0 2px 8px rgba(15,23,42,0.12)'
                                }}>
                                    <Typography variant="body2" fontWeight="700" sx={{ color: '#B45309' }}>
                                        Estimated Location — Cell ID
                                    </Typography>
                                    <Typography variant="caption" sx={{ display: 'block', color: '#334155' }}>
                                        {Number(trackerData.cellLatitude).toFixed(6)}, {Number(trackerData.cellLongitude).toFixed(6)}
                                        {(Number(trackerData.cellAccuracy) || Number(trackerData.accuracy))
                                            ? ` · about ${Math.round(Number(trackerData.cellAccuracy) || Number(trackerData.accuracy))} m`
                                            : ''}
                                    </Typography>
                                </Box>
                            ) : null}
                            </Box>
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
                                            <Typography variant="body2" color="text.secondary">
                                                {trackerData?.locationType === 'CELL_TOWER' ? 'Estimated latitude:' : 'Latitude:'}
                                            </Typography>
                                            <Typography variant="body2" fontWeight="500">
                                                {(trackerData?.locationType === 'CELL_TOWER' && Number(trackerData?.cellLatitude))
                                                    ? Number(trackerData.cellLatitude).toFixed(6)
                                                    : (trackerData?.latitude ? parseFloat(trackerData.latitude).toFixed(6) : "0.000000")}
                                            </Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                                            <Typography variant="body2" color="text.secondary">
                                                {trackerData?.locationType === 'CELL_TOWER' ? 'Estimated longitude:' : 'Longitude:'}
                                            </Typography>
                                            <Typography variant="body2" fontWeight="500">
                                                {(trackerData?.locationType === 'CELL_TOWER' && Number(trackerData?.cellLongitude))
                                                    ? Number(trackerData.cellLongitude).toFixed(6)
                                                    : (trackerData?.longitude ? parseFloat(trackerData.longitude).toFixed(6) : "0.000000")}
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
                                                {trackerData?.locationType === 'BLE'
                                                    ? '🎒 BLE Fix'
                                                    : trackerData?.locationType === 'CELL_TOWER'
                                                    ? '📡 Cell ID Fallback'
                                                    : '🛰️ Satellite GPS Fix'}
                                            </Typography>
                                        </Box>
                                        {trackerData?.localization && (
                                            <Box sx={{ mb: 1.5, p: 1.25, borderRadius: '10px', backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
                                                <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, color: '#92400E' }}>
                                                    Localization: {trackerData.localization.method}
                                                </Typography>
                                                <Typography variant="caption" sx={{ display: 'block', color: '#44403C' }}>
                                                    {trackerData.localization.markerReady
                                                        ? `Estimate ${Number(trackerData.localization.latitude).toFixed(6)}, ${Number(trackerData.localization.longitude).toFixed(6)}`
                                                        : 'No estimate saved'}
                                                    {trackerData.localization.circleReady
                                                        ? ` · circle ${Math.round(trackerData.localization.accuracyMeters)} m`
                                                        : ' · no uncertainty circle'}
                                                </Typography>
                                                {trackerData.localization.failure ? (
                                                    <Typography variant="caption" sx={{ display: 'block', color: '#B45309' }}>
                                                        {trackerData.localization.failure}
                                                    </Typography>
                                                ) : null}
                                            </Box>
                                        )}
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                            <Typography variant="body2" color="text.secondary">LAC (Location Area Code):</Typography>
                                            <Typography variant="body2" fontWeight="600">
                                                {trackerData?.lac !== undefined ? `${trackerData.lac} (0x${(trackerData.lac || 0).toString(16).toUpperCase()})` : '0 (0x0000)'}
                                            </Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                            <Typography variant="body2" color="text.secondary">Cell ID:</Typography>
                                            <Typography variant="body2" fontWeight="600">
                                                {trackerData?.cellId ? `${trackerData.cellId} (MCC:${trackerData.mcc || 0} MNC:${trackerData.mnc || 0})` : 'Waiting for tower'}
                                            </Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                            <Typography variant="body2" color="text.secondary">Cell latitude:</Typography>
                                            <Typography variant="body2" fontWeight="600">
                                                {trackerData?.cellLatitude ? Number(trackerData.cellLatitude).toFixed(6) : 'Not resolved'}
                                            </Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                            <Typography variant="body2" color="text.secondary">Cell longitude:</Typography>
                                            <Typography variant="body2" fontWeight="600">
                                                {trackerData?.cellLongitude ? Number(trackerData.cellLongitude).toFixed(6) : 'Not resolved'}
                                            </Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, gap: 2 }}>
                                            <Typography variant="body2" color="text.secondary">Approximate location:</Typography>
                                            <Typography variant="body2" fontWeight="600" sx={{ textAlign: 'right' }}>
                                                {trackerData?.cellLocation || resolvedPlace || 'Not resolved'}
                                            </Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                            <Typography variant="body2" color="text.secondary">Cell reading time:</Typography>
                                            <Typography variant="body2" fontWeight="600">
                                                {(trackerData?.cellTimestamp || ((trackerData?.cellId || trackerData?.cellLatitude) && trackerData?.last_updated))
                                                    ? formatDate(trackerData.cellTimestamp || trackerData.last_updated)
                                                    : '—'}
                                            </Typography>
                                        </Box>
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, mb: 1.5 }}>
                                            Cell ID comes from the tower the tag is connected to. Position order: BLE, then GPS, then this Cell ID.
                                        </Typography>
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
                            {mapsError && (
                                <Typography variant="body2" color="error" sx={{ mt: 1 }}>{mapsError}</Typography>
                            )}

                            {activeActivity && (
                                <Box sx={{
                                    mt: 2,
                                    p: 2,
                                    borderRadius: '12px',
                                    border: `1px solid ${ACTIVITY_STYLES[activeActivity.type]?.color || '#CBD5E1'}40`,
                                    background: ACTIVITY_STYLES[activeActivity.type]?.bg || '#F8FAFC'
                                }}>
                                    <Typography variant="caption" sx={{ color: ACTIVITY_STYLES[activeActivity.type]?.color || 'text.secondary', fontWeight: 700 }}>
                                        {(ACTIVITY_STYLES[activeActivity.type]?.icon || '•')} Now on route · {ACTIVITY_STYLES[activeActivity.type]?.label || activeActivity.type}
                                    </Typography>
                                    <Typography variant="subtitle1" fontWeight={700} sx={{ mt: 0.25 }}>
                                        {activeActivity.title}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {formatClockRange(activeActivity.startTime, activeActivity.endTime)}
                                        {activeActivity.durationMs ? ` · ${formatDuration(activeActivity.durationMs)}` : ''}
                                        {activeActivity.travelDurationMs ? ` · travel ${formatDuration(activeActivity.travelDurationMs)}` : ''}
                                        {activeActivity.travelDistanceMeters ? ` · ${activeActivity.travelDistanceMeters} m` : ''}
                                        {activeActivity.distanceMeters ? ` · ${activeActivity.distanceMeters} m` : ''}
                                    </Typography>
                                    {activeActivity.details && (
                                        <Typography variant="body2" sx={{ mt: 0.5 }}>{activeActivity.details}</Typography>
                                    )}
                                </Box>
                            )}
                        </Paper>
                    </Grid>

                    {/* Playback Statistics & Activity Timeline */}
                    <Grid item xs={12} lg={4}>
                        <Grid container spacing={3}>
                            <Grid item xs={12}>
                                <Card sx={{ borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                                    <CardContent sx={{ p: 3 }}>
                                        <Typography variant="h6" fontWeight="600" sx={{ mb: 2 }}>
                                            Trajectory Summary ({playbackDate})
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
                                            <Typography variant="body2" color="text.secondary">Stops:</Typography>
                                            <Typography variant="body2" fontWeight="700">{activityTimeline.summary?.stopCount || 0}</Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                            <Typography variant="body2" color="text.secondary">Time Stationary:</Typography>
                                            <Typography variant="body2" fontWeight="700">{formatDuration(activityTimeline.summary?.totalStopMs || 0)}</Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                            <Typography variant="body2" color="text.secondary">Time Moving:</Typography>
                                            <Typography variant="body2" fontWeight="700">{formatDuration(activityTimeline.summary?.totalMoveMs || 0)}</Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                            <Typography variant="body2" color="text.secondary">Safe Zone Visits:</Typography>
                                            <Typography variant="body2" fontWeight="700">{activityTimeline.summary?.zoneVisitCount || 0}</Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                            <Typography variant="body2" color="text.secondary">Current Checkpoint:</Typography>
                                            <Typography variant="body2" fontWeight="700">
                                                {playbackPoints.length ? `${playbackIndex + 1} of ${playbackPoints.length}` : '0 of 0'}
                                            </Typography>
                                        </Box>
                                        {loadingHistory && (
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                                                <CircularProgress size={16} />
                                                <Typography variant="caption" color="text.secondary">Loading activity timeline…</Typography>
                                            </Box>
                                        )}
                                    </CardContent>
                                </Card>
                            </Grid>

                            <Grid item xs={12}>
                                <Card sx={{ borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                                    <CardContent sx={{ p: 2 }}>
                                        <Typography variant="subtitle2" fontWeight="700" sx={{ mb: 1 }}>
                                            Activity Timeline ({timelineEvents.length})
                                        </Typography>
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.5 }}>
                                            {[
                                                { id: 'all', label: 'All' },
                                                { id: 'stops', label: 'Stops' },
                                                { id: 'moves', label: 'Moves' },
                                                { id: 'zones', label: 'Safe Zones' }
                                            ].map((filter) => (
                                                <Chip
                                                    key={filter.id}
                                                    size="small"
                                                    label={filter.label}
                                                    color={timelineFilter === filter.id ? 'primary' : 'default'}
                                                    variant={timelineFilter === filter.id ? 'filled' : 'outlined'}
                                                    onClick={() => setTimelineFilter(filter.id)}
                                                />
                                            ))}
                                        </Box>
                                        <Box ref={timelineListRef} sx={{ maxHeight: 420, overflowY: 'auto', pr: 0.5 }}>
                                            {timelineEvents.map((event) => {
                                                const style = ACTIVITY_STYLES[event.type] || ACTIVITY_STYLES.move;
                                                const active = eventActiveAtIndex(event, playbackIndex);
                                                return (
                                                    <Box
                                                        key={event.id}
                                                        data-event-id={event.id}
                                                        onClick={() => seekToEvent(event)}
                                                        sx={{
                                                            mb: 1,
                                                            p: 1.25,
                                                            borderRadius: '12px',
                                                            border: active ? `2px solid ${style.color}` : '1px solid #E2E8F0',
                                                            background: active ? style.bg : '#FFFFFF',
                                                            cursor: 'pointer',
                                                            transition: 'border-color 120ms ease, background 120ms ease'
                                                        }}
                                                    >
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 0.5 }}>
                                                            <Chip
                                                                size="small"
                                                                label={`${style.icon} ${style.label}`}
                                                                sx={{
                                                                    height: 22,
                                                                    bgcolor: style.bg,
                                                                    color: style.color,
                                                                    fontWeight: 700,
                                                                    '& .MuiChip-label': { px: 1 }
                                                                }}
                                                            />
                                                            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                                                                {formatClockRange(event.startTime, event.endTime)}
                                                            </Typography>
                                                        </Box>
                                                        <Typography variant="body2" fontWeight={700} sx={{ lineHeight: 1.35 }}>
                                                            {event.title}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.35 }}>
                                                            {[
                                                                event.durationMs ? `Duration ${formatDuration(event.durationMs)}` : null,
                                                                event.travelDurationMs ? `Travel ${formatDuration(event.travelDurationMs)}` : null,
                                                                event.travelDistanceMeters ? `${event.travelDistanceMeters} m to arrive` : null,
                                                                event.distanceMeters ? `${event.distanceMeters} m moved` : null
                                                            ].filter(Boolean).join(' · ') || event.details}
                                                        </Typography>
                                                        {event.details && (event.durationMs || event.distanceMeters || event.travelDurationMs) && (
                                                            <Typography variant="caption" sx={{ display: 'block', mt: 0.35, color: 'text.secondary' }}>
                                                                {event.details}
                                                            </Typography>
                                                        )}
                                                    </Box>
                                                );
                                            })}
                                            {timelineEvents.length === 0 && (
                                                <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
                                                    {playbackPoints.length === 0
                                                        ? 'No route history recorded for this date.'
                                                        : 'No activity events match this filter.'}
                                                </Typography>
                                            )}
                                        </Box>
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
