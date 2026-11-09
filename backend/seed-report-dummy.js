/**
 * Adds a linked dummy cohort for the signed-in school admin so the report builder
 * has rows to filter. Re-running replaces only records tagged as dummy.
 */
require('dotenv').config();
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');

const Student = require('./models/studentSchema');
const Sclass = require('./models/sclassSchema');
const Teacher = require('./models/teacherSchema');
const Parent = require('./models/parentSchema');
const Subject = require('./models/subjectSchema');
const Fee = require('./models/feeSchema');
const FeeHead = require('./models/feeHeadSchema');
const FeeInvoice = require('./models/feeInvoiceSchema');
const Assignment = require('./models/assignmentSchema');
const Notice = require('./models/noticeSchema');
const Staff = require('./models/staffSchema');
const Leave = require('./models/leaveSchema');
const Admission = require('./models/admissionEnquirySchema');
const Transport = require('./models/transportRouteSchema');
const Session = require('./models/attendanceSessionSchema');
const Arrival = require('./models/parentArrivalSchema');
const Complain = require('./models/complainSchema');

const SCHOOL = '68f88bc6e8e6cea5e0e6172d';

const CLASSES = ['Dummy 6A', 'Dummy 7B', 'Dummy 8C'];
const SUBJECTS = [
  { subName: 'Mathematics', subCode: 'D-MATH', sessions: '40' },
  { subName: 'English', subCode: 'D-ENG', sessions: '40' },
  { subName: 'Science', subCode: 'D-SCI', sessions: '36' },
];
const FIRST = ['Asha', 'Rohan', 'Meera', 'Kabir', 'Diya', 'Arjun', 'Sana', 'Vivaan'];
const LAST = ['Rao', 'Iyer', 'Khan', 'Das', 'Nair', 'Gill', 'Shah', 'Menon'];

async function clearDummy(school) {
  const classes = await Sclass.find({ school, sclassName: /^Dummy / });
  const classIds = classes.map((row) => row._id);
  const students = await Student.find({ school, name: /^Dummy / });
  const studentIds = students.map((row) => row._id);
  const teachers = await Teacher.find({ school, email: /@dummy\.school$/ });
  const teacherIds = teachers.map((row) => row._id);
  const subjects = await Subject.find({ school, subCode: /^D-/ });
  const subjectIds = subjects.map((row) => row._id);

  await Promise.all([
    Fee.deleteMany({ school, student: { $in: studentIds } }),
    FeeInvoice.deleteMany({ school, student: { $in: studentIds } }),
    FeeHead.deleteMany({ school, code: /^D-/ }),
    Assignment.deleteMany({ school, sclassName: { $in: classIds } }),
    Parent.deleteMany({ school, email: /@dummy\.school$/ }),
    Arrival.deleteMany({ school, student: { $in: studentIds } }),
    Complain.deleteMany({ school, user: { $in: studentIds } }),
    Session.deleteMany({ school, sclassName: { $in: classIds } }),
    Leave.deleteMany({ school, teacher: { $in: teacherIds } }),
    Transport.deleteMany({ school, code: /^D-/ }),
    Admission.deleteMany({ school, guardianEmail: /@dummy\.school$/ }),
    Staff.deleteMany({ school, email: /@dummy\.school$/ }),
    Notice.deleteMany({ school, title: /^Dummy / }),
    Subject.deleteMany({ _id: { $in: subjectIds } }),
    Teacher.deleteMany({ _id: { $in: teacherIds } }),
    Student.deleteMany({ _id: { $in: studentIds } }),
    Sclass.deleteMany({ _id: { $in: classIds } }),
  ]);
}

