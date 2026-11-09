import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const AdminStatCard = ({
  label,
  value,
  helper,
  icon,
  color = 'primary.main',
  bg = 'primary.light',
  to,
  onClick,
}) => {
  const navigate = useNavigate();
  const clickable = Boolean(to || onClick);

  const handleActivate = () => {
    if (onClick) onClick();
    else if (to) navigate(to);
  };

  return (
    <Paper
      elevation={0}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? handleActivate : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') handleActivate(); } : undefined}
      sx={{
        p: { xs: 2, sm: 2.5 },
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25,
        cursor: clickable ? 'pointer' : 'default',
        transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
        '&:hover': clickable ? {
          transform: 'translateY(-2px)',
          boxShadow: 2,
          borderColor: 'primary.main',
        } : undefined,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5 }}>
        <Box>
          <Typography variant="overline" sx={{ color: 'text.secondary' }}>
            {label}
          </Typography>
          <Typography
            variant="h3"
            sx={{
              mt: 0.75,
              fontWeight: 800,
              color,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.1,
            }}
          >
            {value}
          </Typography>
        </Box>
        {icon && (
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '12px',
              bgcolor: bg,
              color,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
        )}
      </Box>
      {helper && (
        <Typography variant="caption" color="text.secondary">
          {helper}
        </Typography>
      )}
    </Paper>
  );
};

export default AdminStatCard;
