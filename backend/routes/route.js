/**
 * Route definitions.
 *
 * Auth & RBAC policy applied:
 *
 *   PUBLIC  — no token required (auth endpoints, BLE telemetry from devices)
 *   protect — valid JWT required (any role)
 *   allow() — valid JWT + specific role(s) required
 *
 * Role hierarchy:
 *   Admin        — full administrative access
 *   Teacher      — class, student, attendance, assignment, and leave access
 *   Staff        — own staff records, attendance, copies
 *   Parent       — own student details, tracker data, guardian passes
 *   Guardian     — temporary passes for pickup & tracking
 *   FrontDesk    — visitor arrival and dispatch management
 */

const router = require('express').Router();

// ── Middleware ────────────────────────────────────────────────────────────────
const { protect, allow } = require('../middleware/auth');
const { loginLimiter, bleTelemetryLimiter } = require('../middleware/rateLimiter');

// ── Controllers ───────────────────────────────────────────────────────────────
const { adminRegister, adminLogIn, getAdminDetail } = require('../controllers/admin-controller.js');

const { sclassCreate, sclassList, deleteSclass, deleteSclasses, getSclassDetail, getSclassStudents } = require('../controllers/class-controller.js');
const { complainCreate, complainList } = require('../controllers/complain-controller.js');
const { noticeCreate, noticeList, deleteNotices, deleteNotice, updateNotice } = require('../controllers/notice-controller.js');
const {
    studentRegister,
    studentLogIn,
    getStudents,
    getStudentDetail,
    deleteStudents,
    deleteStudent,
    updateStudent,
    studentAttendance,
    deleteStudentsByClass,
    updateExamResult,
    clearAllStudentsAttendanceBySubject,
    clearAllStudentsAttendance,
    removeStudentAttendanceBySubject,
    removeStudentAttendance,
    studentAttendanceBulk,
    registerStudentFace,
    markAttendanceByFace,
} = require('../controllers/student_controller.js');
const { subjectCreate, classSubjects, deleteSubjectsByClass, getSubjectDetail, deleteSubject, freeSubjectList, allSubjects, deleteSubjects } = require('../controllers/subject-controller.js');

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const { teacherRegister, teacherLogIn, getTeachers, getTeacherDetail, deleteTeachers, deleteTeachersByClass, deleteTeacher, updateTeacherSubject, teacherAttendance } = require('../controllers/teacher-controller.js');
const { createAssignment, listAssignments, submitAssignment, reviewAssignment, setAssignmentStatus } = require('../controllers/assignment-controller.js');
const { createLeave, listTeacherLeaves, listSchoolLeaves, setLeaveStatus } = require('../controllers/leave-controller.js');
const { upsertClassDay, getClassTimetable, getTeacherTimetable } = require('../controllers/timetable-controller.js');
const { parentLogIn, upsertParentForStudent, upsertParent, listParents, parentDetail, createGuardianPass, guardianLogIn, getGuardianPasses, revokeGuardianPass } = require('../controllers/parent-controller.js');
const { staffRegister, staffLogIn, getStaff, getStaffDetail, updateStaff, deleteStaff, deleteAllStaff, staffAttendance } = require('../controllers/staff-controller.js');
const { getFeesByClass, updateFeeStatus, bulkRegisterFees, getStudentFeeHistory, getFeesSummary } = require('../controllers/fee-controller.js');
const { getPayrollByStaff, getPayrollByEmployee, getPayrollBySchool, updatePayrollStatus, getStaffPayrollHistory, getEmployeePayrollHistory, getPayrollSummary } = require('../controllers/payroll-controller.js');
const { getFinancialAccounting } = require('../controllers/financial-controller.js');
const { getStationery, getStationeryDetail, addStationery, updateStationery, deleteStationery, createInvoice, getInvoices, getInvoiceDetail, deleteInvoice } = require('../controllers/stationery-controller.js');
const { getAttendanceReport, getFeesReport } = require('../controllers/report-controller.js');
const { createVisitor, listVisitors, updateVisitor, frontdeskLogin, lookupStudentQr, scanParentQr, getParentArrivals, updateArrivalStatus } = require('../controllers/visitor-controller.js');
const { importBooks, searchBooks, uploadMiddleware } = require('../controllers/books-controller.js');
const { createCopy, listCopies } = require('../controllers/copies-controller.js');
const { getDeviceData, getActiveDevices, updateGeofence, uploadBleTelemetry, addStudentTracker, removeStudentTracker, getDeviceHistory } = require('../controllers/tracker-controller.js');

