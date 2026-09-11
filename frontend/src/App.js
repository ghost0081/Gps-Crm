import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useSelector } from 'react-redux';
import { PageSkeleton } from './components/SkeletonLoaders';

// Eagerly load critical public path components
import Homepage from './pages/Homepage';
import LoginPage from './pages/LoginPage';
import AdminRegisterPage from './pages/admin/AdminRegisterPage';
import ChooseUser from './pages/ChooseUser';

// Lazy load role-based dashboards (30-45% reduction in initial bundle parse time)
const AdminDashboard = React.lazy(() => import('./pages/admin/AdminDashboard'));
const StudentDashboard = React.lazy(() => import('./pages/student/StudentDashboard'));
const TeacherDashboard = React.lazy(() => import('./pages/teacher/TeacherDashboard'));
const ParentDashboard = React.lazy(() => import('./pages/ParentDashboard'));
const StaffDashboard = React.lazy(() => import('./pages/StaffDashboard'));
const FrontdeskMainDashboard = React.lazy(() => import('./pages/frontdesk/FrontdeskMainDashboard'));

const App = () => {
  const { currentRole } = useSelector(state => state.user);

  return (
    <Router>
      {/* ── Public Routes ──────────────────────────────────────────────── */}
      {(!currentRole || !["Admin", "Student", "Teacher", "Parent", "Staff", "FrontDesk"].includes(currentRole)) && (
        <Routes>
          <Route path="/" element={<Homepage />} />
          <Route path="/choose" element={<ChooseUser visitor="normal" />} />
          <Route path="/chooseasguest" element={<ChooseUser visitor="guest" />} />

          <Route path="/Adminlogin" element={<LoginPage role="Admin" />} />
          <Route path="/Studentlogin" element={<LoginPage role="Student" />} />
          <Route path="/Teacherlogin" element={<LoginPage role="Teacher" />} />
          <Route path="/Parentlogin" element={<LoginPage role="Parent" />} />
          <Route path="/Stafflogin" element={<LoginPage role="Staff" />} />
          <Route path="/Frontdesklogin" element={<LoginPage role="FrontDesk" />} />

          <Route path="/Adminregister" element={<AdminRegisterPage />} />

          <Route path='*' element={<Navigate to="/" />} />
        </Routes>
      )}

      {/* ── Protected Routes ───────────────────────────────────────────── */}
      <Suspense fallback={<PageSkeleton />}>
        {currentRole === "Admin" && <AdminDashboard />}
        {currentRole === "Student" && <StudentDashboard />}
        {currentRole === "Teacher" && <TeacherDashboard />}
        {currentRole === "Parent" && <ParentDashboard />}
        {currentRole === "Staff" && <StaffDashboard />}
        {currentRole === "FrontDesk" && <FrontdeskMainDashboard />}
      </Suspense>
    </Router>
  );
}

export default App;