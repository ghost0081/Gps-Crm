const Visitor = require('../models/visitorSchema.js');
const ParentArrival = require('../models/parentArrivalSchema.js');
const Student = require('../models/studentSchema.js');
const Teacher = require('../models/teacherSchema.js');
const Sclass = require('../models/sclassSchema.js');
const Admin = require('../models/adminSchema.js');
const NotificationOutbox = require('../models/notificationOutboxSchema.js');
const { resolveQrToContext, writeAudit } = require('./guardian-credential-controller.js');
const { assertTransition } = require('../services/pickup-state.js');

const generateVisitorCode = async () => {
    const padCode = (num) => String(num).padStart(5, '0');
    let attempts = 0;
    const maxAttempts = 50;
    while (attempts < maxAttempts) {
        const random = Math.floor(10000 + Math.random() * 90000);
        const code = padCode(random);
        const exists = await Visitor.exists({ visitorCode: code });
        if (!exists) {
            return code;
        }
        attempts += 1;
    }
    throw new Error('Unable to generate unique visitor code');
};

const createVisitor = async (req, res) => {
    try {
        const { name, contactNumber, purpose, hostName, notes, school } = req.body;
        if (!name) {
            return res.status(400).send({ message: 'Visitor name is required' });
        }

        const visitorCode = await generateVisitorCode();
        const visitor = new Visitor({
            visitorCode,
            name,
            contactNumber,
            purpose,
            hostName,
            notes,
            school: school || null,
        });
        const savedVisitor = await visitor.save();
        return res.send(savedVisitor);
    } catch (error) {
        return res.status(500).json(error);
    }
};

const listVisitors = async (req, res) => {
    try {
        const { schoolId, status, limit = 100 } = req.query;
        const query = {};
        if (schoolId) {
            query.school = schoolId;
        } else {
            query.school = null;
        }
        if (status) {
            query.status = status;
        }

        const visitors = await Visitor.find(query)
            .sort({ createdAt: -1 })
            .limit(Number(limit) || 100);

        return res.send(visitors);
    } catch (error) {
        return res.status(500).json(error);
    }
};

const updateVisitor = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes, checkOutTime, hostName, purpose, contactNumber } = req.body;

        const updatePayload = {};
        if (status) updatePayload.status = status;
        if (notes !== undefined) updatePayload.notes = notes;
        if (hostName !== undefined) updatePayload.hostName = hostName;
        if (purpose !== undefined) updatePayload.purpose = purpose;
        if (contactNumber !== undefined) updatePayload.contactNumber = contactNumber;
        if (checkOutTime) {
            updatePayload.checkOutTime = checkOutTime;
        } else if (status === 'Checked Out') {
            updatePayload.checkOutTime = new Date();
        }

        const visitor = await Visitor.findByIdAndUpdate(id, updatePayload, { new: true });
        if (!visitor) {
            return res.status(404).send({ message: 'Visitor not found' });
        }
        return res.send(visitor);
    } catch (error) {
        return res.status(500).json(error);
    }
};

// FrontDesk Staff Login Controller
const frontdeskLogin = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).send({ message: 'Email and password are required' });
        }

        // Allow Admin credentials or FrontDesk account
        const admin = await Admin.findOne({ email: email });
        if (admin && admin.password === password) {
            return res.send({
                _id: admin._id,
                name: admin.name || 'FrontDesk Gatekeeper',
                email: admin.email,
                role: 'FrontDesk',
                schoolName: admin.schoolName,
                // Admin document id is the school tenant id in this codebase
                school: admin._id,
            });
        }

        // Default FrontDesk fallback login
        if ((email.toLowerCase() === 'frontdesk@school.com' || email.toLowerCase() === 'frontdesk') && password === '123456') {
            const firstAdmin = await Admin.findOne().select('_id schoolName name');
            return res.send({
                _id: 'frontdesk_default_id',
                name: 'FrontDesk Gatekeeper Staff',
                email: 'frontdesk@school.com',
                role: 'FrontDesk',
                schoolName: firstAdmin?.schoolName || 'Main School',
                school: firstAdmin?._id || null,
            });
        }

        return res.status(400).send({ message: 'Invalid FrontDesk credentials' });
    } catch (error) {
        return res.status(500).json(error);
    }
};

