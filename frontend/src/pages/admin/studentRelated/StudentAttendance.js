import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { getUserDetails } from '../../../redux/userRelated/userHandle';
import { getSubjectList } from '../../../redux/sclassRelated/sclassHandle';
import { updateStudentFields } from '../../../redux/studentRelated/studentHandle';

import {
    Box, InputLabel, MenuItem, Select, Typography, Stack, TextField,
    CircularProgress, FormControl, Paper, Avatar, Chip, Grid, Button, Divider
} from '@mui/material';
import Popup from '../../../components/Popup';
import AdminSection from '../../../components/admin/AdminSection';
import HowToRegOutlinedIcon from '@mui/icons-material/HowToRegOutlined';
import PersonOffOutlinedIcon from '@mui/icons-material/PersonOffOutlined';
import ClassOutlinedIcon from '@mui/icons-material/ClassOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';

const StudentAttendance = ({ situation }) => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { currentUser, userDetails, loading } = useSelector((state) => state.user);
    const { subjectsList } = useSelector((state) => state.sclass);
    const { response, error, statestatus } = useSelector((state) => state.student);
    const params = useParams();

    const [studentID, setStudentID] = useState('');
    const [subjectName, setSubjectName] = useState('');
    const [chosenSubName, setChosenSubName] = useState('');
    const [status, setStatus] = useState('');
    const [date, setDate] = useState('');

    const [showPopup, setShowPopup] = useState(false);
    const [message, setMessage] = useState('');
    const [loader, setLoader] = useState(false);

    const routeStudentId = situation === 'Subject' ? params.studentID : params.id;
    const routeSubjectId = params.subjectID;
    const studentReady = Boolean(
        userDetails &&
        typeof userDetails === 'object' &&
        !Array.isArray(userDetails) &&
        userDetails._id &&
        String(userDetails._id) === String(routeStudentId || studentID)
    );

    useEffect(() => {
        if (situation === 'Student' && routeStudentId) {
            setStudentID(routeStudentId);
            dispatch(getUserDetails(routeStudentId, 'Student'));
        } else if (situation === 'Subject' && routeStudentId) {
            setStudentID(routeStudentId);
            dispatch(getUserDetails(routeStudentId, 'Student'));
            if (routeSubjectId) setChosenSubName(routeSubjectId);
        }
    }, [situation, routeStudentId, routeSubjectId, dispatch]);

    useEffect(() => {
        if (studentReady && userDetails.sclassName?._id && situation === 'Student') {
            dispatch(getSubjectList(userDetails.sclassName._id, 'ClassSubjects'));
        }
    }, [dispatch, studentReady, userDetails, situation]);

    const changeHandler = (event) => {
        const selectedSubject = subjectsList.find(
            (subject) => subject.subName === event.target.value
        );
        if (!selectedSubject) return;
        setSubjectName(selectedSubject.subName);
        setChosenSubName(selectedSubject._id);
    };

    const fields = { subName: chosenSubName, status, date };

    const submitHandler = (event) => {
        event.preventDefault();
        setLoader(true);
        dispatch(updateStudentFields(studentID, fields, 'StudentAttendance'));
    };

    useEffect(() => {
        if (response) {
            setLoader(false);
            setShowPopup(true);
            setMessage(response);
        } else if (error) {
            setLoader(false);
            setShowPopup(true);
            setMessage('error');
        } else if (statestatus === 'added') {
            setLoader(false);
            setShowPopup(true);
            setMessage('Done Successfully');
        }
    }, [response, statestatus, error]);

    const studentName = userDetails?.name || 'Student';
    const rollNum = userDetails?.rollNum || '—';
    const classLabel = userDetails?.sclassName?.sclassName || 'Unassigned';
    const subjectFromTeacher = currentUser?.teachSubject?.subName;
    const initials = studentName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('') || 'S';

    const todayIso = new Date().toISOString().split('T')[0];

    if (loading && !studentReady) {
        return (
            <Box sx={{ py: 8, textAlign: 'center' }}>
                <CircularProgress size={28} sx={{ mb: 1.5 }} />
                <Typography color="text.secondary">Loading attendance form…</Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ width: '100%', pb: 4 }}>
            <Paper
                elevation={0}
                sx={{
                    mb: 2.5,
                    overflow: 'hidden',
                    borderRadius: '18px',
                    border: '1px solid',
                    borderColor: 'divider',
                }}
            >
                <Box
                    sx={{
                        px: { xs: 2, sm: 3 },
                        py: { xs: 2.5, sm: 3 },
                        background:
                            'linear-gradient(135deg, rgba(27,79,114,0.10) 0%, rgba(4,120,87,0.08) 55%, rgba(255,255,255,0.92) 100%)',
                    }}
                >
                    <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={2.5}
                        alignItems={{ xs: 'flex-start', md: 'center' }}
                        justifyContent="space-between"
                    >
                        <Stack direction="row" spacing={2} alignItems="center" sx={{ minWidth: 0 }}>
                            <Avatar
                                sx={{
                                    width: 64,
                                    height: 64,
                                    fontWeight: 800,
                                    bgcolor: 'primary.main',
                                    color: '#fff',
                                }}
                            >
                                {initials}
                            </Avatar>
                            <Box sx={{ minWidth: 0 }}>
                                <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                                    Mark attendance
                                </Typography>
                                <Typography
                                    variant="h3"
                                    sx={{
                                        fontWeight: 800,
                                        letterSpacing: '-0.02em',
                                        fontSize: { xs: '1.3rem', sm: '1.55rem' },
                                    }}
                                >
                                    {studentName}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                                    Roll {rollNum} · {classLabel}
                                    {subjectFromTeacher ? ` · ${subjectFromTeacher}` : ''}
                                </Typography>
                                <Stack direction="row" spacing={1} sx={{ mt: 1.25 }} flexWrap="wrap" useFlexGap>
                                    <Chip size="small" icon={<BadgeOutlinedIcon />} label={`Roll ${rollNum}`} />
                                    <Chip size="small" icon={<ClassOutlinedIcon />} label={classLabel} />
                                    {situation === 'Subject' && (
                                        <Chip size="small" icon={<MenuBookOutlinedIcon />} color="primary" label="Subject mode" />
                                    )}
                                </Stack>
                            </Box>
                        </Stack>

                        <Button
                            variant="outlined"
                            startIcon={<ArrowBackOutlinedIcon />}
                            onClick={() => navigate(`/Admin/students/student/${studentID || params.id || params.studentID}`)}
                        >
                            Back to profile
                        </Button>
                    </Stack>
                </Box>
            </Paper>

            <Grid container spacing={2.5}>
                <Grid item xs={12} md={7} lg={8}>
                    <AdminSection
                        title="Attendance entry"
                        subtitle="Choose the subject, status, and date, then save the record"
                    >
                        <Box component="form" onSubmit={submitHandler}>
                            <Stack spacing={2.5}>
                                {situation === 'Student' && (
                                    <FormControl fullWidth required>
                                        <InputLabel id="attendance-subject-label">Select Subject</InputLabel>
                                        <Select
                                            labelId="attendance-subject-label"
                                            id="attendance-subject"
                                            value={subjectName}
                                            label="Select Subject"
                                            onChange={changeHandler}
                                        >
                                            {subjectsList && subjectsList.length > 0 ? (
                                                subjectsList.map((subject) => (
                                                    <MenuItem key={subject._id} value={subject.subName}>
                                                        {subject.subName}
                                                    </MenuItem>
                                                ))
                                            ) : (
                                                <MenuItem disabled value="">
                                                    Add subjects for this class first
                                                </MenuItem>
                                            )}
                                        </Select>
                                    </FormControl>
                                )}

                                {situation === 'Subject' && subjectFromTeacher && (
                                    <Box
                                        sx={{
                                            p: 1.75,
                                            borderRadius: '12px',
                                            bgcolor: 'primary.light',
                                            border: '1px solid',
                                            borderColor: 'divider',
                                        }}
                                    >
                                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                                            Subject
                                        </Typography>
                                        <Typography variant="subtitle1" sx={{ fontWeight: 750 }}>
                                            {subjectFromTeacher}
                                        </Typography>
                                    </Box>
                                )}

                                <Box>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 750, mb: 1.25 }}>
                                        Attendance status
                                    </Typography>
                                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                                        <StatusChoice
                                            active={status === 'Present'}
                                            icon={<HowToRegOutlinedIcon />}
                                            label="Present"
                                            helper="Student attended class"
                                            color="success.main"
                                            bg="rgba(4,120,87,0.10)"
                                            onClick={() => setStatus('Present')}
                                        />
                                        <StatusChoice
                                            active={status === 'Absent'}
                                            icon={<PersonOffOutlinedIcon />}
                                            label="Absent"
                                            helper="Student missed class"
                                            color="error.main"
                                            bg="rgba(185,28,28,0.08)"
                                            onClick={() => setStatus('Absent')}
                                        />
                                    </Stack>
                                    {!status && (
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                                            Select Present or Absent to continue.
                                        </Typography>
                                    )}
                                </Box>

                                <TextField
                                    label="Select Date"
                                    type="date"
                                    value={date}
                                    onChange={(event) => setDate(event.target.value)}
                                    required
                                    fullWidth
                                    InputLabelProps={{ shrink: true }}
                                    inputProps={{ max: todayIso }}
                                    helperText="Use the class date for this attendance entry"
                                />

                                <Divider />

                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                                    <Button
                                        type="submit"
                                        variant="contained"
                                        size="large"
                                        disabled={loader || !status || !date || (situation === 'Student' && !chosenSubName)}
                                        startIcon={loader ? <CircularProgress size={18} color="inherit" /> : <EventAvailableOutlinedIcon />}
                                        sx={{ minWidth: 180 }}
                                    >
                                        {loader ? 'Saving…' : 'Save attendance'}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outlined"
                                        size="large"
                                        onClick={() => {
                                            setStatus('');
                                            setDate('');
                                            if (situation === 'Student') {
                                                setSubjectName('');
                                                setChosenSubName('');
                                            }
                                        }}
                                    >
                                        Reset
                                    </Button>
                                </Stack>
                            </Stack>
                        </Box>
                    </AdminSection>
                </Grid>

                <Grid item xs={12} md={5} lg={4}>
                    <AdminSection title="Entry checklist" subtitle="Quick checks before you submit">
                        <Stack spacing={1.5}>
                            <CheckRow
                                done={Boolean(studentName && studentName !== 'Student')}
                                label="Student loaded"
                                detail={studentName}
                            />
                            <CheckRow
                                done={situation === 'Subject' ? Boolean(chosenSubName || subjectFromTeacher) : Boolean(chosenSubName)}
                                label="Subject selected"
                                detail={
                                    situation === 'Subject'
                                        ? (subjectFromTeacher || 'Linked subject')
                                        : (subjectName || 'Choose a subject')
                                }
                            />
                            <CheckRow
                                done={Boolean(status)}
                                label="Status chosen"
                                detail={status || 'Present or Absent'}
                            />
                            <CheckRow
                                done={Boolean(date)}
                                label="Date set"
                                detail={date || 'Select a class date'}
                            />
                        </Stack>
                    </AdminSection>
                </Grid>
            </Grid>

            <Popup message={message} setShowPopup={setShowPopup} showPopup={showPopup} />
        </Box>
    );
};

