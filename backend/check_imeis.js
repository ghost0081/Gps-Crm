
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URL).then(async () => {
    const Student = require('./models/studentSchema');
    const Tracker = require('./models/trackerSchema');

    console.log('=== 1. TRACKERS IN DATABASE (trackers collection) ===');
    const trackers = await Tracker.find({});
    if (trackers.length === 0) {
        console.log('No tracker records found.');
    } else {
        trackers.forEach((t, i) => {
            console.log(`[${i+1}] IMEI: ${t.imei} | Type: ${t.deviceType || 'N/A'} | Status: ${t.status} | Bat: ${t.battery}% | Last Updated: ${t.last_updated} | Path Points: ${(t.path_history || []).length}`);
        });
    }

    console.log('\n=== 2. STUDENTS ASSIGNED TO TRACKERS (students collection) ===');
    const students = await Student.find({ imei: { $exists: true, $ne: null } });
    if (students.length === 0) {
        console.log('No students assigned to IMEIs.');
    } else {
        students.forEach((s, i) => {
            console.log(`[${i+1}] Student: ${s.name} (Roll: ${s.rollNum}) | Assigned IMEI: ${s.imei} | Geofences: ${(s.geofences || []).length}`);
        });
    }

    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
