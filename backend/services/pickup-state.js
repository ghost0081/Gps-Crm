/**
 * Pickup transaction state machine (spec Workflow A).
 * QR scan ≠ teacher ack ≠ handover ≠ gate exit.
 */

const ALLOWED = {
  Scanned: ['TeacherNotified', 'Waiting at Frontdesk', 'Acknowledged', 'Preparing', 'Rejected', 'Override'],
  'Waiting at Frontdesk': ['TeacherNotified', 'Acknowledged', 'Preparing', 'Rejected', 'Override'],
  TeacherNotified: ['Acknowledged', 'Preparing', 'Rejected', 'Override'],
  Acknowledged: ['Preparing', 'Rejected', 'Override'],
  Preparing: ['Ready', 'Rejected', 'Override'],
  Ready: ['CollectorVerified', 'HandedOver', 'Student Dispatched', 'Rejected', 'Override'],
  CollectorVerified: ['HandedOver', 'Student Dispatched', 'Rejected', 'Override'],
  HandedOver: ['Exited'],
  'Student Dispatched': ['Exited', 'HandedOver'],
  Exited: [],
  Rejected: [],
  Override: ['Preparing', 'Ready', 'HandedOver', 'Exited', 'Rejected'],
};

function canTransition(from, to) {
  if (!from || !to) return false;
  if (from === to) return true;
  const next = ALLOWED[from];
  if (!next) return false;
  return next.includes(to);
}

function assertTransition(from, to) {
  if (!canTransition(from, to)) {
    const err = new Error(`Invalid pickup transition: ${from} → ${to}`);
    err.status = 400;
    throw err;
  }
}

module.exports = { ALLOWED, canTransition, assertTransition };
