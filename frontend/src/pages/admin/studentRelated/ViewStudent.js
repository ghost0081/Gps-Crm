import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getUserDetails } from '../../../redux/userRelated/userHandle';
import { useNavigate, useParams } from 'react-router-dom';
import { getSubjectList } from '../../../redux/sclassRelated/sclassHandle';
import {
    Box, Button, Collapse, IconButton, Table, TableBody, TableHead, Typography,
    Tab, Paper, Avatar, Chip, Divider, Grid, TextField, Stack, TableContainer,
    LinearProgress
} from '@mui/material';
import axios from 'axios';
import TabContext from '@mui/lab/TabContext';
import TabList from '@mui/lab/TabList';
import TabPanel from '@mui/lab/TabPanel';
import { KeyboardArrowUp, KeyboardArrowDown, Delete as DeleteIcon } from '@mui/icons-material';
import { removeStuff, updateStudentFields } from '../../../redux/studentRelated/studentHandle';
import {
    calculateOverallAttendancePercentage,
    calculateSubjectAttendancePercentage,
    groupAttendanceBySubject
} from '../../../components/attendanceCalculator';
import CustomBarChart from '../../../components/CustomBarChart';
import CustomPieChart from '../../../components/CustomPieChart';
import { StyledTableCell, StyledTableRow } from '../../../components/styles';
import Popup from '../../../components/Popup';
import AdminSection from '../../../components/admin/AdminSection';
import AdminStatCard from '../../../components/admin/AdminStatCard';
import BluetoothIcon from '@mui/icons-material/Bluetooth';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import ClassOutlinedIcon from '@mui/icons-material/ClassOutlined';
import HowToRegOutlinedIcon from '@mui/icons-material/HowToRegOutlined';
import GradeOutlinedIcon from '@mui/icons-material/GradeOutlined';
import DevicesOtherOutlinedIcon from '@mui/icons-material/DevicesOtherOutlined';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import InsertChartOutlinedIcon from '@mui/icons-material/InsertChartOutlined';
import PersonRemoveOutlinedIcon from '@mui/icons-material/PersonRemoveOutlined';

