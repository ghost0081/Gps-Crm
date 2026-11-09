import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { Box, Button, MenuItem, TextField, Typography } from '@mui/material';
import { CATEGORIES } from './designDocument';

const API = process.env.REACT_APP_BASE_URL;
const FEE_TYPES = CATEGORIES.filter((item) => ['fee-receipt', 'fee-due', 'fee-adjustment'].includes(item.id));

export default function ReceiptAssignmentsPage() {
    const { currentUser } = useSelector((state) => state.user);
    const schoolId = currentUser?._id;
    const [templates, setTemplates] = useState([]);
    const [students, setStudents] = useState([]);
    const [classes, setClasses] = useState([]);
    const [rows, setRows] = useState([]);
    const [form, setForm] = useState({ documentType: 'fee-receipt', scope: 'department', templateId: '', studentId: '', classId: '' });
    const [message, setMessage] = useState('');

    const load = () => {
        if (!schoolId) return;
        axios.get(`${API}/Design/Templates`, { params: { schoolId } }).then((res) => setTemplates(res.data || []));
        axios.get(`${API}/Design/Assignments`, { params: { schoolId } }).then((res) => setRows(res.data || []));
        axios.get(`${API}/Students/${schoolId}`).then((res) => setStudents(Array.isArray(res.data) ? res.data : []));
        axios.get(`${API}/SclassList/${schoolId}`).then((res) => setClasses(Array.isArray(res.data) ? res.data : []));
    };

    useEffect(load, [schoolId]);

    const matchingTemplates = templates.filter((item) => item.category === form.documentType);

    const save = async () => {
        try {
            await axios.post(`${API}/Design/Assignments`, {
                schoolId,
                documentType: form.documentType,
                scope: form.scope,
                templateId: form.templateId,
                studentId: form.studentId,
                classId: form.classId,
            });
            setMessage('Assignment saved. Student and fee records were not changed.');
            load();
        } catch (error) {
            setMessage(error.response?.data?.message || 'The assignment could not be saved.');
        }
    };

    const remove = async (id) => {
        await axios.delete(`${API}/Design/Assignments/${id}`, { params: { schoolId } });
        load();
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 860 }}>
            <Typography>
                Assign Design Studio receipts to the Account Department. Accountants print from these assignments. They do not edit the design.
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <TextField size="small" select label="Document type" value={form.documentType} onChange={(event) => setForm({ ...form, documentType: event.target.value, templateId: '' })} sx={{ minWidth: 200 }}>
                    {FEE_TYPES.map((item) => <MenuItem key={item.id} value={item.id}>{item.label}</MenuItem>)}
                </TextField>
                <TextField size="small" select label="Assign to" value={form.scope} onChange={(event) => setForm({ ...form, scope: event.target.value })} sx={{ minWidth: 160 }}>
                    <MenuItem value="department">Account Department default</MenuItem>
                    <MenuItem value="class">Class</MenuItem>
                    <MenuItem value="student">Student</MenuItem>
                </TextField>
                <TextField size="small" select label="Template" value={form.templateId} onChange={(event) => setForm({ ...form, templateId: event.target.value })} sx={{ minWidth: 220 }}>
                    {matchingTemplates.map((item) => <MenuItem key={item._id} value={item._id}>{item.name}</MenuItem>)}
                </TextField>
                {form.scope === 'class' && (
                    <TextField size="small" select label="Class" value={form.classId} onChange={(event) => setForm({ ...form, classId: event.target.value })} sx={{ minWidth: 180 }}>
                        {classes.map((item) => <MenuItem key={item._id} value={item._id}>{item.sclassName}</MenuItem>)}
                    </TextField>
                )}
                {form.scope === 'student' && (
                    <TextField size="small" select label="Student" value={form.studentId} onChange={(event) => setForm({ ...form, studentId: event.target.value })} sx={{ minWidth: 220 }}>
                        {students.map((item) => <MenuItem key={item._id} value={item._id}>{item.name} · {item.rollNum}</MenuItem>)}
                    </TextField>
                )}
                <Button variant="contained" onClick={save}>Save assignment</Button>
            </Box>
            {message && <Typography>{message}</Typography>}
            {rows.map((row) => (
                <Box key={row._id} sx={{ display: 'flex', gap: 1, alignItems: 'center', borderBottom: '1px solid #E2E8F0', py: 1 }}>
                    <Box sx={{ flex: 1 }}>
                        <Typography sx={{ fontWeight: 700 }}>{row.template?.name || 'Template'}</Typography>
                        <Typography variant="caption" color="text.secondary">
                            {row.documentType} · Account Department · {row.scope}
                            {row.student ? ` · ${row.student.name}` : ''}
                            {row.sclassName ? ` · ${row.sclassName.sclassName}` : ''}
                        </Typography>
                    </Box>
                    <Button size="small" color="error" onClick={() => remove(row._id)}>Remove</Button>
                </Box>
            ))}
        </Box>
    );
}
