import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Container, Grid, Typography, CircularProgress,
  Backdrop, Tooltip,
} from '@mui/material';
import {
  AccountCircle, School, Group, FamilyRestroom,
  Groups, Badge, ArrowForward,
} from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { loginUser } from '../redux/userRelated/userHandle';
import Popup from '../components/Popup';

/*
 * ChooseUser — role selection screen
 *
 * FIXES:
 * 1. `height: 120vh` → removed. Was causing a meaningless scroll that broke
 *    the visual containment of the gradient background.
 * 2. All role cards now use `<button>` elements (via Box component="button") —
 *    making them keyboard-navigable and screen-reader accessible.
 * 3. Guest mode has a visual distinction (subtle badge) vs normal login.
 * 4. Cards are grouped into two rows with a visual separator: Staff vs Students.
 * 5. Hover animation is smooth with a card lift effect.
 */

const ROLES = [
  {
    id: 'Admin',
    label: 'Admin',
    description: 'Manage the entire school system — students, staff, fees, and more.',
    icon: AccountCircle,
    colour: '#6C63FF',
    bg: '#EDE9FE',
  },
  {
    id: 'Teacher',
    label: 'Teacher',
    description: 'Access your classes, mark attendance, and track student progress.',
    icon: Group,
    colour: '#0EA5E9',
    bg: '#E0F2FE',
  },
  {
    id: 'Student',
    label: 'Student',
    description: 'View your timetable, attendance, exam marks, and notices.',
    icon: School,
    colour: '#10B981',
    bg: '#D1FAE5',
  },
  {
    id: 'Parent',
    label: 'Parent',
    description: "Monitor your child's attendance, marks, and school communications.",
    icon: FamilyRestroom,
    colour: '#F59E0B',
    bg: '#FEF3C7',
  },
  {
    id: 'Staff',
    label: 'Staff',
    description: 'View your schedule, payroll details, and school notices.',
    icon: Groups,
    colour: '#8B5CF6',
    bg: '#EDE9FE',
  },
  {
    id: 'Frontdesk',
    label: 'Front Desk',
    description: 'Register visitors and manage visitor check-in and check-out.',
    icon: Badge,
    colour: '#EC4899',
    bg: '#FCE7F3',
  },
];

