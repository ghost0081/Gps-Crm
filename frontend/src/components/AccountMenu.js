import React, { useState } from 'react';
import {
  Box, Avatar, Menu, MenuItem, ListItemIcon,
  Divider, IconButton, Tooltip, Typography,
} from '@mui/material';
import { Logout, AccountCircle } from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';

/*
 * AccountMenu — top-right user account dropdown
 *
 * FIXES:
 * 1. "Settings" menu item removed — it linked to nowhere (#) and communicates
 *    that something is broken. Re-add when the Settings page is built.
 * 2. User's name now shows next to the avatar — provides immediate recognition
 *    that the user is signed in as the correct account (trust signal).
 * 3. Avatar shows initials with role-specific colour from the theme.
 */

// Maps role → colour for avatar background
const ROLE_COLOURS = {
  Admin:     '#6C63FF',
  Teacher:   '#0EA5E9',
  Student:   '#10B981',
  Parent:    '#F59E0B',
  Staff:     '#8B5CF6',
  FrontDesk: '#EC4899', // Pink
};

const AccountMenu = () => {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const { currentRole, currentUser } = useSelector(state => state.user);

  const avatarColour = ROLE_COLOURS[currentRole] || '#6C63FF';
  const displayName  = currentUser?.name || 'User';
  const initials     = displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          cursor: 'pointer',
          px: 1.5,
          py: 0.75,
          borderRadius: '99px',
          transition: 'background-color 150ms ease',
          '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' },
        }}
        onClick={(e) => setAnchorEl(e.currentTarget)}
        aria-controls={open ? 'account-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setAnchorEl(e.currentTarget); }}
      >
        {/* User name — not shown on very small screens */}
        <Box sx={{ display: { xs: 'none', sm: 'block' }, textAlign: 'right' }}>
          <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', lineHeight: 1.3 }}>
            {displayName}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {currentRole}
          </Typography>
        </Box>

        <Tooltip title="Account settings" placement="bottom-end">
          <Avatar
            sx={{
              width: 36,
              height: 36,
              bgcolor: avatarColour,
              fontSize: '0.875rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: `2px solid ${avatarColour}30`,
            }}
          >
            {initials}
          </Avatar>
        </Tooltip>
      </Box>

      <Menu
        anchorEl={anchorEl}
        id="account-menu"
        open={open}
        onClose={() => setAnchorEl(null)}
        onClick={() => setAnchorEl(null)}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{
          elevation: 0,
          sx: {
            mt: 1,
            minWidth: 200,
            overflow: 'visible',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
            '&::before': {
              content: '""',
              display: 'block',
              position: 'absolute',
              top: 0,
              right: 18,
              width: 10,
              height: 10,
              bgcolor: 'background.paper',
              transform: 'translateY(-50%) rotate(45deg)',
              borderTop: '1px solid #E2E8F0',
              borderLeft: '1px solid #E2E8F0',
              zIndex: 0,
            },
          },
        }}
      >
        {/* User info header */}
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>
            {displayName}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {currentRole} Account
          </Typography>
        </Box>

        <Divider />

        <MenuItem
          component={Link}
          to={`/${currentRole}/profile`}
          sx={{ py: 1.25, borderRadius: '8px', mx: 0.5, mt: 0.5 }}
        >
          <ListItemIcon>
            <AccountCircle fontSize="small" sx={{ color: 'text.secondary' }} />
          </ListItemIcon>
          <Typography variant="body2" fontWeight={500}>View Profile</Typography>
        </MenuItem>

        <Divider sx={{ mx: 1 }} />

        <MenuItem
          component={Link}
          to="/logout"
          sx={{
            py: 1.25,
            borderRadius: '8px',
            mx: 0.5,
            mb: 0.5,
            color: 'error.main',
            '&:hover': { bgcolor: '#FEF2F2' },
          }}
        >
          <ListItemIcon>
            <Logout fontSize="small" sx={{ color: 'error.main' }} />
          </ListItemIcon>
          <Typography variant="body2" fontWeight={500} color="error">Sign Out</Typography>
        </MenuItem>
      </Menu>
    </>
  );
};

export default AccountMenu;