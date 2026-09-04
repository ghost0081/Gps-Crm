const Parent = require('../models/parentSchema.js');
const Student = require('../models/studentSchema.js');
const Sclass = require('../models/sclassSchema.js');
const GuardianPass = require('../models/guardianPassSchema.js');

// login with roll number and last 5 digits of parent's mobile
const parentLogIn = async (req, res) => {
    try {
        const { rollNum, password } = req.body; // password: last 5 of mobile
        const student = await Student.findOne({ rollNum }).populate('school', 'schoolName');
        if (!student) return res.send({ message: 'Student not found' });
        const parent = await Parent.findOne({ student: student._id });
        if (!parent) return res.send({ message: 'Parent not found' });
        const last5 = (parent.mobile || '').slice(-5);
        if (last5 !== password) return res.send({ message: 'Invalid password' });
        const payload = { _id: parent._id, name: parent.name, role: 'Parent', student: student._id, school: student.school };
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
            { name, mobile, email, school, student: studentId },
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

const listParents = async (req, res) => {
    try {
        const schoolId = req.params.id;
        const items = await Parent.find({ school: schoolId })
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
        const item = await Parent.findById(req.params.id)
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
        return res.send(savedPass);
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
            parent: pass.parent
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
        return res.send(pass);
    } catch (error) {
        return res.status(500).json(error);
    }
};

module.exports = {
    parentLogIn,
    upsertParentForStudent,
    upsertParent,
    listParents,
    parentDetail,
    createGuardianPass,
    guardianLogIn,
    getGuardianPasses,
    revokeGuardianPass
};
