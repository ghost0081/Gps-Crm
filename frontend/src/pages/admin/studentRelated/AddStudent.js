import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { upsertParent } from '../../../redux/parentRelated/parentHandle';
import Popup from '../../../components/Popup';
import { underControl } from '../../../redux/userRelated/userSlice';
import { getAllSclasses } from '../../../redux/sclassRelated/sclassHandle';
import { PrimaryButton, GhostButton } from '../../../components/buttonStyles';
import axios from 'axios';
import {
    Box,
    Typography,
    TextField,
    MenuItem,
    InputAdornment,
    IconButton,
    CircularProgress,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import SupervisorAccountOutlinedIcon from '@mui/icons-material/SupervisorAccountOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';

const fieldSx = {
    minWidth: 0,
    width: '100%',
    '& .MuiOutlinedInput-root': {
        borderRadius: '10px',
        backgroundColor: '#fff',
    },
};

const formGridSx = {
    display: 'grid',
    width: '100%',
    gap: 2,
    gridTemplateColumns: {
        xs: 'minmax(0, 1fr)',
        sm: 'repeat(2, minmax(0, 1fr))',
        lg: 'repeat(4, minmax(0, 1fr))',
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

const AddStudent = ({ situation }) => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const params = useParams();

    const userState = useSelector(state => state.user);
    const { status, currentUser, response, error } = userState;
    const { sclassesList } = useSelector((state) => state.sclass);

    const [name, setName] = useState('');
    const [rollNum, setRollNum] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [className, setClassName] = useState('');
    const [sclassName, setSclassName] = useState('');

    const [parentName, setParentName] = useState('');
    const [parentMobile, setParentMobile] = useState('');

    const adminID = currentUser._id;
    const role = 'Student';
    const attendance = [];

    useEffect(() => {
        if (situation === 'Class') {
            setSclassName(params.id);
        }
    }, [params.id, situation]);

    const [showPopup, setShowPopup] = useState(false);
    const [message, setMessage] = useState('');
    const [loader, setLoader] = useState(false);

    useEffect(() => {
        dispatch(getAllSclasses(adminID, 'Sclass'));
    }, [adminID, dispatch]);

    const lockedClass = situation === 'Class'
        ? (sclassesList || []).find((classItem) => classItem._id === (sclassName || params.id))
        : null;

    const changeHandler = (event) => {
        if (event.target.value === 'Select Class') {
            setClassName('Select Class');
            setSclassName('');
        } else {
            const selectedClass = sclassesList.find(
                (classItem) => classItem.sclassName === event.target.value
            );
            setClassName(selectedClass.sclassName);
            setSclassName(selectedClass._id);
        }
    };

    const fields = { name, rollNum, password, sclassName, adminID, role, attendance };

    const submitHandler = async (event) => {
        event.preventDefault();
        if (sclassName === '') {
            setMessage('Please select a classname');
            setShowPopup(true);
        } else if (!parentName || !parentMobile) {
            setMessage('Please fill in parent details');
            setShowPopup(true);
        } else {
            setLoader(true);
            try {
                const studentResult = await axios.post(`${process.env.REACT_APP_BASE_URL}/StudentReg`, fields, {
                    headers: { 'Content-Type': 'application/json' },
                });

                if (studentResult.data._id) {
                    const parentFields = {
                        name: parentName,
                        mobile: parentMobile,
                        student: studentResult.data._id,
                        school: adminID,
                    };
                    await dispatch(upsertParent(parentFields));
                    dispatch(underControl());
                    navigate(-1);
                } else {
                    setMessage(studentResult.data.message || 'Error creating student');
                    setShowPopup(true);
                    setLoader(false);
                }
            } catch (err) {
                setMessage('Error creating student and parent record');
                setShowPopup(true);
                setLoader(false);
            }
        }
    };

    useEffect(() => {
        if (status === 'failed') {
            setMessage(response);
            setShowPopup(true);
            setLoader(false);
        } else if (status === 'error') {
            setMessage('Network Error');
            setShowPopup(true);
            setLoader(false);
        }
    }, [status, error, response, dispatch]);

    return (
        <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0, pb: 2 }}>
            <Box sx={{ mb: 3, width: '100%' }}>
                <Typography variant="h1" sx={{ fontWeight: 800, color: '#0F172A', fontSize: { xs: '1.5rem', sm: '1.75rem' } }}>
                    Add student
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748B', mt: 0.75 }}>
                    Create a student record for safety tracking. Parent contact is used for alerts and the parent login.
                </Typography>
            </Box>

            <Box
                component="form"
                onSubmit={submitHandler}
                sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, width: '100%', minWidth: 0 }}
            >
                <SectionCard
                    icon={<PersonOutlineIcon />}
                    title="Student record"
                    description="Name, class, and the login the student will use."
                >
                    <Box sx={formGridSx}>
                        <TextField
                            label="Full name"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            autoComplete="name"
                            required
                            fullWidth
                            sx={fieldSx}
                        />

                        {situation === 'Student' ? (
                            <TextField
                                select
                                label="Class"
                                value={className || 'Select Class'}
                                onChange={changeHandler}
                                required
                                fullWidth
                                sx={fieldSx}
                            >
                                <MenuItem value="Select Class">Select class</MenuItem>
                                {(sclassesList || []).map((classItem) => (
                                    <MenuItem key={classItem._id} value={classItem.sclassName}>
                                        {classItem.sclassName}
                                    </MenuItem>
                                ))}
                            </TextField>
                        ) : (
                            <TextField
                                label="Class"
                                value={lockedClass ? lockedClass.sclassName : 'This class'}
                                fullWidth
                                InputProps={{ readOnly: true }}
                                sx={fieldSx}
                            />
                        )}

                        <TextField
                            label="Roll number"
                            type="number"
                            value={rollNum}
                            onChange={(event) => setRollNum(event.target.value)}
                            required
                            fullWidth
                            sx={fieldSx}
                        />

                        <TextField
                            label="Password"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            autoComplete="new-password"
                            required
                            fullWidth
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
                                            {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                        />
                    </Box>
                </SectionCard>

                <SectionCard
                    icon={<SupervisorAccountOutlinedIcon />}
                    title="Parent or guardian"
                    description="This contact receives safety updates and can sign in to the parent view."
                >
                    <Box
                        sx={{
                            ...formGridSx,
                            gridTemplateColumns: {
                                xs: 'minmax(0, 1fr)',
                                sm: 'repeat(2, minmax(0, 1fr))',
                            },
                        }}
                    >
                        <TextField
                            label="Parent name"
                            value={parentName}
                            onChange={(event) => setParentName(event.target.value)}
                            required
                            fullWidth
                            sx={fieldSx}
                        />
                        <TextField
                            label="Parent mobile number"
                            type="tel"
                            value={parentMobile}
                            onChange={(event) => setParentMobile(event.target.value)}
                            required
                            fullWidth
                            helperText="Parent login password is the last 5 digits of this number."
                            sx={fieldSx}
                        />
                    </Box>
                </SectionCard>

                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: { xs: 'column', md: 'row' },
                        alignItems: { xs: 'stretch', md: 'center' },
                        justifyContent: 'space-between',
                        gap: 2,
                        width: '100%',
                    }}
                >
                    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', minWidth: 0 }}>
                        <ShieldOutlinedIcon sx={{ color: '#64748B', mt: 0.25 }} fontSize="small" />
                        <Typography variant="body2" sx={{ color: '#64748B' }}>
                            A BLE tracker can be assigned from the student list after this record is saved.
                        </Typography>
                    </Box>

                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: { xs: 'column-reverse', sm: 'row' },
                            gap: 1.5,
                            width: { xs: '100%', md: 'auto' },
                            flexShrink: 0,
                        }}
                    >
                        <GhostButton
                            type="button"
                            onClick={() => navigate(-1)}
                            disabled={loader}
                            sx={{ width: { xs: '100%', md: 'auto' }, flex: { sm: '1 1 0', md: '0 0 auto' } }}
                        >
                            Cancel
                        </GhostButton>
                        <PrimaryButton
                            type="submit"
                            disabled={loader}
                            sx={{ width: { xs: '100%', md: 'auto' }, flex: { sm: '1 1 0', md: '0 0 auto' }, minWidth: { md: 160 } }}
                        >
                            {loader ? <CircularProgress size={22} color="inherit" /> : 'Add student'}
                        </PrimaryButton>
                    </Box>
                </Box>
            </Box>

            <Popup message={message} setShowPopup={setShowPopup} showPopup={showPopup} />
        </Box>
    );
};

export default AddStudent;
