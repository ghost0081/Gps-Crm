import * as React from 'react';
import {
  Divider, ListItemButton, ListItemIcon, ListItemText,
  ListSubheader, Collapse, List, Typography, Box,
} from '@mui/material';
import { Link, useLocation } from 'react-router-dom';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';

// Icons
import HomeIcon from '@mui/icons-material/Home';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined';
import AnnouncementOutlinedIcon from '@mui/icons-material/AnnouncementOutlined';
import ClassOutlinedIcon from '@mui/icons-material/ClassOutlined';
import SupervisorAccountOutlinedIcon from '@mui/icons-material/SupervisorAccountOutlined';
import ReportIcon from '@mui/icons-material/Report';
import AssignmentIcon from '@mui/icons-material/Assignment';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import FamilyRestroomIcon from '@mui/icons-material/FamilyRestroom';
import GroupsIcon from '@mui/icons-material/Groups';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import InsightsIcon from '@mui/icons-material/Insights';
import BadgeIcon from '@mui/icons-material/Badge';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import BluetoothIcon from '@mui/icons-material/Bluetooth';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import InventoryIcon from '@mui/icons-material/Inventory';
import ReceiptIcon from '@mui/icons-material/Receipt';
import DirectionsBusIcon from '@mui/icons-material/DirectionsBus';
import CategoryIcon from '@mui/icons-material/Category';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import SchoolIcon from '@mui/icons-material/School';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import BrushIcon from '@mui/icons-material/Brush';
import VideocamIcon from '@mui/icons-material/Videocam';
import FaceIcon from '@mui/icons-material/Face';

/*
 * SideBar — navigation for the Admin dashboard
 *
 * RESTRUCTURED from 20 flat items to 6 semantic groups.
 *
 * WHY: Hick's Law states that decision time increases logarithmically with
 * the number of choices. A flat 20-item list forces the user to scan every
 * item. Grouped navigation (6 groups × ~3-4 items) reduces the cognitive
 * search space by ~5×.
 *
 * Groups:
 *   Overview  → Dashboard
 *   People    → Students, Teachers, Parents, Staff, Payroll
 *   Academics → Classes, Subjects, Timetable
 *   Finance   → Fees, Financial Reports
 *   Operations → Attendance (BLE), Tracker, Library, Stationery, Frontdesk
 *   Communicate → Notices, Complaints, Teacher Leave
 *
 * Logout moved to bottom fixed section (not inside navigation groups).
 */

// ── Helper: Nav Item ──────────────────────────────────────────────────────
const NavItem = ({ to, icon: Icon, label, selected }) => (
  <ListItemButton
    component={Link}
    to={to}
    selected={selected}
    aria-current={selected ? 'page' : undefined}
    sx={{ borderRadius: '8px', mx: 1, mb: 0.25 }}
  >
    <ListItemIcon>
      <Icon sx={{ fontSize: 20, color: selected ? 'primary.dark' : 'text.secondary' }} />
    </ListItemIcon>
    <ListItemText primary={label} />
  </ListItemButton>
);

// ── Helper: Collapsible Group ─────────────────────────────────────────────
const NavGroup = ({ icon: Icon, label, children, isOpen, onToggle, isActive }) => (
  <>
    <ListItemButton
      onClick={onToggle}
      selected={isActive}
      aria-expanded={isOpen}
      sx={{ borderRadius: '8px', mx: 1, mb: 0.25 }}
    >
      <ListItemIcon>
        <Icon sx={{ fontSize: 20, color: isActive ? 'primary.dark' : 'text.secondary' }} />
      </ListItemIcon>
      <ListItemText primary={label} />
      {isOpen
        ? <ExpandLess sx={{ fontSize: 16, color: 'text.secondary' }} />
        : <ExpandMore sx={{ fontSize: 16, color: 'text.secondary' }} />
      }
    </ListItemButton>
    <Collapse in={isOpen} timeout={180} unmountOnExit>
      <List component="div" disablePadding sx={{ pl: 1.5 }}>
        {children}
      </List>
    </Collapse>
  </>
);

// ── Helper: Section Header ────────────────────────────────────────────────
const SectionHeader = ({ label }) => (
  <ListSubheader
    component="div"
    disableSticky
    sx={{
      fontSize: '0.6875rem',
      fontWeight: 700,
      letterSpacing: '0.07em',
      textTransform: 'uppercase',
      color: 'text.disabled',
      lineHeight: 1,
      py: 1.5,
      px: 2,
      mt: 1,
    }}
  >
    {label}
  </ListSubheader>
);

