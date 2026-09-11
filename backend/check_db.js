require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('./models/studentSchema');

mongoose.connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => {
    try {
        const student = await Student.findOne({ rollNum: 12 });
        if (!student) {
            console.log("Student with roll number 12 not found.");
        } else {
            console.log(`Found Student: ${student.name} (ID: ${student._id})`);
            
            if (!student.faceEmbeddings) {
                console.log("faceEmbeddings field is MISSING or NULL.");
            } else if (!Array.isArray(student.faceEmbeddings)) {
                console.log("faceEmbeddings is present but NOT an array. Type:", typeof student.faceEmbeddings);
            } else if (student.faceEmbeddings.length === 0) {
                console.log("faceEmbeddings is an EMPTY array.");
            } else {
                console.log(`SUCCESS! faceEmbeddings contains ${student.faceEmbeddings.length} items.`);
                
                // Check if it's an array of arrays (which we expect for 5 angles)
                if (Array.isArray(student.faceEmbeddings[0])) {
                    console.log(`Data format: Array of Arrays. First embedding has ${student.faceEmbeddings[0].length} dimensions.`);
                } else {
                    console.log(`Data format: Single 1D Array. Dimensions: ${student.faceEmbeddings.length}.`);
                }
            }
        }
    } catch (err) {
        console.error("Error querying DB:", err);
    } finally {
        mongoose.connection.close();
    }
}).catch(err => {
    console.error("MongoDB Connection Error:", err);
});
