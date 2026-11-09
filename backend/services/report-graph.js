const { discover, tableMap } = require('./report-catalog.js');

function adjacency() {
  const cat = discover();
  const adj = {};
  for (const t of cat.tables) adj[t.name] = [];
  for (const e of cat.edges) {
    adj[e.from].push({ ...e, reverse: false });
    adj[e.to].push({
      ...e,
      id: `rev:${e.id}`,
      from: e.to,
      to: e.from,
      fromFields: e.toFields,
      toFields: e.fromFields,
      cardinality: e.cardinality === 'many-to-one' ? 'one-to-many' : 'many-to-one',
      reverse: true,
      sourceEdge: e.id,
    });
  }
  return { adj, edges: cat.edges };
}

/** Shortest approved path. Equal-length alternatives are ambiguous — never guessed. */
function shortestPath(from, to) {
  if (from === to) return { status: 'same', path: [] };
  const { adj } = adjacency();
  if (!adj[from] || !adj[to]) return { status: 'unknown-table' };
  const q = [[from]];
  const seen = new Set([from]);
  let shortest = null;
  const found = [];
  while (q.length) {
    const path = q.shift();
    const node = path[path.length - 1];
    if (shortest && path.length > shortest) break;
    for (const edge of adj[node] || []) {
      if (path.includes(edge.to)) continue;
      const next = path.concat([edge]);
      if (edge.to === to) {
        const hops = next.filter((x) => typeof x !== 'string').length;
        if (!shortest) shortest = hops;
        if (hops === shortest) found.push(next.filter((x) => typeof x !== 'string'));
        continue;
      }
      if (!seen.has(edge.to) || (shortest && path.length < shortest)) {
        seen.add(edge.to);
        q.push(next);
      }
    }
  }
  if (!found.length) return { status: 'no-relationship' };
  if (found.length > 1) {
    return {
      status: 'ambiguous',
      options: found.map((p) => p.map((e) => e.id)),
    };
  }
  return { status: 'ok', path: found[0] };
}

function planJoins(base, tables) {
  const selected = [...new Set(tables || [])];
  if (!selected.includes(base)) selected.unshift(base);
  const joins = [];
  const ambiguous = [];
  const missing = [];
  for (const t of selected) {
    if (t === base) continue;
    const res = shortestPath(base, t);
    if (res.status === 'ok') joins.push({ table: t, path: res.path });
    else if (res.status === 'ambiguous') ambiguous.push({ table: t, options: res.options });
    else missing.push({ table: t, status: res.status });
  }
  const many = joins.filter((j) => j.path.some((e) => e.cardinality === 'one-to-many' || e.reverse));
  const fanOut = many.length > 1;
  return { base, joins, ambiguous, missing, fanOut, tables: tableMap() };
}

module.exports = { shortestPath, planJoins, adjacency };
