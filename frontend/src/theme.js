import { createTheme } from '@mui/material/styles';

// Academic school admin tokens — navy primary, teal accent (not SaaS purple).
const BRAND_PRIMARY = '#1B4F72';
const BRAND_PRIMARY_DARK = '#154360';
const BRAND_PRIMARY_LIGHT = '#E8F1F8';
const BRAND_ACCENT = '#0F766E';
const COLOR_SUCCESS = '#047857';
const COLOR_WARNING = '#B45309';
const COLOR_DANGER = '#B91C1C';
const TEXT_PRIMARY = '#0F172A';
const TEXT_SECONDARY = '#475569';
const BORDER = '#DCE3EB';
const BG_DEFAULT = '#F3F6F9';

const theme = createTheme({
  palette: {
    primary: {
      main: BRAND_PRIMARY,
      dark: BRAND_PRIMARY_DARK,
      light: BRAND_PRIMARY_LIGHT,
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: BRAND_ACCENT,
      contrastText: '#FFFFFF',
    },
    error: { main: COLOR_DANGER },
    warning: { main: COLOR_WARNING },
    success: { main: COLOR_SUCCESS },
    background: {
      default: BG_DEFAULT,
      paper: '#FFFFFF',
    },
    text: {
      primary: TEXT_PRIMARY,
      secondary: TEXT_SECONDARY,
      disabled: '#94A3B8',
    },
    divider: BORDER,
  },

  typography: {
    fontFamily: '"Plus Jakarta Sans", "Segoe UI", sans-serif',
    button: {
      textTransform: 'none',
      fontWeight: 600,
      letterSpacing: '0.01em',
    },
    h1: { fontSize: '1.85rem', fontWeight: 750, lineHeight: 1.2, letterSpacing: '-0.03em' },
    h2: { fontSize: '1.45rem', fontWeight: 700, lineHeight: 1.3, letterSpacing: '-0.02em' },
    h3: { fontSize: '1.2rem', fontWeight: 700, lineHeight: 1.35, letterSpacing: '-0.015em' },
    h4: { fontSize: '1.05rem', fontWeight: 650, lineHeight: 1.4 },
    h5: { fontSize: '1rem', fontWeight: 650, lineHeight: 1.45 },
    h6: { fontSize: '0.9rem', fontWeight: 650, lineHeight: 1.45 },
    body1: { fontSize: '0.9375rem', lineHeight: 1.6 },
    body2: { fontSize: '0.875rem', lineHeight: 1.55 },
    subtitle1: { fontSize: '0.9375rem', fontWeight: 600, lineHeight: 1.5 },
    subtitle2: { fontSize: '0.8125rem', fontWeight: 650, lineHeight: 1.45 },
    caption: {
      fontSize: '0.75rem',
      fontWeight: 550,
      lineHeight: 1.4,
      letterSpacing: '0.01em',
    },
    overline: {
      fontSize: '0.6875rem',
      fontWeight: 750,
      lineHeight: 1,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
    },
  },

  shape: {
    borderRadius: 12,
  },

  shadows: [
    'none',
    '0 1px 2px rgba(15,23,42,0.05), 0 1px 3px rgba(15,23,42,0.04)',
    '0 4px 10px rgba(15,23,42,0.07)',
    '0 10px 24px rgba(15,23,42,0.09)',
    '0 16px 32px rgba(15,23,42,0.10)',
    '0 8px 20px rgba(15,23,42,0.10)',
    '0 12px 28px rgba(15,23,42,0.12)',
    '0 24px 48px rgba(15,23,42,0.16)',
    '0 8px 22px rgba(27,79,114,0.28)',
    ...Array(16).fill('none'),
  ],

  components: {
    MuiCssBaseline: {
      styleOverrides: `
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

        :root {
          --color-primary: ${BRAND_PRIMARY};
          --color-primary-dark: ${BRAND_PRIMARY_DARK};
          --color-primary-light: ${BRAND_PRIMARY_LIGHT};
          --color-accent: ${BRAND_ACCENT};
          --color-success: ${COLOR_SUCCESS};
          --color-warning: ${COLOR_WARNING};
          --color-danger: ${COLOR_DANGER};
          --color-bg: ${BG_DEFAULT};
          --color-surface: #FFFFFF;
          --color-border: ${BORDER};
          --color-text-primary: ${TEXT_PRIMARY};
          --color-text-secondary: ${TEXT_SECONDARY};
          --radius-sm: 8px;
          --radius-md: 12px;
          --radius-lg: 16px;
          --radius-xl: 20px;
          --shadow-1: 0 1px 2px rgba(15,23,42,0.05), 0 1px 3px rgba(15,23,42,0.04);
          --shadow-2: 0 4px 10px rgba(15,23,42,0.07);
          --admin-aside-width: 268px;
        }

        body {
          background:
            radial-gradient(1200px 420px at 0% -10%, rgba(27,79,114,0.08), transparent 55%),
            radial-gradient(900px 380px at 100% 0%, rgba(15,118,110,0.07), transparent 50%),
            ${BG_DEFAULT};
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            transition-duration: 0.01ms !important;
          }
        }

        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #C5D0DB; border-radius: 99px; }
        ::-webkit-scrollbar-thumb:hover { background: #94A3B8; }
        * { scrollbar-width: thin; scrollbar-color: #C5D0DB transparent; }

        .MuiOutlinedInput-root:focus-within { outline: none; }
      `,
    },

    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 10,
          paddingTop: 9,
          paddingBottom: 9,
          paddingLeft: 18,
          paddingRight: 18,
          fontSize: '0.875rem',
          fontWeight: 650,
          transition: 'background-color 150ms ease, box-shadow 150ms ease, transform 100ms ease',
          '&:active': { transform: 'scale(0.98)' },
          '&:focus-visible': {
            outline: `2px solid ${BRAND_PRIMARY}`,
            outlineOffset: 2,
          },
        },
        containedPrimary: {
          '&:hover': { backgroundColor: BRAND_PRIMARY_DARK },
        },
        outlined: {
          borderColor: BORDER,
          '&:hover': {
            borderColor: BRAND_PRIMARY,
            backgroundColor: BRAND_PRIMARY_LIGHT,
          },
        },
      },
    },

    MuiIconButton: {
      styleOverrides: {
        root: {
          transition: 'background-color 150ms ease',
          '&:focus-visible': {
            outline: `2px solid ${BRAND_PRIMARY}`,
            outlineOffset: 2,
          },
        },
      },
    },

    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          borderRadius: 16,
          border: `1px solid ${BORDER}`,
          boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
        },
      },
    },

    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: 16,
          border: `1px solid ${BORDER}`,
          boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
        },
      },
    },

    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(10px)',
          color: TEXT_PRIMARY,
          boxShadow: 'none',
          borderBottom: `1px solid ${BORDER}`,
        },
      },
    },

    MuiDrawer: {
      styleOverrides: {
        paper: {
          border: 'none',
          borderRight: `1px solid ${BORDER}`,
          background:
            'linear-gradient(180deg, #FFFFFF 0%, #F8FBFD 100%)',
        },
      },
    },

    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          margin: '2px 10px',
          paddingTop: 9,
          paddingBottom: 9,
          transition: 'background-color 150ms ease, color 150ms ease',
          '&.Mui-selected': {
            backgroundColor: BRAND_PRIMARY_LIGHT,
            color: BRAND_PRIMARY_DARK,
            fontWeight: 700,
            '&:hover': { backgroundColor: '#D7E6F2' },
            '& .MuiListItemIcon-root': { color: BRAND_PRIMARY_DARK },
            '& .MuiListItemText-primary': { fontWeight: 700 },
          },
          '&:hover': { backgroundColor: 'rgba(27,79,114,0.05)' },
          '&:focus-visible': {
            outline: `2px solid ${BRAND_PRIMARY}`,
            outlineOffset: -2,
          },
        },
      },
    },

    MuiListItemIcon: {
      styleOverrides: {
        root: {
          minWidth: 38,
          color: TEXT_SECONDARY,
        },
      },
    },

    MuiListItemText: {
      styleOverrides: {
        primary: {
          fontSize: '0.875rem',
          fontWeight: 550,
        },
      },
    },

    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
        size: 'small',
      },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
            backgroundColor: '#FFFFFF',
            transition: 'box-shadow 150ms ease',
            '&.Mui-focused': {
              boxShadow: `0 0 0 3px ${BRAND_PRIMARY}28`,
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: BRAND_PRIMARY,
              borderWidth: 1.5,
            },
          },
        },
      },
    },

    MuiTableContainer: {
      styleOverrides: {
        root: {
          width: '100%',
          maxWidth: '100%',
          overflowX: 'auto',
          borderRadius: 14,
        },
      },
    },

    MuiTableCell: {
      styleOverrides: {
        head: {
          backgroundColor: '#EEF3F7',
          color: TEXT_SECONDARY,
          fontWeight: 750,
          fontSize: '0.6875rem',
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          borderBottom: `1px solid ${BORDER}`,
          whiteSpace: 'nowrap',
        },
        body: {
          fontSize: '0.875rem',
          borderBottom: `1px solid ${BORDER}`,
          color: TEXT_PRIMARY,
        },
      },
    },

    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: 'background-color 120ms ease',
          '&:hover': { backgroundColor: '#F7FAFC' },
          '&:last-child td': { borderBottom: 'none' },
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 650,
          fontSize: '0.75rem',
        },
      },
    },

    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 18,
          border: 'none',
          boxShadow: '0 24px 48px rgba(15,23,42,0.18)',
        },
      },
    },

    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontSize: '1.125rem',
          fontWeight: 750,
          padding: '22px 24px 12px',
          color: TEXT_PRIMARY,
        },
      },
    },

    MuiDialogContent: {
      styleOverrides: {
        root: { padding: '0 24px' },
      },
    },

    MuiDialogActions: {
      styleOverrides: {
        root: {
          padding: '16px 24px 22px',
          gap: 8,
        },
      },
    },

    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: TEXT_PRIMARY,
          fontSize: '0.75rem',
          borderRadius: 8,
          padding: '6px 10px',
        },
        arrow: { color: TEXT_PRIMARY },
      },
    },

    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 99,
          height: 7,
          backgroundColor: BRAND_PRIMARY_LIGHT,
        },
        bar: { borderRadius: 99 },
      },
    },

    MuiSkeleton: {
      defaultProps: { animation: 'wave' },
      styleOverrides: {
        root: {
          borderRadius: 8,
          backgroundColor: '#E8EEF3',
        },
      },
    },

    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 12 },
        filledSuccess: { backgroundColor: COLOR_SUCCESS },
        filledError: { backgroundColor: COLOR_DANGER },
        filledWarning: { backgroundColor: COLOR_WARNING },
      },
    },

    MuiSnackbar: {
      defaultProps: {
        anchorOrigin: { vertical: 'top', horizontal: 'right' },
      },
    },

    MuiDivider: {
      styleOverrides: {
        root: { borderColor: BORDER },
      },
    },

    MuiAvatar: {
      styleOverrides: {
        root: {
          backgroundColor: BRAND_PRIMARY_LIGHT,
          color: BRAND_PRIMARY_DARK,
          fontWeight: 750,
        },
      },
    },

    MuiTabs: {
      styleOverrides: {
        indicator: {
          height: 3,
          borderRadius: 99,
          backgroundColor: BRAND_PRIMARY,
        },
      },
    },

    MuiTab: {
      styleOverrides: {
        root: {
          fontWeight: 650,
          minHeight: 44,
          textTransform: 'none',
        },
      },
    },
  },
});

export default theme;
