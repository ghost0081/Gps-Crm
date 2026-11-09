const GuardianCredential = require('../models/guardianCredentialSchema.js');
const AuditLog = require('../models/auditLogSchema.js');
const Parent = require('../models/parentSchema.js');
const {
    newCredentialId,
    buildOpaqueQrPayload,
    verifyCredentialSignature,
} = require('../utils/qrCredential.js');

async function writeAudit({ school, action, actorType, actorId, actorName, resourceType, resourceId, detail }) {
    try {
        await AuditLog.create({
            school,
            action,
            actorType: actorType || 'system',
            actorId: actorId || '',
            actorName: actorName || '',
            resourceType: resourceType || '',
            resourceId: resourceId || '',
            detail: detail || {},
        });
    } catch (err) {
        console.error('audit log failed', err.message);
    }
}

function toClientCredential(doc) {
    const payload = buildOpaqueQrPayload(doc.credentialId, doc.version || 1);
    return {
        credentialId: doc.credentialId,
        kind: doc.kind,
        status: doc.status,
        version: doc.version || 1,
        collectorName: doc.collectorName,
        student: doc.student,
        parent: doc.parent,
        school: doc.school,
        expiresAt: doc.expiresAt,
        issuedAt: doc.createdAt,
        qrPayload: payload,
        qrString: JSON.stringify(payload),
    };
}

/** Issue once (or return existing active) permanent parent credential. */
const ensureParentCredential = async (req, res) => {
    try {
        const { parentId } = req.params;
        const parent = await Parent.findById(parentId);
        if (!parent || !parent.student) {
            return res.status(404).send({ message: 'Parent or linked student not found' });
        }

        let cred = await GuardianCredential.findOne({
            parent: parent._id,
            student: parent.student,
            kind: 'parent',
            status: 'active',
        });

        if (!cred) {
            cred = await GuardianCredential.create({
                credentialId: newCredentialId(),
                kind: 'parent',
                status: 'active',
                parent: parent._id,
                student: parent.student,
                school: parent.school,
                collectorName: parent.name || 'Parent',
                collectorPhone: parent.mobile || '',
                version: 1,
            });
            await writeAudit({
                school: parent.school,
                action: 'credential.issue',
                actorType: 'parent',
                actorId: String(parent._id),
                actorName: parent.name,
                resourceType: 'guardianCredential',
                resourceId: cred.credentialId,
                detail: { kind: 'parent' },
            });
        }

        return res.send(toClientCredential(cred));
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to ensure credential' });
    }
};

/** Revoke current parent credential and issue a replacement. */
const replaceParentCredential = async (req, res) => {
    try {
        const { parentId } = req.params;
        const { reason } = req.body || {};
        const parent = await Parent.findById(parentId);
        if (!parent || !parent.student) {
            return res.status(404).send({ message: 'Parent or linked student not found' });
        }

        const existing = await GuardianCredential.find({
            parent: parent._id,
            student: parent.student,
            kind: 'parent',
            status: 'active',
        });

        const newId = newCredentialId();
        for (const old of existing) {
            old.status = 'revoked';
            old.revokedAt = new Date();
            old.revokeReason = reason || 'Replaced by parent';
            old.replacedBy = newId;
            await old.save();
            await writeAudit({
                school: parent.school,
                action: 'credential.revoke',
                actorType: 'parent',
                actorId: String(parent._id),
                actorName: parent.name,
                resourceType: 'guardianCredential',
                resourceId: old.credentialId,
                detail: { reason: old.revokeReason, replacedBy: newId },
            });
        }

        const cred = await GuardianCredential.create({
            credentialId: newId,
            kind: 'parent',
            status: 'active',
            parent: parent._id,
            student: parent.student,
            school: parent.school,
            collectorName: parent.name || 'Parent',
            collectorPhone: parent.mobile || '',
            version: 1,
        });

        await writeAudit({
            school: parent.school,
            action: 'credential.replace',
            actorType: 'parent',
            actorId: String(parent._id),
            actorName: parent.name,
            resourceType: 'guardianCredential',
            resourceId: cred.credentialId,
            detail: { reason: reason || 'Replaced by parent' },
        });

        return res.send(toClientCredential(cred));
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to replace credential' });
    }
};

const revokeCredential = async (req, res) => {
    try {
        const { credentialId } = req.params;
        const { reason, actorType, actorId, actorName } = req.body || {};
        const cred = await GuardianCredential.findOne({ credentialId });
        if (!cred) {
            return res.status(404).send({ message: 'Credential not found' });
        }
        if (cred.status !== 'active') {
            return res.send(toClientCredential(cred));
        }
        cred.status = 'revoked';
        cred.revokedAt = new Date();
        cred.revokeReason = reason || 'Revoked';
        await cred.save();
        await writeAudit({
            school: cred.school,
            action: 'credential.revoke',
            actorType: actorType || 'admin',
            actorId: actorId || '',
            actorName: actorName || '',
            resourceType: 'guardianCredential',
            resourceId: cred.credentialId,
            detail: { reason: cred.revokeReason },
        });
        return res.send(toClientCredential(cred));
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to revoke credential' });
    }
};

