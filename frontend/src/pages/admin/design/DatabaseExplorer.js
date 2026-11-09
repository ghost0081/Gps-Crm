import { useMemo, useState } from 'react';
import { Box, TextField, MenuItem, Typography } from '@mui/material';

const TYPE_OPTIONS = [
    { id: '', label: 'All types' },
    { id: 'text', label: 'Text' },
    { id: 'number', label: 'Number' },
    { id: 'date', label: 'Date' },
    { id: 'boolean', label: 'Yes / No' },
    { id: 'relation', label: 'Related record' },
    { id: 'collection', label: 'Collection' },
];

export default function DatabaseExplorer({ schema, onInsertField, onInsertTable }) {
    const [query, setQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [open, setOpen] = useState({});

    const tables = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return (schema?.tables || []).map((table) => {
            const fields = table.fields.filter((field) => {
                if (typeFilter && field.dataType !== typeFilter) return false;
                if (!needle) return true;
                return `${table.model} ${table.label} ${field.path} ${field.label}`.toLowerCase().includes(needle);
            });
            const tableMatch = !needle || `${table.model} ${table.label}`.toLowerCase().includes(needle);
            return { ...table, fields: needle && !tableMatch ? fields : (needle ? fields : table.fields.filter((field) => !typeFilter || field.dataType === typeFilter)) };
        }).filter((table) => table.fields.length > 0);
    }, [schema, query, typeFilter]);

    const relations = schema?.relationships || [];

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minHeight: 0 }}>
            <TextField size="small" label="Search tables and fields" value={query} onChange={(event) => setQuery(event.target.value)} />
            <TextField size="small" select label="Field type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                {TYPE_OPTIONS.map((option) => <MenuItem key={option.id || 'all'} value={option.id}>{option.label}</MenuItem>)}
            </TextField>
            <Box sx={{ overflow: 'auto', maxHeight: { xs: 280, md: 'calc(100vh - 280px)' } }}>
                {tables.map((table) => {
                    const expanded = open[table.model] !== false && (query ? true : open[table.model]);
                    const links = relations.filter((item) => item.from === table.model);
                    return (
                        <Box key={table.model} sx={{ borderBottom: '1px solid #E2E8F0', py: 0.5 }}>
                            <Box
                                onClick={() => setOpen((current) => ({ ...current, [table.model]: !expanded }))}
                                sx={{ cursor: 'pointer', py: 0.5 }}
                            >
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                    {expanded ? '▾' : '▸'} {table.label}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">{table.model}</Typography>
                            </Box>
                            {expanded && table.fields.map((field) => (
                                <Box
                                    key={`${table.model}-${field.path}`}
                                    draggable
                                    onDragStart={(event) => {
                                        event.dataTransfer.setData('application/x-school-field', JSON.stringify({ table: table.model, field }));
                                        event.dataTransfer.effectAllowed = 'copy';
                                    }}
                                    onDoubleClick={() => (field.collectionPath ? onInsertTable(table, field) : onInsertField(table, field))}
                                    sx={{ pl: 1.5, py: 0.4, cursor: 'grab', '&:hover': { bgcolor: '#F8FAFC' } }}
                                >
                                    <Typography variant="body2">{field.label}</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {field.path} · {field.dataType}{field.ref ? ` → ${field.ref}` : ''}{field.collectionPath ? ' · repeatable' : ''}
                                    </Typography>
                                </Box>
                            ))}
                            {expanded && links.length > 0 && (
                                <Typography variant="caption" sx={{ display: 'block', pl: 1.5, pb: 0.5 }} color="text.secondary">
                                    Links: {links.map((link) => `${link.path} → ${link.to}`).join(', ')}
                                </Typography>
                            )}
                        </Box>
                    );
                })}
            </Box>
        </Box>
    );
}
