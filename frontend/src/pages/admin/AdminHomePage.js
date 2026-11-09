import { Grid, Box, Typography, Button, Stack } from '@mui/material';
import SeeNotice from '../../components/SeeNotice';
import CountUp from 'react-countup';
import { useDispatch, useSelector } from 'react-redux';
import { useEffect } from 'react';
import { getAllSclasses } from '../../redux/sclassRelated/sclassHandle';
import { getAllStudents } from '../../redux/studentRelated/studentHandle';
import { getAllTeachers } from '../../redux/teacherRelated/teacherHandle';
import { getFinancialAccounting } from '../../redux/financialRelated/financialHandle';
import FinancialAccounting from './financialRelated/FinancialAccounting';
import { fetchAttendanceReport, fetchFeesReport } from '../../redux/reportRelated/reportHandle';
import AttendanceFeesCharts from '../../components/reports/AttendanceFeesCharts';
import { StatCardSkeleton } from '../../components/SkeletonLoaders';
import { useNavigate } from 'react-router-dom';
import AdminPageShell from '../../components/admin/AdminPageShell';
import AdminStatCard from '../../components/admin/AdminStatCard';
import AdminSection from '../../components/admin/AdminSection';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import ClassOutlinedIcon from '@mui/icons-material/ClassOutlined';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';

const QuickAction = ({ label, to, icon: Icon }) => {
  const navigate = useNavigate();
  return (
    <Button
      onClick={() => navigate(to)}
      variant="outlined"
      size="medium"
      startIcon={Icon ? <Icon sx={{ fontSize: 18 }} /> : null}
      sx={{
        borderRadius: '10px',
        fontWeight: 650,
        px: 2,
        py: 1,
        justifyContent: 'flex-start',
        bgcolor: 'background.paper',
      }}
    >
      {label}
    </Button>
  );
};

