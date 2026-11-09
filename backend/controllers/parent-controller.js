const Parent = require('../models/parentSchema.js');
const Student = require('../models/studentSchema.js');
const Sclass = require('../models/sclassSchema.js');
const GuardianPass = require('../models/guardianPassSchema.js');
const AuthorisedCollector = require('../models/authorisedCollectorSchema.js');

async function syncStudentsField(parentDoc, studentId) {
    if (!parentDoc) return;
    parentDoc.students = parentDoc.students || [];
    const sid = String(studentId || parentDoc.student);
    const set = new Set(parentDoc.students.map(String));
    if (parentDoc.student) set.add(String(parentDoc.student));
    if (sid) set.add(sid);
    parentDoc.students = [...set];
    await parentDoc.save();
}

// login with roll number and last 5 digits of parent's mobile
const parentLogIn = async (req, res) => {
    try {
        const { rollNum, password } = req.body; // password: last 5 of mobile
        const student = await Student.findOne({ rollNum }).populate('school', 'schoolName');
        if (!student) return res.send({ message: 'Student not found' });
        // Match primary student OR any linked child in students[]
        let parent = await Parent.findOne({
            $or: [{ student: student._id }, { students: student._id }],
        });
        if (!parent) return res.send({ message: 'Parent not found' });
        const supplied = String(password ?? '').trim();
        const stored = String(parent.password || '').trim();
        const last5 = String(parent.mobile || '').slice(-5);
        const valid = stored ? stored === supplied : last5 === supplied;
        if (!valid) return res.send({ message: 'Invalid password' });
        await syncStudentsField(parent, student._id);
        parent = await Parent.findById(parent._id)
            .populate({ path: 'students', select: 'name rollNum sclassName', populate: { path: 'sclassName', select: 'sclassName' } })
            .populate({ path: 'student', select: 'name rollNum sclassName', populate: { path: 'sclassName', select: 'sclassName' } });
        const children = (parent.students && parent.students.length)
            ? parent.students
            : (parent.student ? [parent.student] : []);
        const payload = {
            _id: parent._id,
            name: parent.name,
            role: 'Parent',
            student: student._id,
            students: children.map((c) => ({
                _id: c._id,
                name: c.name,
                rollNum: c.rollNum,
                sclassName: c.sclassName?.sclassName || '',
            })),
            school: student.school,
        };
        res.send(payload);
    } catch (error) {
        res.status(500).json(error);
    }
};

// create or update parent for a student
const upsertParentForStudent = async (req, res) => {
    try {
        const { studentId, name, mobile, email, school } = req.body;
        const parent = await Parent.findOneAndUpdate(
            { student: studentId },
            { name, mobile, email, school, student: studentId, $addToSet: { students: studentId } },
            { new: true, upsert: true }
        );
        res.send(parent);
    } catch (error) {
        res.status(500).json(error);
    }
};

// create or update parent
const upsertParent = async (req, res) => {
    try {
        const { name, mobile, student, school } = req.body;
        const parent = await Parent.findOneAndUpdate(
            { student: student },
            { name, mobile, student, school },
            { new: true, upsert: true }
        );
        res.send(parent);
    } catch (error) {
        res.status(500).json(error);
    }
};