// ════════════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES  (No token required)
// ════════════════════════════════════════════════════════════════════════════

// Admin auth
router.post('/AdminReg', adminRegister);
router.post('/AdminLogin', loginLimiter, adminLogIn);

// Student auth
router.post('/StudentReg', studentRegister);
router.post('/StudentLogin', loginLimiter, studentLogIn);

// Teacher auth
router.post('/TeacherReg', teacherRegister);
router.post('/TeacherLogin', loginLimiter, teacherLogIn);

// Staff auth
router.post('/StaffReg', staffRegister);
router.post('/StaffLogin', loginLimiter, staffLogIn);

// Parent / Guardian auth
router.post('/ParentLogin', loginLimiter, parentLogIn);
router.post('/GuardianLogin', loginLimiter, guardianLogIn);

// FrontDesk auth
router.post('/FrontDeskLogin', loginLimiter, frontdeskLogin);

// BLE Telemetry — raw IoT device-to-server push
router.post('/api/tracker/ble-telemetry', bleTelemetryLimiter, uploadBleTelemetry);

// ════════════════════════════════════════════════════════════════════════════
// PROTECTED ROUTES  (Valid Bearer JWT required for all below)
// ════════════════════════════════════════════════════════════════════════════

// ── Admin ───────────────────────────────────────────────────────────────────
router.get('/Admin/:id', protect, allow('Admin'), getAdminDetail);

// ── Students ─────────────────────────────────────────────────────────────────
router.get('/Students/:id', protect, allow('Admin'), getStudents);
router.get('/Student/:id', protect, allow('Admin', 'Teacher', 'Staff', 'Parent', 'Guardian'), getStudentDetail);
router.put('/Student/:id', protect, allow('Admin'), updateStudent);
router.delete('/Students/:id', protect, allow('Admin'), deleteStudents);
router.delete('/StudentsClass/:id', protect, allow('Admin'), deleteStudentsByClass);
router.delete('/Student/:id', protect, allow('Admin'), deleteStudent);

router.put('/UpdateExamResult/:id', protect, allow('Admin', 'Teacher'), updateExamResult);
router.put('/StudentAttendance/:id', protect, allow('Admin', 'Teacher'), studentAttendance);
router.put('/StudentsAttendanceBulk', protect, allow('Admin', 'Teacher'), studentAttendanceBulk);
router.put('/RemoveAllStudentsSubAtten/:id', protect, allow('Admin', 'Teacher'), clearAllStudentsAttendanceBySubject);
router.put('/RemoveAllStudentsAtten/:id', protect, allow('Admin'), clearAllStudentsAttendance);
router.put('/RemoveStudentSubAtten/:id', protect, allow('Admin', 'Teacher'), removeStudentAttendanceBySubject);
router.put('/RemoveStudentAtten/:id', protect, allow('Admin'), removeStudentAttendance);

// Face Recognition
router.post('/Attendance/RegisterFace/:id', protect, allow('Admin', 'Teacher'), upload.array('images', 5), registerStudentFace);
router.post('/Attendance/MarkFace', protect, allow('Admin', 'Teacher'), upload.single('image'), markAttendanceByFace);

// ── Teachers ──────────────────────────────────────────────────────────────────
router.get('/Teachers/:id', protect, allow('Admin'), getTeachers);
router.get('/Teacher/:id', protect, allow('Admin', 'Teacher'), getTeacherDetail);
router.delete('/Teachers/:id', protect, allow('Admin'), deleteTeachers);
router.delete('/TeachersClass/:id', protect, allow('Admin'), deleteTeachersByClass);
router.delete('/Teacher/:id', protect, allow('Admin'), deleteTeacher);
router.put('/TeacherSubject', protect, allow('Admin'), updateTeacherSubject);
router.post('/TeacherAttendance/:id', protect, allow('Admin', 'Teacher'), teacherAttendance);

// ── Classes ───────────────────────────────────────────────────────────────────
router.post('/SclassCreate', protect, allow('Admin'), sclassCreate);
router.get('/SclassList/:id', protect, allow('Admin', 'Teacher', 'Staff'), sclassList);
router.get('/Sclass/:id', protect, allow('Admin', 'Teacher', 'Staff'), getSclassDetail);
router.get('/Sclass/Students/:id', protect, allow('Admin', 'Teacher'), getSclassStudents);
router.delete('/Sclasses/:id', protect, allow('Admin'), deleteSclasses);
router.delete('/Sclass/:id', protect, allow('Admin'), deleteSclass);