/** Compact list for gate cache sync (P0.2) — includes student snapshot for offline display. */
const getGateCredentialCache = async (req, res) => {
    try {
        const { schoolId } = req.params;
        if (!schoolId) {
            return res.status(400).send({ message: 'schoolId required' });
        }

        const Student = require('../models/studentSchema.js');
        const Teacher = require('../models/teacherSchema.js');

        const syncedAt = new Date();
        const rows = await GuardianCredential.find({
            school: schoolId,
            status: { $in: ['active', 'revoked'] },
        })
            .select('credentialId status kind expiresAt collectorName collectorPhone student parent revokedAt updatedAt')
            .lean();

        const studentIds = [...new Set(rows.map((r) => String(r.student)).filter(Boolean))];
        const students = await Student.find({ _id: { $in: studentIds } })
            .populate('sclassName', 'sclassName')
            .select('name rollNum sclassName school')
            .lean();
        const studentMap = Object.fromEntries(students.map((s) => [String(s._id), s]));

        const classIds = [...new Set(students.map((s) => String(s.sclassName?._id || s.sclassName || '')).filter(Boolean))];
        const teachers = await Teacher.find({ teachSclass: { $in: classIds } }).select('name teachSclass').lean();
        const teacherByClass = {};
        for (const t of teachers) {
            const cid = String(t.teachSclass);
            if (!teacherByClass[cid]) teacherByClass[cid] = t;
        }

        const now = Date.now();
        const credentials = rows.map((r) => {
            let status = r.status;
            if (status === 'active' && r.expiresAt && new Date(r.expiresAt).getTime() < now) {
                status = 'expired';
            }
            const student = studentMap[String(r.student)];
            const classId = student ? String(student.sclassName?._id || student.sclassName || '') : '';
            const teacher = classId ? teacherByClass[classId] : null;
            return {
                credentialId: r.credentialId,
                status,
                kind: r.kind,
                expiresAt: r.expiresAt,
                collectorName: r.collectorName,
                collectorPhone: r.collectorPhone || '',
                studentId: r.student,
                parentId: r.parent,
                studentName: student?.name || '',
                rollNum: student?.rollNum ?? null,
                sclassNameStr: student?.sclassName?.sclassName || '',
                teacherId: teacher?._id || null,
                teacherName: teacher?.name || 'Unassigned',
                revokedAt: r.revokedAt,
                updatedAt: r.updatedAt,
            };
        });

        return res.send({
            schoolId,
            syncedAt,
            count: credentials.length,
            credentials,
            staleAfterHours: 24,
        });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to load credential cache' });
    }
};

/** Resolve opaque QR (or legacy PII QR) to student + collector context. */
async function resolveQrToContext(body) {
    const { cid, credentialId, v, sig, studentId, rollNum, parentName, parentPhone } = body || {};
    const opaqueId = cid || credentialId;

    if (opaqueId) {
        const version = Number(v) || 1;
        if (sig && !verifyCredentialSignature(opaqueId, sig, version)) {
            const err = new Error('Invalid credential signature');
            err.status = 401;
            throw err;
        }

        const cred = await GuardianCredential.findOne({ credentialId: opaqueId });
        if (!cred) {
            const err = new Error('Unknown gate credential');
            err.status = 404;
            throw err;
        }
        if (cred.status === 'revoked') {
            const err = new Error('This gate pass has been revoked. Ask the school for a replacement.');
            err.status = 403;
            throw err;
        }
        if (cred.expiresAt && new Date(cred.expiresAt).getTime() < Date.now()) {
            if (cred.status === 'active') {
                cred.status = 'expired';
                await cred.save();
            }
            const err = new Error('This gate pass has expired');
            err.status = 403;
            throw err;
        }
        if (cred.status !== 'active') {
            const err = new Error('Credential is not active');
            err.status = 403;
            throw err;
        }

        return {
            mode: 'opaque',
            credential: cred,
            studentQuery: { _id: cred.student },
            parentName: cred.collectorName || 'Parent',
            parentPhone: cred.collectorPhone || '',
            verified: Boolean(sig && verifyCredentialSignature(opaqueId, sig, version)),
        };
    }

    // Legacy transition: rollNum / studentId payloads
    return {
        mode: 'legacy',
        credential: null,
        studentQuery: studentId
            ? { _id: studentId }
            : { rollNum: Number(rollNum) },
        parentName: parentName || 'Parent',
        parentPhone: parentPhone || '',
        verified: false,
    };
}

module.exports = {
    ensureParentCredential,
    replaceParentCredential,
    revokeCredential,
    getGateCredentialCache,
    resolveQrToContext,
    toClientCredential,
    writeAudit,
    newCredentialId,
    buildOpaqueQrPayload,
};
