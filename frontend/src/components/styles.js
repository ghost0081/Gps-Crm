import {
    TableCell,
    TableRow,
    styled,
    tableCellClasses,
    Drawer as MuiDrawer,
    AppBar as MuiAppBar,
} from "@mui/material";

/*
 * Shared styled components for the admin dashboard shell layout.
 *
 * FIXES:
 * - StyledTableCell previously used `backgroundColor: black` for headers.
 *   This was the original MUI "zebra stripe" pattern — visually jarring and
 *   contradicting the theme. Replaced with the theme's text.secondary colour
 *   on a light background (handled by theme.js MuiTableCell override).
 *   Keeping this file minimal — the theme handles table styling.
 *
 * - Drawer now uses the correct sidebar background token.
 */

export const drawerWidth = 240;

// StyledTableCell — kept for backwards compat, but theme.js now handles
// the actual styling so these overrides are minimal
export const StyledTableCell = styled(TableCell)(({ theme }) => ({
  [`&.${tableCellClasses.head}`]: {
    backgroundColor: theme.palette.background.default, // was black — fixed
    color: theme.palette.text.secondary,
    fontWeight: 700,
    fontSize: '0.6875rem',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
  },
  [`&.${tableCellClasses.body}`]: {
    fontSize: 14,
    color: theme.palette.text.primary,
  },
}));

export const StyledTableRow = styled(TableRow)(({ theme }) => ({
  '&:nth-of-type(odd)': {
    backgroundColor: theme.palette.background.default,
  },
  '&:last-child td, &:last-child th': {
    border: 0,
  },
  '&:hover': {
    backgroundColor: '#F7F8FA',
  },
}));

// ── AppBar — adjusts width when sidebar is open ───────────────────────────
export const AppBar = styled(MuiAppBar, {
  shouldForwardProp: (prop) => prop !== 'open',
})(({ theme, open }) => ({
  zIndex: theme.zIndex.drawer + 1,
  transition: theme.transitions.create(['width', 'margin'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  ...(open && {
    marginLeft: drawerWidth,
    width: `calc(100% - ${drawerWidth}px)`,
    transition: theme.transitions.create(['width', 'margin'], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
    [theme.breakpoints.down('md')]: {
      marginLeft: 0,
      width: '100%',
    },
  }),
}));

// ── Drawer — permanent sidebar ─────────────────────────────────────────────
export const Drawer = styled(MuiDrawer, {
  shouldForwardProp: (prop) => prop !== 'open',
})(({ theme, open }) => ({
  '& .MuiDrawer-paper': {
    position: 'relative',
    whiteSpace: 'nowrap',
    width: drawerWidth,
    height: '100vh',
    overflowY: 'auto',
    overflowX: 'hidden',
    transition: theme.transitions.create('width', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
    boxSizing: 'border-box',
    top: 0,
    left: 0,
    backgroundColor: '#FFFFFF',
    borderRight: '1px solid #E2E8F0',
    // Thin scrollbar inside sidebar
    '&::-webkit-scrollbar': { width: '4px' },
    '&::-webkit-scrollbar-track': { background: 'transparent' },
    '&::-webkit-scrollbar-thumb': { background: '#CBD5E1', borderRadius: '99px' },
    scrollbarWidth: 'thin',
    scrollbarColor: '#CBD5E1 transparent',
    ...(!open && {
      overflowX: 'hidden',
      transition: theme.transitions.create('width', {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.leavingScreen,
      }),
      width: theme.spacing(7),
      [theme.breakpoints.up('sm')]: {
        width: theme.spacing(9),
      },
    }),
  },
}));