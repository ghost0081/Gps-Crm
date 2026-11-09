const mongoose = require('mongoose');
const Admin = require('../models/adminSchema');
const Staff = require('../models/staffSchema');
const Student = require('../models/studentSchema');
const Fee = require('../models/feeSchema');
const FeeInvoice = require('../models/feeInvoiceSchema');
const DesignTemplate = require('../models/designTemplateSchema');
const ReceiptAssignment = require('../models/receiptAssignmentSchema');
const { DOCUMENT_TYPES } = ReceiptAssignment;
const { fillTemplatePages } = require('./design-studio-controller');

function fail(res, status, message) {
    res.status(status).json({ message });
}

async function requireAdmin(schoolId) {
    if (!mongoose.isValidObjectId(schoolId)) return null;
    return Admin.findById(schoolId).select('name email schoolName role');
}

async function requireAccountant(staffId) {
    if (!mongoose.isValidObjectId(staffId)) return null;
    const staff = await Staff.findById(staffId).select('name role school status');
    if (!staff || staff.role !== 'Accountant' || staff.status === 'Inactive') return null;
    return staff;
}

async function resolveAssignment({ schoolId, studentId, documentType }) {
    if (!DOCUMENT_TYPES.includes(documentType)) {
        return { error: 'That document type is not used for fee receipts.', status: 400 };
    }
    const student = await Student.findOne({ _id: studentId, school: schoolId }).select('name rollNum sclassName school');
    if (!student) return { error: 'That student is not in this school.', status: 403 };
    const base = { school: schoolId, department: 'accounts', documentType };
    const studentAssignment = await ReceiptAssignment.findOne({ ...base, scope: 'student', student: student._id }).populate('template', 'name category');
    if (studentAssignment) return { assignment: studentAssignment, student, level: 'student' };
    const classAssignment = await ReceiptAssignment.findOne({ ...base, scope: 'class', sclassName: student.sclassName }).populate('template', 'name category');
    if (classAssignment) return { assignment: classAssignment, student, level: 'class' };
    const departmentAssignment = await ReceiptAssignment.findOne({ ...base, scope: 'department' }).populate('template', 'name category');
    if (departmentAssignment) return { assignment: departmentAssignment, student, level: 'department' };
    return {
        error: 'No receipt template is assigned for this student. Ask an administrator to assign one before printing.',
        status: 404,
        student,
    };
}

const listAssignments = async (req, res) => {
    try {
        const admin = await requireAdmin(req.query.schoolId);
        if (!admin) return fail(res, 403, 'Only a school administrator can view template assignments.');
        const rows = await ReceiptAssignment.find({ school: req.query.schoolId, department: 'accounts' })
            .populate('template', 'name category')
            .populate('student', 'name rollNum')
            .populate('sclassName', 'sclassName')
            .lean();
        res.json(rows);
    } catch (error) {
        fail(res, 500, error.message);
    }
};

