/**
 * Route activity timeline (presentation layer).
 *
 * Raw path_history in MongoDB is NEVER mutated. This module builds a
 * chronological journey for playback UIs from a copy of the points.
 *
 * Configurable thresholds (override via options):
 * - dedupeDistanceMeters (12): collapse consecutive GPS jitter within this distance
 * - dedupeTimeMs (20000): only collapse when samples are also close in time
 * - minStopMs (120000): minimum dwell to count as a meaningful stop (2 min)
 * - shortStopMs (60000): allow shorter stop if ≥3 samples cluster
 * - maxGapMs (45 min): gap larger than this opens a "missing data" segment
 * - gpsStayRadiusMin (40) / cellStayRadiusMin (120) / cellStayRadiusMax (280)
 */

const DEFAULT_OPTIONS = {
    dedupeDistanceMeters: 12,
    dedupeTimeMs: 20 * 1000,
    minStopMs: 2 * 60 * 1000,
    shortStopMs: 60 * 1000,
    maxGapMs: 45 * 60 * 1000,
    gpsStayRadiusMin: 40,
    cellStayRadiusMin: 120,
    cellStayRadiusMax: 280,
    bleStayRadiusMin: 15,
    // Merge adjacent stops that share the same place label when the
    // intervening "move" is only GPS/cell jitter (not a real trip).
    coalesceSamePlaceDistanceMeters: 200,
    coalesceSamePlaceMoveMs: 5 * 60 * 1000
};

function mergeOptions(options = {}) {
    return { ...DEFAULT_OPTIONS, ...options };
}

function toNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function isValidPoint(pt) {
    if (!pt) return false;
    const lat = toNumber(pt.lat);
    const lng = toNumber(pt.lng);
    if (lat === null || lng === null) return false;
    if (lat === 0 && lng === 0) return false;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
    return Boolean(pt.timestamp);
}

