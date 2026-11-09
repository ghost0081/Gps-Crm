const MAPS_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';

let loadPromise = null;
let adapter = null;

export function hasGoogleMapsKey() {
    return Boolean(MAPS_KEY);
}

export function mapsApi() {
    return adapter;
}

function colorFromIcon(icon) {
    const html = icon && icon.html ? String(icon.html) : '';
    const match = html.match(/background-color:\s*(#[0-9A-Fa-f]{3,8})/i);
    return match ? match[1] : '#7B61FF';
}

function markerIcon(maps, icon) {
    const color = colorFromIcon(icon);
    const size = (icon && icon.iconSize && icon.iconSize[0]) || 28;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${(size / 2) - 2}" fill="${color}" stroke="#ffffff" stroke-width="3"/></svg>`;
    return {
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
        scaledSize: new maps.Size(size, size),
        anchor: new maps.Point(size / 2, size / 2)
    };
}

function toLatLng(value) {
    if (!value) return null;
    if (Array.isArray(value)) return { lat: Number(value[0]), lng: Number(value[1]) };
    if (typeof value.lat === 'function') return { lat: value.lat(), lng: value.lng() };
    return { lat: Number(value.lat), lng: Number(value.lng) };
}

function createAdapter(maps) {
    function makeMap(element, options = {}) {
        const center = toLatLng(options.center) || { lat: 22.5, lng: 79.0 };
        const map = new maps.Map(element, {
            center,
            zoom: options.zoom || 13,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            clickableIcons: false
        });
        const wrapper = {
            _map: map,
            setView(latlng, zoom) {
                const point = toLatLng(latlng);
                if (point) map.setCenter(point);
                if (zoom) map.setZoom(zoom);
                return wrapper;
            },
            getZoom() {
                return map.getZoom() || 13;
            },
            panTo(latlng) {
                const point = toLatLng(latlng);
                if (point) map.panTo(point);
            },
            invalidateSize() {
                maps.event.trigger(map, 'resize');
            },
            fitBounds(input, options = {}) {
                let bounds = input && input._bounds ? input._bounds : input;
                if (Array.isArray(input)) {
                    bounds = new maps.LatLngBounds();
                    input.forEach((point) => {
                        const latlng = toLatLng(point);
                        if (latlng) bounds.extend(latlng);
                    });
                }
                if (!bounds || typeof bounds.getNorthEast !== 'function') return;
                map.fitBounds(bounds, options.padding ? options.padding[0] : 40);
                if (options.maxZoom) {
                    maps.event.addListenerOnce(map, 'idle', () => {
                        if ((map.getZoom() || 0) > options.maxZoom) map.setZoom(options.maxZoom);
                    });
                }
            },
            remove() {
                element.replaceChildren();
            },
            on(name, handler) {
                if (name !== 'click') return;
                map.addListener('click', (event) => {
                    if (!event.latLng) return;
                    handler({ latlng: { lat: event.latLng.lat(), lng: event.latLng.lng() } });
                });
            },
            removeLayer(layer) {
                if (layer && layer.remove) layer.remove();
            }
        };
        return wrapper;
    }

    function makeCircle(latlng, options = {}) {
        const circle = new maps.Circle({
            center: toLatLng(latlng),
            radius: Number(options.radius) || 0,
            strokeColor: options.color || '#F59E0B',
            strokeWeight: options.weight || 2,
            strokeOpacity: 0.9,
            fillColor: options.fillColor || options.color || '#F59E0B',
            fillOpacity: options.fillOpacity == null ? 0.2 : options.fillOpacity
        });
        let info = null;
        const api = {
            addTo(mapWrap) {
                circle.setMap(mapWrap._map);
                api._map = mapWrap._map;
                return api;
            },
            remove() {
                circle.setMap(null);
                if (info) info.close();
            },
            setLatLng(next) {
                circle.setCenter(toLatLng(next));
            },
            setRadius(radius) {
                circle.setRadius(Number(radius) || 0);
            },
            setStyle(style) {
                circle.setOptions({
                    strokeColor: style.color || circle.get('strokeColor'),
                    fillColor: style.fillColor || style.color,
                    fillOpacity: style.fillOpacity,
                    strokeWeight: style.weight
                });
            },
            getBounds() {
                return circle.getBounds();
            },
            bindPopup(html) {
                info = new maps.InfoWindow({ content: html });
                circle.addListener('click', (event) => {
                    info.setPosition(event.latLng);
                    info.open({ map: api._map });
                });
                return api;
            }
        };
        return api;
    }

    function makePolyline(latlngs, options = {}) {
        const path = (latlngs || []).map(toLatLng).filter(Boolean);
        const dashed = Boolean(options.dashArray);
        const line = new maps.Polyline({
            path,
            strokeColor: options.color || '#2563EB',
            strokeWeight: options.weight || 4,
            strokeOpacity: dashed ? 0 : (options.opacity == null ? 0.85 : options.opacity),
            icons: dashed ? [{
                icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3, strokeColor: options.color || '#D97706' },
                offset: '0',
                repeat: '14px'
            }] : undefined
        });
        const api = {
            addTo(mapWrap) {
                line.setMap(mapWrap._map);
                return api;
            },
            remove() {
                line.setMap(null);
            },
            setLatLngs(next) {
                line.setPath((next || []).map(toLatLng).filter(Boolean));
            }
        };
        return api;
    }

    function makeMarker(latlng, options = {}) {
        const marker = new maps.Marker({
            position: toLatLng(latlng),
            icon: markerIcon(maps, options.icon)
        });
        const info = new maps.InfoWindow();
        const api = {
            _html: '',
            addTo(mapWrap) {
                marker.setMap(mapWrap._map);
                api._map = mapWrap._map;
                return api;
            },
            remove() {
                marker.setMap(null);
                info.close();
            },
            setLatLng(next) {
                marker.setPosition(toLatLng(next));
            },
            setIcon(icon) {
                marker.setIcon(markerIcon(maps, icon));
            },
            bindPopup(html) {
                api._html = html;
                marker.addListener('click', () => {
                    info.setContent(api._html);
                    info.open({ map: api._map, anchor: marker });
                });
                return api;
            },
            getPopup() {
                return {
                    setContent(html) {
                        api._html = html;
                        info.setContent(html);
                    }
                };
            }
        };
        return api;
    }

    return {
        map: makeMap,
        tileLayer() {
            return { addTo() { return this; } };
        },
        circle: makeCircle,
        polyline: makePolyline,
        marker: makeMarker,
        divIcon(options) {
            return options || {};
        },
        latLngBounds(coords) {
            const bounds = new maps.LatLngBounds();
            (coords || []).forEach((point) => {
                const latlng = toLatLng(point);
                if (latlng) bounds.extend(latlng);
            });
            return { _bounds: bounds };
        }
    };
}

export function ensureMaps() {
    if (adapter) return Promise.resolve(adapter);
    if (!MAPS_KEY) return Promise.reject(new Error('missing-key'));
    if (window.google && window.google.maps) {
        adapter = createAdapter(window.google.maps);
        return Promise.resolve(adapter);
    }
    if (!loadPromise) {
        loadPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(MAPS_KEY)}&v=weekly`;
            script.async = true;
            script.onload = () => {
                if (!window.google || !window.google.maps) {
                    reject(new Error('maps-load-failed'));
                    return;
                }
                adapter = createAdapter(window.google.maps);
                resolve(adapter);
            };
            script.onerror = () => reject(new Error('maps-load-failed'));
            document.head.appendChild(script);
        });
    }
    return loadPromise;
}
