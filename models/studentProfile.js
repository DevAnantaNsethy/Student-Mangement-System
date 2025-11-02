const mongoose = require("mongoose");

// Use the separate connection passed from server.js
module.exports = (conn) => {
  const studentProfileSchema = new mongoose.Schema({
    studentId: { type: String, required: true, unique: true },
    personalInfo: {
      fullName: String,
      age: Number,
      gender: String,
      email: String,
      phone: String,
      whatsapp: String,
      profilePicture: String, // store as URL or base64
    },
    academicInfo: {
      registrationNo: String,
      branch: String,
      yearOfStudy: Number,
      section: String,
    },
    professionalInfo: {
      role: String,
      skills: String,
      resumeFile: String,
    },
    createdAt: { type: Date, default: Date.now },
  });

  return conn.model("StudentProfile", studentProfileSchema);
};
