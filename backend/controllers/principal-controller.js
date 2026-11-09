const Student = require('../models/studentSchema.js');
const Teacher = require('../models/teacherSchema.js');
const ParentArrival = require('../models/parentArrivalSchema.js');
const Leave = require('../models/leaveSchema.js');
const FeeInvoice = require('../models/feeInvoiceSchema.js');

/** Oversight aggregates for Principal / Academic Head (App 3). */
const getPrincipalOverview = async (req, res) => {
  try {
    const { schoolId } = req.query;
    if (!schoolId) return res.status(400).json({ message: 'schoolId required' });

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [students, teachers, openPickups, pendingLeaves, unpaidInvoices] = await Promise.all([
      Student.countDocuments({ school: schoolId }),
      Teacher.countDocuments({ school: schoolId }),
      ParentArrival.countDocuments({
        school: schoolId,
        createdAt: { $gte: since },
        status: { $in: ['Waiting at Frontdesk', 'TeacherNotified', 'Acknowledged', 'Preparing', 'Ready'] },
      }),
      Leave.countDocuments({ school: schoolId, status: { $in: ['Pending', 'pending'] } }).catch(() => 0),
      FeeInvoice.countDocuments({ school: schoolId, status: { $in: ['Issued', 'Partial'] } }),
    ]);

    const recentPickups = await ParentArrival.find({ school: schoolId })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('studentName status parentName arrivalTime teacherName');

    return res.send({
      schoolId,
      totals: { students, teachers, openPickups, pendingLeaves, unpaidInvoices },
      recentPickups,
      note: 'Principal view is oversight-only — not unrestricted access to welfare/payroll detail.',
    });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

module.exports = { getPrincipalOverview };
