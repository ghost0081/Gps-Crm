import React from 'react';
import { Box, Paper, Typography } from '@mui/material';

const AdminSection = ({
  title,
  subtitle,
  action,
  children,
  sx = {},
  contentSx = {},
  disablePadding = false,
}) => (
  <Paper
    elevation={0}
    sx={{
      borderRadius: '16px',
      overflow: 'hidden',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      ...sx,
    }}
  >
    {(title || action) && (
      <Box
        sx={{
          px: { xs: 2, sm: 2.5 },
          py: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: { xs: 'flex-start', sm: 'center' },
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          gap: 1.5,
        }}
      >
        <Box>
          {title && (
            <Typography variant="h5" sx={{ fontWeight: 750 }}>
              {title}
            </Typography>
          )}
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
      </Box>
    )}
    <Box sx={{ p: disablePadding ? 0 : { xs: 2, sm: 2.5 }, flex: 1, minWidth: 0, ...contentSx }}>
      {children}
    </Box>
  </Paper>
);

export default AdminSection;
