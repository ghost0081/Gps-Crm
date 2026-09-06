import * as React from 'react';
import { Divider, ListItemButton, ListItemIcon, ListItemText, Collapse, List } from '@mui/material';
import { Link, useLocation } from 'react-router-dom';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import BadgeIcon from '@mui/icons-material/Badge';
import GroupsIcon from '@mui/icons-material/Groups';
import HomeIcon from "@mui/icons-material/Home";

const FrontdeskSideBar = () => {
    const location = useLocation();
    const [frontdeskOpen, setFrontdeskOpen] = React.useState(
        location.pathname.startsWith("/frontdesk")
    );

    const handleFrontdeskClick = () => {
        setFrontdeskOpen(!frontdeskOpen);
    };

    return (
        <>
            <React.Fragment>
                <ListItemButton component={Link} to="/frontdesk">
                    <ListItemIcon>
                        <HomeIcon color={location.pathname === "/frontdesk" ? 'primary' : 'inherit'} />
                    </ListItemIcon>
                    <ListItemText primary="Home" />
                </ListItemButton>
                <ListItemButton onClick={handleFrontdeskClick}>
                    <ListItemIcon>
                        <BadgeIcon color={location.pathname.startsWith("/frontdesk") ? 'primary' : 'inherit'} />
                    </ListItemIcon>
                    <ListItemText primary="Frontdesk" />
                    {frontdeskOpen ? <ExpandLess /> : <ExpandMore />}
                </ListItemButton>
                <Collapse in={frontdeskOpen} timeout="auto" unmountOnExit>
                    <List component="div" disablePadding>
                        <ListItemButton
                            component={Link}
                            to="/frontdesk"
                            sx={{ pl: 4 }}
                        >
                            <ListItemIcon>
                                <BadgeIcon color={location.pathname === "/frontdesk" || location.pathname === "/frontdesk/" ? 'primary' : 'inherit'} />
                            </ListItemIcon>
                            <ListItemText primary="Frontdesk Desk" />
                        </ListItemButton>
                <ListItemButton
                    component={Link}
                    to="/frontdesk/visitors"
                    sx={{ pl: 4 }}
                >
                    <ListItemIcon>
                        <GroupsIcon color={location.pathname === "/frontdesk/visitors" ? 'primary' : 'inherit'} />
                    </ListItemIcon>
                    <ListItemText primary="Visitors Log" />
                </ListItemButton>
                <ListItemButton
                    component={Link}
                    to="/frontdesk/face-attendance"
                    sx={{ pl: 4 }}
                >
                    <ListItemIcon>
                        <BadgeIcon color={location.pathname === "/frontdesk/face-attendance" ? 'primary' : 'inherit'} />
                    </ListItemIcon>
                    <ListItemText primary="Face Attendance" />
                </ListItemButton>
                    </List>
                </Collapse>
            </React.Fragment>
        </>
    )
}

export default FrontdeskSideBar

