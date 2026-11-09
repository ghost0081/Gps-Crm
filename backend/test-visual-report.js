const assert = require('assert');
const { discover } = require('./services/report-catalog.js');
const { shortestPath, planJoins } = require('./services/report-graph.js');
const { build } = require('./services/report-query.js');

const cat = discover();
assert.ok(cat.tables.find((t) => t.name === 'student'));
assert.ok(!cat.tables.find((t) => t.name === 'student').fields.some((f) => f.name === 'password'));
assert.ok(cat.edges.some((e) => e.from === 'student' && e.to === 'sclass'));

const direct = shortestPath('student', 'sclass');
assert.strictEqual(direct.status, 'ok');
assert.ok(direct.path.length >= 1);

const fees = shortestPath('student', 'feeInvoice');
assert.strictEqual(fees.status, 'ok');

const none = shortestPath('student', 'notice');
assert.ok(none.status === 'no-relationship' || none.status === 'ok');

const school = '507f1f77bcf86cd799439011';
const built = build({
  schoolId: school,
  base: 'student',
  tables: ['student', 'sclass'],
  fields: [
    { table: 'sclass', path: 'sclassName' },
    { table: 'student', path: 'rollNum', agg: 'count', alias: 'students' },
  ],
  filters: [{ table: 'student', path: 'name', op: 'contains', value: 'a.b+c' }],
  limit: 50,
});
assert.ok(built.pipeline[0].$match.school);
assert.ok(built.pipeline[0].$match.name.$regex.includes('\\+'));
assert.strictEqual(built.pipeline.at(-1).$limit, 50);

const fan = planJoins('student', ['student', 'feeInvoice', 'parentArrival']);
assert.strictEqual(fan.missing.length, 0);
assert.strictEqual(fan.fanOut, true);

assert.throws(() => build({
  schoolId: school,
  base: 'student',
  tables: ['student'],
  fields: [{ table: 'student', path: 'password' }],
}), /not approved|Invalid/);

assert.throws(() => build({
  schoolId: school,
  base: 'student;drop',
  tables: ['student;drop'],
  fields: [],
}), /Invalid|not approved/);

const either = build({
  schoolId: school,
  base: 'student',
  tables: ['student'],
  fields: [{ table: 'student', path: 'name' }],
  filterLogic: 'or',
  filters: [
    { table: 'student', path: 'name', op: 'eq', value: 'A' },
    { table: 'student', path: 'rollNum', op: 'gt', value: 1 },
  ],
});
assert.ok(either.pipeline[0].$match.$or);
assert.strictEqual(either.pipeline[0].$match.$or.length, 2);

assert.throws(() => build({
  schoolId: school,
  base: 'student',
  tables: ['student'],
  fields: [{ table: 'student', path: 'name' }],
  filters: [{ table: 'student', path: 'name', op: 'gt', value: 'A' }],
}), /not valid/);

console.log('visual-report tests passed', {
  tables: cat.tables.length,
  edges: cat.edges.length,
  fanOut: fan.fanOut,
});