async function main() {
  await mongoose.connect(process.env.MONGO_URL);
  const school = new mongoose.Types.ObjectId(SCHOOL);
  const admin = await mongoose.connection.db.collection('admins').findOne({ _id: school });
  if (!admin) throw new Error('School admin was not found');

  await clearDummy(school);
  const password = await bcrypt.hash('dummy123', 8);

  const classes = [];
  for (const sclassName of CLASSES) {
    classes.push(await Sclass.create({ sclassName, school }));
  }

  const teachers = [];
  for (let i = 0; i < classes.length; i += 1) {
    teachers.push(await Teacher.create({
      name: `Dummy Teacher ${['Anjali', 'Farhan', 'Leela'][i]}`,
      email: `teacher${i + 1}@dummy.school`,
      password,
      school,
      teachSclass: classes[i]._id,
    }));
  }

  const subjects = [];
  for (const klass of classes) {
    for (const subject of SUBJECTS) {
      const teacher = teachers[classes.indexOf(klass)];
      const row = await Subject.create({
        ...subject,
        subCode: `${subject.subCode}-${klass.sclassName.replace(/\s/g, '')}`,
        sclassName: klass._id,
        school,
        teacher: teacher._id,
      });
      subjects.push(row);
      if (subject.subName === 'Mathematics') {
        teacher.teachSubject = row._id;
        await teacher.save();
      }
    }
  }

  const heads = await FeeHead.create([
    { school, code: 'D-TUI', name: 'Dummy Tuition', category: 'tuition', defaultAmount: 4500, billingCycle: 'monthly' },
    { school, code: 'D-TRN', name: 'Dummy Transport', category: 'transport', defaultAmount: 1800, billingCycle: 'monthly' },
    { school, code: 'D-EXM', name: 'Dummy Examination', category: 'examination', defaultAmount: 800, billingCycle: 'term' },
  ]);

  const students = [];
  let roll = 9001;
  for (let c = 0; c < classes.length; c += 1) {
    const classSubjects = subjects.filter((row) => String(row.sclassName) === String(classes[c]._id));
    for (let n = 0; n < FIRST.length; n += 1) {
      const name = `Dummy ${FIRST[n]} ${LAST[(n + c) % LAST.length]}`;
      const student = await Student.create({
        name,
        rollNum: roll,
        password,
        sclassName: classes[c]._id,
        school,
        role: 'Student',
        examResult: classSubjects.map((subject, index) => ({
          subName: subject._id,
          marksObtained: 55 + ((roll + index * 7) % 41),
        })),
        attendance: classSubjects.slice(0, 2).map((subject, index) => ({
          date: new Date(2026, 9, 6 + index),
          status: (roll + index) % 5 === 0 ? 'Absent' : 'Present',
          subName: subject._id,
        })),
      });
      students.push(student);
      roll += 1;
    }
  }

  for (const student of students) {
    const klass = classes.find((row) => String(row._id) === String(student.sclassName));
    await Parent.create({
      name: `Dummy Parent of ${student.name.replace('Dummy ', '')}`,
      mobile: `98000${String(student.rollNum).padStart(5, '0')}`,
      password: 'dummy123',
      email: `parent${student.rollNum}@dummy.school`,
      student: student._id,
      students: [student._id],
      school,
    });

    for (const month of ['2026-09', '2026-10']) {
      const paid = student.rollNum % 3 !== 0 || month === '2026-09';
      const amount = 4500 + (student.rollNum % 2 === 0 ? 1800 : 0);
      await Fee.create({
        student: student._id,
        sclassName: student.sclassName,
        school,
        month,
        amount,
        status: paid ? 'Paid' : 'Unpaid',
        paidDate: paid ? new Date(`${month}-12`) : undefined,
        paymentMethod: paid ? 'Online' : undefined,
        duration: 'Monthly',
        remarks: 'Dummy fee row',
      });
      await FeeInvoice.create({
        school,
        student: student._id,
        sclassName: student.sclassName,
        month,
        lines: [
          { feeHeadId: heads[0]._id, code: heads[0].code, name: heads[0].name, amount: 4500 },
          ...(student.rollNum % 2 === 0 ? [{ feeHeadId: heads[1]._id, code: heads[1].code, name: heads[1].name, amount: 1800 }] : []),
        ],
        total: amount,
        status: paid ? 'Paid' : 'Issued',
        dueDate: new Date(`${month}-10`),
        paidAmount: paid ? amount : 0,
        notes: `Dummy invoice for ${klass.sclassName}`,
      });
    }
  }

  for (const klass of classes) {
    const teacher = teachers[classes.indexOf(klass)];
    const subject = subjects.find((row) => String(row.sclassName) === String(klass._id) && row.subName === 'English');
    const classStudents = students.filter((row) => String(row.sclassName) === String(klass._id));
    await Assignment.create({
      title: `Dummy essay — ${klass.sclassName}`,
      description: 'Write one page about a school day.',
      dueDate: new Date('2026-10-28'),
      subject: subject._id,
      sclassName: klass._id,
      school,
      teacher: teacher._id,
      studentStatus: classStudents.map((student, index) => ({
        student: student._id,
        status: index % 3 === 0 ? 'Submitted' : 'Assigned',
        marks: index % 3 === 0 ? 16 + (index % 5) : undefined,
      })),
    });
    await Session.create({
      school,
      teacher: teacher._id,
      sclassName: klass._id,
      subject: subject._id,
      periodLabel: 'Period 2',
      room: `D-${classes.indexOf(klass) + 1}`,
      startedAt: new Date('2026-10-20T09:00:00'),
      endedAt: new Date('2026-10-20T09:40:00'),
      status: 'closed',
      expectedStudentIds: classStudents.map((row) => row._id),
      marks: classStudents.map((student, index) => ({
        student: student._id,
        state: index % 6 === 0 ? 'verified_absent' : 'verified_present',
      })),
    });
  }

  await Notice.create([
    { title: 'Dummy sports day', details: 'Dummy 6A, 7B and 8C will assemble at 8:30.', date: new Date('2026-10-18'), school },
    { title: 'Dummy fee reminder', details: 'October transport fees are due on the 10th.', date: new Date('2026-10-05'), school },
  ]);

  await Staff.create([
    { name: 'Dummy Rekha Librarian', email: 'librarian@dummy.school', password, mobile: '9811111101', role: 'Librarian', school, salary: 28000, status: 'Active' },
    { name: 'Dummy Imran Driver', email: 'driver@dummy.school', password, mobile: '9811111102', role: 'Bus Driver', school, salary: 22000, status: 'Active' },
    { name: 'Dummy Neha Accountant', email: 'accounts@dummy.school', password, mobile: '9811111103', role: 'Accountant', school, salary: 35000, status: 'Active' },
  ]);

  await Leave.create([
    { teacher: teachers[0]._id, school, reason: 'Dummy family function', fromDate: new Date('2026-10-14'), toDate: new Date('2026-10-15'), totalDays: 2, status: 'Approved', approvedBy: school, approvedAt: new Date('2026-10-12') },
    { teacher: teachers[1]._id, school, reason: 'Dummy medical appointment', fromDate: new Date('2026-10-22'), toDate: new Date('2026-10-22'), totalDays: 1, status: 'Pending' },
  ]);

  await Admission.create([
    { school, studentName: 'Dummy Ishaan Bose', classApplying: 'Dummy 6A', guardianName: 'Dummy Parent Bose', guardianPhone: '9822211101', guardianEmail: 'ishaan@dummy.school', source: 'walk_in', status: 'New' },
    { school, studentName: 'Dummy Myra Kapoor', classApplying: 'Dummy 7B', guardianName: 'Dummy Parent Kapoor', guardianPhone: '9822211102', guardianEmail: 'myra@dummy.school', source: 'website', status: 'Offer' },
    { school, studentName: 'Dummy Dev Patel', classApplying: 'Dummy 8C', guardianName: 'Dummy Parent Patel', guardianPhone: '9822211103', guardianEmail: 'dev@dummy.school', source: 'referral', status: 'Enrolled' },
  ]);

  await Transport.create({
    school,
    name: 'Dummy North Route',
    code: 'D-NORTH',
    vehicleLabel: 'Bus D1',
    driverName: 'Dummy Imran Driver',
    capacity: 30,
    active: true,
    stops: [
      { name: 'Dummy City Gate', sequence: 1, etaMinutes: 15 },
      { name: 'Dummy Lake Stop', sequence: 2, etaMinutes: 25 },
    ],
    studentIds: students.filter((row) => row.rollNum % 2 === 0).map((row) => row._id),
  });

  for (const student of students.slice(0, 4)) {
    await Arrival.create({
      student: student._id,
      studentName: student.name,
      rollNum: student.rollNum,
      sclassName: student.sclassName,
      sclassNameStr: classes.find((row) => String(row._id) === String(student.sclassName)).sclassName,
      school,
      parentName: `Dummy Parent of ${student.name.replace('Dummy ', '')}`,
      clientEventId: `dummy-arrival-${student.rollNum}`,
      status: student.rollNum % 2 === 0 ? 'HandedOver' : 'Waiting at Frontdesk',
      arrivalTime: new Date('2026-10-21T14:10:00'),
    });
    await Complain.create({
      user: student._id,
      date: new Date('2026-10-16'),
      complaint: `${student.name} reported a dummy lost-book complaint.`,
      school,
    });
  }

  const counts = {
    classes: classes.length,
    teachers: teachers.length,
    subjects: subjects.length,
    students: students.length,
    parents: students.length,
    fees: students.length * 2,
    invoices: students.length * 2,
    feeHeads: heads.length,
  };
  console.log('dummy cohort ready', counts);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
