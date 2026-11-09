const assert = require('assert');
const { describeSchema, formatValue, starterTemplates } = require('./services/design-schema');

const tree = describeSchema();
const student = tree.tables.find((table) => table.model === 'student');
const fee = tree.tables.find((table) => table.model === 'fee');
assert.ok(student, 'student collection is discovered');
assert.ok(student.fields.some((field) => field.path === 'name'));
assert.ok(student.fields.some((field) => field.path === 'rollNum'));
assert.ok(!student.fields.some((field) => /password/i.test(field.path)));
assert.ok(!student.fields.some((field) => /embedding/i.test(field.path)));
assert.ok(!tree.tables.some((table) => /credential/i.test(table.model)));
assert.ok(fee.fields.some((field) => field.path === 'amount' && field.dataType === 'number'));
assert.ok(tree.relationships.some((link) => link.from === 'fee' && link.to === 'student'));
assert.ok(!tree.tables.some((table) => table.model === 'designTemplate'));

const starters = starterTemplates();
assert.ok(starters.some((item) => item.category === 'fee-receipt'));
assert.ok(starters.some((item) => item.category === 'student-id'));
assert.strictEqual(formatValue(1500, 'currency').includes('1,500') || formatValue(1500, 'currency').includes('1500'), true);
assert.ok(formatValue(1500, 'currency').includes('₹') || formatValue(1500, 'currency').includes('INR'));

console.log('design-schema-ok', tree.tables.length, 'collections', tree.relationships.length, 'links', starters.length, 'templates');