// ── Subjects ──────────────────────────────────────────────────────────────────
router.post('/SubjectCreate', protect, allow('Admin'), subjectCreate);
router.get('/AllSubjects/:id', protect, allow('Admin', 'Teacher'), allSubjects);
router.get('/ClassSubjects/:id', protect, allow('Admin', 'Teacher', 'Student'), classSubjects);
router.get('/FreeSubjectList/:id', protect, allow('Admin'), freeSubjectList);
router.get('/Subject/:id', protect, allow('Admin', 'Teacher'), getSubjectDetail);
router.delete('/Subject/:id', protect, allow('Admin'), deleteSubject);
router.delete('/Subjects/:id', protect, allow('Admin'), deleteSubjects);
router.delete('/SubjectsClass/:id', protect, allow('Admin'), deleteSubjectsByClass);

// ── Notices ───────────────────────────────────────────────────────────────────
router.post('/NoticeCreate', protect, allow('Admin'), noticeCreate);
router.get('/NoticeList/:id', protect, noticeList);
router.delete('/Notices/:id', protect, allow('Admin'), deleteNotices);
router.delete('/Notice/:id', protect, allow('Admin'), deleteNotice);
router.put('/Notice/:id', protect, allow('Admin'), updateNotice);

// ── Complaints ────────────────────────────────────────────────────────────────
router.post('/ComplainCreate', protect, complainCreate);
router.get('/ComplainList/:id', protect, allow('Admin'), complainList);

// ── Assignments ───────────────────────────────────────────────────────────────
router.post('/AssignmentCreate', protect, allow('Admin', 'Teacher'), createAssignment);
router.get('/AssignmentList/:scope/:id', protect, listAssignments);
router.put('/AssignmentSubmit', protect, allow('Student'), submitAssignment);
router.put('/AssignmentReview', protect, allow('Admin', 'Teacher'), reviewAssignment);
router.put('/AssignmentSetStatus', protect, allow('Admin', 'Teacher'), setAssignmentStatus);

// ── Leaves ────────────────────────────────────────────────────────────────────
router.post('/LeaveCreate', protect, allow('Teacher'), createLeave);
router.get('/LeaveList/teacher/:id', protect, allow('Admin', 'Teacher'), listTeacherLeaves);
router.get('/LeaveList/school/:id', protect, allow('Admin'), listSchoolLeaves);
router.put('/LeaveStatus/:id', protect, allow('Admin'), setLeaveStatus);

// ── Timetable ─────────────────────────────────────────────────────────────────
router.post('/TimetableUpsert', protect, allow('Admin'), upsertClassDay);
router.get('/TimetableClass/:id', protect, getClassTimetable);
router.get('/TimetableTeacher/:id', protect, allow('Admin', 'Teacher'), getTeacherTimetable);

// ── Parents & Guardian Passes ─────────────────────────────────────────────────
router.post('/ParentUpsert', protect, allow('Admin'), upsertParentForStudent);
router.get('/Parents/:id', protect, allow('Admin'), listParents);
router.get('/Parent/:id', protect, allow('Admin', 'Parent'), parentDetail);
router.post('/Parent/CreateGuardianPass', protect, allow('Parent'), createGuardianPass);
router.get('/Parent/GuardianPasses/:parentId', protect, allow('Parent'), getGuardianPasses);
router.put('/Parent/RevokeGuardianPass/:passId', protect, allow('Parent'), revokeGuardianPass);

// ── Staff ─────────────────────────────────────────────────────────────────────
router.get('/Staff/:id', protect, allow('Admin', 'Staff'), getStaffDetail);
router.get('/Staffs/:id', protect, allow('Admin'), getStaff);
router.put('/Staff/:id', protect, allow('Admin'), updateStaff);
router.delete('/Staff/:id', protect, allow('Admin'), deleteStaff);
router.delete('/Staffs/:id', protect, allow('Admin'), deleteAllStaff);
router.put('/StaffAttendance/:id', protect, allow('Admin', 'Staff'), staffAttendance);

