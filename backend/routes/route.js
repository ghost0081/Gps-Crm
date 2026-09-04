const router = require('express').Router();

// const { adminRegister, adminLogIn, deleteAdmin, getAdminDetail, updateAdmin } = require('../controllers/admin-controller.js');

const { adminRegister, adminLogIn, getAdminDetail} = require('../controllers/admin-controller.js');

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
    studentAttendanceBulk } = require('../controllers/student_controller.js');
const { subjectCreate, classSubjects, deleteSubjectsByClass, getSubjectDetail, deleteSubject, freeSubjectList, allSubjects, deleteSubjects } = require('../controllers/subject-controller.js');
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
const { createVisitor, listVisitors, updateVisitor, frontdeskLogin, scanParentQr, getParentArrivals, updateArrivalStatus } = require('../controllers/visitor-controller.js');
const { importBooks, searchBooks, uploadMiddleware } = require('../controllers/books-controller.js');
const { createCopy, listCopies } = require('../controllers/copies-controller.js');
const { getDeviceData, getActiveDevices, updateGeofence, uploadBleTelemetry, addStudentTracker, removeStudentTracker, getDeviceHistory } = require('../controllers/tracker-controller.js');

// Admin
router.post('/AdminReg', adminRegister);
router.post('/AdminLogin', adminLogIn);

router.get("/Admin/:id", getAdminDetail)
// router.delete("/Admin/:id", deleteAdmin)

// router.put("/Admin/:id", updateAdmin)

// Student

router.post('/StudentReg', studentRegister);
router.post('/StudentLogin', studentLogIn)

router.get("/Students/:id", getStudents)
router.get("/Student/:id", getStudentDetail)

router.delete("/Students/:id", deleteStudents)
router.delete("/StudentsClass/:id", deleteStudentsByClass)
router.delete("/Student/:id", deleteStudent)

router.put("/Student/:id", updateStudent)

router.put('/UpdateExamResult/:id', updateExamResult)

router.put('/StudentAttendance/:id', studentAttendance)
router.put('/StudentsAttendanceBulk', studentAttendanceBulk)

router.put('/RemoveAllStudentsSubAtten/:id', clearAllStudentsAttendanceBySubject);
router.put('/RemoveAllStudentsAtten/:id', clearAllStudentsAttendance);

router.put('/RemoveStudentSubAtten/:id', removeStudentAttendanceBySubject);
router.put('/RemoveStudentAtten/:id', removeStudentAttendance)

// Teacher

router.post('/TeacherReg', teacherRegister);
router.post('/TeacherLogin', teacherLogIn)

router.get("/Teachers/:id", getTeachers)
router.get("/Teacher/:id", getTeacherDetail)

router.delete("/Teachers/:id", deleteTeachers)
router.delete("/TeachersClass/:id", deleteTeachersByClass)
router.delete("/Teacher/:id", deleteTeacher)

router.put("/TeacherSubject", updateTeacherSubject)

router.post('/TeacherAttendance/:id', teacherAttendance)

// Notice

router.post('/NoticeCreate', noticeCreate);

router.get('/NoticeList/:id', noticeList);

router.delete("/Notices/:id", deleteNotices)
router.delete("/Notice/:id", deleteNotice)

router.put("/Notice/:id", updateNotice)

// Complain

router.post('/ComplainCreate', complainCreate);

router.get('/ComplainList/:id', complainList);

// Sclass

router.post('/SclassCreate', sclassCreate);

router.get('/SclassList/:id', sclassList);
router.get("/Sclass/:id", getSclassDetail)

router.get("/Sclass/Students/:id", getSclassStudents)

router.delete("/Sclasses/:id", deleteSclasses)
router.delete("/Sclass/:id", deleteSclass)

// Subject

router.post('/SubjectCreate', subjectCreate);

router.get('/AllSubjects/:id', allSubjects);
router.get('/ClassSubjects/:id', classSubjects);
router.get('/FreeSubjectList/:id', freeSubjectList);
router.get("/Subject/:id", getSubjectDetail)

router.delete("/Subject/:id", deleteSubject)
router.delete("/Subjects/:id", deleteSubjects)
router.delete("/SubjectsClass/:id", deleteSubjectsByClass)

// Assignment

router.post('/AssignmentCreate', createAssignment); // teacher creates
router.get('/AssignmentList/:scope/:id', listAssignments); // list by scope
router.put('/AssignmentSubmit', submitAssignment); // student submits
router.put('/AssignmentReview', reviewAssignment); // teacher reviews
router.put('/AssignmentSetStatus', setAssignmentStatus); // teacher set status per student

// Leave
router.post('/LeaveCreate', createLeave);
router.get('/LeaveList/teacher/:id', listTeacherLeaves);
router.get('/LeaveList/school/:id', listSchoolLeaves);
router.put('/LeaveStatus/:id', setLeaveStatus);

