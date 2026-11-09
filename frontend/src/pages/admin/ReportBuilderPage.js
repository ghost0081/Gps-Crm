import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Box, Typography, Button, Paper, TextField, MenuItem, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, CircularProgress, Alert, Stack, Checkbox,
} from '@mui/material';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import axios from 'axios';

function apiBase() {
  const env = process.env.REACT_APP_BASE_URL || '';
  if (typeof window !== 'undefined' && window.location.hostname
    && window.location.hostname !== 'localhost'
    && window.location.hostname !== '127.0.0.1'
    && /localhost|127\.0\.0\.1/.test(env)) {
    return `http://${window.location.hostname}:5000`;
  }
  return env;
}

const API = apiBase();
const COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2'];

const OP_LABEL = {
  eq: 'equals',
  ne: 'not equals',
  contains: 'contains',
  starts: 'starts with',
  gt: 'greater than',
  lt: 'less than',
  gte: 'greater or equal',
  lte: 'less or equal',
  between: 'between',
  isNull: 'is empty',
  isNotNull: 'is not empty',
};

function opLabel(op, type) {
  if (op === 'between' && type === 'date') return 'date range';
  return OP_LABEL[op] || op;
}

function blankFilter(id, table = '') {
  return { id, table, path: '', op: 'eq', value: '', valueTo: '' };
}

function readyFilters(rows) {
  return rows.flatMap((row) => {
    if (!row.table || !row.path || !row.op) return [];
    if (row.op === 'isNull' || row.op === 'isNotNull') {
      return [{ table: row.table, path: row.path, op: row.op }];
    }
    if (row.op === 'between') {
      if (row.value === '' || row.valueTo === '') return [];
      return [{ table: row.table, path: row.path, op: row.op, value: [row.value, row.valueTo] }];
    }
    if (row.value === '') return [];
    return [{ table: row.table, path: row.path, op: row.op, value: row.value }];
  });
}

