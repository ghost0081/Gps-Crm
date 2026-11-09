import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { CssBaseline, Box, Toolbar, List, Typography, Divider, IconButton } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import AccountMenu from '../components/AccountMenu';
import { AppBar, Drawer, drawerWidth } from '../components/styles';
import StaffSideBar from './staff/StaffSideBar';
import { Navigate, Route, Routes } from 'react-router-dom';
import Logout from './Logout';
import StaffHomePage from './staff/StaffHomePage';
import StaffProfile from './staff/StaffProfile';
import StaffAttendance from './staff/StaffAttendance';
import StaffPayroll from './staff/StaffPayroll';
import StaffReceipts from './staff/StaffReceipts';

const StaffDashboard = () => {
  const [open, setOpen] = useState(true);
  const toggleDrawer = () => setOpen(!open);

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar open={open} position='absolute'>
        <Toolbar sx={{ pr: '24px' }}>
          <IconButton edge="start" color="inherit" onClick={toggleDrawer} sx={{ marginRight: '36px', ...(open && { display: 'none' }) }}>
            <MenuIcon />
          </IconButton>
          <Typography component="h1" variant="h6" color="inherit" noWrap sx={{ flexGrow: 1 }}>
            Staff Dashboard
          </Typography>
          <AccountMenu />
        </Toolbar>
      </AppBar>
      <Drawer variant="permanent" open={open}>
        <Toolbar sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', px: [1] }}>
          <IconButton onClick={toggleDrawer}><ChevronLeftIcon /></IconButton>
        </Toolbar>
        <Divider />
        <List component="nav"><StaffSideBar /></List>
      </Drawer>
      <Box component="main" sx={(theme) => ({
        backgroundColor: theme.palette.mode === 'light' ? theme.palette.grey[100] : theme.palette.grey[900], 
        flexGrow: 1, 
        height: '100vh', 
        overflowY: 'auto',
        overflowX: 'hidden',
        width: open ? `calc(100% - ${drawerWidth}px)` : `calc(100% - ${theme.spacing(7)})`,
        transition: theme.transitions.create(['width'], {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.enteringScreen,
        }),
        // Custom scrollbar for main content
        '&::-webkit-scrollbar': {
          width: '12px',
        },
        '&::-webkit-scrollbar-track': {
          background: theme.palette.mode === 'light' ? '#f1f1f1' : '#2a2a2a',
          borderRadius: '10px',
        },
        '&::-webkit-scrollbar-thumb': {
          background: theme.palette.mode === 'light' ? '#888' : '#555',
          borderRadius: '10px',
          '&:hover': {
            background: theme.palette.mode === 'light' ? '#555' : '#777',
          },
        },
        // Firefox scrollbar
        scrollbarWidth: 'thin',
        scrollbarColor: theme.palette.mode === 'light' ? '#888 #f1f1f1' : '#555 #2a2a2a',
        [theme.breakpoints.up('sm')]: {
          width: open ? `calc(100% - ${drawerWidth}px)` : `calc(100% - ${theme.spacing(9)})`,
        },
      })}>
        <Toolbar />
        <Routes>
          <Route path='/' element={<StaffHomePage />} />
          <Route path='*' element={<Navigate to='/' />} />
          <Route path='/Staff/profile' element={<StaffProfile />} />
          <Route path='/Staff/attendance' element={<StaffAttendance />} />
          <Route path='/Staff/payroll' element={<StaffPayroll />} />
          <Route path='/Staff/receipts' element={<StaffReceipts />} />
          <Route path='/logout' element={<Logout />} />
        </Routes>
      </Box>
    </Box>
  );
};

export default StaffDashboard;

