require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('./models/studentSchema');

mongoose.connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => {
    try {
        console.log("Connected to database. Beginning deletion of all face embeddings...");
        
        // Update all students to have an empty faceEmbeddings array
        const result = await Student.updateMany(
            {}, 
            { $set: { faceEmbeddings: [] } }
        );
        
        console.log(`Success! Modified ${result.modifiedCount} student records.`);
        console.log("All face embeddings have been completely cleared from the database.");
    } catch (err) {
        console.error("Error updating DB:", err);
    } finally {
        mongoose.connection.close();
    }
}).catch(err => {
    console.error("MongoDB Connection Error:", err);
});