const VisualReportBuilderPage = () => {
  const { currentUser } = useSelector((s) => s.user);
  const schoolId = currentUser?._id;
  const filterSeq = useRef(1);
  const runSeq = useRef(0);
  const [catalog, setCatalog] = useState(null);
  const [base, setBase] = useState('');
  const [extras, setExtras] = useState([]);
  const [fields, setFields] = useState([]);
  const [filters, setFilters] = useState(() => [blankFilter(filterSeq.current++)]);
  const [logic, setLogic] = useState('and');
  const [chart, setChart] = useState('');
  const [plan, setPlan] = useState(null);
  const [result, setResult] = useState(null);
  const [name, setName] = useState('Class enrolment');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadTables = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/Reports/Visual/Catalog`);
      const next = Array.isArray(data?.tables) ? data.tables : null;
      if (!next) {
        setError('The connected API did not return a table list. Start the school API so /Reports/Visual/Catalog can read the database.');
        return;
      }
      setCatalog(data);
      setBase((prev) => (next.some((t) => t.name === prev) ? prev : (next[0]?.name || '')));
      setExtras((prev) => prev.filter((name) => next.some((t) => t.name === name)));
      setFields((prev) => prev.filter((field) => next.some((t) => t.name === field.table && t.fields.some((col) => col.name === field.path))));
      setFilters((prev) => prev.map((row) => {
        const table = next.find((t) => t.name === row.table);
        if (row.table && !table) return { ...row, table: '', path: '', op: 'eq', value: '', valueTo: '' };
        if (row.path && table && !table.fields.some((col) => col.name === row.path)) {
          return { ...row, path: '', op: 'eq', value: '', valueTo: '' };
        }
        const column = table?.fields.find((col) => col.name === row.path);
        if (column && row.op && !(column.operators || []).includes(row.op)) {
          return { ...row, op: column.operators[0] || 'eq', value: '', valueTo: '' };
        }
        return row;
      }));
      setError('');
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    }
  }, []);

  useEffect(() => {
    loadTables();
    const timer = setInterval(loadTables, 5000);
    window.addEventListener('focus', loadTables);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', loadTables);
    };
  }, [loadTables]);

  const tables = catalog?.tables || [];
  const tableByName = useMemo(() => Object.fromEntries(tables.map((t) => [t.name, t])), [tables]);
  const filterTableNames = filters.map((row) => row.table).filter((name) => name && name !== base && tableByName[name]);
  const selectedTables = useMemo(
    () => [...new Set([base, ...extras, ...filterTableNames].filter(Boolean))],
    [base, extras, filterTableNames],
  );
  const selectedMeta = selectedTables.map((name) => tableByName[name]).filter(Boolean);
  const preparedFilters = useMemo(() => readyFilters(filters), [filters]);

  const definition = useCallback(() => ({
    schoolId,
    base,
    tables: selectedTables,
    fields,
    filters: preparedFilters,
    filterLogic: logic,
    chart: chart || undefined,
    limit: 200,
  }), [schoolId, base, selectedTables, fields, preparedFilters, logic, chart]);

  const queryKey = JSON.stringify({
    schoolId,
    base,
    tables: selectedTables,
    fields,
    filters: preparedFilters,
    logic,
    chart,
  });

  useEffect(() => {
    if (!base || !fields.length) {
      setResult(null);
      setLoading(false);
      return undefined;
    }
    if (!schoolId) return undefined;
    const handle = setTimeout(async () => {
      const seq = ++runSeq.current;
      setLoading(true);
      setError('');
      try {
        const { data } = await axios.post(`${API}/Reports/Visual/Run`, definition());
        if (seq !== runSeq.current) return;
        setResult(data);
        setPlan(data.plan);
        if (!chart && data.chart) setChart(data.chart);
      } catch (e) {
        if (seq !== runSeq.current) return;
        setError(e.response?.data?.message || e.message);
        setPlan(e.response?.data?.plan || null);
        setResult(null);
      } finally {
        if (seq === runSeq.current) setLoading(false);
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [queryKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const columnsFor = (tableName) => (tableByName[tableName]?.fields || []).filter((field) => field.type !== 'array' && field.type !== 'mixed');

  const setTableColumns = (tableName, paths) => {
    const chosen = Array.isArray(paths) ? paths : String(paths).split(',');
    setFields((prev) => [
      ...prev.filter((field) => field.table !== tableName),
      ...chosen.filter(Boolean).map((path) => ({ table: tableName, path })),
    ]);
  };

  const updateFilter = (id, patch) => {
    setFilters((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const onFilterTable = (id, table) => {
    updateFilter(id, { table, path: '', op: 'eq', value: '', valueTo: '' });
  };

  const onFilterField = (id, table, path) => {
    const column = columnsFor(table).find((field) => field.name === path);
    const operators = column?.operators || ['eq'];
    updateFilter(id, { path, op: operators[0] || 'eq', value: '', valueTo: '' });
  };

  const preview = async () => {
    setError('');
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/Reports/Visual/Plan`, { ...definition(), schoolId });
      setPlan(data);
      if (data.recommendedChart && !chart) setChart(data.recommendedChart);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
      setPlan(e.response?.data?.plan || null);
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    setError('');
    try {
      await axios.post(`${API}/Reports/Visual/Saved`, { schoolId, name, definition: definition() });
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    }
  };

  const exportCsv = () => {
    const rows = result?.rows || [];
    if (!rows.length) return;
    const cols = Object.keys(rows[0]);
    const lines = [cols.join(',')].concat(rows.map((r) => cols.map((c) => JSON.stringify(r[c] ?? '')).join(',')));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name || 'report'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const rows = result?.rows || [];
  const cols = rows[0] ? Object.keys(rows[0]) : [];
  const xKey = cols[0];
  const yKey = cols.find((c) => typeof rows[0]?.[c] === 'number') || cols[1];
  const activeChart = chart || result?.chart || 'table';

  return (
    <Box>
      <Typography variant="h1" sx={{ fontWeight: 800, mb: 1 }}>Visual report builder</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Pick tables, columns, and filters from the connected database. The rows below update as those choices change.
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography fontWeight={800} sx={{ mb: 1 }}>Tables</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          {tables.length ? `${tables.length} collections in the connected database` : 'Waiting for the database…'}
        </Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
          <TextField select size="small" fullWidth label="Base table" value={base} onChange={(e) => { setBase(e.target.value); setExtras((prev) => prev.filter((name) => name !== e.target.value)); }} disabled={!tables.length}>
            {tables.map((t) => (
              <MenuItem key={t.collection || t.name} value={t.name}>{t.collection || t.name}</MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            fullWidth
            label="Related tables"
            value={extras}
            disabled={!tables.length}
            SelectProps={{ multiple: true, renderValue: (selected) => selected.map((name) => tableByName[name]?.collection || name).join(', ') }}
            onChange={(e) => setExtras(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
          >
            {tables.filter((t) => t.name !== base).map((t) => (
              <MenuItem key={t.name} value={t.name}>
                <Checkbox size="small" checked={extras.includes(t.name)} />
                {t.collection || t.name}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography fontWeight={800} sx={{ mb: 1 }}>Columns</Typography>
        <Stack spacing={1}>
          {selectedMeta.map((table) => {
            const columns = columnsFor(table.name);
            const selected = fields.filter((field) => field.table === table.name).map((field) => field.path);
            return (
              <TextField
                key={table.name}
                select
                size="small"
                fullWidth
                label={`${table.collection || table.name} columns`}
                value={selected}
                disabled={!columns.length}
                helperText={columns.length ? 'Columns included in the report' : 'This collection has no readable columns yet'}
                SelectProps={{ multiple: true, renderValue: (value) => value.join(', ') }}
                onChange={(e) => setTableColumns(table.name, e.target.value)}
              >
                {columns.map((field) => (
                  <MenuItem key={field.name} value={field.name}>
                    <Checkbox size="small" checked={selected.includes(field.name)} />
                    {field.name}
                  </MenuItem>
                ))}
              </TextField>
            );
          })}
        </Stack>
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <Typography fontWeight={800} sx={{ flex: 1 }}>Filters</Typography>
          <Button size="small" variant={logic === 'and' ? 'contained' : 'outlined'} onClick={() => setLogic('and')}>AND</Button>
          <Button size="small" variant={logic === 'or' ? 'contained' : 'outlined'} onClick={() => setLogic('or')}>OR</Button>
          <Button size="small" onClick={() => setFilters((prev) => [...prev, blankFilter(filterSeq.current++)])}>Add filter</Button>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          {logic === 'or' ? 'A row matches when any complete filter matches.' : 'A row matches when every complete filter matches.'}
        </Typography>
        {filters.map((row) => {
          const columns = columnsFor(row.table);
          const column = columns.find((field) => field.name === row.path);
          const operators = column?.operators || [];
          const needsValue = row.op !== 'isNull' && row.op !== 'isNotNull';
          const range = row.op === 'between';
          const inputType = column?.type === 'date' ? 'date' : column?.type === 'number' ? 'number' : 'text';
          return (
            <Stack key={row.id} direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ mb: 1 }} alignItems={{ md: 'flex-start' }}>
              <TextField select size="small" label="Table" value={row.table} sx={{ minWidth: 160 }} onChange={(e) => onFilterTable(row.id, e.target.value)}>
                <MenuItem value="">Select table</MenuItem>
                {tables.map((t) => (
                  <MenuItem key={t.name} value={t.name}>{t.collection || t.name}</MenuItem>
                ))}
              </TextField>
              <TextField select size="small" label="Field" value={row.path} disabled={!row.table} sx={{ minWidth: 160 }} onChange={(e) => onFilterField(row.id, row.table, e.target.value)}>
                {columns.map((field) => (
                  <MenuItem key={field.name} value={field.name}>{field.name}</MenuItem>
                ))}
              </TextField>
              <TextField select size="small" label="Condition" value={operators.includes(row.op) ? row.op : ''} disabled={!column} sx={{ minWidth: 160 }} onChange={(e) => updateFilter(row.id, { op: e.target.value, value: '', valueTo: '' })}>
                {operators.map((op) => (
                  <MenuItem key={op} value={op}>{opLabel(op, column?.type)}</MenuItem>
                ))}
              </TextField>
              {needsValue && column?.type === 'boolean' && (
                <TextField select size="small" label="Value" value={row.value} sx={{ minWidth: 120 }} onChange={(e) => updateFilter(row.id, { value: e.target.value })}>
                  <MenuItem value="true">true</MenuItem>
                  <MenuItem value="false">false</MenuItem>
                </TextField>
              )}
              {needsValue && column && column.type !== 'boolean' && (
                <TextField
                  size="small"
                  label={range ? (column.type === 'date' ? 'From' : 'From') : 'Value'}
                  type={inputType}
                  value={row.value}
                  InputLabelProps={inputType === 'date' ? { shrink: true } : undefined}
                  onChange={(e) => updateFilter(row.id, { value: e.target.value })}
                />
              )}
              {needsValue && range && column && column.type !== 'boolean' && (
                <TextField
                  size="small"
                  label={column.type === 'date' ? 'To' : 'To'}
                  type={inputType}
                  value={row.valueTo}
                  InputLabelProps={inputType === 'date' ? { shrink: true } : undefined}
                  onChange={(e) => updateFilter(row.id, { valueTo: e.target.value })}
                />
              )}
              <Button size="small" disabled={filters.length === 1} onClick={() => setFilters((prev) => prev.filter((item) => item.id !== row.id))}>Remove</Button>
            </Stack>
          );
        })}
        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          <TextField select size="small" label="Chart" value={chart} onChange={(e) => setChart(e.target.value)} sx={{ minWidth: 180 }}>
            {['', 'table', 'bar', 'line', 'pie', 'kpi'].map((c) => <MenuItem key={c || 'auto'} value={c}>{c || 'Table'}</MenuItem>)}
          </TextField>
          <Button variant="outlined" onClick={preview} disabled={loading || !base}>Preview joins</Button>
          {loading && <CircularProgress size={22} />}
        </Stack>
      </Paper>

      {plan && (
        <Alert severity={plan.fanOut ? 'warning' : plan.missing?.length ? 'warning' : 'success'} sx={{ mb: 2 }}>
          {plan.fanOut ? 'Multiple one-to-many joins: related metrics are pre-aggregated to avoid double counting. ' : 'Join path resolved. '}
          {(plan.joins || []).map((j) => j.table).join(', ') || 'No extra joins'}
          {plan.ambiguous?.length ? ` Ambiguous: ${plan.ambiguous.map((a) => a.table).join(', ')} — pick one path.` : ''}
          {plan.missing?.length ? ` No verified relationship: ${plan.missing.map((m) => m.table).join(', ')}.` : ''}
        </Alert>
      )}

      {fields.length > 0 && !loading && rows.length === 0 && !error && (
        <Alert severity="info" sx={{ mb: 2 }}>No records match these filters.</Alert>
      )}
      {rows.length > 0 && (
        <Typography variant="body2" sx={{ mb: 1 }}>{result.rowCount} matching record{result.rowCount === 1 ? '' : 's'}</Typography>
      )}

      {rows.length > 0 && activeChart === 'kpi' && (
        <Paper sx={{ p: 3, mb: 2 }}>
          <Typography variant="h3">{rows.length === 1 ? Object.values(rows[0]).join(' · ') : rows.length}</Typography>
        </Paper>
      )}

      {rows.length > 0 && (activeChart === 'bar' || activeChart === 'line' || activeChart === 'pie') && xKey && yKey && (
        <Paper sx={{ p: 2, mb: 2, height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            {activeChart === 'line' ? (
              <LineChart data={rows}><XAxis dataKey={xKey} hide /><YAxis /><Tooltip /><Line dataKey={yKey} stroke="#2563eb" /></LineChart>
            ) : activeChart === 'pie' ? (
              <PieChart><Pie data={rows} dataKey={yKey} nameKey={xKey} outerRadius={90}>{rows.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie></PieChart>
            ) : (
              <BarChart data={rows}><XAxis dataKey={xKey} hide /><YAxis /><Tooltip /><Bar dataKey={yKey} fill="#2563eb" /></BarChart>
            )}
          </ResponsiveContainer>
        </Paper>
      )}

      {rows.length > 0 && (
        <TableContainer component={Paper} sx={{ mb: 2 }}>
          <Table size="small">
            <TableHead><TableRow>{cols.map((c) => <TableCell key={c}>{c}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {rows.slice(0, 100).map((r, i) => (
                <TableRow key={i}>{cols.map((c) => <TableCell key={c}>{String(r[c] ?? '')}</TableCell>)}</TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Stack direction="row" spacing={1}>
        <TextField size="small" label="Save as" value={name} onChange={(e) => setName(e.target.value)} />
        <Button variant="outlined" onClick={save} disabled={!fields.length}>Save</Button>
        <Button variant="outlined" onClick={exportCsv} disabled={!rows.length}>Export CSV</Button>
      </Stack>
    </Box>
  );
};

export default VisualReportBuilderPage;
