const { canTransition, assertTransition } = require('./services/pickup-state.js');

function ok(cond, msg) {
  if (!cond) throw new Error(msg);
  console.log('ok:', msg);
}

ok(canTransition('TeacherNotified', 'Preparing'), 'teacher notified → preparing');
ok(canTransition('Preparing', 'Ready'), 'preparing → ready');
ok(canTransition('Ready', 'CollectorVerified'), 'ready → collector verified');
ok(canTransition('CollectorVerified', 'HandedOver'), 'verified → handover');
ok(canTransition('HandedOver', 'Exited'), 'handover → exited');
ok(!canTransition('Scanned', 'Exited'), 'cannot skip to exit');
ok(!canTransition('Exited', 'Preparing'), 'exited is terminal');

let threw = false;
try {
  assertTransition('Ready', 'Exited');
} catch (e) {
  threw = e.status === 400;
}
ok(threw, 'assertTransition rejects Ready → Exited');

console.log('pickup-state tests passed');
