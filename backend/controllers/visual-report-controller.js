const SavedReport = require('../models/savedReportSchema.js');
const { listDatabaseTables } = require('../services/report-catalog.js');
const { planJoins } = require('../services/report-graph.js');
const { build, execute, recommendChart } = require('../services/report-query.js');

function schoolIdOf(req) {
  return req.query.schoolId || req.body?.schoolId || req.body?.definition?.schoolId;
}

const catalog = async (req, res) => {
  try {
    const data = await listDatabaseTables();
    return res.send({
      engine: data.engine,
      note: 'Table names are read from the connected database and refresh when collections change.',
      domains: [...new Set(data.tables.map((t) => t.domain))],
      tables: data.tables,
      edges: data.edges,
      discoveredAt: data.discoveredAt,
    });
  } catch (e) {
    return res.status(e.status || 500).json({ message: e.message });
  }
};

const previewPlan = async (req, res) => {
  try {
    const { base, tables } = req.body || {};
    if (!base) return res.status(400).json({ message: 'base table required' });
    const plan = planJoins(base, tables || [base]);
    let chart = null;
    let pipeline = null;
    if (!plan.ambiguous.length && !plan.missing.length && schoolIdOf(req)) {
      const built = build({ ...(req.body.definition || req.body), schoolId: schoolIdOf(req) });
      pipeline = built.pipeline;
      chart = built.chart;
    }
    return res.send({ ...plan, pipeline, recommendedChart: chart || recommendChart(req.body || {}) });
  } catch (e) {
    return res.status(e.status || 500).json({ message: e.message, plan: e.plan || null });
  }
};

const runVisualReport = async (req, res) => {
  try {
    const def = { ...(req.body || {}), schoolId: schoolIdOf(req) };
    const result = await execute(def);
    return res.send({
      rows: result.rows,
      rowCount: result.rowCount,
      chart: result.chart,
      plan: result.plan,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    return res.status(e.status || 500).json({ message: e.message, plan: e.plan || null });
  }
};

const listSaved = async (req, res) => {
  const schoolId = schoolIdOf(req);
  if (!schoolId) return res.status(400).json({ message: 'schoolId required' });
  const rows = await SavedReport.find({ school: schoolId, archived: false }).sort({ updatedAt: -1 }).limit(100);
  return res.send(rows);
};

const saveReport = async (req, res) => {
  try {
    const schoolId = schoolIdOf(req);
    const { name, description, definition, ownerName } = req.body || {};
    if (!schoolId || !name || !definition) return res.status(400).json({ message: 'schoolId, name, definition required' });
    build({ ...definition, schoolId });
    const row = await SavedReport.create({
      school: schoolId,
      name,
      description: description || '',
      definition: { ...definition, schoolId },
      ownerName: ownerName || 'Admin',
    });
    return res.send(row);
  } catch (e) {
    return res.status(e.status || 500).json({ message: e.message, plan: e.plan || null });
  }
};

const runSaved = async (req, res) => {
  try {
    const row = await SavedReport.findById(req.params.id);
    if (!row || String(row.school) !== String(schoolIdOf(req))) {
      return res.status(404).json({ message: 'Report not found' });
    }
    const result = await execute({ ...row.definition, schoolId: String(row.school) });
    return res.send({ report: row.name, rows: result.rows, rowCount: result.rowCount, chart: result.chart, plan: result.plan });
  } catch (e) {
    return res.status(e.status || 500).json({ message: e.message });
  }
};

module.exports = { catalog, previewPlan, runVisualReport, listSaved, saveReport, runSaved };