// ──────────────────────────────────────────────────────────────────────────

const SideBar = ({ onNavigate }) => {
  const location = useLocation();
  const is = (path) => location.pathname.startsWith(path);
  const isExact = (path) => location.pathname === path || location.pathname === path + '/';

  // Persist group open state based on current path
  const [staffOpen,      setStaffOpen]      = React.useState(is('/Admin/staff') || is('/Admin/payroll'));
  const [stationeryOpen, setStationeryOpen] = React.useState(is('/Admin/stationery') || is('/Admin/invoices'));
  const [frontdeskOpen,  setFrontdeskOpen]  = React.useState(is('/Admin/frontdesk') || is('/Admin/visitors'));
  const [libraryOpen,    setLibraryOpen]    = React.useState(is('/Admin/library'));

  return (
    <Box
      component="nav"
      aria-label="Admin navigation"
      onClick={(event) => {
        if (onNavigate && event.target.closest('a')) onNavigate();
      }}
      sx={{ display: 'flex', flexDirection: 'column', minHeight: '100%', py: 1, '& > *': { flexShrink: 0 } }}
    >
      {/* ── Logo ──────────────────────────────────────────────────────── */}
      <Box sx={{ px: 2.5, py: 2.25, mb: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '10px',
              bgcolor: 'primary.main',
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 800,
              fontSize: '0.85rem',
              letterSpacing: '-0.02em',
            }}
          >
            SM
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, color: 'primary.main', lineHeight: 1.1 }}>
              SchoolMS
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
              School Admin Portal
            </Typography>
          </Box>
        </Box>
      </Box>

      <Divider sx={{ mb: 1 }} />

      {/* ── Overview ──────────────────────────────────────────────────── */}
      <NavItem
        to="/"
        icon={HomeIcon}
        label="Dashboard"
        selected={isExact('/') || isExact('/Admin/dashboard')}
      />

      {/* ── People ────────────────────────────────────────────────────── */}
      <SectionHeader label="People" />
      <NavItem to="/Admin/students" icon={PersonOutlineIcon} label="Students"    selected={is('/Admin/students')} />
      <NavItem to="/Admin/teachers" icon={SupervisorAccountOutlinedIcon} label="Teachers" selected={is('/Admin/teachers')} />
      <NavItem to="/Admin/parents"  icon={FamilyRestroomIcon} label="Parents"    selected={is('/Admin/parents')} />

      <NavGroup
        icon={GroupsIcon}
        label="Staff"
        isOpen={staffOpen}
        onToggle={() => setStaffOpen(!staffOpen)}
        isActive={is('/Admin/staff') || is('/Admin/payroll')}
      >
        <NavItem to="/Admin/staff"    icon={PersonAddAlt1Icon}         label="All Staff"  selected={is('/Admin/staff') && !is('/Admin/payroll')} />
        <NavItem to="/Admin/payroll"  icon={AccountBalanceWalletIcon}  label="Payroll"    selected={is('/Admin/payroll')} />
      </NavGroup>

      {/* ── Academics ─────────────────────────────────────────────────── */}
      <SectionHeader label="Academics" />
      <NavItem to="/Admin/classes"   icon={ClassOutlinedIcon} label="Classes"   selected={is('/Admin/classes')} />
      <NavItem to="/Admin/subjects"  icon={AssignmentIcon}    label="Subjects"  selected={is('/Admin/subjects')} />
      <NavItem to="/Admin/timetable" icon={AccessTimeIcon}    label="Timetable" selected={is('/Admin/timetable')} />

      {/* ── Finance ───────────────────────────────────────────────────── */}
      <SectionHeader label="Finance" />
      <NavItem to="/Admin/fees"          icon={AccountBalanceIcon} label="Fees"         selected={is('/Admin/fees') && !is('/Admin/fees/heads') && !is('/Admin/fees/invoices')} />
      <NavItem to="/Admin/fees/heads"    icon={CategoryIcon}       label="Fee Heads"    selected={is('/Admin/fees/heads')} />
      <NavItem to="/Admin/fees/invoices" icon={ReceiptLongIcon}    label="Fee Invoices" selected={is('/Admin/fees/invoices')} />
      <NavItem to="/Admin/reports"       icon={InsightsIcon}       label="Reports"      selected={isExact('/Admin/reports')} />
      <NavItem to="/Admin/reports/builder" icon={QueryStatsIcon}   label="Report Builder" selected={is('/Admin/reports/builder')} />
      <NavItem to="/Admin/design" icon={BrushIcon} label="Design Studio" selected={is('/Admin/design')} />

      {/* ── Oversight & CRM ───────────────────────────────────────────── */}
      <SectionHeader label="Oversight" />
      <NavItem to="/Admin/principal"  icon={SchoolIcon}         label="Principal"   selected={is('/Admin/principal')} />
      <NavItem to="/Admin/admissions" icon={HowToRegIcon}       label="Admissions"  selected={is('/Admin/admissions')} />
      <NavItem to="/Admin/welfare"    icon={LocalHospitalIcon} label="Nurse / Welfare" selected={is('/Admin/welfare')} />

      {/* ── Operations ────────────────────────────────────────────────── */}
      <SectionHeader label="Operations" />
      <NavItem to="/Admin/cameras"         icon={VideocamIcon}       label="AI Cameras"      selected={is('/Admin/cameras')} />
      <NavItem to="/Admin/gate-attendance" icon={FaceIcon}           label="Gate Attendance" selected={is('/Admin/gate-attendance')} />
      <NavItem to="/Admin/ble-attendance"  icon={BluetoothIcon}      label="BLE Attendance"  selected={is('/Admin/ble-attendance')} />
      <NavItem to="/Admin/tracker"         icon={LocationOnIcon}     label="GPS Tracker"     selected={is('/Admin/tracker')} />
      <NavItem to="/Admin/transport"       icon={DirectionsBusIcon}  label="Transport"       selected={is('/Admin/transport')} />

      <NavGroup
        icon={BadgeIcon}
        label="Front Desk"
        isOpen={frontdeskOpen}
        onToggle={() => setFrontdeskOpen(!frontdeskOpen)}
        isActive={is('/Admin/frontdesk') || is('/Admin/visitors')}
      >
        <NavItem to="/Admin/frontdesk" icon={BadgeIcon}  label="Check-in Desk"  selected={is('/Admin/frontdesk')} />
        <NavItem to="/Admin/visitors"  icon={GroupsIcon} label="Visitors Log"   selected={is('/Admin/visitors')} />
      </NavGroup>

      <NavGroup
        icon={MenuBookIcon}
        label="Library"
        isOpen={libraryOpen}
        onToggle={() => setLibraryOpen(!libraryOpen)}
        isActive={is('/Admin/library')}
      >
        <NavItem to="/Admin/library/upload" icon={UploadFileIcon} label="Upload Books"  selected={is('/Admin/library/upload')} />
        <NavItem to="/Admin/library/books"  icon={MenuBookIcon}   label="Search Books"  selected={is('/Admin/library/books')} />
      </NavGroup>

      <NavGroup
        icon={InventoryIcon}
        label="Stationery"
        isOpen={stationeryOpen}
        onToggle={() => setStationeryOpen(!stationeryOpen)}
        isActive={is('/Admin/stationery') || is('/Admin/invoices')}
      >
        <NavItem to="/Admin/stationery" icon={InventoryIcon} label="Inventory"  selected={is('/Admin/stationery') && !is('/Admin/invoices')} />
        <NavItem to="/Admin/invoices"   icon={ReceiptIcon}   label="Invoices"   selected={is('/Admin/invoices')} />
      </NavGroup>

      {/* ── Communicate ───────────────────────────────────────────────── */}
      <SectionHeader label="Communicate" />
      <NavItem to="/Admin/notices"      icon={AnnouncementOutlinedIcon} label="Notices"       selected={is('/Admin/notices')} />
      <NavItem to="/Admin/complains"    icon={ReportIcon}               label="Complaints"    selected={is('/Admin/complains')} />
      <NavItem to="/Admin/teacher-leave" icon={EventBusyIcon}           label="Teacher Leave" selected={is('/Admin/teacher-leave')} />

      {/* ── Account (bottom) ──────────────────────────────────────────── */}
      <Box sx={{ mt: 'auto' }}>
        <Divider sx={{ mb: 1 }} />
        <NavItem to="/Admin/profile" icon={AccountCircleOutlinedIcon} label="Profile"  selected={is('/Admin/profile')} />
        <NavItem to="/logout"         icon={ExitToAppIcon}             label="Sign Out" selected={is('/logout')} />
      </Box>
    </Box>
  );
};

export default SideBar;
