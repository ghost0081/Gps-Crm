import { useState } from 'react';
import {
    CssBaseline,
    Box,
    Toolbar,
    List,
    Typography,
    Divider,
    IconButton,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppBar, Drawer, drawerWidth } from '../../components/styles';
import FrontdeskSideBar from './FrontdeskSideBar';
import FrontdeskDashboard from '../admin/frontdesk/FrontdeskDashboard';
import VisitorsListPage from '../admin/frontdesk/VisitorsListPage';
import FrontdeskFaceAttendance from './FrontdeskFaceAttendance';

const FrontdeskMainDashboard = () => {
    const [open, setOpen] = useState(false);
    const toggleDrawer = () => {
        setOpen(!open);
    };

    return (
        <>
            <Box sx={{ display: 'flex' }}>
                <CssBaseline />
                <AppBar open={open} position='absolute'>
                    <Toolbar sx={{ pr: '24px' }}>
                        <IconButton
                            edge="start"
                            color="inherit"
                            aria-label="open drawer"
                            onClick={toggleDrawer}
                            sx={{
                                marginRight: '36px',
                                ...(open && { display: 'none' }),
                            }}
                        >
                            <MenuIcon />
                        </IconButton>
                        <Typography
                            component="h1"
                            variant="h6"
                            color="inherit"
                            noWrap
                            sx={{ flexGrow: 1 }}
                        >
                            Frontdesk Dashboard
                        </Typography>
                    </Toolbar>
                </AppBar>
                <Drawer variant="permanent" open={open} sx={open ? styles.drawerStyled : styles.hideDrawer}>
                    <Toolbar sx={styles.toolBarStyled}>
                        <IconButton onClick={toggleDrawer}>
                            <ChevronLeftIcon />
                        </IconButton>
                    </Toolbar>
                    <Divider />
                    <List component="nav">
                        <FrontdeskSideBar />
                    </List>
                </Drawer>
                <Box component="main" sx={(theme) => ({
                    ...styles.boxStyled,
                    width: open ? `calc(100% - ${drawerWidth}px)` : `calc(100% - ${theme.spacing(7)})`,
                    transition: theme.transitions.create(['width'], {
                        easing: theme.transitions.easing.sharp,
                        duration: theme.transitions.duration.enteringScreen,
                    }),
                    [theme.breakpoints.up('sm')]: {
                        width: open ? `calc(100% - ${drawerWidth}px)` : `calc(100% - ${theme.spacing(9)})`,
                    },
                })}>
                    <Toolbar />
                    <Routes>
                        <Route path="/" element={<FrontdeskDashboard />} />
                        <Route path="visitors" element={<VisitorsListPage />} />
                        <Route path="face-attendance" element={<FrontdeskFaceAttendance />} />
                        <Route path='*' element={<Navigate to="/frontdesk" />} />
                    </Routes>
                </Box>
            </Box>
        </>
    );
}

export default FrontdeskMainDashboard

const styles = {
    boxStyled: {
        backgroundColor: (theme) =>
            theme.palette.mode === 'light'
                ? theme.palette.grey[100]
                : theme.palette.grey[900],
        flexGrow: 1,
        height: '100vh',
        overflowY: 'auto',
        overflowX: 'hidden',
        '&::-webkit-scrollbar': {
            width: '12px',
        },
        '&::-webkit-scrollbar-track': {
            background: (theme) => theme.palette.mode === 'light' ? '#f1f1f1' : '#2a2a2a',
            borderRadius: '10px',
        },
        '&::-webkit-scrollbar-thumb': {
            background: (theme) => theme.palette.mode === 'light' ? '#888' : '#555',
            borderRadius: '10px',
            '&:hover': {
                background: (theme) => theme.palette.mode === 'light' ? '#555' : '#777',
            },
        },
        scrollbarWidth: 'thin',
        scrollbarColor: (theme) => theme.palette.mode === 'light' ? '#888 #f1f1f1' : '#555 #2a2a2a',
    },
    toolBarStyled: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        px: [1],
    },
    drawerStyled: {
        display: "flex"
    },
    hideDrawer: {
        display: 'flex',
        '@media (max-width: 600px)': {
            display: 'none',
        },
    },
}

