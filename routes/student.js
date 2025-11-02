const express = require("express");
const multer = require("multer");
const path = require("path");
const router = express.Router();

// Pass the separate connection from server.js
const StudentProfileModel = require("../models/studentProfile")(
  studentDataConnection
);

// Configure file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, "uploads/"),
    filename: (req, file, cb) => {
      cb(null, Date.now() + "-" + file.originalname);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// Save profile
router.post(
  "/profile",
  upload.fields([
    { name: "profilePicture", maxCount: 1 },
    { name: "resumeFile", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { studentId, personalInfo, academicInfo, professionalInfo } =
        req.body;

      const profileData = {
        studentId,
        personalInfo: JSON.parse(personalInfo),
        academicInfo: JSON.parse(academicInfo),
        professionalInfo: JSON.parse(professionalInfo),
      };

      // Save file URLs if uploaded
      if (req.files["profilePicture"]) {
        profileData.personalInfo.profilePicture = `/uploads/${req.files["profilePicture"][0].filename}`;
      }
      if (req.files["resumeFile"]) {
        profileData.professionalInfo.resumeFile = `/uploads/${req.files["resumeFile"][0].filename}`;
      }

      const existing = await StudentProfileModel.findOne({ studentId });

      if (existing) {
        // Update existing
        await StudentProfileModel.updateOne({ studentId }, profileData);
      } else {
        // Create new
        await StudentProfileModel.create(profileData);
      }

      res.json({ success: true, message: "Profile saved successfully" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// Get profile by studentId
router.get("/profile/:studentId", async (req, res) => {
  try {
    const profile = await StudentProfileModel.findOne({
      studentId: req.params.studentId,
    });
    res.json({ success: true, profile });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Check if profile is complete
router.get("/profile-status/:studentId", async (req, res) => {
  try {
    const profile = await StudentProfileModel.findOne({
      studentId: req.params.studentId,
    });
    const isComplete = !!(
      profile &&
      profile.personalInfo.fullName &&
      profile.academicInfo.registrationNo
    );
    res.json({ success: true, isComplete });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
