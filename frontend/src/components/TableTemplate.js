import React, { useState, useMemo } from 'react';
import {
  Box, Paper, Typography, TablePagination,
  InputBase, IconButton, Tooltip, Chip,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { ListRowSkeleton } from './SkeletonLoaders';
import EmptyState from './EmptyState';

/*
 * TableTemplate — the core data display component
 *
 * ENHANCEMENTS:
 * 1. Client-side search across all visible columns
 * 2. Column sorting (click column header to sort; click again to reverse)
 * 3. Skeleton loading state
 * 4. Empty state (with different messages for "no data" vs "no search results")
 * 5. Accessible: search input labelled, sort buttons have aria-sort
 *
 * API unchanged — existing callers pass { columns, rows, buttonHaver } and
 * everything continues to work. Search and sort are additive.
 */

const TableTemplate = ({
  buttonHaver: ButtonHaver,
  columns,
  rows,
  loading = false,
  onAdd,          // optional — if provided, empty state shows "Add first item" CTA
  addLabel = 'Add',
}) => {
  const [page, setPage]               = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn]   = useState(null);
  const [sortDir, setSortDir]         = useState('asc');

  // Search: filter rows where any column value contains the query
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase();
    return rows.filter(row =>
      columns.some(col => {
        const val = row[col.id];
        return val != null && String(val).toLowerCase().includes(q);
      })
    );
  }, [rows, searchQuery, columns]);

  // Sort: stable sort on the selected column
  const sortedRows = useMemo(() => {
    if (!sortColumn) return filteredRows;
    return [...filteredRows].sort((a, b) => {
      const va = a[sortColumn] ?? '';
      const vb = b[sortColumn] ?? '';
      const cmp = typeof va === 'number'
        ? va - vb
        : String(va).localeCompare(String(vb));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filteredRows, sortColumn, sortDir]);

  const paginatedRows = sortedRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const handleSort = (columnId) => {
    if (sortColumn === columnId) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnId);
      setSortDir('asc');
    }
    setPage(0);
  };

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
    setPage(0);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setPage(0);
  };

  if (loading) {
    return <ListRowSkeleton rows={rowsPerPage} />;
  }

  return (
    <Box sx={{ width: '100%' }}>

      {/* ── Toolbar: Search + result count ──────────────────────────── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        {/* Search */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            bgcolor: 'background.default',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: '12px',
            px: 1.5,
            py: 0.75,
            gap: 1,
            width: { xs: '100%', sm: 'auto' },
            minWidth: { xs: 0, sm: 220 },
            maxWidth: { xs: '100%', sm: 360 },
            flex: { xs: '1 1 100%', sm: '0 1 auto' },
            transition: 'all 150ms ease',
            '&:focus-within': {
              borderColor: 'primary.main',
              bgcolor: '#fff',
              boxShadow: '0 0 0 3px rgba(27,79,114,0.14)',
            },
          }}
        >
          <SearchIcon sx={{ color: 'text.disabled', fontSize: 18 }} />
          <InputBase
            value={searchQuery}
            onChange={handleSearch}
            placeholder={`Search ${columns.map(c => c.label).slice(0, 2).join(', ')}…`}
            sx={{ flex: 1, fontSize: '0.875rem' }}
            inputProps={{ 'aria-label': 'Search records' }}
          />
          {searchQuery && (
            <IconButton size="small" onClick={clearSearch} aria-label="Clear search" sx={{ p: 0.25 }}>
              <CloseIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
            </IconButton>
          )}
        </Box>

        {/* Result count */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {searchQuery && (
            <Chip
              label={`${filteredRows.length} of ${rows.length} results`}
              size="small"
              sx={{ bgcolor: 'primary.light', color: 'primary.dark', fontWeight: 650 }}
            />
          )}
          {!searchQuery && (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {rows.length} record{rows.length !== 1 ? 's' : ''}
            </Typography>
          )}
        </Box>
      </Box>

      {/* ── Table Container ───────────────────────────────────────────── */}
      <Box sx={{ overflowX: 'auto', width: '100%', maxWidth: '100%' }}>
        <Box sx={{ minWidth: { xs: 560, md: 800 } }}>
          
          {/* ── Column headers (sortable) ────────────────────────────────── */}
          {rows.length > 0 && (
            <Box
              sx={{
                display: 'flex',
                px: 3,
                py: 1.25,
                bgcolor: '#EEF3F7',
                borderRadius: '12px 12px 0 0',
                border: '1px solid',
                borderColor: 'divider',
                borderBottom: 'none',
              }}
            >
              <Box sx={{ display: 'flex', gap: 4, flex: 1 }}>
                {columns.map((col) => (
                  <Box
                    key={col.id}
                    onClick={() => handleSort(col.id)}
                    role="button"
                    tabIndex={0}
                    aria-sort={sortColumn === col.id ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSort(col.id); }}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      flex: 1,
                      minWidth: col.minWidth ? col.minWidth / 1.5 : 100,
                      cursor: 'pointer',
                      userSelect: 'none',
                      '&:hover .sort-icon': { opacity: 1 },
                    }}
                  >
                    <Typography variant="overline" sx={{ color: 'text.secondary', lineHeight: 1 }}>
                      {col.label}
                    </Typography>
                    <Box className="sort-icon" sx={{ opacity: sortColumn === col.id ? 1 : 0, transition: 'opacity 150ms ease' }}>
                      {sortColumn === col.id && sortDir === 'desc'
                        ? <ArrowDownwardIcon sx={{ fontSize: 12, color: 'primary.main' }} />
                        : <ArrowUpwardIcon  sx={{ fontSize: 12, color: sortColumn === col.id ? 'primary.main' : 'text.disabled' }} />
                      }
                    </Box>
                  </Box>
                ))}
              </Box>
              
              {/* Header placeholder for action buttons */}
              {ButtonHaver && (
                <Box sx={{ width: 160, flexShrink: 0, pl: 2 }} />
              )}
            </Box>
          )}

          {/* ── Data Rows ───────────────────────────────────────────────── */}
          {paginatedRows.length === 0 ? (
            <Paper elevation={1} sx={{ borderRadius: rows.length > 0 ? '0 0 14px 14px' : '14px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
              <EmptyState
                type={searchQuery ? 'search' : 'empty'}
                heading={searchQuery ? 'No matching records' : 'No records yet'}
                description={searchQuery
                  ? `No results match "${searchQuery}". Try different keywords.`
                  : 'Get started by adding your first record.'
                }
                action={!searchQuery && onAdd ? { label: addLabel, onClick: onAdd } : undefined}
                compact
              />
            </Paper>
          ) : (
            paginatedRows.map((row) => (
              <Paper
                key={row.id}
                elevation={0}
                sx={{
                  px: 3,
                  py: 2.5,
                  mb: 0,
                  borderRadius: 0,
                  display: 'flex',
                  alignItems: 'center',
                  border: '1px solid #E2E8F0',
                  borderTop: 'none',
                  transition: 'background-color 150ms ease',
                  '&:hover': { bgcolor: '#F7F8FA' },
                  '&:last-of-type': { borderRadius: '0 0 14px 14px' },
                }}
              >
                {/* Data fields */}
                <Box sx={{ display: 'flex', gap: 4, flex: 1 }}>
                  {columns.map((column) => {
                    const value = row[column.id];
                    return (
                      <Box key={column.id} sx={{ flex: 1, minWidth: column.minWidth ? column.minWidth / 1.5 : 100 }}>
                        <Typography
                          variant="caption"
                          sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', mb: 0.25, textTransform: 'uppercase', letterSpacing: '0.05em' }}
                        >
                          {column.label}
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', wordBreak: 'break-word' }}>
                          {column.format && typeof value === 'number' ? column.format(value) : (value || '—')}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>

                {/* Action buttons */}
                {ButtonHaver && (
                  <Box
                    sx={{
                      display: 'flex',
                      flexShrink: 0,
                      gap: 1,
                      alignItems: 'center',
                      width: 160,
                      justifyContent: 'center',
                      pl: 2,
                      borderLeft: '1px solid #E2E8F0',
                    }}
                  >
                    <ButtonHaver row={row} />
                  </Box>
                )}
              </Paper>
            ))
          )}
        </Box>
      </Box>

      {/* ── Pagination ──────────────────────────────────────────────── */}
      {rows.length > rowsPerPage && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
          <TablePagination
            rowsPerPageOptions={[10, 25, 50, 100]}
            component="div"
            count={sortedRows.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
            sx={{
              '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': {
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: 'text.secondary',
              },
              border: 'none',
            }}
          />
        </Box>
      )}
    </Box>
  );
};

export default TableTemplate;