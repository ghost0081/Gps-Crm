import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { Box, Button, MenuItem, TextField, Typography } from '@mui/material';
import { CATEGORIES } from './designDocument';

const API = process.env.REACT_APP_BASE_URL;

export default function DesignSettingsPage() {
    const { currentUser } = useSelector((state) => state.user);
    const [rows, setRows] = useState([]);
    const [choice, setChoice] = useState({});
    const [versions, setVersions] = useState(null);
    const [message, setMessage] = useState('');

    const load = () => {
        if (!currentUser?._id) return;
        axios.get(`${API}/Design/Templates`, { params: { schoolId: currentUser._id } })
            .then((res) => {
                const list = res.data || [];
                setRows(list);
                const next = {};
                list.filter((item) => item.isDefault).forEach((item) => { next[item.category] = item._id; });
                setChoice(next);
            })
            .catch(() => setMessage('Settings could not be loaded.'));
    };

    useEffect(load, [currentUser]);

    const saveDefault = async (category) => {
        const id = choice[category];
        if (!id) return;
        await axios.put(`${API}/Design/Templates/${id}/Default`, { schoolId: currentUser._id });
        setMessage('Default design updated.');
        load();
    };

    const restore = async (index) => {
        if (!versions) return;
        await axios.post(`${API}/Design/Templates/${versions._id}/Restore`, {
            schoolId: currentUser._id,
            versionIndex: index,
        });
        setMessage('Previous version restored.');
        setVersions(null);
        load();
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 720 }}>
            <Typography>Choose the design used when a fee receipt is printed from class fees. Printing a receipt does not create a new payment.</Typography>
            {message && <Typography>{message}</Typography>}
            {CATEGORIES.map((category) => {
                const options = rows.filter((row) => row.category === category.id);
                if (!options.length) return null;
                return (
                    <Box key={category.id} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <TextField
                            size="small"
                            select
                            fullWidth
                            label={category.label}
                            value={choice[category.id] || ''}
                            onChange={(event) => setChoice({ ...choice, [category.id]: event.target.value })}
                        >
                            {options.map((row) => <MenuItem key={row._id} value={row._id}>{row.name}</MenuItem>)}
                        </TextField>
                        <Button onClick={() => saveDefault(category.id)}>Save</Button>
                    </Box>
                );
            })}
            <TextField
                size="small"
                select
                label="Version history"
                value={versions?._id || ''}
                onChange={(event) => setVersions(rows.find((row) => row._id === event.target.value) || null)}
            >
                {rows.map((row) => <MenuItem key={row._id} value={row._id}>{row.name}</MenuItem>)}
            </TextField>
            {(versions?.versions || []).map((version, index) => (
                <Box key={`${version.savedAt}-${index}`} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">{version.name} · {version.savedAt ? new Date(version.savedAt).toLocaleString('en-IN') : 'Saved version'}</Typography>
                    <Button size="small" onClick={() => restore(index)}>Restore</Button>
                </Box>
            ))}
        </Box>
    );
}
