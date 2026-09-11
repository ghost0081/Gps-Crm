import React from 'react';
import { ListItemButton, ListItemIcon, ListItemText, Collapse, List } from '@mui/material';
import { Link, useLocation } from 'react-router-dom';
import HomeIcon from '@mui/icons-material/Home';
import BadgeIcon from '@mui/icons-material/Badge';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import GroupsIcon from '@mui/icons-material/Groups';

const FrontdeskSideBar = () => {
    const location = useLocation();
    
    // Frontdesk features should expand if inside visitors or face-attendance
    const [open, setOpen] = React.useState(
        location.pathname.startsWith("/visitors") || location.pathname.startsWith("/face-attendance")
    );

    const handleClick = () => {
        setOpen(!open);
    };

    return (
        <React.Fragment>
            <ListItemButton component={Link} to="/">
                <ListItemIcon>
                    <HomeIcon color={location.pathname === "/" ? 'primary' : 'inherit'} />
                </ListItemIcon>
                <ListItemText primary="Dashboard" />
            </ListItemButton>
            
            <ListItemButton onClick={handleClick}>
                <ListItemIcon>
                    <BadgeIcon color={location.pathname.startsWith("/visitors") || location.pathname.startsWith("/face-attendance") ? 'primary' : 'inherit'} />
                </ListItemIcon>
                <ListItemText primary="Frontdesk Features" />
                {open ? <ExpandLess /> : <ExpandMore />}
            </ListItemButton>
            
            <Collapse in={open} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                    <ListItemButton component={Link} to="/visitors" sx={{ pl: 4 }}>
                        <ListItemIcon>
                            <GroupsIcon color={location.pathname.startsWith("/visitors") ? 'primary' : 'inherit'} />
                        </ListItemIcon>
                        <ListItemText primary="Visitors Log" />
                    </ListItemButton>
                    
                    <ListItemButton component={Link} to="/face-attendance" sx={{ pl: 4 }}>
                        <ListItemIcon>
                            <BadgeIcon color={location.pathname.startsWith("/face-attendance") ? 'primary' : 'inherit'} />
                        </ListItemIcon>
                        <ListItemText primary="Face Attendance" />
                    </ListItemButton>
                </List>
            </Collapse>
        </React.Fragment>
    );
};

export default FrontdeskSideBar;
