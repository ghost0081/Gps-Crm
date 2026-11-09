export function formatDuration(ms) {
    const totalSeconds = Math.max(0, Math.round(Number(ms || 0) / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
}

export function formatClock(value) {
    if (!value) return '—';
    try {
        return new Date(value).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    } catch (e) {
        return String(value);
    }
}

export function formatClockRange(start, end) {
    if (!start) return '—';
    if (!end || start === end) return formatClock(start);
    return `${formatClock(start)} → ${formatClock(end)}`;
}

export const ACTIVITY_STYLES = {
    arrive: { label: 'Arrival', color: '#059669', bg: '#ECFDF5', icon: '📍' },
    stop: { label: 'Stop', color: '#D97706', bg: '#FFFBEB', icon: '🛑' },
    depart: { label: 'Departure', color: '#DC2626', bg: '#FEF2F2', icon: '🚪' },
    move: { label: 'Moving', color: '#2563EB', bg: '#EFF6FF', icon: '🚶' },
    zone_enter: { label: 'Zone In', color: '#7C3AED', bg: '#F5F3FF', icon: '🛡️' },
    zone_visit: { label: 'Safe Zone', color: '#6D28D9', bg: '#F5F3FF', icon: '🏠' },
    zone_exit: { label: 'Zone Out', color: '#9333EA', bg: '#FAF5FF', icon: '🚪' }
};

export function eventActiveAtIndex(event, playbackIndex) {
    if (!event) return false;
    const start = Number(event.startIndex);
    const end = Number(event.endIndex);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
    return playbackIndex >= start && playbackIndex <= end;
}

export function findActiveEvent(events, playbackIndex) {
    if (!Array.isArray(events) || !events.length) return null;
    const preferred = ['stop', 'zone_visit', 'move', 'arrive', 'depart', 'zone_enter', 'zone_exit'];
    for (const type of preferred) {
        const match = events.find((event) => event.type === type && eventActiveAtIndex(event, playbackIndex));
        if (match) return match;
    }
    return events.find((event) => eventActiveAtIndex(event, playbackIndex)) || null;
}
