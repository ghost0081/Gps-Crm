require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('./models/adminSchema');
const Subject = require('./models/subjectSchema');

mongoose.connect(process.env.MONGO_URL).then(async () => {
    try {
        const admins = await Admin.find({});
        console.log("Admins:", admins.map(a => `${a.name} (${a._id})`));

        const subjects = await Subject.find({});
        console.log(`\nTotal Subjects in DB: ${subjects.length}`);
        
        if (subjects.length > 0) {
            subjects.forEach(sub => {
                console.log(`Subject: ${sub.subName}, SchoolID: ${sub.school}`);
            });
        }
    } catch (err) {
        console.error("Error querying DB:", err);
    } finally {
        mongoose.connection.close();
    }
});
