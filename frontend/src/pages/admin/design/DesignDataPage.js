import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { Box, Typography } from '@mui/material';
import DatabaseExplorer from './DatabaseExplorer';

const API = process.env.REACT_APP_BASE_URL;

export default function DesignDataPage() {
    const { currentUser } = useSelector((state) => state.user);
    const [schema, setSchema] = useState({ tables: [], relationships: [] });
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (!currentUser?._id) return;
        axios.get(`${API}/Design/Schema`, { params: { schoolId: currentUser._id } })
            .then((res) => setSchema(res.data))
            .catch(() => setMessage('The database structure could not be loaded.'));
    }, [currentUser]);

    return (
        <Box>
            <Typography sx={{ mb: 1 }}>
                These are the collections and fields this school can place on a design. Passwords, tokens, and face data are omitted. Drag a field from the editor to place it on a page.
            </Typography>
            {message && <Typography color="error">{message}</Typography>}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {(schema.tables || []).length} collections · {(schema.relationships || []).length} relationships
            </Typography>
            <DatabaseExplorer schema={schema} onInsertField={() => {}} onInsertTable={() => {}} />
        </Box>
    );
}
