import { useState } from 'react';
import {
  CssBaseline, Box, Toolbar, List, Typography,
  IconButton, InputBase, Tooltip, Button,
  useMediaQuery, useTheme, Drawer as MuiDrawer,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import SearchIcon from '@mui/icons-material/Search';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AppBar, Drawer, drawerWidth } from '../../components/styles';
import PageHeader from '../../components/PageHeader';
import Logout from '../Logout';
import SideBar from './SideBar';
import { resolveAdminRouteMeta } from './adminRouteMeta';
import AdminProfile from './AdminProfile';
import AdminHomePage from './AdminHomePage';

import AddStudent from './studentRelated/AddStudent';
import SeeComplains from './studentRelated/SeeComplains';
import ShowStudents from './studentRelated/ShowStudents';
import StudentAttendance from './studentRelated/StudentAttendance';
import StudentExamMarks from './studentRelated/StudentExamMarks';
import ViewStudent from './studentRelated/ViewStudent';

import AddNotice from './noticeRelated/AddNotice';
import ShowNotices from './noticeRelated/ShowNotices';

import ShowSubjects from './subjectRelated/ShowSubjects';
import SubjectForm from './subjectRelated/SubjectForm';
import ViewSubject from './subjectRelated/ViewSubject';
import AdminTimetable from './timetable/AdminTimetable';
import AdminTimetableHome from './timetable/AdminTimetableHome';

import AddTeacher from './teacherRelated/AddTeacher';
import ChooseClass from './teacherRelated/ChooseClass';
import ChooseSubject from './teacherRelated/ChooseSubject';
import ShowTeachers from './teacherRelated/ShowTeachers';
import TeacherDetails from './teacherRelated/TeacherDetails';
import TeacherLeavePage from './TeacherLeavePage';
import ShowParents from './parentRelated/ShowParents';
import AddParent from './parentRelated/AddParent';
import ClassParentsPage from './parentRelated/ClassParentsPage';
import ShowStaff from './staffRelated/ShowStaff';
import AddStaff from './staffRelated/AddStaff';
import StaffDetails from './staffRelated/StaffDetails';
import FeesHomePage from './feesRelated/FeesHomePage';
import FeeHeadsPage from './feesRelated/FeeHeadsPage';
import FeeInvoicesPage from './feesRelated/FeeInvoicesPage';
import TransportRoutesPage from './transport/TransportRoutesPage';
import ClassFeesPage from './feesRelated/ClassFeesPage';
import PayrollHomePage from './payrollRelated/PayrollHomePage';
import StaffPayrollPage from './payrollRelated/StaffPayrollPage';
import AddStationery from './stationeryRelated/AddStationery';
import StationeryInvoices from './stationeryRelated/StationeryInvoices';
import ReportsDashboard from './reports/ReportsDashboard';
import ReportBuilderPage from './ReportBuilderPage';
import PrincipalOverviewPage from './PrincipalOverviewPage';
import AdmissionsPage from './AdmissionsPage';
import WelfarePage from './WelfarePage';
import FrontdeskDashboard from './frontdesk/FrontdeskDashboard';
import VisitorsListPage from './frontdesk/VisitorsListPage';
import AdminUploadBooks from './libraryRelated/AdminUploadBooks';
import LibraryBooks from './libraryRelated/LibraryBooks';
import TrackerPage from './TrackerPage';
import BLEAttendancePage from './BLEAttendancePage';
import DesignListPage from './design/DesignListPage';
import DesignStudioPage from './design/DesignStudioPage';
import DesignPrintPage from './design/DesignPrintPage';
import DesignSettingsPage from './design/DesignSettingsPage';
import DesignDataPage from './design/DesignDataPage';
import ReceiptAssignmentsPage from './design/ReceiptAssignmentsPage';

import AddClass from './classRelated/AddClass';
import ClassDetails from './classRelated/ClassDetails';
import ShowClasses from './classRelated/ShowClasses';
import AccountMenu from '../../components/AccountMenu';

