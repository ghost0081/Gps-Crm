import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { Box, Button, MenuItem, TextField, Typography } from '@mui/material';
import { buildDocumentHtml } from '../admin/design/designDocument';

const API = process.env.REACT_APP_BASE_URL;
const TYPES = [
    { id: 'fee-receipt', label: 'Fee payment receipt' },
    { id: 'fee-due', label: 'Fee due receipt' },
    { id: 'fee-adjustment', label: 'Fee adjustment receipt' },
];

export default function StaffReceipts() {
    const { currentUser } = useSelector((state) => state.user);
    const [students, setStudents] = useState([]);
    const [fees, setFees] = useState([]);
    const [studentId, setStudentId] = useState('');
    const [feeId, setFeeId] = useState('');
    const [documentType, setDocumentType] = useState('fee-receipt');
    const [preview, setPreview] = useState(null);
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (!currentUser?._id) return;
        axios.get(`${API}/Accounts/Receipts/Students`, { params: { staffId: currentUser._id } })
            .then((res) => setStudents(res.data || []))
            .catch((error) => setMessage(error.response?.data?.message || 'Receipts are available to the Account Department.'));
    }, [currentUser]);

    useEffect(() => {
        setFeeId('');
        setPreview(null);
        if (!studentId || !currentUser?._id) {
            setFees([]);
            return;
        }
        axios.get(`${API}/Accounts/Receipts/Fees`, { params: { staffId: currentUser._id, studentId } })
            .then((res) => setFees(res.data || []))
            .catch((error) => setMessage(error.response?.data?.message || 'Those fees could not be loaded.'));
    }, [studentId, currentUser]);

    const loadPreview = async () => {
        setMessage('');
        try {
            const res = await axios.post(`${API}/Accounts/Receipts/Preview`, {
                staffId: currentUser._id,
                studentId,
                feeId,
                documentType,
            });
            setPreview(res.data);
        } catch (error) {
            setPreview(null);
            setMessage(error.response?.data?.message || 'The receipt could not be prepared.');
        }
    };

    const printReceipt = () => {
        if (!preview?.template) return;
        const win = window.open('', '_blank');
        if (!win) return;
        win.document.write(buildDocumentHtml(preview.template, preview.values || {}));
        win.document.close();
        win.onload = () => win.print();
    };

    const html = preview?.template ? buildDocumentHtml(preview.template, preview.values || {}) : '';

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>Fee receipts</Typography>
            <Typography sx={{ mb: 2 }}>
                Choose a student and a saved fee transaction. The assigned template is filled from that transaction. Printing does not create a payment.
            </Typography>
            {message && <Typography sx={{ mb: 2 }}>{message}</Typography>}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                <TextField size="small" select label="Document" value={documentType} onChange={(event) => { setDocumentType(event.target.value); setPreview(null); }} sx={{ minWidth: 220 }}>
                    {TYPES.map((item) => <MenuItem key={item.id} value={item.id}>{item.label}</MenuItem>)}
                </TextField>
                <TextField size="small" select label="Student" value={studentId} onChange={(event) => setStudentId(event.target.value)} sx={{ minWidth: 240 }}>
                    {students.map((item) => (
                        <MenuItem key={item._id} value={item._id}>
                            {item.name} · {item.rollNum} · {item.sclassName?.sclassName || ''}
                        </MenuItem>
                    ))}
                </TextField>
                <TextField size="small" select label="Fee transaction" value={feeId} onChange={(event) => { setFeeId(event.target.value); setPreview(null); }} sx={{ minWidth: 260 }}>
                    {fees.map((item) => (
                        <MenuItem key={item._id} value={item._id}>
                            {item.month} · {item.status} · {item.amount}
                        </MenuItem>
                    ))}
                </TextField>
                <Button variant="contained" disabled={!studentId || !feeId} onClick={loadPreview}>Prepare receipt</Button>
                <Button variant="outlined" disabled={!preview} onClick={printReceipt}>Print receipt</Button>
            </Box>
            {preview && (
                <Box sx={{ mb: 1 }}>
                    <Typography sx={{ fontWeight: 700 }}>{preview.studentName}</Typography>
                    <Typography variant="body2">
                        Template: {preview.templateName} · chosen by {preview.level} assignment · {preview.fee?.month} · {preview.fee?.status}
                    </Typography>
                </Box>
            )}
            {html && (
                <iframe title="Receipt preview" srcDoc={html} style={{ width: '100%', minHeight: 760, border: '1px solid #E2E8F0', background: '#fff' }} />
            )}
        </Box>
    );
}