function haversineMeters(lat1, lng1, lat2, lng2) {
    const rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad;
    const dLng = (lng2 - lng1) * rad;
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function pointTime(pt) {
    return new Date(pt.timestamp).getTime();
}

function stayRadius(pt, options) {
    const type = String(pt.locationType || 'GPS').toUpperCase();
    const accuracy = toNumber(pt.accuracy);
    if (type === 'CELL_TOWER') {
        const raw = Math.max(accuracy || options.cellStayRadiusMin, options.cellStayRadiusMin);
        return Math.min(raw, options.cellStayRadiusMax);
    }
    if (type === 'BLE') return Math.max(accuracy || options.bleStayRadiusMin, options.bleStayRadiusMin);
    return Math.max(accuracy || options.gpsStayRadiusMin, options.gpsStayRadiusMin);
}

function formatCoords(lat, lng) {
    return `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
}

function placeLabel(points) {
    for (const pt of points) {
        const label = String(pt.cellLocation || pt.address || pt.placeLabel || '').trim();
        if (label) return label;
    }
    const last = points[points.length - 1] || points[0];
    return formatCoords(last.lat, last.lng);
}

function clusterCenter(points) {
    let lat = 0;
    let lng = 0;
    for (const pt of points) {
        lat += Number(pt.lat);
        lng += Number(pt.lng);
    }
    return {
        lat: lat / points.length,
        lng: lng / points.length
    };
}

function pathDistance(points) {
    let total = 0;
    for (let i = 1; i < points.length; i += 1) {
        total += haversineMeters(
            Number(points[i - 1].lat),
            Number(points[i - 1].lng),
            Number(points[i].lat),
            Number(points[i].lng)
        );
    }
    return Math.round(total);
}

function normalizeZones(geofences) {
    if (!Array.isArray(geofences)) return [];
    return geofences
        .filter((zone) => zone && zone.enabled !== false && toNumber(zone.lat) !== null && toNumber(zone.lng) !== null)
        .map((zone, index) => ({
            id: zone._id || zone.id || `zone-${index}`,
            name: String(zone.name || `Safe Zone ${index + 1}`).trim() || `Safe Zone ${index + 1}`,
            lat: Number(zone.lat),
            lng: Number(zone.lng),
            radius: Math.max(Number(zone.radius) || 50, 10)
        }));
}

/**
 * Sort + validate raw points. Preserves originalIndex into the filtered list
 * (which matches history indices returned by the API after the same filter/sort).
 */
function prepareRawPoints(rawPoints) {
    const prepared = (Array.isArray(rawPoints) ? rawPoints : [])
        .map((pt, originalIndex) => ({ ...pt, originalIndex }))
        .filter(isValidPoint)
        .map((pt) => ({
            ...pt,
            lat: Number(pt.lat),
            lng: Number(pt.lng)
        }))
        .sort((a, b) => pointTime(a) - pointTime(b));

    // Re-index after sort so startIndex/endIndex align with API history order.
    return prepared.map((pt, index) => ({
        ...pt,
        originalIndex: index
    }));
}

/**
 * Collapse consecutive near-duplicate samples (GPS jitter / repeated cell fixes)
 * for analysis only. Keeps first→last timestamps and source index range.
 */
function collapseJitter(points, options) {
    if (!points.length) return [];
    const collapsed = [];

    for (let i = 0; i < points.length; i += 1) {
        const pt = points[i];
        const last = collapsed[collapsed.length - 1];
        if (last) {
            const dist = haversineMeters(last.lat, last.lng, pt.lat, pt.lng);
            const gap = pointTime(pt) - pointTime({ timestamp: last.lastTimestamp || last.timestamp });
            const samePlace = dist <= options.dedupeDistanceMeters && gap >= 0 && gap <= options.dedupeTimeMs;
            // Exact duplicate coordinates within a short window (common cell refresh)
            const exactDup = dist < 1 && gap >= 0 && gap <= Math.max(options.dedupeTimeMs, 60 * 1000);
            if (samePlace || exactDup) {
                last.lastTimestamp = pt.timestamp;
                last.sourceEndIndex = pt.originalIndex;
                last.memberCount += 1;
                last.members.push(pt);
                // Prefer GPS over CELL when collapsing mixed samples
                const type = String(pt.locationType || '').toUpperCase();
                if (type === 'GPS' && String(last.locationType || '').toUpperCase() !== 'GPS') {
                    last.lat = pt.lat;
                    last.lng = pt.lng;
                    last.locationType = pt.locationType;
                    last.accuracy = pt.accuracy;
                }
                if (!last.cellLocation && pt.cellLocation) last.cellLocation = pt.cellLocation;
                continue;
            }
        }

        collapsed.push({
            lat: pt.lat,
            lng: pt.lng,
            timestamp: pt.timestamp,
            lastTimestamp: pt.timestamp,
            locationType: pt.locationType,
            accuracy: pt.accuracy,
            cellLocation: pt.cellLocation,
            sourceStartIndex: pt.originalIndex,
            sourceEndIndex: pt.originalIndex,
            memberCount: 1,
            members: [pt],
            // Analysis-list index (used temporarily by findStops)
            analysisIndex: collapsed.length
        });
    }

    return collapsed.map((c, analysisIndex) => ({ ...c, analysisIndex }));
}

function findStops(analysisPoints, options = {}) {
    const opts = mergeOptions(options);
    const minStopMs = opts.minStopMs;
    const shortStopMs = opts.shortStopMs;
    const maxGapMs = opts.maxGapMs;
    const stops = [];
    let i = 0;

    while (i < analysisPoints.length) {
        const seed = analysisPoints[i];
        const clusterIndexes = [i];
        let center = { lat: Number(seed.lat), lng: Number(seed.lng) };
        let j = i + 1;

        while (j < analysisPoints.length) {
            const next = analysisPoints[j];
            const prev = analysisPoints[j - 1];
            const gap = pointTime({ timestamp: next.timestamp }) - pointTime({ timestamp: prev.lastTimestamp || prev.timestamp });
            if (gap > maxGapMs) break;

            const radius = Math.max(
                stayRadius(seed, opts),
                stayRadius(next, opts),
                stayRadius(analysisPoints[clusterIndexes[clusterIndexes.length - 1]], opts)
            );
            const dist = haversineMeters(center.lat, center.lng, Number(next.lat), Number(next.lng));
            if (dist > radius) break;

            clusterIndexes.push(j);
            const clusterPoints = clusterIndexes.map((idx) => analysisPoints[idx]);
            center = clusterCenter(clusterPoints);
            j += 1;
        }

        const startA = clusterIndexes[0];
        const endA = clusterIndexes[clusterIndexes.length - 1];
        const startPt = analysisPoints[startA];
        const endPt = analysisPoints[endA];
        const arrivalTs = startPt.timestamp;
        const departureTs = endPt.lastTimestamp || endPt.timestamp;
        const durationMs = Math.max(0, pointTime({ timestamp: departureTs }) - pointTime({ timestamp: arrivalTs }));
        const sampleCount = clusterIndexes.reduce((sum, idx) => sum + (analysisPoints[idx].memberCount || 1), 0);

        if (durationMs >= minStopMs || (sampleCount >= 3 && durationMs >= shortStopMs)) {
            const clusterPoints = clusterIndexes.flatMap((idx) => analysisPoints[idx].members || [analysisPoints[idx]]);
            const centerPoint = clusterCenter(clusterPoints.length ? clusterPoints : [startPt]);
            stops.push({
                startIndex: startPt.sourceStartIndex,
                endIndex: endPt.sourceEndIndex,
                analysisStartIndex: startA,
                analysisEndIndex: endA,
                startTime: arrivalTs,
                endTime: departureTs,
                durationMs,
                lat: centerPoint.lat,
                lng: centerPoint.lng,
                placeLabel: placeLabel(clusterPoints.length ? clusterPoints : [startPt]),
                pointCount: sampleCount,
                stillHere: false
            });
            i = endA + 1;
        } else {
            i += 1;
        }
    }

    return stops;
}

function findZoneVisits(points, zones) {
    const visits = [];
    if (!zones.length || !points.length) return visits;

    for (const zone of zones) {
        let open = null;
        for (let index = 0; index < points.length; index += 1) {
            const pt = points[index];
            const dist = haversineMeters(Number(pt.lat), Number(pt.lng), zone.lat, zone.lng);
            const inside = dist <= zone.radius;
            if (inside && !open) {
                open = {
                    zoneId: zone.id,
                    zoneName: zone.name,
                    zoneLat: zone.lat,
                    zoneLng: zone.lng,
                    zoneRadius: zone.radius,
                    startIndex: pt.originalIndex != null ? pt.originalIndex : index,
                    startTime: pt.timestamp,
                    entryDistanceMeters: Math.round(dist)
                };
            } else if (!inside && open) {
                const prev = points[index - 1] || pt;
                visits.push({
                    ...open,
                    endIndex: prev.originalIndex != null ? prev.originalIndex : index - 1,
                    endTime: prev.timestamp,
                    durationMs: Math.max(0, pointTime(prev) - pointTime({ timestamp: open.startTime })),
                    exitDistanceMeters: Math.round(dist)
                });
                open = null;
            }
        }
        if (open) {
            const last = points[points.length - 1];
            visits.push({
                ...open,
                endIndex: last.originalIndex != null ? last.originalIndex : points.length - 1,
                endTime: last.timestamp,
                durationMs: Math.max(0, pointTime(last) - pointTime({ timestamp: open.startTime })),
                exitDistanceMeters: null,
                stillInside: true
            });
        }
    }

    return visits;
}

function detectGaps(points, options) {
    const gaps = [];
    for (let i = 1; i < points.length; i += 1) {
        const prev = points[i - 1];
        const next = points[i];
        const gapMs = pointTime(next) - pointTime(prev);
        if (gapMs > options.maxGapMs) {
            gaps.push({
                startIndex: prev.originalIndex,
                endIndex: next.originalIndex,
                startTime: prev.timestamp,
                endTime: next.timestamp,
                durationMs: gapMs,
                dataQuality: 'gap'
            });
        }
    }
    return gaps;
}

/**
 * Collapse back-to-back stops at the same labeled place when the travel
 * between them is tiny (common with cell-tower label repetition).
 * Does NOT merge non-adjacent visits (return trips stay separate).
 */
function coalesceAdjacentSamePlaceStops(stops, points, options) {
    if (stops.length < 2) return stops;
    const merged = [];
    let current = { ...stops[0] };

    for (let i = 1; i < stops.length; i += 1) {
        const next = stops[i];
        const sameLabel = String(current.placeLabel || '').trim().toLowerCase()
            === String(next.placeLabel || '').trim().toLowerCase()
            && String(current.placeLabel || '').trim() !== '';
        const segment = points.slice(current.endIndex, next.startIndex + 1);
        const moveDist = segment.length > 1 ? pathDistance(segment) : 0;
        const gpsSegment = segment.filter((p) => String(p.locationType || 'GPS').toUpperCase() === 'GPS');
        const gpsDist = gpsSegment.length > 1 ? pathDistance(gpsSegment) : moveDist;
        const moveMs = Math.max(
            0,
            pointTime({ timestamp: next.startTime }) - pointTime({ timestamp: current.endTime })
        );
        const centerDist = haversineMeters(current.lat, current.lng, next.lat, next.lng);
        // Same reverse-geocode / cell label with only short or low-GPS travel = jitter, not a new visit.
        // Cell multilateration often jumps hundreds of meters while the human-readable place stays identical.
        const trivialMove = (
            moveDist <= options.coalesceSamePlaceDistanceMeters
            && centerDist <= options.coalesceSamePlaceDistanceMeters
            && moveMs <= options.coalesceSamePlaceMoveMs
        ) || (
            sameLabel
            && gpsDist <= options.coalesceSamePlaceDistanceMeters
            && moveMs <= options.coalesceSamePlaceMoveMs * 2
        ) || (
            // Brief leave/return to the exact same labeled place is almost always signal noise.
            sameLabel && moveMs <= 3 * 60 * 1000
        );

        if (sameLabel && trivialMove) {
            current = {
                ...current,
                endIndex: next.endIndex,
                endTime: next.endTime,
                durationMs: Math.max(0, pointTime({ timestamp: next.endTime }) - pointTime({ timestamp: current.startTime })),
                pointCount: (current.pointCount || 0) + (next.pointCount || 0),
                lat: (current.lat + next.lat) / 2,
                lng: (current.lng + next.lng) / 2,
                stillHere: Boolean(next.stillHere)
            };
        } else {
            merged.push(current);
            current = { ...next };
        }
    }
    merged.push(current);
    return merged;
}

function buildMoves(points, stops) {
    const moves = [];
    for (let i = 0; i < stops.length; i += 1) {
        const current = stops[i];
        const moveStart = i === 0 ? 0 : stops[i - 1].endIndex;
        const moveEnd = current.startIndex;
        if (moveEnd > moveStart) {
            const segment = points.slice(moveStart, moveEnd + 1);
            if (segment.length >= 2) {
                const durationMs = Math.max(0, pointTime(segment[segment.length - 1]) - pointTime(segment[0]));
                const distanceMeters = pathDistance(segment);
                if (durationMs > 0 || distanceMeters > 15) {
                    moves.push({
                        startIndex: moveStart,
                        endIndex: moveEnd,
                        startTime: segment[0].timestamp,
                        endTime: segment[segment.length - 1].timestamp,
                        durationMs,
                        distanceMeters,
                        fromLabel: i === 0 ? placeLabel([segment[0]]) : stops[i - 1].placeLabel,
                        toLabel: current.placeLabel,
                        toStopIndex: i,
                        dataQuality: durationMs > 0 ? 'exact' : 'estimated'
                    });
                }
            }
        }
    }

    if (stops.length) {
        const lastStop = stops[stops.length - 1];
        if (lastStop.endIndex < points.length - 1) {
            const segment = points.slice(lastStop.endIndex, points.length);
            if (segment.length >= 2) {
                moves.push({
                    startIndex: lastStop.endIndex,
                    endIndex: points.length - 1,
                    startTime: segment[0].timestamp,
                    endTime: segment[segment.length - 1].timestamp,
                    durationMs: Math.max(0, pointTime(segment[segment.length - 1]) - pointTime(segment[0])),
                    distanceMeters: pathDistance(segment),
                    fromLabel: lastStop.placeLabel,
                    toLabel: placeLabel([segment[segment.length - 1]]),
                    toStopIndex: null,
                    dataQuality: 'exact'
                });
            }
        }
    } else if (points.length > 1) {
        moves.push({
            startIndex: 0,
            endIndex: points.length - 1,
            startTime: points[0].timestamp,
            endTime: points[points.length - 1].timestamp,
            durationMs: Math.max(0, pointTime(points[points.length - 1]) - pointTime(points[0])),
            distanceMeters: pathDistance(points),
            fromLabel: placeLabel([points[0]]),
            toLabel: placeLabel([points[points.length - 1]]),
            toStopIndex: null,
            dataQuality: 'exact'
        });
    }

    return moves;
}

/**
 * Clean chronological journey for parent/admin playback UIs.
 * One row per meaningful stop / move / gap — not arrive+stop+depart triples.
 */
function buildJourney(points, stops, moves, gaps, options) {
    const journey = [];
    if (!points.length) return journey;

    const lastPoint = points[points.length - 1];
    const nowish = pointTime(lastPoint);

    // Mark last stop as stillHere if it ends at the last sample (no departure after).
    if (stops.length) {
        const lastStop = stops[stops.length - 1];
        if (lastStop.endIndex >= points.length - 1) {
            lastStop.stillHere = true;
        }
    }

    let sequence = 1;

    if (!stops.length) {
        if (moves.length) {
            const move = moves[0];
            journey.push({
                id: 'journey-move-only',
                type: 'move',
                role: 'route',
                sequence: sequence++,
                title: 'Continuous movement',
                placeLabel: `${move.fromLabel} → ${move.toLabel}`,
                arrivalTime: null,
                departureTime: null,
                startTime: move.startTime,
                endTime: move.endTime,
                durationMs: move.durationMs,
                distanceMeters: move.distanceMeters,
                stillHere: false,
                dataQuality: move.dataQuality || 'exact',
                startIndex: move.startIndex,
                endIndex: move.endIndex,
                details: `In motion for ${formatDuration(move.durationMs)} · ${move.distanceMeters} m`
            });
        } else {
            journey.push({
                id: 'journey-single',
                type: 'start',
                role: 'start',
                sequence: sequence++,
                title: 'Starting location',
                placeLabel: placeLabel([points[0]]),
                arrivalTime: points[0].timestamp,
                departureTime: null,
                startTime: points[0].timestamp,
                endTime: points[0].timestamp,
                durationMs: 0,
                stillHere: true,
                dataQuality: 'exact',
                startIndex: 0,
                endIndex: 0,
                details: 'Only one valid location sample for this day'
            });
        }
        return journey;
    }

    stops.forEach((stop, index) => {
        const inbound = moves.find((m) => m.toStopIndex === index);
        const isFirst = index === 0;
        const isLast = index === stops.length - 1 && stop.stillHere;
        const role = isFirst ? 'start' : (isLast ? 'destination' : 'stop');
        const type = isFirst ? 'start' : (isLast ? 'destination' : 'stop');

        let title;
        if (isFirst) title = `Journey start · ${stop.placeLabel}`;
        else if (isLast) title = `Destination · ${stop.placeLabel}`;
        else title = stop.placeLabel;

        const gapBefore = gaps.find((g) => g.endIndex === stop.startIndex || (g.endIndex >= stop.startIndex && g.startIndex < stop.startIndex));

        journey.push({
            id: `journey-stop-${index}`,
            type,
            role,
            sequence: sequence++,
            title,
            placeLabel: stop.placeLabel,
            arrivalTime: stop.startTime,
            departureTime: stop.stillHere ? null : stop.endTime,
            startTime: stop.startTime,
            endTime: stop.endTime,
            durationMs: stop.durationMs,
            stillHere: Boolean(stop.stillHere),
            travelFromPreviousMs: inbound ? inbound.durationMs : null,
            travelFromPreviousMeters: inbound ? inbound.distanceMeters : null,
            dataQuality: gapBefore ? 'estimated' : 'exact',
            startIndex: stop.startIndex,
            endIndex: stop.endIndex,
            pointCount: stop.pointCount,
            lat: stop.lat,
            lng: stop.lng,
            details: stop.stillHere
                ? `Currently at this location · elapsed ${formatDuration(stop.durationMs)}`
                : `Stopped for ${formatDuration(stop.durationMs)}`
                + (inbound ? ` · arrived after ${formatDuration(inbound.durationMs)} / ${inbound.distanceMeters} m` : '')
        });

        // Insert move after this stop when travelling to the next stop
        const outbound = moves.find((m) => m.toStopIndex === index + 1);
        if (outbound) {
            journey.push({
                id: `journey-move-${index}`,
                type: 'move',
                role: 'travel',
                sequence: sequence++,
                title: `Travel to ${outbound.toLabel}`,
                placeLabel: outbound.toLabel,
                fromLabel: outbound.fromLabel,
                toLabel: outbound.toLabel,
                arrivalTime: null,
                departureTime: null,
                startTime: outbound.startTime,
                endTime: outbound.endTime,
                durationMs: outbound.durationMs,
                distanceMeters: outbound.distanceMeters,
                stillHere: false,
                dataQuality: outbound.dataQuality || 'exact',
                startIndex: outbound.startIndex,
                endIndex: outbound.endIndex,
                details: `In motion for ${formatDuration(outbound.durationMs)} · ${outbound.distanceMeters} m`
            });
        } else if (isLast && !stop.stillHere) {
            // Final move after last stop (ended away from a long stop)
            const trailing = moves.find((m) => m.toStopIndex === null && m.startIndex >= stop.endIndex);
            if (trailing) {
                journey.push({
                    id: `journey-move-final`,
                    type: 'move',
                    role: 'travel',
                    sequence: sequence++,
                    title: `Continued to ${trailing.toLabel}`,
                    placeLabel: trailing.toLabel,
                    fromLabel: trailing.fromLabel,
                    toLabel: trailing.toLabel,
                    arrivalTime: null,
                    departureTime: null,
                    startTime: trailing.startTime,
                    endTime: trailing.endTime,
                    durationMs: trailing.durationMs,
                    distanceMeters: trailing.distanceMeters,
                    stillHere: false,
                    dataQuality: trailing.dataQuality || 'exact',
                    startIndex: trailing.startIndex,
                    endIndex: trailing.endIndex,
                    details: `In motion for ${formatDuration(trailing.durationMs)} · ${trailing.distanceMeters} m`
                });
            }
        }
    });

    // Insert connectivity gaps as explicit journey rows (safety-critical honesty)
    for (const gap of gaps) {
        const exists = journey.some((j) => j.type === 'gap' && j.startIndex === gap.startIndex);
        if (exists) continue;
        // Place gap chronologically by splicing near matching time
        const gapEvent = {
            id: `journey-gap-${gap.startIndex}`,
            type: 'gap',
            role: 'gap',
            sequence: 0,
            title: 'Location data unavailable',
            placeLabel: 'Connectivity / reporting gap',
            arrivalTime: null,
            departureTime: null,
            startTime: gap.startTime,
            endTime: gap.endTime,
            durationMs: gap.durationMs,
            stillHere: false,
            dataQuality: 'gap',
            startIndex: gap.startIndex,
            endIndex: gap.endIndex,
            details: `No reliable updates for ${formatDuration(gap.durationMs)}`
        };
        journey.push(gapEvent);
    }

    journey.sort((a, b) => {
        const ta = new Date(a.startTime || a.arrivalTime || 0).getTime();
        const tb = new Date(b.startTime || b.arrivalTime || 0).getTime();
        if (ta !== tb) return ta - tb;
        const order = { start: 0, stop: 1, destination: 2, move: 3, gap: 4 };
        return (order[a.type] || 50) - (order[b.type] || 50);
    });

    journey.forEach((step, idx) => {
        step.sequence = idx + 1;
    });

    // Silence unused var lint for nowish if needed — used for potential future "ongoing vs day end"
    void nowish;
    void options;

    return journey;
}

function buildLegacyEvents(points, stops, moves, zoneVisits) {
    const events = [];

    stops.forEach((stop, index) => {
        const inbound = moves.find((move) => move.toStopIndex === index);
        events.push({
            id: `arrive-${index}`,
            type: 'arrive',
            title: `Arrived at ${stop.placeLabel}`,
            placeLabel: stop.placeLabel,
            lat: stop.lat,
            lng: stop.lng,
            startTime: stop.startTime,
            endTime: stop.startTime,
            durationMs: inbound ? inbound.durationMs : 0,
            travelDurationMs: inbound ? inbound.durationMs : 0,
            travelDistanceMeters: inbound ? inbound.distanceMeters : 0,
            startIndex: stop.startIndex,
            endIndex: stop.startIndex,
            details: inbound
                ? `Reached after ${formatDuration(inbound.durationMs)} and ${inbound.distanceMeters} m of travel`
                : 'Arrival recorded at this location'
        });

        events.push({
            id: `stop-${index}`,
            type: 'stop',
            title: `Stopped at ${stop.placeLabel}`,
            placeLabel: stop.placeLabel,
            lat: stop.lat,
            lng: stop.lng,
            startTime: stop.startTime,
            endTime: stop.endTime,
            durationMs: stop.durationMs,
            startIndex: stop.startIndex,
            endIndex: stop.endIndex,
            pointCount: stop.pointCount,
            stillHere: Boolean(stop.stillHere),
            details: stop.stillHere
                ? `Currently at this location · ${formatDuration(stop.durationMs)}`
                : `Stationary for ${formatDuration(stop.durationMs)}`
        });

        if (!stop.stillHere) {
            events.push({
                id: `depart-${index}`,
                type: 'depart',
                title: `Left ${stop.placeLabel}`,
                placeLabel: stop.placeLabel,
                lat: stop.lat,
                lng: stop.lng,
                startTime: stop.endTime,
                endTime: stop.endTime,
                durationMs: 0,
                startIndex: stop.endIndex,
                endIndex: stop.endIndex,
                details: `Departure at ${formatClock(stop.endTime)}`
            });
        }
    });

    moves.forEach((move, index) => {
        events.push({
            id: `move-${index}`,
            type: 'move',
            title: move.toStopIndex === null
                ? `Moved from ${move.fromLabel}`
                : `Travel to ${move.toLabel}`,
            placeLabel: move.toLabel,
            lat: points[move.endIndex].lat,
            lng: points[move.endIndex].lng,
            fromLabel: move.fromLabel,
            toLabel: move.toLabel,
            startTime: move.startTime,
            endTime: move.endTime,
            durationMs: move.durationMs,
            distanceMeters: move.distanceMeters,
            startIndex: move.startIndex,
            endIndex: move.endIndex,
            details: `In motion for ${formatDuration(move.durationMs)} · ${move.distanceMeters} m`
        });
    });

    zoneVisits.forEach((visit, index) => {
        events.push({
            id: `zone-enter-${index}`,
            type: 'zone_enter',
            title: `Entered ${visit.zoneName}`,
            placeLabel: visit.zoneName,
            zoneName: visit.zoneName,
            lat: visit.zoneLat,
            lng: visit.zoneLng,
            startTime: visit.startTime,
            endTime: visit.startTime,
            durationMs: 0,
            startIndex: visit.startIndex,
            endIndex: visit.startIndex,
            details: `Safe zone entry at ${formatClock(visit.startTime)}`
        });
        events.push({
            id: `zone-visit-${index}`,
            type: 'zone_visit',
            title: `Inside ${visit.zoneName}`,
            placeLabel: visit.zoneName,
            zoneName: visit.zoneName,
            lat: visit.zoneLat,
            lng: visit.zoneLng,
            startTime: visit.startTime,
            endTime: visit.endTime,
            durationMs: visit.durationMs,
            startIndex: visit.startIndex,
            endIndex: visit.endIndex,
            stillInside: Boolean(visit.stillInside),
            details: visit.stillInside
                ? `Stayed inside for ${formatDuration(visit.durationMs)} (still inside at end of day)`
                : `Stayed inside for ${formatDuration(visit.durationMs)}`
        });
        if (!visit.stillInside) {
            events.push({
                id: `zone-exit-${index}`,
                type: 'zone_exit',
                title: `Exited ${visit.zoneName}`,
                placeLabel: visit.zoneName,
                zoneName: visit.zoneName,
                lat: visit.zoneLat,
                lng: visit.zoneLng,
                startTime: visit.endTime,
                endTime: visit.endTime,
                durationMs: 0,
                startIndex: visit.endIndex,
                endIndex: visit.endIndex,
                details: `Safe zone exit at ${formatClock(visit.endTime)}`
            });
        }
    });

    events.sort((a, b) => {
        const timeDiff = new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
        if (timeDiff !== 0) return timeDiff;
        const order = {
            zone_enter: 0,
            arrive: 1,
            stop: 2,
            zone_visit: 3,
            depart: 4,
            move: 5,
            zone_exit: 6
        };
        return (order[a.type] || 50) - (order[b.type] || 50);
    });

    return events;
}

function buildActivityTimeline(rawPoints, rawGeofences = [], options = {}) {
    const opts = mergeOptions(options);
    const points = prepareRawPoints(rawPoints);
    const zones = normalizeZones(rawGeofences);

    if (!points.length) {
        return {
            events: [],
            journey: [],
            stops: [],
            moves: [],
            gaps: [],
            zoneVisits: [],
            geofences: zones,
            thresholds: opts,
            summary: {
                pointCount: 0,
                analysisPointCount: 0,
                stopCount: 0,
                moveCount: 0,
                zoneVisitCount: 0,
                gapCount: 0,
                totalStopMs: 0,
                totalMoveMs: 0,
                totalActiveMs: 0,
                totalDistanceMeters: 0,
                firstTimestamp: null,
                lastTimestamp: null,
                journeyStartTime: null,
                destinationArrivalTime: null
            }
        };
    }

    const analysisPoints = collapseJitter(points, opts);
    const rawStops = findStops(analysisPoints, opts);
    const stops = coalesceAdjacentSamePlaceStops(rawStops, points, opts);
    const moves = buildMoves(points, stops);
    const gaps = detectGaps(points, opts);
    const zoneVisits = findZoneVisits(points, zones);
    const journey = buildJourney(points, stops, moves, gaps, opts);
    const events = buildLegacyEvents(points, stops, moves, zoneVisits);

    const totalStopMs = stops.reduce((sum, stop) => sum + stop.durationMs, 0);
    const totalMoveMs = moves.reduce((sum, move) => sum + move.durationMs, 0);
    const totalDistanceMeters = moves.reduce((sum, move) => sum + (move.distanceMeters || 0), 0);
    const totalActiveMs = Math.max(0, pointTime(points[points.length - 1]) - pointTime(points[0]));
    const firstStop = stops[0] || null;
    const lastStop = stops.length ? stops[stops.length - 1] : null;

    return {
        events,
        journey,
        stops,
        moves,
        gaps,
        zoneVisits,
        geofences: zones,
        thresholds: opts,
        summary: {
            pointCount: points.length,
            analysisPointCount: analysisPoints.length,
            stopCount: stops.length,
            moveCount: moves.length,
            zoneVisitCount: zoneVisits.length,
            gapCount: gaps.length,
            totalStopMs,
            totalMoveMs,
            totalActiveMs,
            totalDistanceMeters,
            firstTimestamp: points[0].timestamp,
            lastTimestamp: points[points.length - 1].timestamp,
            journeyStartTime: firstStop ? firstStop.startTime : points[0].timestamp,
            destinationArrivalTime: lastStop && lastStop.stillHere ? lastStop.startTime : null
        }
    };
}

function formatDuration(ms) {
    const totalSeconds = Math.max(0, Math.round(Number(ms) / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
}

function formatClock(value) {
    try {
        return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (e) {
        return String(value || '');
    }
}

module.exports = {
    buildActivityTimeline,
    formatDuration,
    haversineMeters,
    isValidPoint,
    collapseJitter,
    DEFAULT_OPTIONS
};
