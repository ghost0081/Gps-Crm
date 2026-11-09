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
    studentAttendanceBulk,
    registerStudentFace,
    markAttendanceByFace } = require('../controllers/student_controller.js');
const { subjectCreate, classSubjects, deleteSubjectsByClass, getSubjectDetail, deleteSubject, freeSubjectList, allSubjects, deleteSubjects } = require('../controllers/subject-controller.js');

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const { teacherRegister, teacherLogIn, getTeachers, getTeacherDetail, deleteTeachers, deleteTeachersByClass, deleteTeacher, updateTeacherSubject, teacherAttendance, registerTeacherFcmToken } = require('../controllers/teacher-controller.js');
const { createAssignment, listAssignments, submitAssignment, reviewAssignment, setAssignmentStatus } = require('../controllers/assignment-controller.js');
const { createLeave, listTeacherLeaves, listSchoolLeaves, setLeaveStatus } = require('../controllers/leave-controller.js');
const { upsertClassDay, getClassTimetable, getTeacherTimetable } = require('../controllers/timetable-controller.js');
const { parentLogIn, upsertParentForStudent, upsertParent, createParentAccount, listParents, parentDetail, createGuardianPass, guardianLogIn, getGuardianPasses, revokeGuardianPass, linkStudentToParent, listParentChildren, listCollectors, listCollectorsForStudent, createCollector, revokeCollector, verifyGatePin } = require('../controllers/parent-controller.js');
const {
    ensureParentCredential,
    replaceParentCredential,
    revokeCredential,
    getGateCredentialCache,
} = require('../controllers/guardian-credential-controller.js');
const { staffRegister, staffLogIn, getStaff, getStaffDetail, updateStaff, deleteStaff, deleteAllStaff, staffAttendance } = require('../controllers/staff-controller.js');
const { getFeesByClass, updateFeeStatus, bulkRegisterFees, getStudentFeeHistory, getFeesSummary } = require('../controllers/fee-controller.js');
const { getPayrollByStaff, getPayrollByEmployee, getPayrollBySchool, updatePayrollStatus, getStaffPayrollHistory, getEmployeePayrollHistory, getPayrollSummary } = require('../controllers/payroll-controller.js');
const { getFinancialAccounting } = require('../controllers/financial-controller.js');
const { getStationery, getStationeryDetail, addStationery, updateStationery, deleteStationery, createInvoice, getInvoices, getInvoiceDetail, deleteInvoice } = require('../controllers/stationery-controller.js');
const { getAttendanceReport, getFeesReport } = require('../controllers/report-controller.js');
const { createVisitor, listVisitors, updateVisitor, frontdeskLogin, lookupStudentQr, scanParentQr, getParentArrivals, updateArrivalStatus, getTeacherPickupNotifications } = require('../controllers/visitor-controller.js');
const { listFeeHeads, createFeeHead, updateFeeHead, previewFeeCharges } = require('../controllers/fee-head-controller.js');
const { listRoutes, createRoute, updateRoute, getStudentTransport } = require('../controllers/transport-controller.js');
const { startSession, getOpenSession, recordBleEvidence, verifyMark, closeSession } = require('../controllers/attendance-session-controller.js');
const { generateInvoicesForClass, listInvoices, markInvoicePaid } = require('../controllers/fee-invoice-controller.js');
const { listEnquiries, createEnquiry, updateEnquiry } = require('../controllers/admission-controller.js');
const { listWelfareNotes, createWelfareNote, listTeacherSafeAlerts } = require('../controllers/welfare-controller.js');
const { getPrincipalOverview } = require('../controllers/principal-controller.js');
const { listDatasets, runReport } = require('../controllers/report-builder-controller.js');
const { catalog, previewPlan, runVisualReport, listSaved, saveReport, runSaved } = require('../controllers/visual-report-controller.js');
const { importBooks, searchBooks, uploadMiddleware } = require('../controllers/books-controller.js');
const { createCopy, listCopies } = require('../controllers/copies-controller.js');
const {
    getDeviceData,
    getActiveDevices,
    updateGeofence,
    uploadBleTelemetry,
    addStudentTracker,
    removeStudentTracker,
    getDeviceHistory,
    getTrackingSummary,
    getSafetyNotifications,
    markSafetyNotificationRead,
    registerParentFcmToken,
    updateParentNotificationPrefs,
} = require('../controllers/tracker-controller.js');
const {
    getSchema: getDesignSchema,
    listTemplates: listDesignTemplates,
    getTemplate: getDesignTemplate,
    createTemplate: createDesignTemplate,
    updateTemplate: updateDesignTemplate,
    duplicateTemplate: duplicateDesignTemplate,
    removeTemplate: removeDesignTemplate,
    setDefaultTemplate: setDefaultDesignTemplate,
    restoreVersion: restoreDesignVersion,
    previewDesign,
    listRecords: listDesignRecords,
} = require('../controllers/design-studio-controller.js');
const {
    listAssignments: listReceiptAssignments,
    saveAssignment: saveReceiptAssignment,
    removeAssignment: removeReceiptAssignment,
    listAccountStudents,
    listAccountFees,
    resolveAccountTemplate,
    previewAccountReceipt,
} = require('../controllers/accounts-receipt-controller.js');

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

// Face Recognition
router.post('/Attendance/RegisterFace/:id', upload.array('images', 5), registerStudentFace);
router.post('/Attendance/MarkFace', upload.single('image'), markAttendanceByFace);

// Teacher