// Lookup Student details by QR payload (without logging arrival)
const lookupStudentQr = async (req, res) => {
    try {
        const ctx = await resolveQrToContext(req.body);
        const student = await Student.findOne(ctx.studentQuery).populate('sclassName');

        if (!student) {
            return res.status(404).send({ message: 'Student not found for scanned QR code' });
        }

        const classId = student.sclassName?._id || student.sclassName;
        let teacher = null;
        if (classId) {
            teacher = await Teacher.findOne({ teachSclass: classId });
        }

        return res.send({
            studentId: student._id,
            studentName: student.name,
            rollNum: student.rollNum,
            sclassNameStr: student.sclassName?.sclassName || 'Class',
            teacherName: teacher?.name || 'Unassigned',
            teacherId: teacher?._id || null,
            parentName: ctx.parentName || 'Parent',
            parentPhone: ctx.parentPhone || '',
            credentialId: ctx.credential?.credentialId || null,
            credentialKind: ctx.credential?.kind || null,
            verified: Boolean(ctx.verified || ctx.mode === 'opaque'),
            mode: ctx.mode,
        });
    } catch (error) {
        const status = error.status || 500;
        return res.status(status).json({ message: error.message || 'Error looking up student QR' });
    }
};

// Scan Parent QR Code / Log Student Gate Pass Arrival
const scanParentQr = async (req, res) => {
    try {
        const { sclassNameStr, scannedBy, clientEventId, offlineQueuedAt } = req.body;

        if (clientEventId) {
            const prior = await ParentArrival.findOne({ clientEventId });
            if (prior) {
                return res.send({
                    message: 'Pickup event already processed (idempotent replay).',
                    arrival: prior,
                    studentName: prior.studentName,
                    sclassName: prior.sclassNameStr,
                    teacherName: prior.teacherName,
                    duplicate: true,
                    idempotent: true,
                });
            }
        }

        const ctx = await resolveQrToContext(req.body);
        const student = await Student.findOne(ctx.studentQuery).populate('sclassName');

        if (!student) {
            return res.status(404).send({ message: 'Student not found for scanned QR code' });
        }

        const classId = student.sclassName?._id || student.sclassName;
        let teacher = null;
        if (classId) {
            teacher = await Teacher.findOne({ teachSclass: classId });
        }

        // Soft de-dupe: same student still waiting within 10 minutes
        const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
        const existing = await ParentArrival.findOne({
            student: student._id,
            status: { $in: ['Waiting at Frontdesk', 'Scanned', 'TeacherNotified', 'Acknowledged', 'Preparing', 'Ready'] },
            createdAt: { $gte: tenMinAgo },
        }).sort({ createdAt: -1 });

        if (existing) {
            return res.send({
                message: `Pickup already queued for ${student.name}. Class Teacher was notified.`,
                arrival: existing,
                studentName: student.name,
                sclassName: student.sclassName?.sclassName || 'Class',
                teacherName: teacher?.name || existing.teacherName || 'Unassigned',
                duplicate: true,
                verified: Boolean(ctx.verified || ctx.mode === 'opaque'),
                mode: ctx.mode,
            });
        }

        const initialStatus = teacher ? 'TeacherNotified' : 'Waiting at Frontdesk';
        const scannedByName = scannedBy || 'FrontDesk Gatekeeper';
        const arrival = new ParentArrival({
            student: student._id,
            studentName: student.name,
            rollNum: student.rollNum,
            sclassName: classId,
            sclassNameStr: student.sclassName?.sclassName || sclassNameStr || 'Class',
            teacher: teacher?._id || null,
            teacherName: teacher?.name || 'Class Teacher',
            school: student.school,
            parentName: ctx.parentName || 'Parent',
            parentPhone: ctx.parentPhone || '',
            credentialId: ctx.credential?.credentialId || req.body.cid || req.body.credentialId || null,
            clientEventId: clientEventId || undefined,
            offlineQueuedAt: offlineQueuedAt ? new Date(offlineQueuedAt) : null,
            notificationPending: !teacher,
            status: initialStatus,
            scannedBy: scannedByName,
            statusHistory: [
                { status: 'Scanned', at: new Date(), by: scannedByName, note: 'Gate QR scan' },
                { status: initialStatus, at: new Date(), by: 'system', note: teacher ? 'Teacher queued' : 'No class teacher assigned' },
            ],
        });

        const savedArrival = await arrival.save();

        if (teacher) {
            const title = 'Parent at gate';
            const body = `${ctx.parentName || 'Parent'} is collecting ${student.name} (Roll ${student.rollNum}).`;
            let fcmResult = { sent: 0, skipped: true };
            try {
                const { sendToTokens } = require('../services/fcm-dispatch.js');
                const tokens = (teacher.fcmTokens || []).map((t) => t.token).filter(Boolean);
                fcmResult = await sendToTokens(tokens, {
                    title,
                    body,
                    data: {
                        type: 'pickup.scan',
                        arrivalId: String(savedArrival._id),
                        studentName: student.name,
                    },
                    androidChannelId: 'pickup_alerts',
                });
                if (fcmResult.invalidTokens && fcmResult.invalidTokens.length) {
                    teacher.fcmTokens = (teacher.fcmTokens || []).filter(
                        (t) => !fcmResult.invalidTokens.includes(t.token)
                    );
                    await teacher.save();
                }
            } catch (_) {
                fcmResult = { sent: 0, skipped: true, reason: 'fcm_error' };
            }

            await NotificationOutbox.create({
                school: student.school,
                teacher: teacher._id,
                arrival: savedArrival._id,
                type: 'pickup.scan',
                title,
                body,
                payload: {
                    arrivalId: String(savedArrival._id),
                    studentName: student.name,
                    rollNum: student.rollNum,
                    parentName: ctx.parentName || 'Parent',
                    status: initialStatus,
                    fcm: fcmResult,
                },
                status: fcmResult.sent > 0 ? 'delivered' : 'pending',
                attempts: 1,
                deliveredAt: fcmResult.sent > 0 ? new Date() : undefined,
                lastError: fcmResult.skipped ? (fcmResult.reason || '') : '',
            });
        }

        await writeAudit({
            school: student.school,
            action: 'pickup.scan',
            actorType: 'frontdesk',
            actorName: scannedByName,
            resourceType: 'parentArrival',
            resourceId: String(savedArrival._id),
            detail: {
                credentialId: ctx.credential?.credentialId || null,
                mode: ctx.mode,
                studentId: String(student._id),
                clientEventId: clientEventId || null,
                offlineQueuedAt: offlineQueuedAt || null,
                status: initialStatus,
            },
        });

        return res.send({
            message: teacher
                ? `Parent of ${student.name} logged at gate. Class teacher ${teacher.name} notified.`
                : `Parent of ${student.name} logged at gate. No class teacher assigned — pending notification.`,
            arrival: savedArrival,
            studentName: student.name,
            sclassName: student.sclassName?.sclassName || 'Class',
            teacherName: teacher?.name || 'Unassigned',
            duplicate: false,
            verified: Boolean(ctx.verified || ctx.mode === 'opaque'),
            mode: ctx.mode,
            notificationPending: !teacher,
        });
    } catch (error) {
        if (error && error.code === 11000 && req.body?.clientEventId) {
            const prior = await ParentArrival.findOne({ clientEventId: req.body.clientEventId });
            if (prior) {
                return res.send({
                    message: 'Pickup event already processed (idempotent replay).',
                    arrival: prior,
                    studentName: prior.studentName,
                    sclassName: prior.sclassNameStr,
                    teacherName: prior.teacherName,
                    duplicate: true,
                    idempotent: true,
                });
            }
        }
        const status = error.status || 500;
        return res.status(status).json({ message: error.message || 'Error processing parent QR scan' });
    }
};

