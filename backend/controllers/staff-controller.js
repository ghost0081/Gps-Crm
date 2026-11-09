const bcrypt = require('bcrypt');
const Staff = require('../models/staffSchema.js');

const staffRegister = async (req, res) => {
    const { name, email, password, mobile, address, role, school, salary, joiningDate, status } = req.body;
    
    // Validate required fields
    if (!name || !name.trim()) {
        return res.send({ message: 'Staff name is required' });
    }
    if (!email || !email.trim()) {
        return res.send({ message: 'Email is required' });
    }
    if (!password || !password.trim()) {
        return res.send({ message: 'Password is required' });
    }
    if (!role || !role.trim()) {
        return res.send({ message: 'Role is required' });
    }
    
    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPass = await bcrypt.hash(password, salt);

        const staffData = { 
            name: name.trim(), 
            email: email.trim(), 
            password: hashedPass, 
            role: role.trim(), 
            school, 
            status: status || 'Active'
        };

        // Only add optional fields if they have values
        if (mobile && mobile.trim()) staffData.mobile = mobile.trim();
        if (address && address.trim()) staffData.address = address.trim();
        if (salary) staffData.salary = Number(salary);
        if (joiningDate) staffData.joiningDate = joiningDate;

        console.log('Creating staff with data:', { name: staffData.name, email: staffData.email, role: staffData.role });

        const staff = new Staff(staffData);

        const existingStaffByEmail = await Staff.findOne({ email: staffData.email });

        if (existingStaffByEmail) {
            res.send({ message: 'Email already exists' });
        }
        else {
            let result = await staff.save();
            result.password = undefined;
            console.log('Staff created successfully:', { id: result._id, name: result.name });
            res.send(result);
        }
    } catch (err) {
        console.error('Error in staffRegister:', err);
        res.status(500).json(err);
    }
};

const staffLogIn = async (req, res) => {
    try {
        let staff = await Staff.findOne({ email: req.body.email });
        if (staff) {
            const validated = await bcrypt.compare(req.body.password, staff.password);
            if (validated) {
                staff = await staff.populate("school", "schoolName");
                staff.password = undefined;
                // Add role field to indicate user type (not job role)
            const jobRole = staff.role;
            const payload = { ...staff.toObject(), role: 'Staff', jobRole };
                res.send(payload);
            } else {
                res.send({ message: "Invalid password" });
            }
        } else {
            res.send({ message: "Staff not found" });
        }
    } catch (err) {
        res.status(500).json(err);
    }
};

const getStaff = async (req, res) => {
    try {
        let staff = await Staff.find({ school: req.params.id }).populate("school", "schoolName");
        if (staff.length > 0) {
            let modifiedStaff = staff.map((member) => {
                return { ...member._doc, password: undefined };
            });
            res.send(modifiedStaff);
        } else {
            res.send({ message: "No staff found" });
        }
    } catch (err) {
        res.status(500).json(err);
    }
};

const getStaffDetail = async (req, res) => {
    try {
        let staff = await Staff.findById(req.params.id).populate("school", "schoolName");
        if (staff) {
            staff.password = undefined;
            res.send(staff);
        }
        else {
            res.send({ message: "No staff found" });
        }
    } catch (err) {
        res.status(500).json(err);
    }
};

const updateStaff = async (req, res) => {
    try {
        const { name, email, mobile, address, role, salary, status } = req.body;

        if (req.body.password) {
            const salt = await bcrypt.genSalt(10);
            req.body.password = await bcrypt.hash(req.body.password, salt);
        }

        let result = await Staff.findByIdAndUpdate(
            req.params.id,
            { name, email, mobile, address, role, salary, status, password: req.body.password },
            { new: true }
        );
        result.password = undefined;
        res.send(result);
    } catch (error) {
        res.status(500).json(error);
    }
};

const deleteStaff = async (req, res) => {
    try {
        const deletedStaff = await Staff.findByIdAndDelete(req.params.id);
        res.send(deletedStaff);
    } catch (error) {
        res.status(500).json(error);
    }
};

const deleteAllStaff = async (req, res) => {
    try {
        const deletionResult = await Staff.deleteMany({ school: req.params.id });
        res.send(deletionResult);
    } catch (error) {
        res.status(500).json(error);
    }
};

const staffAttendance = async (req, res) => {
    const { status, date } = req.body;

    try {
        const staff = await Staff.findById(req.params.id);

        if (!staff) {
            return res.send({ message: 'Staff not found' });
        }

        const existingAttendance = staff.attendance.find(
            (a) =>
                a.date.toDateString() === new Date(date).toDateString()
        );

        if (existingAttendance) {
            existingAttendance.status = status;
        } else {
            staff.attendance.push({ date, status });
        }

        const result = await staff.save();
        return res.send(result);
    } catch (error) {
        res.status(500).json(error);
    }
};

module.exports = {
    staffRegister,
    staffLogIn,
    getStaff,
    getStaffDetail,
    updateStaff,
    deleteStaff,
    deleteAllStaff,
    staffAttendance
};