router.post('/TeacherReg', teacherRegister);
router.post('/TeacherLogin', teacherLogIn);
router.post('/Teacher/:teacherId/fcm-token', registerTeacherFcmToken);

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
router.post('/ParentCreate', createParentAccount);
router.get('/Parents/:id', listParents); // by school
router.get('/Parent/:id', parentDetail);
router.post('/GuardianLogin', guardianLogIn);
router.post('/Parent/CreateGuardianPass', createGuardianPass);
router.post('/Parent/:parentId/LinkStudent', linkStudentToParent);
router.get('/Parent/:parentId/Children', listParentChildren);
router.get('/Parent/:parentId/Collectors', listCollectors);
router.post('/Parent/:parentId/Collectors', createCollector);
router.put('/Collectors/:collectorId/Revoke', revokeCollector);
router.get('/Gate/Student/:studentId/Collectors', listCollectorsForStudent);
router.post('/Gate/VerifyPin', verifyGatePin);
router.get('/Parent/GuardianPasses/:parentId', getGuardianPasses);
router.put('/Parent/RevokeGuardianPass/:passId', revokeGuardianPass);

// Opaque guardian gate credentials (P0.1)
router.get('/Parent/Credential/:parentId', ensureParentCredential);
router.post('/Parent/Credential/:parentId/Replace', replaceParentCredential);
router.put('/Gate/Credential/:credentialId/Revoke', revokeCredential);
router.get('/Gate/Credentials/:schoolId', getGateCredentialCache);

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
router.post('/Visitors/LookupStudentQR', lookupStudentQr);
router.post('/Visitors/ScanParentQR', scanParentQr);
router.get('/Visitors/ParentArrivals', getParentArrivals);
router.put('/Visitors/ParentArrivals/:arrivalId', updateArrivalStatus);
router.get('/Teacher/PickupNotifications/:teacherId', getTeacherPickupNotifications);

// Fee heads (configurable) — P0.4
router.get('/FeeHeads', listFeeHeads);
router.post('/FeeHeads', createFeeHead);
router.put('/FeeHeads/:id', updateFeeHead);
router.get('/FeeHeads/Preview', previewFeeCharges);
router.post('/FeeInvoices/Generate', generateInvoicesForClass);
router.get('/FeeInvoices', listInvoices);
router.put('/FeeInvoices/:id/Paid', markInvoicePaid);

router.get('/Admissions', listEnquiries);
router.post('/Admissions', createEnquiry);
router.put('/Admissions/:id', updateEnquiry);

router.get('/Welfare/Notes', listWelfareNotes);
router.post('/Welfare/Notes', createWelfareNote);
router.get('/Welfare/TeacherAlerts', listTeacherSafeAlerts);

router.get('/Principal/Overview', getPrincipalOverview);
router.get('/Reports/Builder/Datasets', listDatasets);
router.get('/Reports/Builder/Run', runReport);
router.get('/Reports/Visual/Catalog', catalog);
router.post('/Reports/Visual/Plan', previewPlan);
router.post('/Reports/Visual/Run', runVisualReport);
router.get('/Reports/Visual/Saved', listSaved);
router.post('/Reports/Visual/Saved', saveReport);
router.post('/Reports/Visual/Saved/:id/Run', runSaved);

// Transport routes — P1 foundation
router.get('/Transport/Routes', listRoutes);
router.post('/Transport/Routes', createRoute);
router.put('/Transport/Routes/:id', updateRoute);
router.get('/Transport/Student/:studentId', getStudentTransport);

// Timetable-bound attendance sessions — P0.4 / P2 BLE evidence
router.post('/Attendance/Sessions', startSession);
router.get('/Attendance/Sessions/Open', getOpenSession);
router.post('/Attendance/Sessions/:sessionId/BleEvidence', recordBleEvidence);
router.put('/Attendance/Sessions/:sessionId/Verify', verifyMark);
router.put('/Attendance/Sessions/:sessionId/Close', closeSession);

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
router.get('/api/student/:student_id/tracking-summary', getTrackingSummary);
router.get('/api/parent/:parent_id/safety-notifications', getSafetyNotifications);
router.post('/api/parent/:parent_id/safety-notifications/:event_id/read', markSafetyNotificationRead);
router.post('/api/parent/:parent_id/fcm-token', registerParentFcmToken);
router.put('/api/parent/:parent_id/notification-prefs', updateParentNotificationPrefs);

router.get('/Design/Schema', getDesignSchema);
router.get('/Design/Records', listDesignRecords);
router.get('/Design/Templates', listDesignTemplates);
router.get('/Design/Templates/:id', getDesignTemplate);
router.post('/Design/Templates', createDesignTemplate);
router.put('/Design/Templates/:id', updateDesignTemplate);
router.post('/Design/Templates/:id/Duplicate', duplicateDesignTemplate);
router.delete('/Design/Templates/:id', removeDesignTemplate);
router.put('/Design/Templates/:id/Default', setDefaultDesignTemplate);
router.post('/Design/Templates/:id/Restore', restoreDesignVersion);
router.post('/Design/Preview', previewDesign);

router.get('/Design/Assignments', listReceiptAssignments);
router.post('/Design/Assignments', saveReceiptAssignment);
router.delete('/Design/Assignments/:id', removeReceiptAssignment);
router.get('/Accounts/Receipts/Students', listAccountStudents);
router.get('/Accounts/Receipts/Fees', listAccountFees);
router.get('/Accounts/Receipts/Resolve', resolveAccountTemplate);
router.post('/Accounts/Receipts/Preview', previewAccountReceipt);

module.exports = router;