import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { Box, Button, MenuItem, TextField, Typography } from '@mui/material';
import { CATEGORIES, categoryLabel } from './designDocument';

const API = process.env.REACT_APP_BASE_URL;

export default function DesignListPage() {
    const navigate = useNavigate();
    const { currentUser } = useSelector((state) => state.user);
    const [rows, setRows] = useState([]);
    const [category, setCategory] = useState('');
    const [message, setMessage] = useState('');

    const load = () => {
        if (!currentUser?._id) return;
        axios.get(`${API}/Design/Templates`, {
            params: { schoolId: currentUser._id, category: category || undefined },
        }).then((res) => setRows(res.data || [])).catch(() => setMessage('Designs could not be loaded.'));
    };

    useEffect(load, [currentUser, category]);

    const duplicate = async (id) => {
        await axios.post(`${API}/Design/Templates/${id}/Duplicate`, { schoolId: currentUser._id });
        load();
    };

    const remove = async (row) => {
        if (!window.confirm(`Delete ${row.name}? This does not change student or fee records.`)) return;
        await axios.delete(`${API}/Design/Templates/${row._id}`, { params: { schoolId: currentUser._id } });
        load();
    };

    const makeDefault = async (id) => {
        await axios.put(`${API}/Design/Templates/${id}/Default`, { schoolId: currentUser._id });
        load();
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                <Button variant="contained" onClick={() => navigate('/Admin/design/edit/new')}>Create design</Button>
                <Button variant="outlined" onClick={() => navigate('/Admin/design/edit/new?category=fee-receipt')}>Fee receipt designer</Button>
                <Button onClick={() => navigate('/Admin/design/data')}>Database explorer</Button>
                <Button onClick={() => navigate('/Admin/design/assignments')}>Receipt assignments</Button>
                <TextField size="small" select label="Category" value={category} onChange={(event) => setCategory(event.target.value)} sx={{ minWidth: 180 }}>
                    <MenuItem value="">All</MenuItem>
                    {CATEGORIES.map((item) => <MenuItem key={item.id} value={item.id}>{item.label}</MenuItem>)}
                </TextField>
            </Box>
            {message && <Typography color="error">{message}</Typography>}
            {rows.map((row) => (
                <Box key={row._id} sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', py: 1, borderBottom: '1px solid #E2E8F0' }}>
                    <Box sx={{ flex: 1, minWidth: 180 }}>
                        <Typography sx={{ fontWeight: 700 }}>{row.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                            {categoryLabel(row.category)}{row.isDefault ? ' · Default' : ''} · {(row.pages || []).length} page{(row.pages || []).length === 1 ? '' : 's'}
                        </Typography>
                    </Box>
                    <Button size="small" onClick={() => navigate(`/Admin/design/edit/${row._id}`)}>Edit</Button>
                    <Button size="small" onClick={() => navigate(`/Admin/design/print/${row._id}`)}>Preview</Button>
                    <Button size="small" onClick={() => duplicate(row._id)}>Duplicate</Button>
                    <Button size="small" onClick={() => makeDefault(row._id)}>Set default</Button>
                    <Button size="small" color="error" onClick={() => remove(row)}>Delete</Button>
                </Box>
            ))}
        </Box>
    );
}