// Fetch Active Parent Arrivals for Class Teacher or Frontdesk
const getParentArrivals = async (req, res) => {
    try {
        const { teacherId, sclassId, status } = req.query;
        const query = {};

        if (teacherId) {
            query.teacher = teacherId;
        }
        if (sclassId) {
            query.sclassName = sclassId;
        }
        if (status) {
            query.status = status;
        } else {
            // Default: show active waiting/acknowledged arrivals from last 24 hours
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            query.createdAt = { $gte: twentyFourHoursAgo };
        }

        const arrivals = await ParentArrival.find(query).sort({ createdAt: -1 }).limit(50);
        return res.send(arrivals);
    } catch (error) {
        return res.status(500).json(error);
    }
};

// Class Teacher / Gate status transitions
const updateArrivalStatus = async (req, res) => {
    try {
        const { arrivalId } = req.params;
        const { status, overrideReason, overrideBy, actorName, note } = req.body;

        const arrival = await ParentArrival.findById(arrivalId);
        if (!arrival) {
            return res.status(404).send({ message: 'Parent arrival record not found' });
        }

        const next = status || 'Student Dispatched';
        const from = arrival.status;
        try {
            assertTransition(from, next);
        } catch (e) {
            return res.status(e.status || 400).json({ message: e.message, from, to: next });
        }

        const by = actorName || overrideBy || arrival.scannedBy || 'staff';
        arrival.status = next;
        arrival.statusHistory = arrival.statusHistory || [];
        arrival.statusHistory.push({
            status: next,
            at: new Date(),
            by,
            note: note || overrideReason || '',
        });

        if (['Student Dispatched', 'HandedOver'].includes(next)) {
            arrival.dispatchTime = new Date();
            arrival.handoverAt = new Date();
        }
        if (next === 'CollectorVerified') {
            arrival.collectorVerifiedAt = new Date();
        }
        if (next === 'Exited') {
            arrival.exitTime = new Date();
            if (!arrival.dispatchTime) arrival.dispatchTime = new Date();
            if (!arrival.handoverAt) arrival.handoverAt = new Date();
        }
        if (next === 'Override') {
            arrival.overrideReason = overrideReason || '';
            arrival.overrideBy = overrideBy || by;
        }
        if (['TeacherNotified', 'Waiting at Frontdesk', 'Scanned', 'Acknowledged', 'Preparing', 'Ready'].includes(next)) {
            arrival.notificationPending = false;
        }

        await arrival.save();

        await writeAudit({
            school: arrival.school,
            action: next === 'Override'
                ? 'pickup.override'
                : (next === 'Rejected' ? 'pickup.reject' : 'pickup.status'),
            actorType: 'staff',
            actorName: by,
            resourceType: 'parentArrival',
            resourceId: String(arrival._id),
            detail: { from, to: next, overrideReason: overrideReason || '', note: note || '' },
        });

        return res.send(arrival);
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to update pickup status' });
    }
};

/** Pending pickup notifications for a teacher (P0.3). */
const getTeacherPickupNotifications = async (req, res) => {
    try {
        const { teacherId } = req.params;
        const rows = await NotificationOutbox.find({
            teacher: teacherId,
            type: 'pickup.scan',
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        }).sort({ createdAt: -1 }).limit(40);
        return res.send(rows);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createVisitor,
    listVisitors,
    updateVisitor,
    frontdeskLogin,
    lookupStudentQr,
    scanParentQr,
    getParentArrivals,
    updateArrivalStatus,
    getTeacherPickupNotifications,
};
