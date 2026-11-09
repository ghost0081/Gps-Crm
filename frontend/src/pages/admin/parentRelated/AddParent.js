import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
    Box,
    Typography,
    TextField,
    MenuItem,
    InputAdornment,
    IconButton,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import FamilyRestroomOutlinedIcon from '@mui/icons-material/FamilyRestroomOutlined';
import KeyOutlinedIcon from '@mui/icons-material/KeyOutlined';
import { getAllStudents } from '../../../redux/studentRelated/studentHandle';
import { createParent } from '../../../redux/parentRelated/parentHandle';
import { PrimaryButton, GhostButton } from '../../../components/buttonStyles';
import Popup from '../../../components/Popup';

const fieldSx = {
    minWidth: 0,
    width: '100%',
    '& .MuiOutlinedInput-root': {
        borderRadius: '10px',
        backgroundColor: '#fff',
    },
};

const SectionCard = ({ icon, title, description, children }) => (
    <Box
        sx={{
            bgcolor: '#fff',
            border: '1px solid #E2E8F0',
            borderRadius: '16px',
            boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
            p: { xs: 2, sm: 3 },
            width: '100%',
            minWidth: 0,
            boxSizing: 'border-box',
        }}
    >
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', mb: 2.5 }}>
            <Box
                sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '10px',
                    bgcolor: '#EDE9FE',
                    color: '#4F46E5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                }}
            >
                {icon}
            </Box>
            <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F172A', lineHeight: 1.3 }}>
                    {title}
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748B', mt: 0.25 }}>
                    {description}
                </Typography>
            </Box>
        </Box>
        {children}
    </Box>
);