// ── Fees ──────────────────────────────────────────────────────────────────────
router.get('/Fees/Class', protect, allow('Admin'), getFeesByClass);
router.put('/Fees/Status', protect, allow('Admin'), updateFeeStatus);
router.post('/Fees/BulkRegister', protect, allow('Admin'), bulkRegisterFees);
router.get('/Fees/Student/:studentId', protect, allow('Admin', 'Parent', 'Guardian'), getStudentFeeHistory);
router.get('/Fees/Summary', protect, allow('Admin'), getFeesSummary);

// ── Payroll ───────────────────────────────────────────────────────────────────
router.get('/Payroll/Staff', protect, allow('Admin'), getPayrollByStaff);
router.get('/Payroll/Employee', protect, allow('Admin'), getPayrollByEmployee);
router.get('/Payroll/School', protect, allow('Admin'), getPayrollBySchool);
router.put('/Payroll/Status', protect, allow('Admin'), updatePayrollStatus);
router.get('/Payroll/Staff/:staffId', protect, allow('Admin'), getStaffPayrollHistory);
router.get('/Payroll/Employee/:employeeType/:employeeId', protect, allow('Admin'), getEmployeePayrollHistory);
router.get('/Payroll/Summary', protect, allow('Admin'), getPayrollSummary);

// ── Financial Accounting ──────────────────────────────────────────────────────
router.get('/Financial/Accounting', protect, allow('Admin'), getFinancialAccounting);

// ── Reports ───────────────────────────────────────────────────────────────────
router.get('/Reports/attendance', protect, allow('Admin'), getAttendanceReport);
router.get('/Reports/fees', protect, allow('Admin'), getFeesReport);

// ── Visitors / FrontDesk ──────────────────────────────────────────────────────
router.post('/Visitors', protect, allow('Admin', 'FrontDesk'), createVisitor);
router.get('/Visitors', protect, allow('Admin', 'FrontDesk'), listVisitors);
router.put('/Visitors/:id', protect, allow('Admin', 'FrontDesk'), updateVisitor);
router.post('/Visitors/LookupStudentQR', protect, allow('Admin', 'FrontDesk'), lookupStudentQr);
router.post('/Visitors/ScanParentQR', protect, allow('Admin', 'FrontDesk'), scanParentQr);
router.get('/Visitors/ParentArrivals', protect, allow('Admin', 'FrontDesk', 'Teacher'), getParentArrivals);
router.put('/Visitors/ParentArrivals/:arrivalId', protect, allow('Admin', 'FrontDesk', 'Teacher'), updateArrivalStatus);

// ── Stationery ────────────────────────────────────────────────────────────────
router.get('/Stationery/:schoolId', protect, allow('Admin'), getStationery);
router.get('/Stationery/Product/:id', protect, allow('Admin'), getStationeryDetail);
router.post('/Stationery', protect, allow('Admin'), addStationery);
router.put('/Stationery/:id', protect, allow('Admin'), updateStationery);
router.delete('/Stationery/:id', protect, allow('Admin'), deleteStationery);

// ── Invoices ──────────────────────────────────────────────────────────────────
router.post('/Invoice', protect, allow('Admin'), createInvoice);
router.get('/Invoices/:schoolId', protect, allow('Admin'), getInvoices);
router.get('/Invoice/:id', protect, allow('Admin'), getInvoiceDetail);
router.delete('/Invoice/:id', protect, allow('Admin'), deleteInvoice);

// ── Library ───────────────────────────────────────────────────────────────────
router.post('/Books/Import', protect, allow('Admin'), uploadMiddleware, importBooks);
router.get('/Books', protect, allow('Admin', 'Teacher', 'Staff'), searchBooks);
router.post('/Copies', protect, allow('Admin', 'Staff'), createCopy);
router.get('/Copies', protect, allow('Admin', 'Teacher', 'Staff'), listCopies);

// ── Tracker ───────────────────────────────────────────────────────────────────
router.get('/api/tracker/devices', protect, allow('Admin'), getActiveDevices);
router.get('/api/admin/history/:device_id', protect, allow('Admin', 'Parent', 'Guardian'), getDeviceHistory);
router.get('/api/admin/:device_id', protect, allow('Admin', 'Parent', 'Guardian'), getDeviceData);
router.put('/api/student/:student_id/geofence', protect, allow('Admin', 'Parent'), updateGeofence);
router.post('/api/student/:student_id/tracker', protect, allow('Admin'), addStudentTracker);
router.delete('/api/student/:student_id/tracker/:imei', protect, allow('Admin'), removeStudentTracker);

module.exports = router;