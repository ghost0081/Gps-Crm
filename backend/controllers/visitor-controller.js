const Visitor = require('../models/visitorSchema.js');
const ParentArrival = require('../models/parentArrivalSchema.js');
const Student = require('../models/studentSchema.js');
const Teacher = require('../models/teacherSchema.js');
const Sclass = require('../models/sclassSchema.js');
const Admin = require('../models/adminSchema.js');

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
                schoolName: admin.schoolName
            });
        }

        // Default FrontDesk fallback login
        if ((email.toLowerCase() === 'frontdesk@school.com' || email.toLowerCase() === 'frontdesk') && password === '123456') {
            return res.send({
                _id: 'frontdesk_default_id',
                name: 'FrontDesk Gatekeeper Staff',
                email: 'frontdesk@school.com',
                role: 'FrontDesk',
                schoolName: 'Main School'
            });
        }

        return res.status(400).send({ message: 'Invalid FrontDesk credentials' });
    } catch (error) {
        return res.status(500).json(error);
    }
};

// Scan Parent QR Code / Log Student Gate Pass Arrival
const scanParentQr = async (req, res) => {
    try {
        const { studentId, rollNum, sclassNameStr, parentName, parentPhone, scannedBy } = req.body;

        let student = null;
        if (studentId) {
            student = await Student.findById(studentId).populate('sclassName');
        } else if (rollNum) {
            student = await Student.findOne({ rollNum: Number(rollNum) }).populate('sclassName');
        }

        if (!student) {
            return res.status(404).send({ message: 'Student not found for scanned QR code' });
        }

        // Find assigned Class Teacher
        const classId = student.sclassName?._id || student.sclassName;
        let teacher = null;
        if (classId) {
            teacher = await Teacher.findOne({ teachSclass: classId });
        }

        const arrival = new ParentArrival({
            student: student._id,
            studentName: student.name,
            rollNum: student.rollNum,
            sclassName: classId,
            sclassNameStr: student.sclassName?.sclassName || sclassNameStr || 'Class',
            teacher: teacher?._id || null,
            teacherName: teacher?.name || 'Class Teacher',
            school: student.school,
            parentName: parentName || 'Parent',
            parentPhone: parentPhone || '',
            status: 'Waiting at Frontdesk',
            scannedBy: scannedBy || 'FrontDesk Gatekeeper'
        });

        const savedArrival = await arrival.save();

        return res.send({
            message: `Parent of ${student.name} logged at FrontDesk. Class Teacher notified!`,
            arrival: savedArrival,
            studentName: student.name,
            sclassName: student.sclassName?.sclassName || 'Class',
            teacherName: teacher?.name || 'Unassigned'
        });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Error processing parent QR scan' });
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

// Class Teacher Acknowledge / Dispatch Student
const updateArrivalStatus = async (req, res) => {
    try {
        const { arrivalId } = req.params;
        const { status } = req.body;

        const updatePayload = {
            status: status || 'Student Dispatched'
        };
        if (status === 'Student Dispatched') {
            updatePayload.dispatchTime = new Date();
        }

        const arrival = await ParentArrival.findByIdAndUpdate(arrivalId, updatePayload, { new: true });
        if (!arrival) {
            return res.status(404).send({ message: 'Parent arrival record not found' });
        }

        return res.send(arrival);
    } catch (error) {
        return res.status(500).json(error);
    }
};

module.exports = {
    createVisitor,
    listVisitors,
    updateVisitor,
    frontdeskLogin,
    scanParentQr,
    getParentArrivals,
    updateArrivalStatus
};
