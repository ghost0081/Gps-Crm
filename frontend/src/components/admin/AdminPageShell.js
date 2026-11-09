import React from 'react';
import { Box, Paper } from '@mui/material';
import PageHeader from '../PageHeader';

/**
 * Shared admin page chrome: consistent header + optional surface panel.
 * Does not change page logic — wrap existing content only.
 */
const AdminPageShell = ({
  title,
  subtitle,
  breadcrumbs,
  action,
  children,
  dense = false,
  framed = false,
  maxWidth = '100%',
  sx = {},
  contentSx = {},
}) => {
  const body = (
    <Box sx={{ width: '100%', maxWidth, minWidth: 0, ...contentSx }}>
      {children}
    </Box>
  );

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        pb: dense ? 2 : 4,
        ...sx,
      }}
    >
      {(title || action) && (
        <PageHeader
          title={title}
          subtitle={subtitle}
          breadcrumbs={breadcrumbs}
          action={action}
          sx={{ mb: dense ? 2.5 : 3.5 }}
        />
      )}
      {framed ? (
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, sm: 2.5, md: 3 },
            borderRadius: '16px',
            overflow: 'hidden',
          }}
        >
          {body}
        </Paper>
      ) : (
        body
      )}
    </Box>
  );
};

export default AdminPageShell;