const AddParent = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { currentUser } = useSelector((state) => state.user);
    const { studentsList } = useSelector((state) => state.student);

    const [name, setName] = useState('');
    const [mobile, setMobile] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [studentId, setStudentId] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loader, setLoader] = useState(false);
    const [showPopup, setShowPopup] = useState(false);
    const [message, setMessage] = useState('');
    const [created, setCreated] = useState(null);

    useEffect(() => {
        if (currentUser?._id) {
            dispatch(getAllStudents(currentUser._id));
        }
    }, [currentUser, dispatch]);

    const students = Array.isArray(studentsList) ? studentsList : [];
    const selectedStudent = students.find((student) => student._id === studentId);

    const submitHandler = async (event) => {
        event.preventDefault();
        if (!studentId) {
            setMessage('Select the student this parent will follow');
            setShowPopup(true);
            return;
        }
        if (password.trim().length < 4) {
            setMessage('Password must be at least 4 characters');
            setShowPopup(true);
            return;
        }
        if (password.trim() !== confirmPassword.trim()) {
            setMessage('Password and confirmation do not match');
            setShowPopup(true);
            return;
        }

        setLoader(true);
        const result = await dispatch(createParent({
            name: name.trim(),
            mobile: mobile.trim(),
            password: password.trim(),
            student: studentId,
            school: currentUser._id,
        }));
        setLoader(false);

        if (result?._id) {
            setCreated({
                name: result.name,
                rollNum: result.rollNum,
                studentName: result.studentName,
                password: password.trim(),
            });
            return;
        }
        setMessage(result?.error || 'Could not create the parent account');
        setShowPopup(true);
    };

    if (created) {
        return (
            <Box sx={{ width: '100%', maxWidth: 720 }}>
                <Typography variant="h1" sx={{ fontWeight: 800, color: '#0F172A', fontSize: { xs: '1.5rem', sm: '1.75rem' } }}>
                    Parent account ready
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748B', mt: 0.75, mb: 2.5 }}>
                    Share these credentials with {created.name}. They sign in as Parent on the website and in the app.
                </Typography>
                <SectionCard
                    icon={<KeyOutlinedIcon />}
                    title="Login credentials"
                    description={`${created.studentName} · roll ${created.rollNum}`}
                >
                    <Box sx={{ display: 'grid', gap: 1.5 }}>
                        <Credential label="Role" value="Parent" />
                        <Credential label="Roll number" value={String(created.rollNum)} />
                        <Credential label="Password" value={created.password} />
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1.5, mt: 3, flexWrap: 'wrap' }}>
                        <PrimaryButton onClick={() => navigate('/Admin/parents')}>
                            Back to parents
                        </PrimaryButton>
                        <GhostButton
                            onClick={() => {
                                setCreated(null);
                                setName('');
                                setMobile('');
                                setPassword('');
                                setConfirmPassword('');
                                setStudentId('');
                            }}
                        >
                            Create another
                        </GhostButton>
                    </Box>
                </SectionCard>
            </Box>
        );
    }

    return (
        <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0, pb: 2 }}>
            <Box sx={{ mb: 3 }}>
                <Typography variant="h1" sx={{ fontWeight: 800, color: '#0F172A', fontSize: { xs: '1.5rem', sm: '1.75rem' } }}>
                    Create parent account
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748B', mt: 0.75 }}>
                    Set the name, mobile number, and password. The parent signs in with the student&apos;s roll number and this password.
                </Typography>
            </Box>

            <Box
                component="form"
                onSubmit={submitHandler}
                sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, width: '100%', maxWidth: 880 }}
            >
                <SectionCard
                    icon={<FamilyRestroomOutlinedIcon />}
                    title="Parent and student"
                    description="One parent account follows one student."
                >
                    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
                        <TextField
                            label="Parent name"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            required
                            fullWidth
                            sx={fieldSx}
                        />
                        <TextField
                            label="Mobile number"
                            value={mobile}
                            onChange={(event) => setMobile(event.target.value)}
                            required
                            fullWidth
                            sx={fieldSx}
                        />
                        <TextField
                            select
                            label="Student"
                            value={studentId}
                            onChange={(event) => setStudentId(event.target.value)}
                            required
                            fullWidth
                            sx={{ ...fieldSx, gridColumn: { sm: '1 / -1' } }}
                        >
                            <MenuItem value="">Select student</MenuItem>
                            {students.map((student) => (
                                <MenuItem key={student._id} value={student._id}>
                                    {student.name} · roll {student.rollNum}
                                    {student.sclassName?.sclassName ? ` · ${student.sclassName.sclassName}` : ''}
                                </MenuItem>
                            ))}
                        </TextField>
                    </Box>
                </SectionCard>

                <SectionCard
                    icon={<KeyOutlinedIcon />}
                    title="Login password"
                    description={
                        selectedStudent
                            ? `The parent enters roll ${selectedStudent.rollNum} and this password.`
                            : 'Choose the student first. Their roll number is the parent login.'
                    }
                >
                    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
                        <TextField
                            label="Password"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            required
                            fullWidth
                            autoComplete="new-password"
                            sx={fieldSx}
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton
                                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                                            onClick={() => setShowPassword((visible) => !visible)}
                                            edge="end"
                                            size="small"
                                        >
                                            {showPassword ? <VisibilityOff /> : <Visibility />}
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                        />
                        <TextField
                            label="Confirm password"
                            type={showPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(event) => setConfirmPassword(event.target.value)}
                            required
                            fullWidth
                            autoComplete="new-password"
                            sx={fieldSx}
                        />
                    </Box>
                </SectionCard>

                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                    <PrimaryButton type="submit" disabled={loader}>
                        {loader ? 'Saving...' : 'Create parent account'}
                    </PrimaryButton>
                    <GhostButton type="button" onClick={() => navigate('/Admin/parents')}>
                        Cancel
                    </GhostButton>
                </Box>
            </Box>
            <Popup message={message} setShowPopup={setShowPopup} showPopup={showPopup} />
        </Box>
    );
};

const Credential = ({ label, value }) => (
    <Box
        sx={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 2,
            alignItems: 'center',
            px: 1.5,
            py: 1.25,
            borderRadius: '10px',
            bgcolor: '#F7F8FA',
            border: '1px solid #E2E8F0',
        }}
    >
        <Typography variant="body2" sx={{ color: '#64748B' }}>{label}</Typography>
        <Typography variant="body1" sx={{ fontWeight: 700, color: '#0F172A', wordBreak: 'break-all' }}>{value}</Typography>
    </Box>
);

export default AddParent;