const StatusChoice = ({ active, icon, label, helper, color, bg, onClick }) => (
    <Box
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onClick();
        }}
        sx={{
            flex: 1,
            p: 1.75,
            borderRadius: '14px',
            border: '1.5px solid',
            borderColor: active ? color : 'divider',
            bgcolor: active ? bg : 'background.paper',
            cursor: 'pointer',
            transition: 'border-color 140ms ease, background-color 140ms ease, transform 140ms ease',
            '&:hover': {
                borderColor: color,
                transform: 'translateY(-1px)',
            },
        }}
    >
        <Stack direction="row" spacing={1.25} alignItems="flex-start">
            <Box sx={{ color, mt: 0.15 }}>{icon}</Box>
            <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 750, color: active ? color : 'text.primary' }}>
                    {label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                    {helper}
                </Typography>
            </Box>
        </Stack>
    </Box>
);

const CheckRow = ({ done, label, detail }) => (
    <Box
        sx={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 1.5,
            py: 1.1,
            borderBottom: '1px solid',
            borderColor: 'divider',
            '&:last-child': { borderBottom: 'none', pb: 0 },
        }}
    >
        <Box>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {label}
            </Typography>
            <Typography variant="caption" color="text.secondary">
                {detail}
            </Typography>
        </Box>
        <Chip
            size="small"
            label={done ? 'Ready' : 'Pending'}
            color={done ? 'success' : 'default'}
            sx={{ fontWeight: 700 }}
        />
    </Box>
);

export default StudentAttendance;