// Timetable
router.post('/TimetableUpsert', upsertClassDay); // admin
router.get('/TimetableClass/:id', getClassTimetable);
router.get('/TimetableTeacher/:id', getTeacherTimetable);

// Parent & Temporary Guardian
router.post('/ParentLogin', parentLogIn);
router.post('/ParentUpsert', upsertParent);
router.get('/Parents/:id', listParents); // by school
router.get('/Parent/:id', parentDetail);
router.post('/GuardianLogin', guardianLogIn);
router.post('/Parent/CreateGuardianPass', createGuardianPass);
router.get('/Parent/GuardianPasses/:parentId', getGuardianPasses);
router.put('/Parent/RevokeGuardianPass/:passId', revokeGuardianPass);

// Staff
router.post('/StaffReg', staffRegister);
router.post('/StaffLogin', staffLogIn);
router.get('/Staff/:id', getStaffDetail);
router.get('/Staffs/:id', getStaff); // by school
router.put('/Staff/:id', updateStaff);
router.delete('/Staff/:id', deleteStaff);
router.delete('/Staffs/:id', deleteAllStaff); // delete all by school
router.put('/StaffAttendance/:id', staffAttendance);

// Fees
router.get('/Fees/Class', getFeesByClass); // ?classId=&month=&schoolId=
router.put('/Fees/Status', updateFeeStatus); // update/create fee
router.post('/Fees/BulkRegister', bulkRegisterFees); // bulk register fees for class
router.get('/Fees/Student/:studentId', getStudentFeeHistory);
router.get('/Fees/Summary', getFeesSummary); // ?schoolId=&month=

// Payroll
router.get('/Payroll/Staff', getPayrollByStaff); // ?staffId=&month=&schoolId= (legacy)
router.get('/Payroll/Employee', getPayrollByEmployee); // ?employeeId=&employeeType=&month=&schoolId=
router.get('/Payroll/School', getPayrollBySchool); // ?schoolId=&month=
router.put('/Payroll/Status', updatePayrollStatus); // update/create payroll
router.get('/Payroll/Staff/:staffId', getStaffPayrollHistory); // legacy
router.get('/Payroll/Employee/:employeeType/:employeeId', getEmployeePayrollHistory); // Get history by employee type and ID
router.get('/Payroll/Summary', getPayrollSummary); // ?schoolId=&month=

// Financial Accounting
router.get('/Financial/Accounting', getFinancialAccounting); // ?schoolId=&year=&month=

// Reports
router.get('/Reports/attendance', getAttendanceReport); // ?schoolId=&months=
router.get('/Reports/fees', getFeesReport); // ?schoolId=&months=

// Visitors / Frontdesk
router.post('/FrontDeskLogin', frontdeskLogin);
router.post('/Visitors', createVisitor);
router.get('/Visitors', listVisitors); // ?schoolId=&status=&limit=
router.put('/Visitors/:id', updateVisitor);
router.post('/Visitors/ScanParentQR', scanParentQr);
router.get('/Visitors/ParentArrivals', getParentArrivals);
router.put('/Visitors/ParentArrivals/:arrivalId', updateArrivalStatus);

// Stationery
router.get('/Stationery/:schoolId', getStationery); // Get all products
router.get('/Stationery/Product/:id', getStationeryDetail); // Get single product
router.post('/Stationery', addStationery); // Add product
router.put('/Stationery/:id', updateStationery); // Update product
router.delete('/Stationery/:id', deleteStationery); // Delete product

// Invoices (Sales)
router.post('/Invoice', createInvoice); // Create invoice/sale
router.get('/Invoices/:schoolId', getInvoices); // Get all invoices
router.get('/Invoice/:id', getInvoiceDetail); // Get single invoice
router.delete('/Invoice/:id', deleteInvoice); // Delete invoice (restores inventory)

// Library - Books
router.post('/Books/Import', uploadMiddleware, importBooks); // ?dryRun=true|false - Import books from Excel/CSV
router.get('/Books', searchBooks); // ?q=&page=&limit= - Search books

// Library - Copies
router.post('/Copies', createCopy); // Create a library copy
router.get('/Copies', listCopies); // ?bookId= - List copies (optionally filtered by bookId)

// Tracker Endpoints
router.get('/api/tracker/devices', getActiveDevices);
router.get('/api/admin/history/:device_id', getDeviceHistory);
router.get('/api/admin/:device_id', getDeviceData);
router.put('/api/student/:student_id/geofence', updateGeofence);
router.post('/api/tracker/ble-telemetry', uploadBleTelemetry);
router.post('/api/student/:student_id/tracker', addStudentTracker);
router.delete('/api/student/:student_id/tracker/:imei', removeStudentTracker);

module.exports = router;