const AdminHomePage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { studentsList, loading: studentsLoading } = useSelector((state) => state.student);
  const { sclassesList, loading: classesLoading } = useSelector((state) => state.sclass);
  const { teachersList, loading: teachersLoading } = useSelector((state) => state.teacher);
  const { financialData } = useSelector((state) => state.financial);
  const { currentUser } = useSelector((state) => state.user);

  const adminID = currentUser._id;
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    dispatch(getAllStudents(adminID));
    dispatch(getAllSclasses(adminID, 'Sclass'));
    dispatch(getAllTeachers(adminID));
    dispatch(getFinancialAccounting(adminID, currentYear));
    dispatch(fetchAttendanceReport(adminID, 6));
    dispatch(fetchFeesReport(adminID, 6));
  }, [adminID, dispatch, currentYear]);

  const numberOfStudents = studentsList?.length ?? 0;
  const numberOfClasses = sclassesList?.length ?? 0;
  const numberOfTeachers = teachersList?.length ?? 0;
  const totalFees = financialData?.totalRevenue ?? 0;
  const isLoading = studentsLoading || classesLoading || teachersLoading;

  const firstName = currentUser.name?.split(' ')[0] || 'Admin';
  const schoolName = currentUser.schoolName || 'your school';

  const stats = [
    {
      label: 'Students',
      value: <CountUp end={numberOfStudents} duration={1.6} />,
      helper: 'Enrolled learners',
      icon: <GroupsOutlinedIcon />,
      color: 'primary.main',
      bg: 'primary.light',
      to: '/Admin/students',
    },
    {
      label: 'Classes',
      value: <CountUp end={numberOfClasses} duration={1.6} />,
      helper: 'Active class sections',
      icon: <ClassOutlinedIcon />,
      color: 'secondary.main',
      bg: 'rgba(15,118,110,0.12)',
      to: '/Admin/classes',
    },
    {
      label: 'Teachers',
      value: <CountUp end={numberOfTeachers} duration={1.6} />,
      helper: 'Teaching staff',
      icon: <SchoolOutlinedIcon />,
      color: 'success.main',
      bg: 'rgba(4,120,87,0.12)',
      to: '/Admin/teachers',
    },
    {
      label: 'Fees Collected',
      value: (
        <>
          ₹
          <CountUp end={totalFees} duration={1.8} separator="," />
        </>
      ),
      helper: `Revenue overview · ${currentYear}`,
      icon: <PaymentsOutlinedIcon />,
      color: 'warning.main',
      bg: 'rgba(180,83,9,0.12)',
      to: '/Admin/fees',
    },
  ];

  return (
    <AdminPageShell
      title="School Dashboard"
      subtitle={`Welcome back, ${firstName}. Monitor enrolment, academics, fees, and daily operations for ${schoolName}.`}
      breadcrumbs={[
        { label: 'Admin', href: '/' },
        { label: 'Dashboard' },
      ]}
      action={
        <Button variant="contained" onClick={() => navigate('/Admin/addstudents')} startIcon={<PersonAddAlt1Icon />}>
          Add Student
        </Button>
      }
    >
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {isLoading
          ? [1, 2, 3, 4].map((i) => (
              <Grid item xs={12} sm={6} lg={3} key={i}>
                <StatCardSkeleton />
              </Grid>
            ))
          : stats.map((stat) => (
              <Grid item xs={12} sm={6} lg={3} key={stat.label}>
                <AdminStatCard {...stat} />
              </Grid>
            ))}
      </Grid>

      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} lg={8}>
          <AdminSection
            title="Quick Operations"
            subtitle="Common school admin tasks in one place"
          >
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: '1fr 1fr',
                  md: '1fr 1fr 1fr',
                },
                gap: 1.25,
              }}
            >
              <QuickAction label="Add Student" to="/Admin/addstudents" icon={PersonAddAlt1Icon} />
              <QuickAction label="Add Teacher" to="/Admin/teachers/chooseclass" icon={SchoolOutlinedIcon} />
              <QuickAction label="Create Notice" to="/Admin/addnotice" icon={CampaignOutlinedIcon} />
              <QuickAction label="Add Class" to="/Admin/addclass" icon={ClassOutlinedIcon} />
              <QuickAction label="Fee Collection" to="/Admin/fees" icon={AccountBalanceOutlinedIcon} />
              <QuickAction label="Reports Center" to="/Admin/reports" icon={AssessmentOutlinedIcon} />
            </Box>
          </AdminSection>
        </Grid>
        <Grid item xs={12} lg={4}>
          <AdminSection
            title="Today at a Glance"
            subtitle="Operational snapshot"
          >
            <Stack spacing={1.5}>
              <GlanceRow label="Students on roll" value={numberOfStudents} />
              <GlanceRow label="Teaching staff" value={numberOfTeachers} />
              <GlanceRow label="Active classes" value={numberOfClasses} />
              <GlanceRow
                label="Fees collected"
                value={`₹${Number(totalFees || 0).toLocaleString()}`}
              />
            </Stack>
          </AdminSection>
        </Grid>
      </Grid>

      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12}>
          <AdminSection
            title="Attendance & Fees Trends"
            subtitle="Track school performance over recent months"
            disablePadding
          >
            <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
              <AttendanceFeesCharts hideSummaries />
            </Box>
          </AdminSection>
        </Grid>
      </Grid>

      <Grid container spacing={2.5}>
        <Grid item xs={12} lg={8}>
          <AdminSection title="Financial Overview" subtitle="Accounting summary for the current year">
            <FinancialAccounting />
          </AdminSection>
        </Grid>
        <Grid item xs={12} lg={4}>
          <AdminSection title="Recent Notices" subtitle="Latest school communications">
            <SeeNotice />
          </AdminSection>
        </Grid>
      </Grid>
    </AdminPageShell>
  );
};

const GlanceRow = ({ label, value }) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 2,
      py: 1,
      borderBottom: '1px solid',
      borderColor: 'divider',
      '&:last-child': { borderBottom: 'none', pb: 0 },
    }}
  >
    <Typography variant="body2" color="text.secondary">
      {label}
    </Typography>
    <Typography variant="subtitle2" sx={{ fontWeight: 750 }}>
      {value}
    </Typography>
  </Box>
);

export default AdminHomePage;