const ViewStudent = () => {
    const navigate = useNavigate();
    const params = useParams();
    const dispatch = useDispatch();
    const { userDetails, loading, error } = useSelector((state) => state.user);

    const studentID = params.id;
    const address = 'Student';

    useEffect(() => {
        dispatch(getUserDetails(studentID, address));
    }, [dispatch, studentID]);

    useEffect(() => {
        if (userDetails && userDetails.sclassName && userDetails.sclassName._id !== undefined) {
            dispatch(getSubjectList(userDetails.sclassName._id, 'ClassSubjects'));
        }
    }, [dispatch, userDetails]);

    if (error) console.log(error);

    const [name, setName] = useState('');
    const [rollNum, setRollNum] = useState('');
    const [sclassName, setSclassName] = useState('');
    const [studentSchool, setStudentSchool] = useState('');
    const [subjectMarks, setSubjectMarks] = useState('');
    const [subjectAttendance, setSubjectAttendance] = useState([]);
    const [openStates, setOpenStates] = useState({});
    const [showPopup, setShowPopup] = useState(false);
    const [message, setMessage] = useState('');
    const [popupSeverity, setPopupSeverity] = useState('error');
    const [value, setValue] = useState('1');
    const [selectedSection, setSelectedSection] = useState('table');
    const [bleImei, setBleImei] = useState('');
    const [savingWearable, setSavingWearable] = useState(false);

    const handleOpen = (subId) => {
        setOpenStates((prevState) => ({
            ...prevState,
            [subId]: !prevState[subId],
        }));
    };

    const handleChange = (event, newValue) => {
        setValue(newValue);
        setSelectedSection('table');
    };

    useEffect(() => {
        if (userDetails) {
            setName(userDetails.name || '');
            setRollNum(userDetails.rollNum || '');
            setSclassName(userDetails.sclassName || '');
            setStudentSchool(userDetails.school || '');
            setSubjectMarks(userDetails.examResult || '');
            setSubjectAttendance(userDetails.attendance || []);
            setBleImei(userDetails.imei || '');
        }
    }, [userDetails]);

    const deleteHandler = () => {
        setMessage('Sorry the delete function has been disabled for now.');
        setPopupSeverity('error');
        setShowPopup(true);
    };

    const removeHandler = (id, deladdress) => {
        dispatch(removeStuff(id, deladdress)).then(() => {
                dispatch(getUserDetails(studentID, address));
        });
    };

    const removeSubAttendance = (subId) => {
        dispatch(updateStudentFields(studentID, { subId }, 'RemoveStudentSubAtten')).then(() => {
            dispatch(getUserDetails(studentID, address));
        });
    };

    const handleAllotBle = async () => {
        try {
            setSavingWearable(true);
            await axios.put(`${process.env.REACT_APP_BASE_URL}/Student/${studentID}`, { imei: bleImei });
            dispatch(getUserDetails(studentID, address));
            setMessage(bleImei ? `Wearable ${bleImei} allotted to ${userDetails.name}.` : `Wearable removed for ${userDetails.name}.`);
            setPopupSeverity('success');
            setShowPopup(true);
        } catch (err) {
            console.error('Error allotting BLE:', err);
            setMessage('Failed to allot BLE wearable.');
            setPopupSeverity('error');
            setShowPopup(true);
        } finally {
            setSavingWearable(false);
        }
    };

    const handleRemoveWearable = async () => {
        try {
            setSavingWearable(true);
            setBleImei('');
            await axios.put(`${process.env.REACT_APP_BASE_URL}/Student/${studentID}`, { imei: '' });
                dispatch(getUserDetails(studentID, address));
            setMessage('Wearable removed successfully.');
            setPopupSeverity('success');
            setShowPopup(true);
        } catch (err) {
            console.error(err);
            setMessage('Failed to remove wearable.');
            setPopupSeverity('error');
            setShowPopup(true);
        } finally {
            setSavingWearable(false);
        }
    };

    const overallAttendancePercentage = calculateOverallAttendancePercentage(subjectAttendance);
    const overallAbsentPercentage = 100 - overallAttendancePercentage;

    const chartData = [
        { name: 'Present', value: overallAttendancePercentage },
        { name: 'Absent', value: overallAbsentPercentage }
    ];

    const subjectData = Object.entries(groupAttendanceBySubject(subjectAttendance)).map(([subName, { subCode, present, sessions }]) => {
        const subjectAttendancePercentage = calculateSubjectAttendancePercentage(present, sessions);
        return {
            subject: subName,
            attendancePercentage: subjectAttendancePercentage,
            totalClasses: sessions,
            attendedClasses: present
        };
    });

    const marksCount = Array.isArray(subjectMarks)
        ? subjectMarks.filter((result) => result.subName && result.marksObtained != null).length
        : 0;

    const initials = (name || 'S')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('') || 'S';

    const classLabel = sclassName?.sclassName || 'Unassigned';
    const schoolLabel = studentSchool?.schoolName || '—';
    const hasWearable = Boolean(userDetails?.imei);

    const SectionToggle = () => (
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            <Button
                size="small"
                variant={selectedSection === 'table' ? 'contained' : 'outlined'}
                startIcon={<TableChartOutlinedIcon />}
                onClick={() => setSelectedSection('table')}
            >
                Table
            </Button>
            <Button
                size="small"
                variant={selectedSection === 'chart' ? 'contained' : 'outlined'}
                startIcon={<InsertChartOutlinedIcon />}
                onClick={() => setSelectedSection('chart')}
            >
                Chart
            </Button>
        </Stack>
    );

    const StudentAttendanceSection = () => {
        const renderTableSection = () => (
                <>
                <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '12px', mb: 2 }}>
                    <Table size="small">
                        <TableHead>
                            <StyledTableRow>
                                <StyledTableCell>Subject</StyledTableCell>
                                <StyledTableCell>Present</StyledTableCell>
                                <StyledTableCell>Sessions</StyledTableCell>
                                <StyledTableCell>Attendance</StyledTableCell>
                                <StyledTableCell align="right">Actions</StyledTableCell>
                            </StyledTableRow>
                        </TableHead>
                        {Object.entries(groupAttendanceBySubject(subjectAttendance)).map(([subName, { present, allData, subId, sessions }], index) => {
                            const subjectAttendancePercentage = calculateSubjectAttendancePercentage(present, sessions);
                            return (
                                <TableBody key={index}>
                                    <StyledTableRow>
                                        <StyledTableCell sx={{ fontWeight: 650 }}>{subName}</StyledTableCell>
                                        <StyledTableCell>{present}</StyledTableCell>
                                        <StyledTableCell>{sessions}</StyledTableCell>
                                        <StyledTableCell>
                                            <Box sx={{ minWidth: 120 }}>
                                                <Typography variant="caption" sx={{ fontWeight: 700 }}>
                                                    {subjectAttendancePercentage}%
                                                </Typography>
                                                <LinearProgress
                                                    variant="determinate"
                                                    value={Math.min(100, Number(subjectAttendancePercentage) || 0)}
                                                    sx={{ mt: 0.5, height: 6, borderRadius: 99 }}
                                                />
                                            </Box>
                                        </StyledTableCell>
                                        <StyledTableCell align="right">
                                            <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap" useFlexGap>
                                                <Button size="small" variant="outlined" onClick={() => handleOpen(subId)}>
                                                    {openStates[subId] ? <KeyboardArrowUp /> : <KeyboardArrowDown />} Details
                                            </Button>
                                                <Button
                                                    size="small"
                                                    variant="contained"
                                                    onClick={() => navigate(`/Admin/subject/student/attendance/${studentID}/${subId}`)}
                                                >
                                                Change
                                            </Button>
                                                <IconButton size="small" onClick={() => removeSubAttendance(subId)} aria-label="Remove subject attendance">
                                                    <DeleteIcon color="error" fontSize="small" />
                                                </IconButton>
                                            </Stack>
                                        </StyledTableCell>
                                    </StyledTableRow>
                                    <StyledTableRow>
                                        <StyledTableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
                                            <Collapse in={openStates[subId]} timeout="auto" unmountOnExit>
                                                <Box sx={{ py: 2, px: 1 }}>
                                                    <Typography variant="subtitle2" sx={{ mb: 1.25, fontWeight: 750 }}>
                                                        Session history · {subName}
                                                    </Typography>
                                                    <Table size="small">
                                                        <TableHead>
                                                            <StyledTableRow>
                                                                <StyledTableCell>Date</StyledTableCell>
                                                                <StyledTableCell align="right">Status</StyledTableCell>
                                                            </StyledTableRow>
                                                        </TableHead>
                                                        <TableBody>
                                                            {allData.map((data, idx) => {
                                                                const date = new Date(data.date);
                                                                const dateString = date.toString() !== 'Invalid Date'
                                                                    ? date.toISOString().substring(0, 10)
                                                                    : 'Invalid Date';
                                                                return (
                                                                    <StyledTableRow key={idx}>
                                                                        <StyledTableCell>{dateString}</StyledTableCell>
                                                                        <StyledTableCell align="right">
                                                                            <Chip
                                                                                size="small"
                                                                                label={data.status}
                                                                                color={String(data.status).toLowerCase() === 'present' ? 'success' : 'default'}
                                                                            />
                                                                        </StyledTableCell>
                                                                    </StyledTableRow>
                                                                );
                                                            })}
                                                        </TableBody>
                                                    </Table>
                                                </Box>
                                            </Collapse>
                                        </StyledTableCell>
                                    </StyledTableRow>
                                </TableBody>
                            );
                        })}
                    </Table>
                </TableContainer>

                <Box
                    sx={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 1.5,
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 2,
                        borderRadius: '12px',
                        bgcolor: 'primary.light',
                        mb: 2,
                    }}
                >
                    <Typography variant="subtitle2" sx={{ fontWeight: 750 }}>
                        Overall attendance · {overallAttendancePercentage.toFixed(1)}%
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Button
                            variant="contained"
                            onClick={() => navigate(`/Admin/students/student/attendance/${studentID}`)}
                        >
                        Add Attendance
                    </Button>
                        <Button
                            variant="outlined"
                            color="error"
                            startIcon={<DeleteIcon />}
                            onClick={() => removeHandler(studentID, 'RemoveStudentAtten')}
                        >
                            Clear All
                        </Button>
                    </Stack>
                </Box>
            </>
        );

        if (!(subjectAttendance && Array.isArray(subjectAttendance) && subjectAttendance.length > 0)) {
            return (
                <EmptyPanel
                    title="No attendance recorded"
                    body="Start tracking this student’s classroom presence."
                    actionLabel="Add Attendance"
                    onAction={() => navigate(`/Admin/students/student/attendance/${studentID}`)}
                />
            );
        }

        return (
            <>
                <SectionToggle />
                {selectedSection === 'table' ? renderTableSection() : <CustomBarChart chartData={subjectData} dataKey="attendancePercentage" />}
            </>
        );
    };

    const StudentMarksSection = () => {
        const renderTableSection = () => (
                <>
                <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '12px', mb: 2 }}>
                    <Table size="small">
                        <TableHead>
                            <StyledTableRow>
                                <StyledTableCell>Subject</StyledTableCell>
                                <StyledTableCell align="right">Marks Obtained</StyledTableCell>
                            </StyledTableRow>
                        </TableHead>
                        <TableBody>
                            {subjectMarks.map((result, index) => {
                                if (!result.subName || result.marksObtained == null) return null;
                                return (
                                    <StyledTableRow key={index}>
                                        <StyledTableCell sx={{ fontWeight: 650 }}>{result.subName.subName}</StyledTableCell>
                                        <StyledTableCell align="right">
                                            <Chip size="small" color="primary" label={result.marksObtained} sx={{ fontWeight: 750 }} />
                                        </StyledTableCell>
                                    </StyledTableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
                <Button variant="contained" onClick={() => navigate(`/Admin/students/student/marks/${studentID}`)}>
                        Add Marks
                    </Button>
                </>
        );

        if (!(subjectMarks && Array.isArray(subjectMarks) && subjectMarks.length > 0)) {
            return (
                <EmptyPanel
                    title="No exam marks yet"
                    body="Add subject-wise marks to build this student’s academic record."
                    actionLabel="Add Marks"
                    onAction={() => navigate(`/Admin/students/student/marks/${studentID}`)}
                />
            );
        }

        return (
            <>
                <SectionToggle />
                {selectedSection === 'table' ? renderTableSection() : <CustomBarChart chartData={subjectMarks} dataKey="marksObtained" />}
            </>
        );
    };

    const StudentDetailsSection = () => (
        <Grid container spacing={2.5}>
            <Grid item xs={12} md={7}>
                <AdminSection
                    title="Student information"
                    subtitle="Core enrolment details for school records"
                >
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                            <InfoTile icon={<BadgeOutlinedIcon />} label="Full name" value={userDetails?.name || '—'} />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <InfoTile icon={<SchoolOutlinedIcon />} label="Roll number" value={userDetails?.rollNum || '—'} />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <InfoTile icon={<ClassOutlinedIcon />} label="Class" value={classLabel} />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <InfoTile icon={<SchoolOutlinedIcon />} label="School" value={schoolLabel} />
                        </Grid>
                    </Grid>

                    <Divider sx={{ my: 2.5 }} />

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                        <Button
                            variant="outlined"
                            color="error"
                            startIcon={<PersonRemoveOutlinedIcon />}
                            onClick={deleteHandler}
                        >
                            Delete Student
                        </Button>
                        <Button
                            variant="outlined"
                            onClick={() => navigate(`/Admin/students/student/attendance/${studentID}`)}
                        >
                            Manage Attendance
                        </Button>
                                <Button
                                    variant="outlined"
                            onClick={() => navigate(`/Admin/students/student/marks/${studentID}`)}
                        >
                            Manage Marks
                        </Button>
                    </Stack>
                </AdminSection>
            </Grid>

            <Grid item xs={12} md={5}>
                <AdminSection
                    title="Safety device"
                    subtitle="BLE / GPS wearable linked to this student"
                    action={
                        hasWearable ? (
                            <Button
                                    size="small"
                                variant="outlined"
                                startIcon={<LocationOnOutlinedIcon />}
                                    onClick={() => navigate('/Admin/tracker')}
                                >
                                Live track
                                </Button>
                        ) : null
                    }
                >
                    <Stack spacing={2}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box
                                sx={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: '12px',
                                    bgcolor: hasWearable ? 'rgba(4,120,87,0.12)' : 'background.default',
                                    color: hasWearable ? 'success.main' : 'text.secondary',
                                    display: 'grid',
                                    placeItems: 'center',
                                }}
                            >
                                <BluetoothIcon />
                            </Box>
                            <Box>
                                <Typography variant="subtitle2" sx={{ fontWeight: 750 }}>
                                    {hasWearable ? 'Wearable allotted' : 'No wearable allotted'}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {hasWearable ? userDetails.imei : 'Assign an IMEI / BLE ID for live tracking'}
                                </Typography>
                            </Box>
                        </Box>

                            <TextField
                                label="Wearable IMEI / BLE ID"
                                size="small"
                            fullWidth
                                value={bleImei}
                                onChange={(e) => setBleImei(e.target.value)}
                                placeholder="e.g. 864163085084979"
                            helperText="Leave blank and save to clear an existing assignment."
                            />

                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            <Button
                                variant="contained"
                                color="success"
                                disabled={savingWearable}
                                onClick={handleAllotBle}
                            >
                                {hasWearable ? 'Update allotment' : 'Allot wearable'}
                            </Button>
                            {hasWearable && (
                                <Button
                                    variant="outlined"
                                    color="error"
                                    disabled={savingWearable}
                                    onClick={handleRemoveWearable}
                                >
                                    Remove
                                </Button>
                            )}
                        </Stack>
                    </Stack>
                </AdminSection>

                {subjectAttendance && Array.isArray(subjectAttendance) && subjectAttendance.length > 0 && (
                    <Box sx={{ mt: 2.5 }}>
                        <AdminSection title="Attendance split" subtitle="Present vs absent overall">
                        <CustomPieChart data={chartData} />
                        </AdminSection>
                    </Box>
                )}
            </Grid>
        </Grid>
    );

    if (loading || !userDetails) {
        return (
            <Box sx={{ py: 8, textAlign: 'center' }}>
                <Typography color="text.secondary">Loading student profile…</Typography>
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
                            'linear-gradient(135deg, rgba(27,79,114,0.10) 0%, rgba(15,118,110,0.08) 55%, rgba(255,255,255,0.9) 100%)',
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
                                    width: 72,
                                    height: 72,
                                    fontWeight: 800,
                                    fontSize: '1.4rem',
                                    bgcolor: 'primary.main',
                                    color: '#fff',
                                }}
                            >
                                {initials}
                            </Avatar>
                            <Box sx={{ minWidth: 0 }}>
                                <Typography
                                    variant="h3"
                                    sx={{
                                        fontWeight: 800,
                                        letterSpacing: '-0.02em',
                                        fontSize: { xs: '1.35rem', sm: '1.6rem' },
                                    }}
                                >
                                    {userDetails.name}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                                    Roll {userDetails.rollNum} · {classLabel} · {schoolLabel}
                                </Typography>
                                <Stack direction="row" spacing={1} sx={{ mt: 1.25 }} flexWrap="wrap" useFlexGap>
                                    <Chip size="small" icon={<ClassOutlinedIcon />} label={classLabel} />
                                    <Chip
                                        size="small"
                                        icon={<DevicesOtherOutlinedIcon />}
                                        color={hasWearable ? 'success' : 'default'}
                                        label={hasWearable ? 'Tracked' : 'No device'}
                                    />
                                    <Chip
                                        size="small"
                                        icon={<HowToRegOutlinedIcon />}
                                        label={`${overallAttendancePercentage.toFixed(0)}% attendance`}
                                    />
                                </Stack>
                            </Box>
                        </Stack>

                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            <Button
                                variant="contained"
                                startIcon={<HowToRegOutlinedIcon />}
                                onClick={() => navigate(`/Admin/students/student/attendance/${studentID}`)}
                            >
                                Attendance
                            </Button>
                            <Button
                                variant="outlined"
                                startIcon={<GradeOutlinedIcon />}
                                onClick={() => navigate(`/Admin/students/student/marks/${studentID}`)}
                            >
                                Marks
                            </Button>
                            {hasWearable && (
                                <Button
                                    variant="outlined"
                                    startIcon={<LocationOnOutlinedIcon />}
                                    onClick={() => navigate('/Admin/tracker')}
                                >
                                    Track
                                </Button>
                            )}
                        </Stack>
                    </Stack>
                </Box>
            </Paper>

            <Grid container spacing={2} sx={{ mb: 2.5 }}>
                <Grid item xs={12} sm={6} md={3}>
                    <AdminStatCard
                        label="Attendance"
                        value={`${overallAttendancePercentage.toFixed(0)}%`}
                        helper="Overall present rate"
                        icon={<HowToRegOutlinedIcon />}
                        color="success.main"
                        bg="rgba(4,120,87,0.12)"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <AdminStatCard
                        label="Subjects marked"
                        value={marksCount}
                        helper="Exam results on record"
                        icon={<GradeOutlinedIcon />}
                        color="primary.main"
                        bg="primary.light"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <AdminStatCard
                        label="Class"
                        value={classLabel}
                        helper="Current enrolment"
                        icon={<ClassOutlinedIcon />}
                        color="secondary.main"
                        bg="rgba(15,118,110,0.12)"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <AdminStatCard
                        label="Wearable"
                        value={hasWearable ? 'Active' : 'None'}
                        helper={hasWearable ? userDetails.imei : 'Not allotted'}
                        icon={<BluetoothIcon />}
                        color={hasWearable ? 'success.main' : 'text.secondary'}
                        bg={hasWearable ? 'rgba(4,120,87,0.12)' : 'background.default'}
                    />
                </Grid>
            </Grid>

            <Paper elevation={0} sx={{ borderRadius: '16px', overflow: 'hidden' }}>
                        <TabContext value={value}>
                    <Box sx={{ borderBottom: 1, borderColor: 'divider', px: { xs: 1, sm: 2 } }}>
                        <TabList
                            onChange={handleChange}
                            variant="scrollable"
                            scrollButtons="auto"
                            allowScrollButtonsMobile
                        >
                                    <Tab label="Details" value="1" />
                                    <Tab label="Attendance" value="2" />
                                    <Tab label="Marks" value="3" />
                                </TabList>
                            </Box>
                    <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
                        <TabPanel value="1" sx={{ p: 0 }}>
                                    <StudentDetailsSection />
                                </TabPanel>
                        <TabPanel value="2" sx={{ p: 0 }}>
                                    <StudentAttendanceSection />
                                </TabPanel>
                        <TabPanel value="3" sx={{ p: 0 }}>
                                    <StudentMarksSection />
                                </TabPanel>
                    </Box>
                </TabContext>
            </Paper>

            <Popup message={message} setShowPopup={setShowPopup} showPopup={showPopup} severity={popupSeverity} />
        </Box>
    );
};

const InfoTile = ({ icon, label, value }) => (
    <Box
        sx={{
            p: 1.75,
            borderRadius: '12px',
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.default',
            height: '100%',
        }}
    >
        <Stack direction="row" spacing={1.25} alignItems="flex-start">
            <Box sx={{ color: 'primary.main', mt: 0.15 }}>{icon}</Box>
            <Box sx={{ minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {label}
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 750, mt: 0.25, wordBreak: 'break-word' }}>
                    {value}
                </Typography>
            </Box>
        </Stack>
    </Box>
);

const EmptyPanel = ({ title, body, actionLabel, onAction }) => (
    <Box
        sx={{
            textAlign: 'center',
            py: 6,
            px: 2,
            borderRadius: '14px',
            border: '1px dashed',
            borderColor: 'divider',
            bgcolor: 'background.default',
        }}
    >
        <Typography variant="h5" sx={{ fontWeight: 750, mb: 0.75 }}>{title}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, maxWidth: 420, mx: 'auto' }}>
            {body}
        </Typography>
        <Button variant="contained" onClick={onAction}>{actionLabel}</Button>
    </Box>
);

export default ViewStudent;