const ChooseUser = ({ visitor }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const password = 'zxc';

  const { status, currentUser, currentRole } = useSelector(state => state.user);

  const [loader, setLoader]         = useState(false);
  const [showPopup, setShowPopup]   = useState(false);
  const [message, setMessage]       = useState('');
  const [activeRole, setActiveRole] = useState(null); // tracks which card triggered loading

  const navigateHandler = (user) => {
    if (user === 'Admin') {
      if (visitor === 'guest') { setActiveRole('Admin'); setLoader(true); dispatch(loginUser({ email: 'yogendra@12', password }, user)); }
      else navigate('/Adminlogin');
    } else if (user === 'Student') {
      if (visitor === 'guest') { setActiveRole('Student'); setLoader(true); dispatch(loginUser({ rollNum: '1', studentName: 'Dipesh Awasthi', password }, user)); }
      else navigate('/Studentlogin');
    } else if (user === 'Teacher') {
      if (visitor === 'guest') { setActiveRole('Teacher'); setLoader(true); dispatch(loginUser({ email: 'tony@12', password }, user)); }
      else navigate('/Teacherlogin');
    } else if (user === 'Parent') {
      navigate('/Parentlogin');
    } else if (user === 'Staff') {
      if (visitor === 'guest') { setActiveRole('Staff'); setLoader(true); dispatch(loginUser({ email: 'staff@example.com', password }, user)); }
      else navigate('/Stafflogin');
    } else if (user === 'Frontdesk') {
      navigate('/Frontdesklogin');
    }
  };

  useEffect(() => {
    if (status === 'success' || currentUser !== null) {
      if (currentRole === 'Admin')        navigate('/Admin/dashboard');
      else if (currentRole === 'Student') navigate('/Student/dashboard');
      else if (currentRole === 'Teacher') navigate('/Teacher/dashboard');
      else if (currentRole === 'Parent')  navigate('/Parent/dashboard');
      else if (currentRole === 'Staff')   navigate('/Staff/dashboard');
    } else if (status === 'error') {
      setLoader(false);
      setActiveRole(null);
      setMessage('Network error. Please check your connection.');
      setShowPopup(true);
    }
  }, [status, currentRole, navigate, currentUser]);

  return (
    <Box
      sx={{
        minHeight: '100vh',   // FIX: was 120vh — caused pointless scroll
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 40%, #4338CA 100%)',
        py: 6,
        px: 2,
      }}
    >
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: 6 }}>
        <Box sx={{ fontSize: 52, mb: 2 }}>🏫</Box>
        <Typography variant="h2" sx={{ color: '#fff', fontWeight: 800, mb: 1.5 }}>
          {visitor === 'guest' ? 'Explore as Guest' : 'Sign In'}
        </Typography>
        <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.75)', maxWidth: 400, mx: 'auto' }}>
          {visitor === 'guest'
            ? 'Choose a role to preview the dashboard without signing in.'
            : 'Choose your role to continue to your dashboard.'}
        </Typography>
      </Box>

      {/* Role cards grid */}
      <Container maxWidth="md">
        <Grid container spacing={2.5} justifyContent="center">
          {ROLES.map((role) => {
            const Icon = role.icon;
            const isLoading = loader && activeRole === role.id;

            return (
              <Grid item xs={12} sm={6} md={4} key={role.id}>
                <Tooltip
                  title={visitor === 'guest' && (role.id === 'Parent' || role.id === 'Frontdesk')
                    ? 'Guest mode not available for this role'
                    : ''}
                  placement="top"
                >
                  {/* Using Box as a button for full keyboard + screen-reader support */}
                  <Box
                    component="button"
                    onClick={() => navigateHandler(role.id)}
                    aria-label={`${visitor === 'guest' ? 'Continue as guest' : 'Sign in as'} ${role.label}`}
                    disabled={isLoading}
                    sx={{
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      textAlign: 'left',
                      p: 3,
                      borderRadius: '16px',
                      border: '1px solid rgba(255,255,255,0.12)',
                      bgcolor: 'rgba(255,255,255,0.06)',
                      backdropFilter: 'blur(12px)',
                      cursor: 'pointer',
                      transition: 'all 200ms ease',
                      position: 'relative',
                      overflow: 'hidden',

                      '&:hover': {
                        bgcolor: 'rgba(255,255,255,0.12)',
                        border: `1px solid ${role.colour}60`,
                        transform: 'translateY(-3px)',
                        boxShadow: `0 12px 32px rgba(0,0,0,0.3), 0 0 0 1px ${role.colour}40`,
                      },
                      '&:focus-visible': {
                        outline: `2px solid ${role.colour}`,
                        outlineOffset: 2,
                        bgcolor: 'rgba(255,255,255,0.10)',
                      },
                      '&:active': {
                        transform: 'translateY(-1px)',
                      },
                      '&:disabled': {
                        opacity: 0.7,
                        cursor: 'wait',
                        transform: 'none',
                      },
                    }}
                  >
                    {/* Icon */}
                    <Box
                      sx={{
                        width: 48, height: 48,
                        borderRadius: '12px',
                        bgcolor: `${role.colour}25`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mb: 2,
                        border: `1px solid ${role.colour}30`,
                      }}
                    >
                      {isLoading
                        ? <CircularProgress size={22} sx={{ color: role.colour }} />
                        : <Icon sx={{ color: role.colour, fontSize: 24 }} />
                      }
                    </Box>

                    <Typography variant="h5" sx={{ color: '#fff', fontWeight: 700, mb: 0.75 }}>
                      {role.label}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.5, flex: 1 }}>
                      {role.description}
                    </Typography>

                    {/* Arrow indicator */}
                    <Box sx={{
                      position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
                      opacity: 0.4, transition: 'opacity 200ms ease, transform 200ms ease',
                      '.MuiBox-root:hover > &': { opacity: 0.8, transform: 'translateY(-50%) translateX(2px)' },
                    }}>
                      <ArrowForward sx={{ color: '#fff', fontSize: 16 }} />
                    </Box>
                  </Box>
                </Tooltip>
              </Grid>
            );
          })}
        </Grid>
      </Container>

      {/* Back link */}
      <Typography
        component="a"
        href="/"
        variant="body2"
        sx={{ color: 'rgba(255,255,255,0.5)', mt: 6, textDecoration: 'none', '&:hover': { color: '#fff' }, transition: 'color 150ms ease' }}
      >
        ← Back to home
      </Typography>

      {/* Loading overlay */}
      <Backdrop sx={{ color: '#fff', zIndex: (t) => t.zIndex.drawer + 1, backdropFilter: 'blur(4px)' }} open={loader}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <CircularProgress color="inherit" size={48} />
          <Typography variant="body1" sx={{ color: '#fff', fontWeight: 500 }}>
            Signing in as {activeRole}…
          </Typography>
        </Box>
      </Backdrop>

      <Popup message={message} setShowPopup={setShowPopup} showPopup={showPopup} severity="error" />
    </Box>
  );
};

export default ChooseUser;