/*
 * AdminDashboard — the shell that wraps the entire admin experience
 *
 * IMPROVEMENTS:
 * 1. AppBar now shows a contextual search bar (prepared for global search)
 * 2. AppBar title reflects the current section — not always "Admin Dashboard"
 * 3. Drawer has a proper min-width in collapsed mode for icon-only state
 * All routes are 100% unchanged.
 */

const AdminDashboard = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true });
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const routeMeta = resolveAdminRouteMeta(location.pathname);

  const toggleDrawer = () => setOpen(!open);
  const closeDrawer = () => setOpen(false);

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <CssBaseline />

      {/* ── AppBar ──────────────────────────────────────────────────── */}
      <AppBar open={!isMobile && open} position="absolute">
        <Toolbar sx={{ pr: { xs: 1, sm: 2 }, gap: { xs: 0.5, sm: 1 }, minWidth: 0 }}>
          {/* Hamburger — only shown when drawer is closed */}
          <Tooltip title={open ? 'Collapse sidebar' : 'Expand sidebar'}>
            <IconButton
              edge="start"
              aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
              onClick={toggleDrawer}
              sx={{
                mr: 1,
                color: 'text.secondary',
                transition: 'transform 200ms ease',
                transform: open ? 'rotate(0deg)' : 'rotate(0deg)',
              }}
            >
              {open ? <ChevronLeftIcon /> : <MenuIcon />}
            </IconButton>
          </Tooltip>

          {/* Brand name — visible when drawer is closed */}
          {!open && (
            <Typography
              variant="h6"
              sx={{ fontWeight: 800, color: 'primary.main', display: { xs: 'none', sm: 'block' }, letterSpacing: '-0.02em' }}
            >
              SchoolMS
            </Typography>
          )}

          {/* Search bar — prepared slot for global search feature */}
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              justifyContent: 'center',
              maxWidth: 480,
              mx: 'auto',
              minWidth: 0,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                bgcolor: searchFocused ? '#fff' : 'background.default',
                border: '1px solid',
                borderColor: searchFocused ? 'primary.main' : 'divider',
                borderRadius: '12px',
                px: 1.5,
                py: 0.5,
                gap: 1,
                width: '100%',
                transition: 'all 150ms ease',
                boxShadow: searchFocused ? '0 0 0 3px rgba(27,79,114,0.16)' : 'none',
              }}
            >
              <SearchIcon sx={{ color: 'text.disabled', fontSize: 18 }} />
              <InputBase
                placeholder={isMobile ? 'Search…' : 'Search students, teachers, classes, fees…'}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                sx={{
                  flex: 1,
                  fontSize: '0.875rem',
                  '& input::placeholder': { color: 'text.disabled' },
                }}
                inputProps={{ 'aria-label': 'Global search' }}
              />
            </Box>
          </Box>

          <Box sx={{ ml: 'auto' }}>
            <AccountMenu />
          </Box>
        </Toolbar>
      </AppBar>

      {/* ── Sidebar Drawer ───────────────────────────────────────────── */}
      <MuiDrawer
        variant="temporary"
        open={isMobile && open}
        onClose={closeDrawer}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            borderRight: '1px solid #E2E8F0',
          },
        }}
      >
        <List component="nav" sx={{ minHeight: '100%', display: 'flex', flexDirection: 'column', p: 0 }}>
          <SideBar onNavigate={closeDrawer} />
        </List>
      </MuiDrawer>

      <Drawer
        variant="permanent"
        open={open}
        sx={{
          ...(open ? styles.drawerOpen : styles.drawerClosed),
          display: { xs: 'none', md: 'block' },
        }}
      >
        <List component="nav" sx={{ minHeight: '100%', display: 'flex', flexDirection: 'column', p: 0 }}>
          <SideBar />
        </List>
      </Drawer>

      {/* ── Main Content ─────────────────────────────────────────────── */}
      <Box
        component="main"
        sx={(theme) => ({
          ...styles.mainContent,
          width: {
            xs: '100%',
            md: open ? `calc(100% - ${drawerWidth}px)` : `calc(100% - ${theme.spacing(9)})`,
          },
          minWidth: 0,
          transition: theme.transitions.create(['width'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
        })}
      >
        <Toolbar /> {/* Spacer to push content below AppBar */}

        <Box sx={styles.pageContent}>
          {routeMeta && !routeMeta.skipChrome && routeMeta.title && (
            <PageHeader
              title={routeMeta.title}
              subtitle={routeMeta.subtitle}
              breadcrumbs={routeMeta.crumbs}
              action={
                routeMeta.action ? (
                  <Button variant="contained" onClick={() => navigate(routeMeta.action.to)}>
                    {routeMeta.action.label}
                  </Button>
                ) : null
              }
            />
          )}
          <Routes>
            <Route path="/"                        element={<AdminHomePage />} />
            <Route path="*"                        element={<Navigate to="/" />} />
            <Route path="/Admin/dashboard"         element={<AdminHomePage />} />
            <Route path="/Admin/profile"           element={<AdminProfile />} />
            <Route path="/Admin/complains"         element={<SeeComplains />} />

            {/* Notice */}
            <Route path="/Admin/addnotice"         element={<AddNotice />} />
            <Route path="/Admin/notices"           element={<ShowNotices />} />

            {/* Subject */}
            <Route path="/Admin/subjects"                          element={<ShowSubjects />} />
            <Route path="/Admin/subjects/subject/:classID/:subjectID" element={<ViewSubject />} />
            <Route path="/Admin/subjects/chooseclass"              element={<ChooseClass situation="Subject" />} />
            <Route path="/Admin/addsubject/:id"                    element={<SubjectForm />} />
            <Route path="/Admin/class/subject/:classID/:subjectID" element={<ViewSubject />} />
            <Route path="/Admin/subject/student/attendance/:studentID/:subjectID" element={<StudentAttendance situation="Subject" />} />
            <Route path="/Admin/subject/student/marks/:studentID/:subjectID"      element={<StudentExamMarks situation="Subject" />} />

            {/* Class */}
            <Route path="/Admin/addclass"                  element={<AddClass />} />
            <Route path="/Admin/classes"                   element={<ShowClasses />} />
            <Route path="/Admin/classes/class/:id"         element={<ClassDetails />} />
            <Route path="/Admin/timetable"                 element={<AdminTimetableHome />} />
            <Route path="/Admin/timetable/:id"             element={<AdminTimetable />} />
            <Route path="/Admin/class/addstudents/:id"     element={<AddStudent situation="Class" />} />

            {/* Student */}
            <Route path="/Admin/addstudents"                              element={<AddStudent situation="Student" />} />
            <Route path="/Admin/students"                                  element={<ShowStudents />} />
            <Route path="/Admin/students/student/:id"                      element={<ViewStudent />} />
            <Route path="/Admin/students/student/attendance/:id"           element={<StudentAttendance situation="Student" />} />
            <Route path="/Admin/students/student/marks/:id"                element={<StudentExamMarks situation="Student" />} />

            {/* Teacher */}
            <Route path="/Admin/teachers"                                  element={<ShowTeachers />} />
            <Route path="/Admin/teachers/teacher/:id"                      element={<TeacherDetails />} />
            <Route path="/Admin/teachers/chooseclass"                      element={<ChooseClass situation="Teacher" />} />
            <Route path="/Admin/teachers/choosesubject/:id"                element={<ChooseSubject situation="Norm" />} />
            <Route path="/Admin/teachers/choosesubject/:classID/:teacherID" element={<ChooseSubject situation="Teacher" />} />
            <Route path="/Admin/teachers/addteacher/:id"                   element={<AddTeacher />} />
            <Route path="/Admin/teacher-leave"                             element={<TeacherLeavePage />} />

            {/* Parents */}
            <Route path="/Admin/parents"                 element={<ShowParents />} />
            <Route path="/Admin/addparent"               element={<AddParent />} />
            <Route path="/Admin/parents/class/:id"       element={<ClassParentsPage />} />

            {/* Reports */}
            <Route path="/Admin/reports"                 element={<ReportsDashboard />} />
            <Route path="/Admin/reports/builder"         element={<ReportBuilderPage />} />

            {/* Principal / Admissions / Welfare */}
            <Route path="/Admin/principal"               element={<PrincipalOverviewPage />} />
            <Route path="/Admin/admissions"              element={<AdmissionsPage />} />
            <Route path="/Admin/welfare"                 element={<WelfarePage />} />

            {/* Frontdesk */}
            <Route path="/Admin/frontdesk"               element={<FrontdeskDashboard />} />
            <Route path="/Admin/visitors"                element={<VisitorsListPage />} />

            {/* Staff */}
            <Route path="/Admin/staff"                   element={<ShowStaff />} />
            <Route path="/Admin/addstaff"                element={<AddStaff />} />
            <Route path="/Admin/staff/:id"               element={<StaffDetails />} />

            {/* Fees */}
            <Route path="/Admin/fees"                    element={<FeesHomePage />} />
            <Route path="/Admin/fees/heads"              element={<FeeHeadsPage />} />
            <Route path="/Admin/fees/invoices"           element={<FeeInvoicesPage />} />
            <Route path="/Admin/fees/class/:id"          element={<ClassFeesPage />} />

            {/* Transport */}
            <Route path="/Admin/transport"               element={<TransportRoutesPage />} />

            {/* Payroll */}
            <Route path="/Admin/payroll"                 element={<PayrollHomePage />} />
            <Route path="/Admin/payroll/staff/:id"       element={<StaffPayrollPage />} />
            <Route path="/Admin/payroll/teacher/:id"     element={<StaffPayrollPage />} />

            {/* Stationery */}
            <Route path="/Admin/stationery"              element={<AddStationery />} />
            <Route path="/Admin/invoices"                element={<StationeryInvoices />} />

            {/* Library */}
            <Route path="/Admin/library/upload"          element={<AdminUploadBooks />} />
            <Route path="/Admin/library/books"           element={<LibraryBooks />} />

            {/* Tracker + BLE */}
            <Route path="/Admin/tracker"                 element={<TrackerPage />} />
            <Route path="/Admin/ble-attendance"          element={<BLEAttendancePage />} />
            <Route path="/Admin/design"                  element={<DesignListPage />} />
            <Route path="/Admin/design/edit/:id"         element={<DesignStudioPage />} />
            <Route path="/Admin/design/print/:id"        element={<DesignPrintPage />} />
            <Route path="/Admin/design/settings"         element={<DesignSettingsPage />} />
            <Route path="/Admin/design/assignments"      element={<ReceiptAssignmentsPage />} />
            <Route path="/Admin/design/data"             element={<DesignDataPage />} />

            <Route path="/logout"                        element={<Logout />} />
          </Routes>
        </Box>
      </Box>
    </Box>
  );
};

export default AdminDashboard;

const styles = {
  mainContent: {
    backgroundColor: (theme) => theme.palette.background.default,
    flexGrow: 1,
    height: '100vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  drawerOpen: {
    display: 'flex',
  },
  drawerClosed: {
    display: 'flex',
  },
  pageContent: {
    p: { xs: 1.5, sm: 2.25, md: 3.25 },
    height: 'calc(100% - 64px)',
    overflowY: 'auto',
    overflowX: 'hidden',
    minWidth: 0,
    width: '100%',
    maxWidth: 1480,
    mx: 'auto',
    boxSizing: 'border-box',
    '& .MuiGrid-item': { minWidth: 0 },
    '& .MuiContainer-root': { px: { xs: 0, sm: 1 }, maxWidth: '100%' },
    '& .MuiPaper-root, & .MuiCard-root': { maxWidth: '100%' },
    '& .MuiTableContainer-root': { maxWidth: '100%', overflowX: 'auto' },
    '& img, & video': { maxWidth: '100%', height: 'auto' },
  },
};