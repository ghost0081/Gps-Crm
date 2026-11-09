/**
 * Canonical page chrome for every admin route.
 * Pages that already render AdminPageShell set skipChrome: true.
 */
const ROUTES = [
  { match: /^\/Admin\/dashboard\/?$/, skipChrome: true },
  { match: /^\/$/, skipChrome: true },
  {
    match: /^\/Admin\/students\/?$/,
    skipChrome: true,
  },
  {
    match: /^\/Admin\/classes\/?$/,
    skipChrome: true,
  },
  {
    match: /^\/Admin\/notices\/?$/,
    skipChrome: true,
  },
  {
    match: /^\/Admin\/subjects\/?$/,
    skipChrome: true,
  },
  {
    match: /^\/Admin\/complains\/?$/,
    skipChrome: true,
  },
  {
    match: /^\/Admin\/teacher-leave\/?$/,
    skipChrome: true,
  },
  {
    match: /^\/Admin\/addstudents/,
    title: 'Add Student',
    subtitle: 'Create a new student profile and class enrolment.',
    crumbs: [{ label: 'Admin', href: '/' }, { label: 'Students', href: '/Admin/students' }, { label: 'Add' }],
  },
  {
    match: /^\/Admin\/students\/student\/attendance/,
    title: 'Student Attendance',
    subtitle: 'Record and review attendance for this student.',
    crumbs: [{ label: 'Admin', href: '/' }, { label: 'Students', href: '/Admin/students' }, { label: 'Attendance' }],
  },
  {
    match: /^\/Admin\/students\/student\/marks/,
    title: 'Exam Marks',
    subtitle: 'Enter and review examination marks.',
    crumbs: [{ label: 'Admin', href: '/' }, { label: 'Students', href: '/Admin/students' }, { label: 'Marks' }],
  },
  {
    match: /^\/Admin\/students\/student\//,
    title: 'Student Profile',
    subtitle: 'View academic, attendance, and tracking details.',
    crumbs: [{ label: 'Admin', href: '/' }, { label: 'Students', href: '/Admin/students' }, { label: 'Profile' }],
  },
  {
    match: /^\/Admin\/teachers\/teacher\//,
    title: 'Teacher Profile',
    subtitle: 'View teacher assignments and details.',
    crumbs: [{ label: 'Admin', href: '/' }, { label: 'Teachers', href: '/Admin/teachers' }, { label: 'Profile' }],
  },
  {
    match: /^\/Admin\/teachers\/chooseclass/,
    title: 'Choose Class',
    subtitle: 'Select a class before assigning a teacher.',
    crumbs: [{ label: 'Admin', href: '/' }, { label: 'Teachers', href: '/Admin/teachers' }, { label: 'Choose Class' }],
  },
  {
    match: /^\/Admin\/teachers\/choosesubject/,
    title: 'Choose Subject',
    subtitle: 'Assign a subject to the selected teacher.',
    crumbs: [{ label: 'Admin', href: '/' }, { label: 'Teachers', href: '/Admin/teachers' }, { label: 'Choose Subject' }],
  },
  {
    match: /^\/Admin\/teachers\/addteacher/,
    title: 'Add Teacher',
    subtitle: 'Register a teacher for the selected subject.',
    crumbs: [{ label: 'Admin', href: '/' }, { label: 'Teachers', href: '/Admin/teachers' }, { label: 'Add' }],
  },
  {
    match: /^\/Admin\/teachers\/?$/,
    title: 'Teachers',
    subtitle: 'Manage teaching staff, subject assignments, and class teachers.',
    crumbs: [{ label: 'Admin', href: '/' }, { label: 'People' }, { label: 'Teachers' }],
    action: { label: 'Add Teacher', to: '/Admin/teachers/chooseclass' },
  },
  {
    match: /^\/Admin\/addparent/,
    title: 'Add Parent',
    subtitle: 'Create a parent account and link students.',
    crumbs: [{ label: 'Admin', href: '/' }, { label: 'Parents', href: '/Admin/parents' }, { label: 'Add' }],
  },
  {
    match: /^\/Admin\/parents\/class\//,
    title: 'Class Parents',
    subtitle: 'Parents linked to students in this class.',
    crumbs: [{ label: 'Admin', href: '/' }, { label: 'Parents', href: '/Admin/parents' }, { label: 'Class' }],
  },
  {
    match: /^\/Admin\/parents\/?$/,
    title: 'Parents',
    subtitle: 'Maintain parent accounts and linked students.',
    crumbs: [{ label: 'Admin', href: '/' }, { label: 'People' }, { label: 'Parents' }],
    action: { label: 'Add Parent', to: '/Admin/addparent' },
  },
  {
    match: /^\/Admin\/addstaff/,
    title: 'Add Staff',
    subtitle: 'Register non-teaching staff members.',
    crumbs: [{ label: 'Admin', href: '/' }, { label: 'Staff', href: '/Admin/staff' }, { label: 'Add' }],
  },
  {
    match: /^\/Admin\/staff\/[^/]+$/,
    title: 'Staff Profile',
    subtitle: 'View staff member details.',
    crumbs: [{ label: 'Admin', href: '/' }, { label: 'Staff', href: '/Admin/staff' }, { label: 'Profile' }],
  },
  {
    match: /^\/Admin\/staff\/?$/,
    title: 'Staff',
    subtitle: 'Manage non-teaching staff records and roles.',
    crumbs: [{ label: 'Admin', href: '/' }, { label: 'People' }, { label: 'Staff' }],
    action: { label: 'Add Staff', to: '/Admin/addstaff' },
  },
  {
    match: /^\/Admin\/addclass/,
    title: 'Add Class',
    subtitle: 'Create a new class section.',
    crumbs: [{ label: 'Admin', href: '/' }, { label: 'Classes', href: '/Admin/classes' }, { label: 'Add' }],
  },
  {
    match: /^\/Admin\/classes\/class\//,
    title: 'Class Details',
    subtitle: 'Students, subjects, and class operations.',
    crumbs: [{ label: 'Admin', href: '/' }, { label: 'Classes', href: '/Admin/classes' }, { label: 'Details' }],
  },
  {
    match: /^\/Admin\/addsubject/,
    title: 'Add Subject',
    subtitle: 'Create subjects for the selected class.',
    crumbs: [{ label: 'Admin', href: '/' }, { label: 'Subjects', href: '/Admin/subjects' }, { label: 'Add' }],
  },
  {
    match: /^\/Admin\/subjects\/subject\//,
    title: 'Subject Details',
    subtitle: 'View subject information and linked students.',
    crumbs: [{ label: 'Admin', href: '/' }, { label: 'Subjects', href: '/Admin/subjects' }, { label: 'Details' }],
  },
  {
    match: /^\/Admin\/subjects\/chooseclass/,
    title: 'Choose Class for Subject',
    subtitle: 'Select a class before adding subjects.',
    crumbs: [{ label: 'Admin', href: '/' }, { label: 'Subjects', href: '/Admin/subjects' }, { label: 'Choose Class' }],
  },
  {
    match: /^\/Admin\/timetable\/[^/]+$/,
    title: 'Class Timetable',
    subtitle: 'Edit the weekly schedule for this class.',
    crumbs: [{ label: 'Admin', href: '/' }, { label: 'Timetable', href: '/Admin/timetable' }, { label: 'Schedule' }],
  },
  {
    match: /^\/Admin\/timetable\/?$/,
    title: 'Timetable',
    subtitle: 'Build and review weekly class schedules.',
    crumbs: [{ label: 'Admin', href: '/' }, { label: 'Academics' }, { label: 'Timetable' }],
  },
  {
    match: /^\/Admin\/fees\/class\//,
    title: 'Class Fees',
    subtitle: 'Collect and track fees for this class.',
    crumbs: [{ label: 'Admin', href: '/' }, { label: 'Fees', href: '/Admin/fees' }, { label: 'Class' }],
  },
  {
    match: /^\/Admin\/fees\/?$/,
    title: 'Fee Collection',
    subtitle: 'Track class-wise fee status and pending dues.',
    crumbs: [{ label: 'Admin', href: '/' }, { label: 'Finance' }, { label: 'Fees' }],
  },
  {
    match: /^\/Admin\/payroll\/(staff|teacher)\//,
    title: 'Payroll Details',
    subtitle: 'Salary history and payment records.',
    crumbs: [{ label: 'Admin', href: '/' }, { label: 'Payroll', href: '/Admin/payroll' }, { label: 'Details' }],
  },
  {
    match: /^\/Admin\/payroll\/?$/,
    title: 'Payroll',
    subtitle: 'Manage staff and teacher salary records.',
    crumbs: [{ label: 'Admin', href: '/' }, { label: 'People' }, { label: 'Payroll' }],
  },
  {
    match: /^\/Admin\/stationery\/?$/,
    title: 'Stationery Inventory',
    subtitle: 'Track school stationery stock and purchases.',
    crumbs: [{ label: 'Admin', href: '/' }, { label: 'Operations' }, { label: 'Stationery' }],
  },
  {
    match: /^\/Admin\/invoices\/?$/,
    title: 'Stationery Invoices',
    subtitle: 'Review stationery billing and invoice history.',
    crumbs: [{ label: 'Admin', href: '/' }, { label: 'Stationery', href: '/Admin/stationery' }, { label: 'Invoices' }],
  },
  {
    match: /^\/Admin\/reports\/?$/,
    title: 'Reports Center',
    subtitle: 'Attendance, fees, and operational analytics for school leadership.',
    crumbs: [{ label: 'Admin', href: '/' }, { label: 'Finance' }, { label: 'Reports' }],
  },
  {
    match: /^\/Admin\/addnotice/,
    title: 'Add Notice',
    subtitle: 'Publish a school announcement.',
    crumbs: [{ label: 'Admin', href: '/' }, { label: 'Notices', href: '/Admin/notices' }, { label: 'Add' }],
  },
  {
    match: /^\/Admin\/library\/upload/,
    title: 'Upload Books',
    subtitle: 'Add titles to the school library catalogue.',
    crumbs: [{ label: 'Admin', href: '/' }, { label: 'Library', href: '/Admin/library/books' }, { label: 'Upload' }],
  },
  {
    match: /^\/Admin\/library\/books/,
    title: 'Library Books',
    subtitle: 'Search and manage the school library catalogue.',
    crumbs: [{ label: 'Admin', href: '/' }, { label: 'Operations' }, { label: 'Library' }],
    action: { label: 'Upload Books', to: '/Admin/library/upload' },
  },
  {
    match: /^\/Admin\/frontdesk\/?$/,
    title: 'Front Desk',
    subtitle: 'Visitor check-in, gate operations, and daily desk activity.',
    crumbs: [{ label: 'Admin', href: '/' }, { label: 'Operations' }, { label: 'Front Desk' }],
  },
  {
    match: /^\/Admin\/visitors\/?$/,
    title: 'Visitors Log',
    subtitle: 'Review visitor history and gate entries.',
    crumbs: [{ label: 'Admin', href: '/' }, { label: 'Front Desk', href: '/Admin/frontdesk' }, { label: 'Visitors' }],
  },
  {
    match: /^\/Admin\/ble-attendance\/?$/,
    title: 'BLE Attendance',
    subtitle: 'Monitor beacon-based attendance and classroom presence.',
    crumbs: [{ label: 'Admin', href: '/' }, { label: 'Operations' }, { label: 'BLE Attendance' }],
  },
  {
    match: /^\/Admin\/tracker\/?$/,
    // Tracker page has its own live/playback chrome
    skipChrome: true,
  },
  {
    match: /^\/Admin\/design\/edit/,
    skipChrome: true,
  },
  {
    match: /^\/Admin\/design\/print/,
    title: 'Design Preview',
    subtitle: 'Preview a design with a real school record. Nothing is saved from this page.',
    crumbs: [{ label: 'Admin', href: '/' }, { label: 'Design Studio', href: '/Admin/design' }, { label: 'Preview' }],
  },
  {
    match: /^\/Admin\/design\/data/,
    title: 'Database Explorer',
    subtitle: 'Browse the collections and fields available to document designs.',
    crumbs: [{ label: 'Admin', href: '/' }, { label: 'Design Studio', href: '/Admin/design' }, { label: 'Database' }],
  },
  {
    match: /^\/Admin\/design\/assignments/,
    title: 'Receipt assignments',
    subtitle: 'Choose which Account Department receipt design applies to a student, class, or the whole department.',
    crumbs: [{ label: 'Admin', href: '/' }, { label: 'Design Studio', href: '/Admin/design' }, { label: 'Assignments' }],
  },
  {
    match: /^\/Admin\/design\/settings/,
    title: 'Design Settings',
    subtitle: 'Choose the default design for each document type.',
    crumbs: [{ label: 'Admin', href: '/' }, { label: 'Design Studio', href: '/Admin/design' }, { label: 'Settings' }],
  },
  {
    match: /^\/Admin\/design\/?$/,
    title: 'Design Studio',
    subtitle: 'Design receipts, certificates, cards, and notices from live school records.',
    crumbs: [{ label: 'Admin', href: '/' }, { label: 'Design Studio' }],
  },
  {
    match: /^\/Admin\/profile\/?$/,
    title: 'Admin Profile',
    subtitle: 'Update your school administrator account details.',
    crumbs: [{ label: 'Admin', href: '/' }, { label: 'Profile' }],
  },
];

export function resolveAdminRouteMeta(pathname) {
  const path = pathname || '/';
  for (const route of ROUTES) {
    if (route.match.test(path)) return route;
  }
  return {
    title: 'School Administration',
    subtitle: 'Manage academics, people, finance, and school operations.',
    crumbs: [{ label: 'Admin', href: '/' }],
  };
}