const createParentAccount = async (req, res) => {
    try {
        const { name, mobile, password, student, school } = req.body;
        const parentName = String(name || '').trim();
        const parentMobile = String(mobile || '').trim();
        const parentPassword = String(password || '').trim();

        if (!parentName || !parentMobile || !parentPassword || !student || !school) {
            return res.status(400).send({ message: 'Name, mobile, password, and student are required' });
        }
        if (parentPassword.length < 4) {
            return res.status(400).send({ message: 'Password must be at least 4 characters' });
        }

        const studentDoc = await Student.findById(student).populate('sclassName', 'sclassName');
        if (!studentDoc) {
            return res.status(400).send({ message: 'Student not found' });
        }
        if (String(studentDoc.school) !== String(school)) {
            return res.status(400).send({ message: 'That student is not in this school' });
        }

        const parent = await Parent.findOneAndUpdate(
            { student: studentDoc._id },
            {
                name: parentName,
                mobile: parentMobile,
                password: parentPassword,
                student: studentDoc._id,
                school,
                role: 'Parent',
                $addToSet: { students: studentDoc._id },
            },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        res.send({
            _id: parent._id,
            name: parent.name,
            mobile: parent.mobile,
            student: studentDoc._id,
            studentName: studentDoc.name,
            rollNum: studentDoc.rollNum,
            sclassName: studentDoc.sclassName?.sclassName || '',
            school: parent.school,
        });
    } catch (error) {
        res.status(500).json({ message: error.message || 'Could not create the parent account' });
    }
};

const listParents = async (req, res) => {
    try {
        const schoolId = req.params.id;
        const items = await Parent.find({ school: schoolId }).select('-password')
            .populate({
                path: 'student',
                select: 'name rollNum sclassName',
                populate: {
                    path: 'sclassName',
                    select: 'sclassName'
                }
            });
        res.send(items);
    } catch (error) {
        res.status(500).json(error);
    }
};

const parentDetail = async (req, res) => {
    try {
        const item = await Parent.findById(req.params.id).select('-password')
            .populate({
                path: 'student',
                select: 'name rollNum sclassName',
                populate: {
                    path: 'sclassName',
                    select: 'sclassName'
                }
            });
        if (!item) return res.send({ message: 'No parent found' });
        res.send(item);
    } catch (error) {
        res.status(500).json(error);
    }
};

// --- 24-HOUR TEMPORARY GUARDIAN PASS CONTROLLERS ---

const generateGuardianPassCode = async () => {
    let attempts = 0;
    while (attempts < 50) {
        const randomNum = Math.floor(100000 + Math.random() * 900000);
        const code = `G-${randomNum}`;
        const exists = await GuardianPass.exists({ passCode: code });
        if (!exists) return code;
        attempts++;
    }
    throw new Error('Could not generate unique pass code');
};

const createGuardianPass = async (req, res) => {
    try {
        const { parentId, guardianName, guardianPhone, relation } = req.body;
        if (!parentId || !guardianName) {
            return res.status(400).send({ message: 'Parent ID and Guardian Name are required' });
        }

        const parent = await Parent.findById(parentId).populate({
            path: 'student',
            populate: { path: 'sclassName', select: 'sclassName' }
        });

        if (!parent || !parent.student) {
            return res.status(404).send({ message: 'Parent or Student not found' });
        }

        const student = parent.student;
        const passCode = await generateGuardianPassCode();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 Hours

        const pass = new GuardianPass({
            passCode,
            guardianName,
            guardianPhone: guardianPhone || '',
            relation: relation || 'Guardian',
            parent: parent._id,
            student: student._id,
            studentName: student.name,
            rollNum: student.rollNum,
            sclassNameStr: student.sclassName?.sclassName || 'Class',
            school: parent.school,
            expiresAt
        });

        const savedPass = await pass.save();

        // Opaque temp credential for QR (no PII in payload)
        const {
            newCredentialId,
            buildOpaqueQrPayload,
            writeAudit,
        } = require('./guardian-credential-controller.js');
        const GuardianCredential = require('../models/guardianCredentialSchema.js');
        const cred = await GuardianCredential.create({
            credentialId: newCredentialId(),
            kind: 'temp_guardian',
            status: 'active',
            parent: parent._id,
            student: student._id,
            school: parent.school,
            collectorName: guardianName,
            collectorPhone: guardianPhone || '',
            guardianPass: savedPass._id,
            expiresAt,
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
            detail: { kind: 'temp_guardian', passCode: savedPass.passCode },
        });

        const qrPayload = buildOpaqueQrPayload(cred.credentialId, 1);
        return res.send({
            ...savedPass.toObject(),
            credentialId: cred.credentialId,
            qrPayload,
            qrString: JSON.stringify(qrPayload),
        });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Error creating Guardian Pass' });
    }
};

const guardianLogIn = async (req, res) => {
    try {
        let { passCode } = req.body;
        if (!passCode) {
            return res.status(400).send({ message: 'Pass Code is required' });
        }

        passCode = passCode.trim().toUpperCase();
        if (!passCode.startsWith('G-') && /^\d{6}$/.test(passCode)) {
            passCode = `G-${passCode}`;
        }

        const pass = await GuardianPass.findOne({ passCode, isActive: true });
        if (!pass) {
            return res.status(400).send({ message: 'Invalid or revoked 24-Hour Guardian Pass Code' });
        }

        if (new Date() > new Date(pass.expiresAt)) {
            return res.status(400).send({ message: 'This 24-Hour Guardian Pass has expired!' });
        }

        const GuardianCredential = require('../models/guardianCredentialSchema.js');
        const { buildOpaqueQrPayload, newCredentialId } = require('./guardian-credential-controller.js');
        let cred = await GuardianCredential.findOne({
            guardianPass: pass._id,
            status: 'active',
        });
        if (!cred) {
            cred = await GuardianCredential.create({
                credentialId: newCredentialId(),
                kind: 'temp_guardian',
                status: 'active',
                parent: pass.parent,
                student: pass.student,
                school: pass.school,
                collectorName: pass.guardianName,
                collectorPhone: pass.guardianPhone || '',
                guardianPass: pass._id,
                expiresAt: pass.expiresAt,
                version: 1,
            });
        }
        const qrPayload = buildOpaqueQrPayload(cred.credentialId, cred.version || 1);

        return res.send({
            _id: pass._id,
            role: 'Guardian',
            name: pass.guardianName,
            guardianName: pass.guardianName,
            passCode: pass.passCode,
            studentId: pass.student,
            studentName: pass.studentName,
            rollNum: pass.rollNum,
            sclassNameStr: pass.sclassNameStr,
            expiresAt: pass.expiresAt,
            parent: pass.parent,
            credentialId: cred.credentialId,
            qrPayload,
            qrString: JSON.stringify(qrPayload),
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const getGuardianPasses = async (req, res) => {
    try {
        const { parentId } = req.params;
        const passes = await GuardianPass.find({ parent: parentId, isActive: true, expiresAt: { $gt: new Date() } })
            .sort({ createdAt: -1 });
        return res.send(passes);
    } catch (error) {
        return res.status(500).json(error);
    }
};

const revokeGuardianPass = async (req, res) => {
    try {
        const { passId } = req.params;
        const pass = await GuardianPass.findByIdAndUpdate(passId, { isActive: false }, { new: true });
        if (pass) {
            const GuardianCredential = require('../models/guardianCredentialSchema.js');
            const { writeAudit } = require('./guardian-credential-controller.js');
            await GuardianCredential.updateMany(
                { guardianPass: pass._id, status: 'active' },
                { $set: { status: 'revoked', revokedAt: new Date(), revokeReason: 'Guardian pass revoked' } }
            );
            await writeAudit({
                school: pass.school,
                action: 'credential.revoke',
                actorType: 'parent',
                resourceType: 'guardianPass',
                resourceId: String(pass._id),
                detail: { reason: 'Guardian pass revoked' },
            });
        }
        return res.send(pass);
    } catch (error) {
        return res.status(500).json(error);
    }
};

/** Link an additional student to an existing parent (multi-child). */
const linkStudentToParent = async (req, res) => {
    try {
        const { parentId } = req.params;
        const { studentId, rollNum, schoolId } = req.body;
        const parent = await Parent.findById(parentId);
        if (!parent) return res.status(404).json({ message: 'Parent not found' });

        let student = null;
        if (studentId) student = await Student.findById(studentId);
        else if (rollNum) student = await Student.findOne({ rollNum, school: schoolId || parent.school });
        if (!student) return res.status(404).json({ message: 'Student not found' });
        if (String(student.school) !== String(parent.school)) {
            return res.status(400).json({ message: 'Student is not in this school' });
        }

        await syncStudentsField(parent, student._id);
        const updated = await Parent.findById(parentId)
            .populate({ path: 'students', select: 'name rollNum sclassName', populate: { path: 'sclassName', select: 'sclassName' } });
        return res.send({
            parentId: updated._id,
            students: (updated.students || []).map((c) => ({
                _id: c._id,
                name: c.name,
                rollNum: c.rollNum,
                sclassName: c.sclassName?.sclassName || '',
            })),
        });
    } catch (e) {
        return res.status(500).json({ message: e.message });
    }
};

const listParentChildren = async (req, res) => {
    try {
        const parent = await Parent.findById(req.params.parentId)
            .populate({ path: 'students', select: 'name rollNum sclassName imei', populate: { path: 'sclassName', select: 'sclassName' } })
            .populate({ path: 'student', select: 'name rollNum sclassName imei', populate: { path: 'sclassName', select: 'sclassName' } });
        if (!parent) return res.status(404).json({ message: 'Parent not found' });
        await syncStudentsField(parent, parent.student);
        const refreshed = await Parent.findById(parent._id)
            .populate({ path: 'students', select: 'name rollNum sclassName imei', populate: { path: 'sclassName', select: 'sclassName' } });
        const kids = refreshed.students || [];
        return res.send(kids.map((c) => ({
            _id: c._id,
            name: c.name,
            rollNum: c.rollNum,
            sclassName: c.sclassName?.sclassName || '',
            imei: c.imei || '',
        })));
    } catch (e) {
        return res.status(500).json({ message: e.message });
    }
};

const listCollectors = async (req, res) => {
    try {
        const { parentId } = req.params;
        const rows = await AuthorisedCollector.find({ parent: parentId, active: true }).sort({ createdAt: -1 });
        return res.send(rows);
    } catch (e) {
        return res.status(500).json({ message: e.message });
    }
};

/** Gate: collectors for a student (active + not expired). */
const listCollectorsForStudent = async (req, res) => {
    try {
        const { studentId } = req.params;
        const now = new Date();
        const rows = await AuthorisedCollector.find({
            student: studentId,
            active: true,
            $or: [{ expiresAt: null }, { expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }],
        }).select('+pinHash').populate('parent', 'name mobile').sort({ createdAt: -1 });
        return res.send(rows.map((r) => ({
            _id: r._id,
            name: r.name,
            relation: r.relation,
            phone: r.phone,
            photoUrl: r.photoUrl,
            parentName: r.parent?.name,
            approvedBySchool: r.approvedBySchool,
            hasPin: Boolean(r.pinHash),
        })));
    } catch (e) {
        return res.status(500).json({ message: e.message });
    }
};

const _hashPin = (pin) => {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(String(pin).trim()).digest('hex');
};

/**
 * Gate PIN fallback when QR is unavailable.
 * Body: { schoolId, pin, studentId? | rollNum? }
 */
const verifyGatePin = async (req, res) => {
    try {
        const { schoolId, pin, studentId, rollNum } = req.body || {};
        if (!schoolId || !pin) return res.status(400).json({ message: 'schoolId and pin required' });
        const pinStr = String(pin).trim();
        if (!/^\d{4,6}$/.test(pinStr)) {
            return res.status(400).json({ message: 'PIN must be 4–6 digits' });
        }

        let student = null;
        if (studentId) {
            student = await Student.findOne({ _id: studentId, school: schoolId });
        } else if (rollNum != null && rollNum !== '') {
            const roll = Number.isNaN(Number(rollNum)) ? rollNum : Number(rollNum);
            student = await Student.findOne({ school: schoolId, rollNum: roll })
                .populate('sclassName', 'sclassName');
        }
        if (!student) return res.status(404).json({ message: 'Student not found for PIN check' });

        const now = new Date();
        const hash = _hashPin(pinStr);
        const collector = await AuthorisedCollector.findOne({
            school: schoolId,
            student: student._id,
            active: true,
            pinHash: hash,
            $or: [{ expiresAt: null }, { expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }],
        }).select('+pinHash').populate('parent', 'name mobile');

        if (!collector) {
            return res.status(401).json({ message: 'Invalid PIN for this student' });
        }

        let teacherName = 'Unassigned';
        try {
            const Teacher = require('../models/teacherSchema.js');
            const t = await Teacher.findOne({ teachSclass: student.sclassName?._id || student.sclassName });
            if (t) teacherName = t.name;
        } catch (_) { /* optional */ }

        return res.send({
            verified: true,
            method: 'pin',
            collector: {
                _id: collector._id,
                name: collector.name,
                relation: collector.relation,
                phone: collector.phone,
                photoUrl: collector.photoUrl,
                parentName: collector.parent?.name,
            },
            studentId: student._id,
            studentName: student.name,
            rollNum: student.rollNum,
            sclassNameStr: student.sclassName?.sclassName || '',
            teacherName,
            parentName: collector.name,
        });
    } catch (e) {
        return res.status(500).json({ message: e.message });
    }
};

const createCollector = async (req, res) => {
    try {
        const { parentId } = req.params;
        const { studentId, name, relation, phone, notes, expiresAt, pin } = req.body;
        const parent = await Parent.findById(parentId);
        if (!parent) return res.status(404).json({ message: 'Parent not found' });
        if (!name) return res.status(400).json({ message: 'Collector name required' });
        const student = studentId || parent.student;
        const doc = {
            school: parent.school,
            parent: parent._id,
            student,
            name: String(name).trim(),
            relation: relation || 'Guardian',
            phone: phone || '',
            notes: notes || '',
            expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        };
        if (pin != null && String(pin).trim() !== '') {
            const pinStr = String(pin).trim();
            if (!/^\d{4,6}$/.test(pinStr)) {
                return res.status(400).json({ message: 'PIN must be 4–6 digits' });
            }
            doc.pinHash = _hashPin(pinStr);
        }
        const row = await AuthorisedCollector.create(doc);
        const out = row.toObject();
        delete out.pinHash;
        out.hasPin = Boolean(doc.pinHash);
        return res.send(out);
    } catch (e) {
        return res.status(500).json({ message: e.message });
    }
};

const revokeCollector = async (req, res) => {
    try {
        const { collectorId } = req.params;
        const row = await AuthorisedCollector.findByIdAndUpdate(
            collectorId,
            { active: false, revokedAt: new Date() },
            { new: true }
        );
        if (!row) return res.status(404).json({ message: 'Collector not found' });
        return res.send(row);
    } catch (e) {
        return res.status(500).json({ message: e.message });
    }
};

module.exports = {
    parentLogIn,
    upsertParentForStudent,
    upsertParent,
    createParentAccount,
    listParents,
    parentDetail,
    createGuardianPass,
    guardianLogIn,
    getGuardianPasses,
    revokeGuardianPass,
    linkStudentToParent,
    listParentChildren,
    listCollectors,
    listCollectorsForStudent,
    createCollector,
    revokeCollector,
    verifyGatePin,
};
