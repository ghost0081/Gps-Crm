import React from 'react';
import { Box, Typography, Breadcrumbs, Link } from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { Link as RouterLink } from 'react-router-dom';

const PageHeader = ({
  title,
  subtitle,
  breadcrumbs,
  action,
  sx = {},
}) => {
  return (
    <Box
      component="header"
      sx={{
        mb: 3.5,
        pb: 2.5,
        borderBottom: '1px solid',
        borderColor: 'divider',
        ...sx,
      }}
    >
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumbs
          separator={<NavigateNextIcon sx={{ fontSize: 14, color: 'text.disabled' }} />}
          aria-label="breadcrumb"
          sx={{ mb: 1.25 }}
        >
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            return isLast ? (
              <Typography
                key={crumb.label}
                variant="caption"
                sx={{ color: 'text.primary', fontWeight: 700 }}
                aria-current="page"
              >
                {crumb.label}
              </Typography>
            ) : (
              <Link
                key={crumb.label}
                component={RouterLink}
                to={crumb.href}
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  fontWeight: 600,
                  textDecoration: 'none',
                  transition: 'color 150ms ease',
                  '&:hover': { color: 'primary.main' },
                }}
              >
                {crumb.label}
              </Link>
            );
          })}
        </Breadcrumbs>
      )}

      <Box
        sx={{
          display: 'flex',
          alignItems: { xs: 'flex-start', sm: 'center' },
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="h1"
            component="h1"
            sx={{
              color: 'text.primary',
              fontWeight: 800,
              fontSize: { xs: '1.45rem', sm: '1.75rem', md: '1.85rem' },
            }}
          >
            {title}
          </Typography>
          {subtitle && (
            <Typography
              variant="body2"
              sx={{ color: 'text.secondary', mt: 0.65, lineHeight: 1.55, maxWidth: 720 }}
            >
              {subtitle}
            </Typography>
          )}
        </Box>

        {action && (
          <Box
            sx={{
              flexShrink: 0,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1,
              width: { xs: '100%', sm: 'auto' },
              '& > *': { flexGrow: { xs: 1, sm: 0 } },
            }}
          >
            {action}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default PageHeader;
