import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from 'axios';
import {
    Box, Button, Checkbox, FormControlLabel, MenuItem, TextField, Typography, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import DatabaseExplorer from './DatabaseExplorer';
import {
    PAGE_PRESETS, CATEGORIES, blankDesign, makeElement, buildDocumentHtml, fieldToken, modelsOnDesign, newId,
} from './designDocument';

function openPrintWindow(design, values) {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(buildDocumentHtml(design, values));
    win.document.close();
    win.onload = () => win.print();
}

const API = process.env.REACT_APP_BASE_URL;
const TABS = ['Templates', 'Elements', 'Text', 'Images', 'Database', 'Assets'];

function snap(value, enabled) {
    if (!enabled) return Math.round(value * 10) / 10;
    return Math.round(value);
}

export default function DesignStudioPage() {
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { currentUser } = useSelector((state) => state.user);
    const schoolId = currentUser?._id;
    const [design, setDesign] = useState(() => blankDesign(searchParams.get('category') || 'custom'));
    const [pageIndex, setPageIndex] = useState(0);
    const [selected, setSelected] = useState([]);
    const [tab, setTab] = useState('Database');
    const [zoom, setZoom] = useState(0.85);
    const [grid, setGrid] = useState(true);
    const [schema, setSchema] = useState({ tables: [], relationships: [] });
    const [templates, setTemplates] = useState([]);
    const [status, setStatus] = useState('');
    const [previewOn, setPreviewOn] = useState(false);
    const [values, setValues] = useState({});
    const [warnings, setWarnings] = useState([]);
    const [anchors, setAnchors] = useState({});
    const [recordOptions, setRecordOptions] = useState({});
    const past = useRef([]);
    const future = useRef([]);
    const designRef = useRef(design);
    const clipboard = useRef([]);
    designRef.current = design;
    const pxPerMm = 3.6 * zoom;
    const page = design.pages[pageIndex] || design.pages[0];
    const elements = page?.elements || [];

    const remember = useCallback(() => {
        past.current.push(JSON.parse(JSON.stringify(designRef.current)));
        if (past.current.length > 40) past.current.shift();
        future.current = [];
    }, []);

    const updateElements = useCallback((nextElements, keepHistory) => {
        if (keepHistory) remember();
        setDesign((current) => {
            const pages = current.pages.map((item, index) => (
                index === pageIndex ? { ...item, elements: nextElements } : item
            ));
            return { ...current, pages };
        });
    }, [pageIndex, remember]);

    useEffect(() => {
        if (!schoolId) return;
        axios.get(`${API}/Design/Schema`, { params: { schoolId } })
            .then((res) => setSchema(res.data || { tables: [], relationships: [] }))
            .catch(() => setStatus('The database structure could not be loaded.'));
        axios.get(`${API}/Design/Templates`, { params: { schoolId } })
            .then((res) => setTemplates(res.data || []))
            .catch(() => setTemplates([]));
    }, [schoolId]);

    useEffect(() => {
        if (!schoolId || !id || id === 'new') return;
        axios.get(`${API}/Design/Templates/${id}`, { params: { schoolId } })
            .then((res) => {
                setDesign(res.data);
                setPageIndex(0);
                setStatus('');
            })
            .catch(() => setStatus('This design could not be opened.'));
    }, [schoolId, id]);

    const selectedElements = elements.filter((item) => selected.includes(item.id));
    const active = selectedElements.length === 1 ? selectedElements[0] : null;

    const patchSelected = (patch, keepHistory = true) => {
        if (!selected.length) return;
        const next = elements.map((item) => (
            selected.includes(item.id) ? { ...item, ...patch, style: patch.style ? { ...item.style, ...patch.style } : item.style } : item
        ));
        updateElements(next, keepHistory);
    };

    const place = (element, point) => {
        remember();
        const created = makeElement({
            ...element,
            x: snap(point?.x ?? 12, grid),
            y: snap(point?.y ?? 12, grid),
            z: Math.max(0, ...elements.map((item) => item.z || 1)) + 1,
        });
        updateElements([...elements, created], false);
        setSelected([created.id]);
    };

    const onDrop = (event) => {
        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        const point = {
            x: (event.clientX - rect.left) / pxPerMm,
            y: (event.clientY - rect.top) / pxPerMm,
        };
        const fieldRaw = event.dataTransfer.getData('application/x-school-field');
        const toolRaw = event.dataTransfer.getData('application/x-design-tool');
        if (fieldRaw) {
            const payload = JSON.parse(fieldRaw);
            const field = payload.field;
            if (field.collectionPath) {
                const columnPath = field.path.slice(field.collectionPath.length + 1);
                place({
                    type: 'table',
                    w: Math.min(design.page.widthMm - 16, 160),
                    h: 40,
                    binding: { model: payload.table, path: field.collectionPath, label: field.collectionPath },
                    columns: [{ path: columnPath, label: field.label, format: field.dataType === 'number' ? 'number' : 'text', width: 40 }],
                }, point);
                return;
            }
            place({
                type: 'field',
                w: 70,
                h: 8,
                format: field.dataType === 'date' ? 'date' : 'text',
                binding: { model: payload.table, path: field.path, label: field.label },
            }, point);
            return;
        }
        if (toolRaw) {
            const tool = JSON.parse(toolRaw);
            place(tool, point);
        }
    };

    const beginDrag = (event, element) => {
        if (element.locked) return;
        event.stopPropagation();
        const groupIds = element.groupId
            ? elements.filter((item) => item.groupId === element.groupId).map((item) => item.id)
            : [element.id];
        const moving = selected.includes(element.id) ? selected : groupIds;
        setSelected(moving);
        remember();
        const startX = event.clientX;
        const startY = event.clientY;
        const origins = Object.fromEntries(elements.filter((item) => moving.includes(item.id)).map((item) => [item.id, { x: item.x, y: item.y }]));
        const move = (ev) => {
            const dx = (ev.clientX - startX) / pxPerMm;
            const dy = (ev.clientY - startY) / pxPerMm;
            setDesign((current) => ({
                ...current,
                pages: current.pages.map((item, index) => (
                    index !== pageIndex ? item : {
                        ...item,
                        elements: item.elements.map((entry) => (
                            origins[entry.id]
                                ? { ...entry, x: snap(origins[entry.id].x + dx, grid), y: snap(origins[entry.id].y + dy, grid) }
                                : entry
                        )),
                    }
                )),
            }));
        };
        const up = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    };

    const beginResize = (event, element) => {
        if (element.locked) return;
        event.stopPropagation();
        remember();
        const startX = event.clientX;
        const startY = event.clientY;
        const origin = { w: element.w, h: element.h };
        const move = (ev) => {
            const dw = (ev.clientX - startX) / pxPerMm;
            const dh = (ev.clientY - startY) / pxPerMm;
            setDesign((current) => ({
                ...current,
                pages: current.pages.map((item, index) => (
                    index !== pageIndex ? item : {
                        ...item,
                        elements: item.elements.map((entry) => (
                            entry.id === element.id
                                ? { ...entry, w: Math.max(8, snap(origin.w + dw, grid)), h: Math.max(4, snap(origin.h + dh, grid)) }
                                : entry
                        )),
                    }
                )),
            }));
        };
        const up = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    };

    const undo = useCallback(() => {
        const previous = past.current.pop();
        if (!previous) return;
        future.current.push(designRef.current);
        setDesign(previous);
    }, []);

    const redo = useCallback(() => {
        const next = future.current.pop();
        if (!next) return;
        past.current.push(designRef.current);
        setDesign(next);
    }, []);

    const removeSelected = useCallback(() => {
        if (!selected.length) return;
        remember();
        setDesign((current) => ({
            ...current,
            pages: current.pages.map((item, index) => (
                index === pageIndex ? { ...item, elements: item.elements.filter((entry) => !selected.includes(entry.id) || entry.locked) } : item
            )),
        }));
        setSelected([]);
    }, [selected, pageIndex, remember]);

    useEffect(() => {
        const onKey = (event) => {
            const typing = ['INPUT', 'TEXTAREA'].includes(event.target.tagName);
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
                event.preventDefault();
                if (event.shiftKey) redo();
                else undo();
            } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
                event.preventDefault();
                redo();
            } else if (!typing && (event.key === 'Delete' || event.key === 'Backspace')) {
                event.preventDefault();
                removeSelected();
            } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
                clipboard.current = elements.filter((item) => selected.includes(item.id));
            } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') {
                if (!clipboard.current.length) return;
                remember();
                const clones = clipboard.current.map((item) => makeElement({ ...item, id: newId('el'), x: item.x + 4, y: item.y + 4, locked: false }));
                updateElements([...elements, ...clones], false);
                setSelected(clones.map((item) => item.id));
            } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
                event.preventDefault();
                const clones = elements.filter((item) => selected.includes(item.id)).map((item) => makeElement({ ...item, id: newId('el'), x: item.x + 4, y: item.y + 4 }));
                if (!clones.length) return;
                remember();
                updateElements([...elements, ...clones], false);
                setSelected(clones.map((item) => item.id));
            } else if (!typing && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
                event.preventDefault();
                const step = event.shiftKey ? 5 : 1;
                const delta = {
                    ArrowUp: [0, -step],
                    ArrowDown: [0, step],
                    ArrowLeft: [-step, 0],
                    ArrowRight: [step, 0],
                }[event.key];
                remember();
                updateElements(elements.map((item) => (
                    selected.includes(item.id) && !item.locked ? { ...item, x: item.x + delta[0], y: item.y + delta[1] } : item
                )), false);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [elements, selected, undo, redo, removeSelected, remember, updateElements]);

    const save = async () => {
        if (!schoolId) return;
        const payload = {
            schoolId,
            name: design.name,
            category: design.category,
            isDefault: design.isDefault,
            page: design.page,
            pages: design.pages,
            assets: design.assets || [],
        };
        const res = !id || id === 'new'
            ? await axios.post(`${API}/Design/Templates`, payload)
            : await axios.put(`${API}/Design/Templates/${id}`, payload);
        setStatus('Design saved.');
        if (!id || id === 'new') navigate(`/Admin/design/edit/${res.data._id}`, { replace: true });
    };

    const runPreview = async () => {
        const res = await axios.post(`${API}/Design/Preview`, {
            schoolId,
            pages: design.pages,
            anchors,
        });
        setValues(res.data.values || {});
        setWarnings(res.data.warnings || []);
        setPreviewOn(true);
    };

    const boundModels = useMemo(() => modelsOnDesign(design), [design]);

    useEffect(() => {
        if (!schoolId) return;
        boundModels.forEach((model) => {
            axios.get(`${API}/Design/Records`, { params: { schoolId, model } })
                .then((res) => setRecordOptions((current) => ({ ...current, [model]: res.data || [] })))
                .catch(() => setRecordOptions((current) => ({ ...current, [model]: [] })));
        });
    }, [schoolId, boundModels]);

    const uploadImage = (file) => {
        if (!file || !/^image\/(png|jpeg|jpg|webp|gif)$/i.test(file.type)) {
            setStatus('Choose a PNG, JPEG, WEBP, or GIF image.');
            return;
        }
        if (file.size > 400000) {
            setStatus('Use an image under 400 KB.');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const asset = { id: newId('asset'), name: file.name, dataUrl: reader.result };
            remember();
            setDesign((current) => ({ ...current, assets: [...(current.assets || []), asset] }));
            place({ type: 'image', assetId: asset.id, w: 40, h: 30 }, { x: 12, y: 12 });
        };
        reader.readAsDataURL(file);
    };

    const displayText = (item) => {
        if (item.type === 'field' || item.type === 'code') {
            if (previewOn && values[item.id]) return values[item.id].text || '—';
            return fieldToken(item.binding);
        }
        return item.text;
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 88px)', minHeight: 560, mx: -1 }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', px: 1, py: 1, borderBottom: '1px solid #E2E8F0' }}>
                <TextField size="small" label="Name" value={design.name || ''} onChange={(event) => setDesign({ ...design, name: event.target.value })} />
                <TextField size="small" select label="Category" value={design.category || 'custom'} onChange={(event) => setDesign({ ...design, category: event.target.value })} sx={{ minWidth: 160 }}>
                    {CATEGORIES.map((item) => <MenuItem key={item.id} value={item.id}>{item.label}</MenuItem>)}
                </TextField>
                <Button variant="contained" onClick={save}>Save</Button>
                <Button variant="outlined" onClick={runPreview}>Preview data</Button>
                <Button variant="outlined" onClick={() => setPreviewOn(false)}>Show tokens</Button>
                <Button variant="outlined" onClick={() => openPrintWindow(designRef.current, previewOn ? values : {})}>Print / PDF</Button>
                <Button onClick={undo}>Undo</Button>
                <Button onClick={redo}>Redo</Button>
                <Button onClick={() => setZoom((value) => Math.min(2, value + 0.1))}>Zoom in</Button>
                <Button onClick={() => setZoom((value) => Math.max(0.4, value - 0.1))}>Zoom out</Button>
                <Button onClick={() => setZoom(0.85)}>Fit</Button>
                <FormControlLabel control={<Checkbox checked={grid} onChange={(event) => setGrid(event.target.checked)} />} label="Snap" />
                <Typography variant="caption">{Math.round(zoom * 100)}%</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>{status}</Typography>
            </Box>
            {warnings.length > 0 && (
                <Typography variant="caption" color="warning.main" sx={{ px: 1 }}>{warnings.join(' ')}</Typography>
            )}
            <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
                <Box sx={{ width: { xs: 220, md: 280 }, borderRight: '1px solid #E2E8F0', p: 1, overflow: 'auto' }}>
                    <ToggleButtonGroup size="small" exclusive value={tab} onChange={(_, next) => next && setTab(next)} sx={{ flexWrap: 'wrap', mb: 1 }}>
                        {TABS.map((item) => <ToggleButton key={item} value={item} sx={{ fontSize: 11, px: 1 }}>{item}</ToggleButton>)}
                    </ToggleButtonGroup>
                    {tab === 'Templates' && templates.map((item) => (
                        <Button key={item._id} fullWidth sx={{ justifyContent: 'flex-start' }} onClick={() => navigate(`/Admin/design/edit/${item._id}`)}>
                            {item.name}
                        </Button>
                    ))}
                    {tab === 'Elements' && (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            {[
                                { label: 'Rectangle', payload: { type: 'shape', shape: 'rect', w: 40, h: 20, style: { background: '#E2E8F0' } } },
                                { label: 'Ellipse', payload: { type: 'shape', shape: 'ellipse', w: 30, h: 20, style: { background: '#DBEAFE' } } },
                                { label: 'Line', payload: { type: 'shape', shape: 'line', w: 60, h: 1, style: { background: '#111827' } } },
                            ].map((tool) => (
                                <Button key={tool.label} variant="outlined" draggable onDragStart={(event) => event.dataTransfer.setData('application/x-design-tool', JSON.stringify(tool.payload))} onClick={() => place(tool.payload)}>
                                    {tool.label}
                                </Button>
                            ))}
                        </Box>
                    )}
                    {tab === 'Text' && (
                        <Button variant="outlined" draggable onDragStart={(event) => event.dataTransfer.setData('application/x-design-tool', JSON.stringify({ type: 'text', text: 'Text', w: 50, h: 8 }))} onClick={() => place({ type: 'text', text: 'Text', w: 50, h: 8 })}>
                            Add text
                        </Button>
                    )}
                    {tab === 'Images' && (
                        <Button variant="outlined" component="label">
                            Upload image
                            <input hidden type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => uploadImage(event.target.files?.[0])} />
                        </Button>
                    )}
                    {tab === 'Database' && (
                        <DatabaseExplorer
                            schema={schema}
                            onInsertField={(table, field) => place({
                                type: 'field',
                                w: 70,
                                h: 8,
                                format: field.dataType === 'date' ? 'date' : 'text',
                                binding: { model: table.model, path: field.path, label: field.label },
                            })}
                            onInsertTable={(table, field) => place({
                                type: 'table',
                                w: 160,
                                h: 40,
                                binding: { model: table.model, path: field.collectionPath, label: field.collectionPath },
                                columns: [{ path: field.path.slice(field.collectionPath.length + 1), label: field.label, format: 'text', width: 40 }],
                            })}
                        />
                    )}
                    {tab === 'Assets' && (design.assets || []).map((asset) => (
                        <Button key={asset.id} fullWidth onClick={() => place({ type: 'image', assetId: asset.id, w: 40, h: 30 })}>{asset.name}</Button>
                    ))}
                </Box>
                <Box sx={{ flex: 1, overflow: 'auto', bgcolor: '#F1F5F9', p: 2 }} onMouseDown={() => setSelected([])}>
                    <Box sx={{ display: 'flex', gap: 1, mb: 1 }} onMouseDown={(event) => event.stopPropagation()}>
                        {design.pages.map((item, index) => (
                            <Button key={item.id} size="small" variant={index === pageIndex ? 'contained' : 'outlined'} onClick={() => { setPageIndex(index); setSelected([]); }}>
                                Page {index + 1}
                            </Button>
                        ))}
                        <Button size="small" onClick={() => {
                            remember();
                            setDesign((current) => ({ ...current, pages: [...current.pages, { id: newId('page'), elements: [] }] }));
                        }}>Add page</Button>
                    </Box>
                    <Box
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={onDrop}
                        onMouseDown={(event) => event.stopPropagation()}
                        sx={{
                            position: 'relative',
                            width: design.page.widthMm * pxPerMm,
                            height: design.page.heightMm * pxPerMm,
                            bgcolor: design.page.background || '#fff',
                            boxShadow: 'none',
                            border: '1px solid #CBD5E1',
                            backgroundImage: grid ? 'linear-gradient(#E2E8F0 1px, transparent 1px), linear-gradient(90deg, #E2E8F0 1px, transparent 1px)' : 'none',
                            backgroundSize: grid ? `${10 * pxPerMm}px ${10 * pxPerMm}px` : 'auto',
                        }}
                    >
                        {elements.map((item) => (
                            <Box
                                key={item.id}
                                onPointerDown={(event) => beginDrag(event, item)}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    setSelected((current) => (
                                        event.shiftKey
                                            ? (current.includes(item.id) ? current.filter((entry) => entry !== item.id) : [...current, item.id])
                                            : [item.id]
                                    ));
                                }}
                                sx={{
                                    position: 'absolute',
                                    left: item.x * pxPerMm,
                                    top: item.y * pxPerMm,
                                    width: item.w * pxPerMm,
                                    height: item.h * pxPerMm,
                                    transform: `rotate(${item.rotation || 0}deg)`,
                                    zIndex: item.z || 1,
                                    outline: selected.includes(item.id) ? '1px solid #2563EB' : 'none',
                                    cursor: item.locked ? 'not-allowed' : 'move',
                                    overflow: 'hidden',
                                    fontFamily: item.style?.fontFamily,
                                    fontSize: item.style?.fontSize,
                                    color: item.style?.color,
                                    textAlign: item.style?.align,
                                    fontWeight: item.style?.bold ? 700 : 400,
                                    fontStyle: item.style?.italic ? 'italic' : 'normal',
                                    lineHeight: item.style?.lineHeight,
                                    background: item.type === 'shape' ? (item.style?.background || '#111827') : (item.style?.background || 'transparent'),
                                    borderRadius: item.shape === 'ellipse' ? '50%' : 0,
                                    border: `${item.style?.borderWidth || 0}px solid ${item.style?.borderColor || '#111'}`,
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                }}
                            >
                                {item.type === 'image' && (
                                    <img alt="" src={(design.assets || []).find((asset) => asset.id === item.assetId)?.dataUrl || ''} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                )}
                                {item.type === 'table' && (
                                    <Typography variant="caption">
                                        {previewOn && values[item.id]
                                            ? `${values[item.id].rows?.length || 0} rows`
                                            : fieldToken(item.binding)}
                                    </Typography>
                                )}
                                {item.type !== 'image' && item.type !== 'table' && item.type !== 'shape' && displayText(item)}
                                {selected.includes(item.id) && (
                                    <Box onPointerDown={(event) => beginResize(event, item)} sx={{ position: 'absolute', right: 0, bottom: 0, width: 10, height: 10, bgcolor: '#2563EB', cursor: 'nwse-resize' }} />
                                )}
                            </Box>
                        ))}
                    </Box>
                </Box>
                <Box sx={{ width: { xs: 220, md: 280 }, borderLeft: '1px solid #E2E8F0', p: 1, overflow: 'auto' }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>Properties</Typography>
                    <TextField size="small" select fullWidth label="Page size" value={`${design.page.widthMm}x${design.page.heightMm}`} sx={{ mb: 1 }} onChange={(event) => {
                        const preset = PAGE_PRESETS.find((item) => `${item.widthMm}x${item.heightMm}` === event.target.value);
                        if (!preset) return;
                        remember();
                        setDesign((current) => ({ ...current, page: { ...current.page, widthMm: preset.widthMm, heightMm: preset.heightMm } }));
                    }}>
                        {PAGE_PRESETS.map((preset) => (
                            <MenuItem key={preset.id} value={`${preset.widthMm}x${preset.heightMm}`}>{preset.label}</MenuItem>
                        ))}
                    </TextField>
                    <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                        <TextField size="small" label="Width mm" type="number" value={design.page.widthMm} onChange={(event) => setDesign({ ...design, page: { ...design.page, widthMm: Number(event.target.value) } })} />
                        <TextField size="small" label="Height mm" type="number" value={design.page.heightMm} onChange={(event) => setDesign({ ...design, page: { ...design.page, heightMm: Number(event.target.value) } })} />
                    </Box>
                    {boundModels.map((model) => (
                        <TextField
                            key={model}
                            size="small"
                            select
                            fullWidth
                            label={`Preview ${model}`}
                            sx={{ mb: 1 }}
                            value={anchors[model] || ''}
                            onChange={(event) => setAnchors({ ...anchors, [model]: event.target.value })}
                        >
                            <MenuItem value="">None</MenuItem>
                            {(recordOptions[model] || []).map((option) => <MenuItem key={option.id} value={option.id}>{option.label}</MenuItem>)}
                        </TextField>
                    ))}
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                        <Button size="small" onClick={() => patchSelected({ locked: true })}>Lock</Button>
                        <Button size="small" onClick={() => patchSelected({ locked: false })}>Unlock</Button>
                        <Button size="small" onClick={removeSelected}>Delete</Button>
                        <Button size="small" onClick={() => {
                            const groupId = newId('group');
                            remember();
                            updateElements(elements.map((item) => selected.includes(item.id) ? { ...item, groupId } : item), false);
                        }}>Group</Button>
                        <Button size="small" onClick={() => patchSelected({ groupId: null })}>Ungroup</Button>
                        <Button size="small" onClick={() => patchSelected({ z: Math.max(...elements.map((item) => item.z || 1)) + 1 })}>Forward</Button>
                        <Button size="small" onClick={() => patchSelected({ z: Math.min(...elements.map((item) => item.z || 1)) - 1 })}>Backward</Button>
                    </Box>
                    {active && (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            {active.binding && (
                                <>
                                    <Typography variant="caption">{active.binding.model}.{active.binding.path}</Typography>
                                    <TextField size="small" label="Display label" value={active.binding.label || ''} onChange={(event) => patchSelected({ binding: { ...active.binding, label: event.target.value } }, false)} />
                                    <TextField size="small" select label="Format" value={active.format || 'text'} onChange={(event) => patchSelected({ format: event.target.value })}>
                                        <MenuItem value="text">Text</MenuItem>
                                        <MenuItem value="currency">Indian Rupee</MenuItem>
                                        <MenuItem value="date">Date</MenuItem>
                                        <MenuItem value="number">Number</MenuItem>
                                    </TextField>
                                </>
                            )}
                            {active.type === 'text' && (
                                <TextField size="small" multiline label="Text" value={active.text || ''} onChange={(event) => patchSelected({ text: event.target.value }, false)} />
                            )}
                            <TextField size="small" type="number" label="Font size" value={active.style?.fontSize || 12} onChange={(event) => patchSelected({ style: { fontSize: Number(event.target.value) } })} />
                            <TextField size="small" label="Color" value={active.style?.color || '#111827'} onChange={(event) => patchSelected({ style: { color: event.target.value } }, false)} />
                            <TextField size="small" select label="Align" value={active.style?.align || 'left'} onChange={(event) => patchSelected({ style: { align: event.target.value } })}>
                                <MenuItem value="left">Left</MenuItem>
                                <MenuItem value="center">Center</MenuItem>
                                <MenuItem value="right">Right</MenuItem>
                            </TextField>
                            <FormControlLabel control={<Checkbox checked={Boolean(active.style?.bold)} onChange={(event) => patchSelected({ style: { bold: event.target.checked } })} />} label="Bold" />
                            <FormControlLabel control={<Checkbox checked={Boolean(active.style?.italic)} onChange={(event) => patchSelected({ style: { italic: event.target.checked } })} />} label="Italic" />
                            <TextField size="small" type="number" label="Rotation" value={active.rotation || 0} onChange={(event) => patchSelected({ rotation: Number(event.target.value) })} />
                            <Button size="small" onClick={() => place({ ...active, type: 'code', w: 50, h: 16, binding: active.binding })}>Add code from field</Button>
                        </Box>
                    )}
                </Box>
            </Box>
        </Box>
    );
}
