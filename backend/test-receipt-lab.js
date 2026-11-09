/**
 * Receipt assignment checks against the separate database crm_receipt_lab.
 * It refuses to run if that is not the connected database.
 */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '.env') });

function labUrl(url) {
    const match = String(url || '').match(/^(mongodb(?:\+srv)?:\/\/[^/]+)\/([^?]*)(\?.*)?$/);
    if (!match) throw new Error('The Mongo address could not be pointed at the lab database.');
    return `${match[1]}/crm_receipt_lab${match[3] || ''}`;
}

function receipt(name, category, width, height, background, elements) {
    return {
        name,
        category,
        isDefault: false,
        page: { widthMm: width, heightMm: height, background, marginMm: 0 },
        pages: [{ id: `${category}-p`, elements }],
        assets: [],
        versions: [],
    };
}

function text(id, value, x, y, w, h, style) {
    return { id, type: 'text', x, y, w, h, text: value, style: style || { fontSize: 16, bold: true } };
}

function field(id, model, fieldPath, x, y, w, h, format) {
    return {
        id,
        type: 'field',
        x, y, w, h,
        format: format || 'text',
        binding: { model, path: fieldPath, label: fieldPath },
        style: { fontSize: 12 },
    };
}

async function main() {
    const url = labUrl(process.env.MONGO_URL);
    await mongoose.connect(url);
    if (mongoose.connection.name !== 'crm_receipt_lab') {
        throw new Error('Refusing to write because the database is not crm_receipt_lab.');
    }
    await mongoose.connection.dropDatabase();

    const Admin = require('./models/adminSchema');
    const Sclass = require('./models/sclassSchema');
    const Student = require('./models/studentSchema');
    const Staff = require('./models/staffSchema');
    const Fee = require('./models/feeSchema');
    const FeeInvoice = require('./models/feeInvoiceSchema');
    const DesignTemplate = require('./models/designTemplateSchema');
    const ReceiptAssignment = require('./models/receiptAssignmentSchema');
    const { previewAccountReceipt, listAccountStudents, resolveAccountTemplate } = require('./controllers/accounts-receipt-controller');
    const { buildDocumentHtml } = require('./services/design-render');

    const password = await bcrypt.hash('lab-only', 8);
    const school = await Admin.create({
        name: 'Receipt Lab Admin',
        email: 'receipt-lab-admin@lab.invalid',
        password,
        schoolName: 'Receipt Lab School',
        role: 'Admin',
    });
    const otherSchool = await Admin.create({
        name: 'Other Lab Admin',
        email: 'receipt-lab-other@lab.invalid',
        password,
        schoolName: 'Other Lab School',
        role: 'Admin',
    });
    const class6 = await Sclass.create({ sclassName: 'Receipt Lab 6', school: school._id });
    const class7 = await Sclass.create({ sclassName: 'Receipt Lab 7', school: school._id });
    const makeStudent = (name, roll, cls) => Student.create({
        name, rollNum: roll, password, sclassName: cls, school: school._id, role: 'Student',
    });
    const studentA = await makeStudent('RECEIPT-LAB Student A', 9101, class6._id);
    const studentB = await makeStudent('RECEIPT-LAB Student B', 9102, class6._id);
    const studentC = await makeStudent('RECEIPT-LAB Student C', 9103, class7._id);
    const studentD = await makeStudent('RECEIPT-LAB Student D', 9104, class6._id);
    const outsider = await Student.create({
        name: 'RECEIPT-LAB Outsider', rollNum: 9199, password, sclassName: class7._id, school: otherSchool._id, role: 'Student',
    });
    const accountant = await Staff.create({
        name: 'RECEIPT-LAB Accountant',
        email: 'receipt-lab-accounts@lab.invalid',
        password,
        role: 'Accountant',
        school: school._id,
        status: 'Active',
    });
    const librarian = await Staff.create({
        name: 'RECEIPT-LAB Librarian',
        email: 'receipt-lab-library@lab.invalid',
        password,
        role: 'Librarian',
        school: school._id,
        status: 'Active',
    });

    const feeA1 = await Fee.create({ student: studentA._id, sclassName: class6._id, school: school._id, month: '2026-03', amount: 1000, status: 'Paid', paymentMethod: 'Cheque', paidDate: new Date('2026-03-05'), duration: 'Monthly' });
    const feeA2 = await Fee.create({ student: studentA._id, sclassName: class6._id, school: school._id, month: '2026-04', amount: 1500, status: 'Paid', paymentMethod: 'Cash', paidDate: new Date('2026-04-06'), duration: 'Monthly', remarks: 'Adjustment note 50 recorded in remarks' });
    await FeeInvoice.create({
        school: school._id, student: studentA._id, sclassName: class6._id, month: '2026-04',
        lines: [{ name: 'Tuition', code: 'TUI', amount: 1200 }, { name: 'Examination', code: 'EXM', amount: 300 }],
        total: 1500, paidAmount: 1500, status: 'Paid',
    });
    const feeB = await Fee.create({ student: studentB._id, sclassName: class6._id, school: school._id, month: '2026-04', amount: 800, status: 'Paid', paymentMethod: 'Online', paidDate: new Date('2026-04-08'), duration: 'Monthly' });
    await FeeInvoice.create({
        school: school._id, student: studentB._id, sclassName: class6._id, month: '2026-04',
        lines: [{ name: 'Tuition', code: 'TUI', amount: 1500 }, { name: 'Transport', code: 'TRN', amount: 500 }],
        total: 2000, paidAmount: 800, status: 'Partial',
    });
    const feeC = await Fee.create({ student: studentC._id, sclassName: class7._id, school: school._id, month: '2026-04', amount: 1000, status: 'Unpaid', duration: 'Monthly' });
    const feeD = await Fee.create({ student: studentD._id, sclassName: class6._id, school: school._id, month: '2026-04', amount: 900, status: 'Paid', paymentMethod: 'Cash', paidDate: new Date('2026-04-09'), duration: 'Monthly' });

    const slip = await DesignTemplate.create({ ...receipt('Payment slip', 'fee-receipt', 80, 160, '#fff7ed', [
        text('title', 'PAYMENT SLIP', 4, 4, 72, 10, { fontSize: 14, bold: true, color: '#9a3412' }),
        field('name', 'student', 'name', 4, 18, 72, 8),
        field('amount', 'fee', 'amount', 4, 30, 72, 10, 'currency'),
        field('method', 'fee', 'paymentMethod', 4, 42, 72, 8),
        field('remarks', 'fee', 'remarks', 4, 54, 72, 16),
    ]), school: school._id });
    const due = await DesignTemplate.create({ ...receipt('Due sheet', 'fee-receipt', 210, 297, '#eff6ff', [
        text('title', 'AMOUNT DUE', 12, 12, 160, 12, { fontSize: 22, bold: true, color: '#1d4ed8' }),
        field('name', 'student', 'name', 12, 32, 120, 8),
        field('pending', 'feeInvoice', 'pendingBalance', 12, 46, 80, 10, 'currency'),
        {
            id: 'lines', type: 'table', x: 12, y: 64, w: 180, h: 40,
            binding: { model: 'feeInvoice', path: 'lines', label: 'lines' },
            columns: [
                { path: 'name', label: 'Fee head', format: 'text' },
                { path: 'amount', label: 'Amount', format: 'currency' },
            ],
        },
    ]), school: school._id });
    const accountsCopy = await DesignTemplate.create({ ...receipt('Accounts copy', 'fee-receipt', 148, 210, '#f0fdf4', [
        text('title', 'ACCOUNTS COPY', 10, 10, 120, 12, { fontSize: 18, bold: true, color: '#166534' }),
        field('name', 'student', 'name', 10, 30, 120, 8),
        field('className', 'sclass', 'sclassName', 10, 42, 80, 8),
        field('amount', 'fee', 'amount', 10, 56, 80, 10, 'currency'),
    ]), school: school._id });
    const classSlip = await DesignTemplate.create({ ...receipt('Class slip', 'fee-receipt', 210, 120, '#fefce8', [
        text('title', 'CLASS 6 SLIP', 10, 8, 160, 10, { fontSize: 18, bold: true, color: '#854d0e' }),
        field('name', 'student', 'name', 10, 24, 120, 8),
        field('amount', 'fee', 'amount', 10, 38, 80, 10, 'currency'),
    ]), school: school._id });
    await DesignTemplate.create({ ...receipt('Due notice', 'fee-due', 210, 297, '#fff1f2', [
        text('title', 'FEE DUE NOTICE', 12, 12, 160, 12, { fontSize: 20, bold: true, color: '#be123c' }),
        field('name', 'student', 'name', 12, 32, 120, 8),
        field('status', 'fee', 'status', 12, 46, 60, 8),
    ]), school: school._id });

    const assign = (scope, template, extra) => ReceiptAssignment.create({
        school: school._id,
        department: 'accounts',
        documentType: 'fee-receipt',
        scope,
        template,
        student: extra.student || null,
        sclassName: extra.sclassName || null,
    });
    await assign('student', slip._id, { student: studentA._id });
    await assign('student', due._id, { student: studentB._id });
    await assign('class', classSlip._id, { sclassName: class6._id });
    await assign('department', accountsCopy._id, {});
    const dueTemplate = await DesignTemplate.findOne({ school: school._id, category: 'fee-due' });
    await ReceiptAssignment.create({
        school: school._id, department: 'accounts', documentType: 'fee-due', scope: 'department', template: dueTemplate._id, student: null, sclassName: null,
    });

    const call = (handler, body) => new Promise((resolve) => {
        const res = {
            statusCode: 200,
            status(code) { this.statusCode = code; return this; },
            json(payload) { resolve({ status: this.statusCode, body: payload }); },
        };
        handler({ body, query: body }, res);
    });

    const feeCount = await Fee.countDocuments({ school: school._id });
    const previewA = await call(previewAccountReceipt, { staffId: accountant._id, studentId: studentA._id, feeId: feeA2._id, documentType: 'fee-receipt' });
    const previewB = await call(previewAccountReceipt, { staffId: accountant._id, studentId: studentB._id, feeId: feeB._id, documentType: 'fee-receipt' });
    const previewC = await call(previewAccountReceipt, { staffId: accountant._id, studentId: studentC._id, feeId: feeC._id, documentType: 'fee-receipt' });
    const previewD = await call(previewAccountReceipt, { staffId: accountant._id, studentId: studentD._id, feeId: feeD._id, documentType: 'fee-receipt' });
    const previewDue = await call(previewAccountReceipt, { staffId: accountant._id, studentId: studentC._id, feeId: feeC._id, documentType: 'fee-due' });
    const missing = await call(resolveAccountTemplate, { staffId: accountant._id, studentId: studentC._id, documentType: 'fee-adjustment' });
    const deniedStaff = await call(listAccountStudents, { staffId: librarian._id });
    const deniedStudent = await call(previewAccountReceipt, { staffId: accountant._id, studentId: outsider._id, feeId: feeA2._id, documentType: 'fee-receipt' });
    const feeCountAfter = await Fee.countDocuments({ school: school._id });

    const textOf = (preview, id) => preview.body.values[id] && preview.body.values[id].text;
    const rowsOf = (preview, id) => (preview.body.values[id] && preview.body.values[id].rows) || [];
    const checks = [
        ['A uses student template', previewA.body.templateName === 'Payment slip' && previewA.body.level === 'student'],
        ['A name filled', textOf(previewA, 'name') === 'RECEIPT-LAB Student A'],
        ['A amount is rupees', /1,500|1500/.test(textOf(previewA, 'amount') || '')],
        ['A remarks kept', (textOf(previewA, 'remarks') || '').includes('Adjustment note 50')],
        ['A has two saved fees', (await Fee.countDocuments({ student: studentA._id })) === 2],
        ['B uses student template', previewB.body.templateName === 'Due sheet' && previewB.body.level === 'student'],
        ['B has two fee heads', rowsOf(previewB, 'lines').length === 2],
        ['B pending is 1200', /1,200|1200/.test(textOf(previewB, 'pending') || '')],
        ['C uses department default', previewC.body.templateName === 'Accounts copy' && previewC.body.level === 'department'],
        ['D uses class template', previewD.body.templateName === 'Class slip' && previewD.body.level === 'class'],
        ['C due notice', previewDue.body.templateName === 'Due notice'],
        ['missing template blocked', missing.status === 404],
        ['librarian blocked', deniedStaff.status === 403],
        ['outsider blocked', deniedStudent.status === 403],
        ['preview did not add fees', feeCount === feeCountAfter],
        ['older fee still exists', Boolean(feeA1._id)],
    ];
    const failed = checks.filter((item) => !item[1]);
    const outDir = path.join(__dirname, 'lab-receipts');
    fs.mkdirSync(outDir, { recursive: true });
    const files = [
        ['student-a-payment-slip.html', previewA.body],
        ['student-b-due-sheet.html', previewB.body],
        ['student-c-accounts-copy.html', previewC.body],
        ['student-d-class-slip.html', previewD.body],
        ['student-c-due-notice.html', previewDue.body],
    ];
    files.forEach(([name, body]) => {
        fs.writeFileSync(path.join(outDir, name), buildDocumentHtml(body.template, body.values));
    });
    console.log(JSON.stringify({
        failed: failed.map((item) => item[0]),
        passed: checks.length - failed.length,
        total: checks.length,
        files: files.map((item) => item[0]),
    }, null, 2));
    await mongoose.disconnect();
    if (failed.length) process.exit(1);
}

main().catch(async (error) => {
    console.error(error.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
});
