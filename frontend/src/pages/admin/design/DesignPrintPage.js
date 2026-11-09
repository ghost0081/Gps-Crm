import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { Box, Button, MenuItem, TextField, Typography } from '@mui/material';
import { buildDocumentHtml, modelsOnDesign } from './designDocument';

const API = process.env.REACT_APP_BASE_URL;

export default function DesignPrintPage() {
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const { currentUser } = useSelector((state) => state.user);
    const [design, setDesign] = useState(null);
    const [html, setHtml] = useState('');
    const [anchors, setAnchors] = useState({});
    const [options, setOptions] = useState({});
    const [warnings, setWarnings] = useState([]);
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (!currentUser?._id || !id) return;
        axios.get(`${API}/Design/Templates/${id}`, { params: { schoolId: currentUser._id } })
            .then((res) => {
                setDesign(res.data);
                const initial = {};
                modelsOnDesign(res.data).forEach((model) => {
                    const fromQuery = searchParams.get(model);
                    if (fromQuery) initial[model] = fromQuery;
                });
                if (searchParams.get('fee')) initial.fee = searchParams.get('fee');
                if (searchParams.get('student')) initial.student = searchParams.get('student');
                if (searchParams.get('feeInvoice')) initial.feeInvoice = searchParams.get('feeInvoice');
                setAnchors(initial);
            })
            .catch(() => setMessage('This design could not be opened.'));
    }, [currentUser, id, searchParams]);

    useEffect(() => {
        if (!design || !currentUser?._id) return;
        modelsOnDesign(design).forEach((model) => {
            axios.get(`${API}/Design/Records`, { params: { schoolId: currentUser._id, model } })
                .then((res) => setOptions((current) => ({ ...current, [model]: res.data || [] })))
                .catch(() => setOptions((current) => ({ ...current, [model]: [] })));
        });
    }, [design, currentUser]);

    const renderPreview = async (autoPrint) => {
        const res = await axios.post(`${API}/Design/Preview`, {
            schoolId: currentUser._id,
            pages: design.pages,
            anchors,
        });
        setWarnings(res.data.warnings || []);
        const next = buildDocumentHtml(design, res.data.values || {});
        setHtml(next);
        if (autoPrint) {
            const win = window.open('', '_blank');
            if (!win) return;
            win.document.write(next);
            win.document.close();
            win.onload = () => win.print();
        }
    };

    useEffect(() => {
        if (!design) return;
        renderPreview(searchParams.get('autoprint') === '1');
        // The first preview should run when the design and query anchors arrive.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [design]);

    return (
        <Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                {design && modelsOnDesign(design).map((model) => (
                    <TextField
                        key={model}
                        size="small"
                        select
                        label={model}
                        value={anchors[model] || ''}
                        onChange={(event) => setAnchors({ ...anchors, [model]: event.target.value })}
                        sx={{ minWidth: 220 }}
                    >
                        <MenuItem value="">None</MenuItem>
                        {(options[model] || []).map((option) => <MenuItem key={option.id} value={option.id}>{option.label}</MenuItem>)}
                    </TextField>
                ))}
                <Button variant="contained" onClick={() => renderPreview(false)}>Refresh preview</Button>
                <Button variant="outlined" onClick={() => renderPreview(true)}>Print / PDF</Button>
            </Box>
            {message && <Typography color="error">{message}</Typography>}
            {warnings.map((warning) => <Typography key={warning} variant="body2">{warning}</Typography>)}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Preview reads saved records and does not create or change fee transactions.
            </Typography>
            {html && (
                <iframe title="Design preview" srcDoc={html} style={{ width: '100%', minHeight: 720, border: '1px solid #E2E8F0', background: '#fff' }} />
            )}
        </Box>
    );
}