const saveAssignment = async (req, res) => {
    try {
        const admin = await requireAdmin(req.body.schoolId);
        if (!admin) return fail(res, 403, 'Only a school administrator can assign receipt templates.');
        const { documentType, scope, templateId, studentId, classId } = req.body;
        if (!DOCUMENT_TYPES.includes(documentType)) return fail(res, 400, 'Choose a fee receipt document type.');
        if (!['department', 'class', 'student'].includes(scope)) return fail(res, 400, 'Choose a department, class, or student assignment.');
        const template = await DesignTemplate.findOne({ _id: templateId, school: req.body.schoolId }).select('name category');
        if (!template) return fail(res, 404, 'That design belongs to another school or does not exist.');
        if (template.category !== documentType) {
            return fail(res, 400, 'The design category must match the document type.');
        }
        const query = {
            school: req.body.schoolId,
            department: 'accounts',
            documentType,
            scope,
            student: scope === 'student' ? studentId : null,
            sclassName: scope === 'class' ? classId : null,
        };
        if (scope === 'student' && !mongoose.isValidObjectId(studentId)) return fail(res, 400, 'Choose a student.');
        if (scope === 'class' && !mongoose.isValidObjectId(classId)) return fail(res, 400, 'Choose a class.');
        if (scope === 'student') {
            const student = await Student.findOne({ _id: studentId, school: req.body.schoolId }).select('_id');
            if (!student) return fail(res, 403, 'That student is not in this school.');
        }
        const saved = await ReceiptAssignment.findOneAndUpdate(
            query,
            { ...query, template: template._id },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        res.json(saved);
    } catch (error) {
        fail(res, 500, error.message);
    }
};

const removeAssignment = async (req, res) => {
    try {
        const admin = await requireAdmin(req.query.schoolId);
        if (!admin) return fail(res, 403, 'Only a school administrator can remove template assignments.');
        const removed = await ReceiptAssignment.findOneAndDelete({ _id: req.params.id, school: req.query.schoolId });
        if (!removed) return fail(res, 404, 'Assignment not found.');
        res.json({ ok: true });
    } catch (error) {
        fail(res, 500, error.message);
    }
};

const listAccountStudents = async (req, res) => {
    try {
        const staff = await requireAccountant(req.query.staffId);
        if (!staff) return fail(res, 403, 'Only the Account Department can open fee receipts.');
        const students = await Student.find({ school: staff.school }).select('name rollNum sclassName').populate('sclassName', 'sclassName').lean();
        res.json(students);
    } catch (error) {
        fail(res, 500, error.message);
    }
};

const listAccountFees = async (req, res) => {
    try {
        const staff = await requireAccountant(req.query.staffId);
        if (!staff) return fail(res, 403, 'Only the Account Department can open fee receipts.');
        const student = await Student.findOne({ _id: req.query.studentId, school: staff.school }).select('_id');
        if (!student) return fail(res, 403, 'That student is not available to this department.');
        const fees = await Fee.find({ student: student._id, school: staff.school })
            .select('month amount status paymentMethod paidDate remarks duration')
            .sort({ month: -1 })
            .lean();
        res.json(fees);
    } catch (error) {
        fail(res, 500, error.message);
    }
};

const resolveAccountTemplate = async (req, res) => {
    try {
        const staff = await requireAccountant(req.query.staffId);
        if (!staff) return fail(res, 403, 'Only the Account Department can open fee receipts.');
        const resolved = await resolveAssignment({
            schoolId: staff.school,
            studentId: req.query.studentId,
            documentType: req.query.documentType,
        });
        if (resolved.error) return fail(res, resolved.status, resolved.error);
        res.json({
            level: resolved.level,
            templateId: resolved.assignment.template._id || resolved.assignment.template,
            templateName: resolved.assignment.template.name,
            documentType: resolved.assignment.documentType,
            studentName: resolved.student.name,
        });
    } catch (error) {
        fail(res, 500, error.message);
    }
};

const previewAccountReceipt = async (req, res) => {
    try {
        const staff = await requireAccountant(req.body.staffId);
        if (!staff) return fail(res, 403, 'Only the Account Department can open fee receipts.');
        const fee = await Fee.findOne({ _id: req.body.feeId, school: staff.school, student: req.body.studentId }).lean();
        if (!fee) return fail(res, 403, 'That fee transaction is not available to this department.');
        const resolved = await resolveAssignment({
            schoolId: staff.school,
            studentId: fee.student,
            documentType: req.body.documentType,
        });
        if (resolved.error) return fail(res, resolved.status, resolved.error);
        const template = await DesignTemplate.findOne({
            _id: resolved.assignment.template._id || resolved.assignment.template,
            school: staff.school,
        }).lean();
        if (!template) return fail(res, 404, 'The assigned design is no longer available.');
        const invoice = await FeeInvoice.findOne({
            school: staff.school,
            student: fee.student,
            month: fee.month,
        }).select('_id').lean();
        const admin = await Admin.findById(staff.school).select('name email schoolName role');
        const filled = await fillTemplatePages({
            schoolId: staff.school,
            admin,
            pages: template.pages,
            anchors: {
                student: fee.student,
                fee: fee._id,
                feeInvoice: invoice ? invoice._id : undefined,
                sclass: resolved.student.sclassName,
            },
        });
        res.json({
            template,
            level: resolved.level,
            templateName: template.name,
            studentName: resolved.student.name,
            fee,
            values: filled.values,
            warnings: filled.warnings,
        });
    } catch (error) {
        fail(res, 500, error.message);
    }
};

module.exports = {
    listAssignments,
    saveAssignment,
    removeAssignment,
    listAccountStudents,
    listAccountFees,
    resolveAccountTemplate,
    previewAccountReceipt,
    resolveAssignment,
};
