const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const multer = require("multer");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

// QR Code generation
let QRCode;
try {
  QRCode = require("qrcode");
} catch (e) {
  console.log("⚠️ QRCode package not found. Run: npm install qrcode");
}

// WebSocket for chat functionality
let httpServer;
let io;
try {
  const { Server } = require("socket.io");
  httpServer = require("http").createServer(app);
  io = new Server(httpServer, {
    cors: {
      origin: ["http://localhost:8000", "http://localhost:3000", "http://localhost:3001"],
      methods: ["GET", "POST"],
      credentials: true
    }
  });
} catch (e) {
  console.log("⚠️ Socket.IO package not found. Run: npm install socket.io");
}

// Load environment variables
try {
  require("dotenv").config();
} catch (e) {
  console.log("⚠️ Dotenv not found, using default values...");
}

const app = express();
const PORT = process.env.PORT || 3001;

// Security & Middleware
app.use(
  cors({
    origin: [
      "http://localhost:8000",
      "http://localhost:3000",
      "http://localhost:3001",
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(helmet());

// Rate limiting
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many OTP requests, please try again later",
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/send-otp", otpLimiter);
app.use("/api/verify-otp", otpLimiter);
app.use("/api/forgot-password", otpLimiter);
app.use("/api/login", authLimiter);

// File upload configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = () => {
      switch(file.fieldname) {
        case 'profilePicture':
          return 'uploads/profile-pictures/';
        case 'resumeFile':
          return 'uploads/resumes/';
        case 'assignmentAttachment':
          return 'uploads/assignments/';
        case 'submissionAttachment':
          return 'uploads/submissions/';
        case 'chatAttachment':
          return 'uploads/chat/';
        case 'qrCode':
          return 'uploads/qr-codes/';
        default:
          return 'uploads/others/';
      }
    };

    const dir = uploadDir();
    // Ensure directory exists
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const identifier = req.body.registrationNo || req.body.studentId || req.body.assignmentId || 'unknown';
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `${identifier}_${timestamp}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = {
    profilePicture: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    resumeFile: ['application/pdf'],
    assignmentAttachment: [
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain', 'application/zip', 'image/jpeg', 'image/png'
    ],
    submissionAttachment: [
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/zip', 'image/jpeg', 'image/png'
    ],
    chatAttachment: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain'],
    qrCode: ['image/png']
  };

  const fieldAllowedTypes = allowedTypes[file.fieldname];

  if (fieldAllowedTypes && fieldAllowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type for ${file.fieldname}. Allowed types: ${fieldAllowedTypes?.join(', ') || 'none'}`), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max file size
  }
});

// Database connection
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/student-management";
let dbAvailable = false;

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("✅ Connected to MongoDB");
    dbAvailable = true;
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    console.log("⚠️ Server will continue with in-memory storage");
    dbAvailable = false;
  });

// Track DB availability
mongoose.connection.on("connected", () => {
  dbAvailable = true;
  console.log("📦 MongoDB connection: connected");
});

mongoose.connection.on("error", (err) => {
  dbAvailable = false;
  console.warn("📦 MongoDB connection error:", err.message);
});

mongoose.connection.on("disconnected", () => {
  dbAvailable = false;
  console.warn("📦 MongoDB connection: disconnected");
});

// Mongoose Schemas
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["student", "admin"], default: "student" },
  verified: { type: Boolean, default: false },
  resetToken: { type: String },
  resetExpires: { type: Date },
  lastLogin: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

const pendingUserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  otp: { type: String, required: true },
  otpExpires: { type: Date, required: true },
  role: { type: String, enum: ["student", "admin"], default: "student" },
});

// Student Profile Schema
const studentDataSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  personalInfo: {
    fullName: { type: String, required: true },
    age: { type: Number, required: true },
    gender: { type: String, enum: ['Male', 'Female', 'Other'], required: true },
    profilePicture: { type: String },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    whatsapp: { type: String, required: true },
    aliasName: { type: String },
    linkedin: { type: String },
    instagram: { type: String },
    github: { type: String }
  },
  academicInfo: {
    registrationNo: { type: String, required: true, unique: true },
    course: { type: String, default: "BTech" },
    branch: { type: String, enum: ['CSE', 'ME', 'ECE', 'EE', 'Civil'], required: true },
    yearOfStudy: { type: Number, enum: [1, 2, 3, 4], required: true },
    semester: { type: Number, enum: [1, 2, 3, 4, 5, 6, 7, 8], required: true }
  },
  professionalInfo: {
    role: { type: String, enum: ['Developer', 'Frontend Designer', 'Tester'] },
    skills: { type: String },
    resumeFile: { type: String }
  },
  qr: {
    payload: { type: String },
    qrImagePath: { type: String },
    generatedAt: { type: Date }
  },
  completedProfile: { type: Boolean, default: false },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Attendance Schema
const attendanceSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true }, // YYYY-MM-DD format
  status: { type: String, enum: ['present', 'absent', 'late'], required: true },
  markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  markedAt: { type: Date, default: Date.now },
  course: { type: String },
  subject: { type: String },
  remarks: { type: String }
});

// Notices Schema
const noticeSchema = new mongoose.Schema({
  title: { type: String, required: true },
  message: { type: String, required: true },
  postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  postedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
  targetAudience: { type: String, enum: ['all', 'students', 'admin'], default: 'all' }
});

// Assignments Schema
const assignmentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  postedAt: { type: Date, default: Date.now },
  dueDate: { type: Date, required: true },
  course: { type: String, required: true },
  branch: { type: String },
  yearOfStudy: { type: Number },
  semester: { type: Number },
  attachments: [{
    originalName: { type: String },
    storedPath: { type: String },
    mimeType: { type: String },
    size: { type: Number }
  }],
  isActive: { type: Boolean, default: true }
});

// Assignment Submissions Schema
const assignmentSubmissionSchema = new mongoose.Schema({
  assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  submittedAt: { type: Date, default: Date.now },
  attachments: [{
    originalName: { type: String },
    storedPath: { type: String },
    mimeType: { type: String },
    size: { type: Number }
  }],
  remarks: { type: String },
  grade: { type: String },
  feedback: { type: String },
  status: { type: String, enum: ['submitted', 'graded', 'returned'], default: 'submitted' }
});

// Results Schema
const resultSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subject: { type: String, required: true },
  marks: { type: Number, required: true },
  maxMarks: { type: Number, required: true },
  grade: { type: String, required: true },
  remarks: { type: String },
  semester: { type: Number },
  course: { type: String },
  postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  postedAt: { type: Date, default: Date.now },
  academicYear: { type: String }
});

// Chat Schema
const chatSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  createdAt: { type: Date, default: Date.now },
  lastMessageAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true }
});

// Messages Schema
const messageSchema = new mongoose.Schema({
  chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true },
  from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  sentAt: { type: Date, default: Date.now },
  readAt: { type: Date },
  attachments: [{
    originalName: { type: String },
    storedPath: { type: String },
    mimeType: { type: String },
    size: { type: Number }
  }],
  messageType: { type: String, enum: ['text', 'file', 'image'], default: 'text' },
  isEdited: { type: Boolean, default: false },
  editedAt: { type: Date }
});

// Contact Messages Schema
const contactMessageSchema = new mongoose.Schema({
  fromStudent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  sentAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
  adminReply: { type: String },
  repliedAt: { type: Date },
  repliedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

const User = mongoose.model("User", userSchema);
const PendingUser = mongoose.model("PendingUser", pendingUserSchema);
const StudentData = mongoose.model("StudentData", studentDataSchema);
const Attendance = mongoose.model("Attendance", attendanceSchema);
const Notice = mongoose.model("Notice", noticeSchema);
const Assignment = mongoose.model("Assignment", assignmentSchema);
const AssignmentSubmission = mongoose.model("AssignmentSubmission", assignmentSubmissionSchema);
const Result = mongoose.model("Result", resultSchema);
const Chat = mongoose.model("Chat", chatSchema);
const Message = mongoose.model("Message", messageSchema);
const ContactMessage = mongoose.model("ContactMessage", contactMessageSchema);

// In-memory fallbacks (used only when dbAvailable === false)
const memoryUsers = new Map(); // key=email, value={name,email,password,role,verified}
const memoryPending = new Map(); // key=email, value={otp, otpExpires, role}
const memoryResets = new Map(); // key=token, value={email, expires}

// Note: Student routes are now handled by the profile endpoints below

// Email configuration
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Utility functions
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateResetToken() {
  return crypto.randomUUID();
}

async function hashPassword(password) {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

async function comparePassword(password, hashedPassword) {
  return await bcrypt.compare(password, hashedPassword);
}

// Utility functions for new features

// QR Code payload signing
function generateQRPayload(studentId, issuedAt) {
  const QR_SIGN_KEY = process.env.QR_SIGN_KEY || 'default-qr-secret-key-change-in-production';
  const payload = {
    studentId: studentId,
    issuedAt: issuedAt,
    sig: crypto.createHmac('sha256', QR_SIGN_KEY).update(`${studentId}-${issuedAt}`).digest('hex')
  };
  return JSON.stringify(payload);
}

function verifyQRSignature(payload) {
  try {
    const QR_SIGN_KEY = process.env.QR_SIGN_KEY || 'default-qr-secret-key-change-in-production';
    const data = JSON.parse(payload);
    const expectedSig = crypto.createHmac('sha256', QR_SIGN_KEY).update(`${data.studentId}-${data.issuedAt}`).digest('hex');

    if (data.sig !== expectedSig) {
      return null; // Invalid signature
    }

    return data;
  } catch (error) {
    return null; // Invalid payload
  }
}

// Calculate attendance percentage
async function calculateAttendancePercentage(studentId, fromDate = null, toDate = null) {
  if (!dbAvailable) return 0;

  const matchQuery = { studentId };
  if (fromDate && toDate) {
    matchQuery.date = { $gte: fromDate, $lte: toDate };
  }

  const totalRecords = await Attendance.countDocuments(matchQuery);
  if (totalRecords === 0) return 0;

  const presentRecords = await Attendance.countDocuments({
    ...matchQuery,
    status: { $in: ['present', 'late'] }
  });

  return Math.round((presentRecords / totalRecords) * 100);
}

// Get or create chat between two users
async function getOrCreateChat(user1Id, user2Id) {
  if (!dbAvailable) return null;

  // Find existing chat
  let chat = await Chat.findOne({
    participants: { $all: [user1Id, user2Id], $size: 2 },
    isActive: true
  });

  if (!chat) {
    // Create new chat
    chat = await Chat.create({
      participants: [user1Id, user2Id],
      createdAt: new Date()
    });
  }

  return chat;
}

// Send notification via email (for new assignments, notices, etc.)
async function sendNotificationEmail(recipients, subject, message, type = 'general') {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: Array.isArray(recipients) ? recipients.join(',') : recipients,
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #7b61ff; margin-bottom: 10px;">Roland Institute of Technology</h1>
            <h2 style="color: #333; margin-top: 0;">${type === 'assignment' ? 'New Assignment' : type === 'notice' ? 'Important Notice' : 'Notification'}</h2>
          </div>

          <div style="background-color: #f8f9fa; border-left: 4px solid #7b61ff; padding: 20px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">${subject}</h3>
            <div style="color: #555; line-height: 1.6;">${message}</div>
          </div>

          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">

          <div style="text-align: center;">
            <p style="color: #999; font-size: 12px; margin: 0;">Roland Institute of Technology</p>
            <p style="color: #999; font-size: 12px; margin: 5px 0 0 0;">Student Management System</p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Notification email sent to: ${recipients}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send notification email:`, error.message);
    return false;
  }
}

// Email functions
async function sendOTPEmail(email, otp, type = "signup") {
  const subject =
    type === "signup"
      ? "Email Verification - Student Management System"
      : "Password Reset OTP";
  const title = type === "signup" ? "Email Verification" : "Password Reset";

  try {
    console.log(`\n📧 Sending ${type} email to: ${email}`);

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #7b61ff; margin-bottom: 10px;">Roland Institute of Technology</h1>
            <h2 style="color: #333; margin-top: 0;">${title}</h2>
          </div>
          
          <p style="color: #555; font-size: 16px;">Hello,</p>
          <p style="color: #555; font-size: 16px;">
            ${
              type === "signup"
                ? "Thank you for signing up for the Student Management System."
                : "You requested to reset your password."
            } 
            Please use the following OTP to verify your identity:
          </p>
          
          <div style="background-color: #f8f9fa; border: 2px solid #7b61ff; border-radius: 8px; padding: 30px; text-align: center; margin: 30px 0;">
            <p style="color: #666; margin-bottom: 10px; font-size: 14px;">Your OTP Code:</p>
            <h1 style="color: #7b61ff; font-size: 36px; margin: 0; letter-spacing: 3px; font-weight: bold;">${otp}</h1>
          </div>
          
          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 15px; margin: 20px 0;">
            <p style="color: #856404; margin: 0; font-size: 14px;">
              ⏰ <strong>Important:</strong> This OTP will expire in <strong>10 minutes</strong>.
            </p>
          </div>
          
          <p style="color: #555; font-size: 14px;">If you didn't request this verification, please ignore this email.</p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          
          <div style="text-align: center;">
            <p style="color: #999; font-size: 12px; margin: 0;">Roland Institute of Technology</p>
            <p style="color: #999; font-size: 12px; margin: 5px 0 0 0;">Student Management System</p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent successfully to ${email}!`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send email to ${email}:`, error.message);

    // Check for common Gmail errors
    if (error.message.includes("Invalid login")) {
      console.error("🚨 Gmail Authentication Error: Check your app password!");
    } else if (error.message.includes("self signed certificate")) {
      console.error("🚨 Certificate Error: Gmail SMTP connection failed");
    }

    // Fallback: display OTP in console for development
    console.log(`\n${"=".repeat(50)}`);
    console.log("📧 OTP EMAIL VERIFICATION (FALLBACK MODE)");
    console.log("=".repeat(50));
    console.log(`📧 Email: ${email}`);
    console.log(`🔐 OTP: ${otp}`);
    console.log(`⏰ Expires in 10 minutes`);
    console.log("=".repeat(50) + "\n");

    return true; // Return true even if email fails for development
  }
}

async function sendPasswordResetEmail(email, resetToken) {
  const resetLink = `http://localhost:${PORT}/reset-password.html?token=${resetToken}`;

  try {
    console.log(`\n🔄 Sending password reset email to: ${email}`);

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Password Reset - Student Management System",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #7b61ff; margin-bottom: 10px;">Roland Institute of Technology</h1>
            <h2 style="color: #333; margin-top: 0;">Password Reset Request</h2>
          </div>
          
          <p style="color: #555; font-size: 16px;">Hello,</p>
          <p style="color: #555; font-size: 16px;">
            You requested to reset your password for your Student Management System account.
            Click the button below to reset your password:
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background-color: #7b61ff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-size: 16px; font-weight: bold;">
              Reset My Password
            </a>
          </div>
          
          <div style="background-color: #f8f9fa; border: 1px solid #dee2e6; border-radius: 6px; padding: 15px; margin: 20px 0;">
            <p style="color: #495057; margin: 0; font-size: 14px;">
              <strong>Alternative:</strong> If the button doesn't work, copy and paste this link in your browser:
            </p>
            <p style="color: #007bff; font-size: 12px; word-break: break-all; margin: 10px 0 0 0;">
              ${resetLink}
            </p>
          </div>
          
          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 15px; margin: 20px 0;">
            <p style="color: #856404; margin: 0; font-size: 14px;">
              ⏰ <strong>Important:</strong> This link will expire in <strong>1 hour</strong>.
            </p>
          </div>
          
          <p style="color: #555; font-size: 14px;">If you didn't request this password reset, please ignore this email. Your password will remain unchanged.</p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          
          <div style="text-align: center;">
            <p style="color: #999; font-size: 12px; margin: 0;">Roland Institute of Technology</p>
            <p style="color: #999; font-size: 12px; margin: 5px 0 0 0;">Student Management System</p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Password reset email sent successfully to ${email}!`);
    return true;
  } catch (error) {
    console.error(
      `❌ Failed to send password reset email to ${email}:`,
      error.message
    );

    // Fallback: display reset link in console
    console.log(`\n${"=".repeat(50)}`);
    console.log("🔄 PASSWORD RESET LINK (FALLBACK MODE)");
    console.log("=".repeat(50));
    console.log(`📧 Email: ${email}`);
    console.log(`🔗 Reset Link: ${resetLink}`);
    console.log(`⏰ Expires in 1 hour`);
    console.log("=".repeat(50) + "\n");

    return true;
  }
}

// ===== API ROUTES =====

// Profile Management Routes

// 1. Save Student Profile
app.post("/api/student/profile", upload.fields([
  { name: 'profilePicture', maxCount: 1 },
  { name: 'resumeFile', maxCount: 1 }
]), async (req, res) => {
  try {
    const { studentId, personalInfo, academicInfo, professionalInfo } = req.body;
    
    if (!studentId) {
      return res.status(400).json({ success: false, message: "Student ID is required" });
    }

    // Parse JSON strings if they come as strings
    const personal = typeof personalInfo === 'string' ? JSON.parse(personalInfo) : personalInfo;
    const academic = typeof academicInfo === 'string' ? JSON.parse(academicInfo) : academicInfo;
    const professional = typeof professionalInfo === 'string' ? JSON.parse(professionalInfo) : professionalInfo;

    // Validate required fields
    if (!personal.fullName || !personal.age || !personal.gender || !personal.email || !personal.phone || !personal.whatsapp) {
      return res.status(400).json({ success: false, message: "All personal information fields are required" });
    }

    if (!academic.registrationNo || !academic.branch || !academic.yearOfStudy || !academic.section) {
      return res.status(400).json({ success: false, message: "All academic information fields are required" });
    }

    // Handle file uploads
    let profilePicturePath = null;
    let resumeFilePath = null;

    if (req.files) {
      if (req.files.profilePicture && req.files.profilePicture[0]) {
        const profileFile = req.files.profilePicture[0];
        try {
          // Resize profile picture to 200x200
          await sharp(profileFile.path)
            .resize(200, 200, { fit: 'cover' })
            .jpeg({ quality: 80 })
            .toFile(profileFile.path.replace(path.extname(profileFile.path), '_resized.jpg'));
          
          // Replace original with resized version
          fs.unlinkSync(profileFile.path);
          profilePicturePath = profileFile.path.replace(path.extname(profileFile.path), '_resized.jpg');
        } catch (error) {
          console.error('Error processing profile picture:', error);
          profilePicturePath = profileFile.path; // Use original if resize fails
        }
      }

      if (req.files.resumeFile && req.files.resumeFile[0]) {
        resumeFilePath = req.files.resumeFile[0].path;
      }
    }

    // Check if profile already exists
    let existingProfile;
    if (dbAvailable) {
      existingProfile = await StudentData.findOne({ studentId });
    }

    const profileData = {
      studentId,
      personalInfo: {
        ...personal,
        profilePicture: profilePicturePath
      },
      academicInfo: academic,
      professionalInfo: {
        ...professional,
        resumeFile: resumeFilePath
      },
      isComplete: true,
      updatedAt: new Date()
    };

    if (existingProfile) {
      // Update existing profile
      if (dbAvailable) {
        await StudentData.updateOne({ studentId }, profileData);
      }
    } else {
      // Create new profile
      if (dbAvailable) {
        await StudentData.create(profileData);
      }
    }

    res.json({
      success: true,
      message: "Profile saved successfully",
      profile: profileData
    });

  } catch (error) {
    console.error("Save profile error:", error);
    res.status(500).json({ success: false, message: "Server error occurred" });
  }
});

// 2. Get Student Profile
app.get("/api/student/profile/:studentId", async (req, res) => {
  try {
    const { studentId } = req.params;

    if (dbAvailable) {
      const profile = await StudentData.findOne({ studentId });
      if (!profile) {
        return res.status(404).json({ success: false, message: "Profile not found" });
      }
      res.json({ success: true, profile });
    } else {
      res.status(503).json({ success: false, message: "Database not available" });
    }
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ success: false, message: "Server error occurred" });
  }
});

// 3. Check Profile Completion Status
app.get("/api/student/profile-status/:studentId", async (req, res) => {
  try {
    const { studentId } = req.params;

    if (dbAvailable) {
      const profile = await StudentData.findOne({ studentId });
      res.json({
        success: true,
        isComplete: profile ? profile.isComplete : false,
        profile: profile || null
      });
    } else {
      res.json({ success: true, isComplete: false, profile: null });
    }
  } catch (error) {
    console.error("Check profile status error:", error);
    res.status(500).json({ success: false, message: "Server error occurred" });
  }
});

// 4. Update Student Profile
app.put("/api/student/profile/:studentId", upload.fields([
  { name: 'profilePicture', maxCount: 1 },
  { name: 'resumeFile', maxCount: 1 }
]), async (req, res) => {
  try {
    const { studentId } = req.params;
    const { personalInfo, academicInfo, professionalInfo } = req.body;

    if (dbAvailable) {
      const existingProfile = await StudentData.findOne({ studentId });
      if (!existingProfile) {
        return res.status(404).json({ success: false, message: "Profile not found" });
      }

      // Parse JSON strings if they come as strings
      const personal = typeof personalInfo === 'string' ? JSON.parse(personalInfo) : personalInfo;
      const academic = typeof academicInfo === 'string' ? JSON.parse(academicInfo) : academicInfo;
      const professional = typeof professionalInfo === 'string' ? JSON.parse(professionalInfo) : professionalInfo;

      // Handle file uploads
      let profilePicturePath = existingProfile.personalInfo.profilePicture;
      let resumeFilePath = existingProfile.professionalInfo.resumeFile;

      if (req.files) {
        if (req.files.profilePicture && req.files.profilePicture[0]) {
          const profileFile = req.files.profilePicture[0];
          try {
            // Resize profile picture to 200x200
            await sharp(profileFile.path)
              .resize(200, 200, { fit: 'cover' })
              .jpeg({ quality: 80 })
              .toFile(profileFile.path.replace(path.extname(profileFile.path), '_resized.jpg'));
            
            // Replace original with resized version
            fs.unlinkSync(profileFile.path);
            profilePicturePath = profileFile.path.replace(path.extname(profileFile.path), '_resized.jpg');
          } catch (error) {
            console.error('Error processing profile picture:', error);
            profilePicturePath = profileFile.path;
          }
        }

        if (req.files.resumeFile && req.files.resumeFile[0]) {
          resumeFilePath = req.files.resumeFile[0].path;
        }
      }

      const updateData = {
        personalInfo: {
          ...personal,
          profilePicture: profilePicturePath
        },
        academicInfo: academic,
        professionalInfo: {
          ...professional,
          resumeFile: resumeFilePath
        },
        updatedAt: new Date()
      };

      await StudentData.updateOne({ studentId }, updateData);
      res.json({ success: true, message: "Profile updated successfully" });
    } else {
      res.status(503).json({ success: false, message: "Database not available" });
    }
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ success: false, message: "Server error occurred" });
  }
});

// 1. Send OTP for signup
app.post("/api/send-otp", async (req, res) => {
  try {
    const { email, role = "student" } = req.body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid email address" });
    }

    // Check if user already exists
    let existingUser;
    if (dbAvailable) {
      existingUser = await User.findOne({ email });
    } else {
      existingUser = memoryUsers.get(email);
    }

    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, message: "User already exists" });
    }

    const otp = generateOTP();
    const expiryTime = Date.now() + 10 * 60 * 1000; // 10 minutes

    if (dbAvailable) {
      await PendingUser.findOneAndUpdate(
        { email },
        { otp, otpExpires: new Date(expiryTime), role },
        { upsert: true, new: true, runValidators: true }
      );
    } else {
      memoryPending.set(email, { otp, otpExpires: new Date(expiryTime), role });
    }

    const emailSent = await sendOTPEmail(email, otp, "signup");

    if (emailSent) {
      res.json({
        success: true,
        message: "OTP sent successfully to your email",
      });
    } else {
      res.status(500).json({ success: false, message: "Failed to send OTP" });
    }
  } catch (error) {
    console.error("Send OTP error:", error);
    res.status(500).json({ success: false, message: "Server error occurred" });
  }
});

// 2. Verify OTP for signup
app.post("/api/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res
        .status(400)
        .json({ success: false, message: "Email and OTP are required" });
    }

    let pending;
    if (dbAvailable) {
      pending = await PendingUser.findOne({ email });
    } else {
      pending = memoryPending.get(email);
    }

    if (!pending) {
      return res
        .status(400)
        .json({ success: false, message: "OTP not found or expired" });
    }

    const pendingOtp = dbAvailable ? pending.otp : pending.otp;
    const pendingExp = dbAvailable ? pending.otpExpires : pending.otpExpires;

    if (pendingOtp !== otp || pendingExp < new Date()) {
      if (dbAvailable) {
        await PendingUser.deleteOne({ email });
      } else {
        memoryPending.delete(email);
      }
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired OTP" });
    }

    // Mark as verified but keep in storage for signup completion
    if (dbAvailable) {
      pending.verified = true;
      await pending.save();
    } else {
      pending.verified = true;
      memoryPending.set(email, pending);
    }

    res.json({ success: true, message: "Email verified successfully" });
  } catch (error) {
    console.error("Verify OTP error:", error);
    res.status(500).json({ success: false, message: "Server error occurred" });
  }
});

// 3. Complete registration
app.post("/api/register", async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      confirmPassword,
      role = "student",
    } = req.body;

    if (!name || !email || !password || !confirmPassword) {
      return res
        .status(400)
        .json({ success: false, message: "All fields are required" });
    }

    if (password !== confirmPassword) {
      return res
        .status(400)
        .json({ success: false, message: "Passwords do not match" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Password must be at least 6 characters",
        });
    }

    // Check if email was verified
    let pending;
    if (dbAvailable) {
      pending = await PendingUser.findOne({ email });
    } else {
      pending = memoryPending.get(email);
    }

    if (!pending || !pending.verified) {
      return res
        .status(400)
        .json({ success: false, message: "Email not verified" });
    }

    // Check if user already exists
    let existingUser;
    if (dbAvailable) {
      existingUser = await User.findOne({ email });
    } else {
      existingUser = memoryUsers.get(email);
    }

    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, message: "User already exists" });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const userId = crypto.randomUUID();
    const userData = {
      id: userId,
      name,
      email,
      password: hashedPassword,
      role: pending.role || role,
      verified: true,
      createdAt: new Date().toISOString(),
    };

    if (dbAvailable) {
      await User.create({
        name: userData.name,
        email: userData.email,
        password: userData.password,
        role: userData.role,
        verified: userData.verified,
      });
      await PendingUser.deleteOne({ email });
    } else {
      memoryUsers.set(email, userData);
      memoryPending.delete(email);
    }

    console.log(`✅ ${userData.role.toUpperCase()} registered:`, {
      email,
      name,
      role: userData.role,
    });

    res.json({
      success: true,
      message: "Registration completed successfully",
      user: { id: userId, name, email, role: userData.role },
    });
  } catch (error) {
    console.error("Registration error:", error);

    if (error.code === 11000) {
      return res
        .status(400)
        .json({
          success: false,
          message: "User with this email already exists",
        });
    }

    res.status(500).json({ success: false, message: "Server error occurred" });
  }
});

// 4. Login (both student and admin)
app.post("/api/login", async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Email and password are required" });
    }

    let user;
    if (dbAvailable) {
      user = await User.findOne({ email });
    } else {
      user = memoryUsers.get(email);
    }

    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "User not found" });
    }

    // Compare password
    const passwordMatch = await comparePassword(password, user.password);
    if (!passwordMatch) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid password" });
    }

    // Check role if specified
    if (role && user.role !== role) {
      return res
        .status(400)
        .json({
          success: false,
          message: `Access denied. This is for ${role}s only.`,
        });
    }

    // Update last login
    if (dbAvailable) {
      await User.updateOne({ email }, { lastLogin: new Date() });
    } else {
      user.lastLogin = new Date();
      memoryUsers.set(email, user);
    }

    console.log(`✅ ${user.role.toUpperCase()} logged in:`, user.email);

    res.json({
      success: true,
      message: "Login successful",
      user: {
        id: user.id || user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, message: "Server error occurred" });
  }
});

// 5. Forgot password - send reset link
app.post("/api/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Email is required" });
    }

    let user;
    if (dbAvailable) {
      user = await User.findOne({ email });
    } else {
      user = memoryUsers.get(email);
    }

    if (!user) {
      // Don't reveal if user exists for security
      return res.json({
        success: true,
        message: "If the email exists, a reset link has been sent",
      });
    }

    const resetToken = generateResetToken();
    const expiryTime = Date.now() + 60 * 60 * 1000; // 1 hour

    if (dbAvailable) {
      await User.updateOne(
        { email },
        { resetToken, resetExpires: new Date(expiryTime) }
      );
    } else {
      memoryResets.set(resetToken, { email, expires: new Date(expiryTime) });
    }

    await sendPasswordResetEmail(email, resetToken);

    res.json({
      success: true,
      message: "Password reset link sent to your email",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ success: false, message: "Server error occurred" });
  }
});

// 6. Reset password with token
app.post("/api/reset-password", async (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;

    if (!token || !newPassword || !confirmPassword) {
      return res
        .status(400)
        .json({ success: false, message: "All fields are required" });
    }

    if (newPassword !== confirmPassword) {
      return res
        .status(400)
        .json({ success: false, message: "Passwords do not match" });
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Password must be at least 6 characters",
        });
    }

    let tokenData;
    if (dbAvailable) {
      const user = await User.findOne({
        resetToken: token,
        resetExpires: { $gt: new Date() },
      });
      if (!user) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid or expired reset token" });
      }

      // Update password
      const hashedPassword = await hashPassword(newPassword);
      await User.updateOne(
        { email: user.email },
        {
          password: hashedPassword,
          resetToken: undefined,
          resetExpires: undefined,
        }
      );
    } else {
      tokenData = memoryResets.get(token);
      if (!tokenData || tokenData.expires < new Date()) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid or expired reset token" });
      }

      const user = memoryUsers.get(tokenData.email);
      if (!user) {
        return res
          .status(400)
          .json({ success: false, message: "User not found" });
      }

      // Update password
      user.password = await hashPassword(newPassword);
      memoryUsers.set(tokenData.email, user);
      memoryResets.delete(token);
    }

    console.log(
      `✅ Password reset for:`,
      dbAvailable ? "user" : tokenData.email
    );

    res.json({ success: true, message: "Password reset successfully" });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ success: false, message: "Server error occurred" });
  }
});

// 7. Get user info (for dashboard)
app.get("/api/user/:email", async (req, res) => {
  try {
    const { email } = req.params;

    let user;
    if (dbAvailable) {
      user = await User.findOne({ email }).select("-password");
    } else {
      user = memoryUsers.get(email);
      if (user) {
        delete user.password; // Remove password from response
      }
    }

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.json({
      success: true,
      user: {
        id: user.id || user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        verified: user.verified,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
      },
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ success: false, message: "Server error occurred" });
  }
});

// ===== NEW FEATURE API ROUTES =====

// 1. Admin Student Management

// Get all students with pagination and search
app.get("/api/admin/students", async (req, res) => {
  try {
    const { q = '', page = 1, limit = 10, sort = 'fullName', order = 'asc' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    if (!dbAvailable) {
      return res.status(503).json({ success: false, message: "Database not available" });
    }

    // Build search query
    const searchQuery = q ? {
      $or: [
        { 'personalInfo.fullName': { $regex: q, $options: 'i' } },
        { 'academicInfo.registrationNo': { $regex: q, $options: 'i' } },
        { 'academicInfo.branch': { $regex: q, $options: 'i' } }
      ]
    } : {};

    // Get total count
    const total = await StudentData.countDocuments(searchQuery);

    // Get students with pagination
    const students = await StudentData.find(searchQuery)
      .populate('studentId', 'email role')
      .sort({ [sort]: order === 'desc' ? -1 : 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('studentId personalInfo.fullName personalInfo.email academicInfo.registrationNo academicInfo.course academicInfo.branch academicInfo.yearOfStudy academicInfo.semester status qr.completedProfile');

    // Calculate attendance percentage for each student
    const studentsWithAttendance = await Promise.all(
      students.map(async (student) => {
        const attendancePercentage = await calculateAttendancePercentage(student.studentId._id);
        return {
          ...student.toObject(),
          attendancePercentage,
          fullName: student.personalInfo.fullName,
          registrationNo: student.academicInfo.registrationNo,
          course: student.academicInfo.course,
          branch: student.academicInfo.branch,
          yearOfStudy: student.academicInfo.yearOfStudy,
          status: student.status,
          completedProfile: student.completedProfile,
          email: student.studentId.email,
          userId: student.studentId._id
        };
      })
    );

    res.json({
      success: true,
      students: studentsWithAttendance,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error("Get students error:", error);
    res.status(500).json({ success: false, message: "Server error occurred" });
  }
});

// Get single student details
app.get("/api/admin/student/:studentId", async (req, res) => {
  try {
    const { studentId } = req.params;

    if (!dbAvailable) {
      return res.status(503).json({ success: false, message: "Database not available" });
    }

    const student = await StudentData.findOne({ studentId })
      .populate('studentId', 'email role createdAt lastLogin');

    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    const attendancePercentage = await calculateAttendancePercentage(studentId);

    res.json({
      success: true,
      student: {
        ...student.toObject(),
        attendancePercentage
      }
    });

  } catch (error) {
    console.error("Get student details error:", error);
    res.status(500).json({ success: false, message: "Server error occurred" });
  }
});

// 2. QR Code Generation and Management

// Generate or retrieve student QR code
app.get("/api/student/:studentId/qr", async (req, res) => {
  try {
    const { studentId } = req.params;

    if (!dbAvailable) {
      return res.status(503).json({ success: false, message: "Database not available" });
    }

    if (!QRCode) {
      return res.status(500).json({ success: false, message: "QR code generation not available" });
    }

    const student = await StudentData.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    // Check if QR already exists
    if (student.qr && student.qr.qrImagePath && fs.existsSync(student.qr.qrImagePath)) {
      return res.json({
        success: true,
        qrUrl: `/uploads/qr-codes/${path.basename(student.qr.qrImagePath)}`,
        generatedAt: student.qr.generatedAt
      });
    }

    // Generate new QR code
    const issuedAt = new Date().toISOString();
    const payload = generateQRPayload(studentId, issuedAt);

    const qrFileName = `qr_${student.academicInfo.registrationNo}_${Date.now()}.png`;
    const qrPath = `uploads/qr-codes/${qrFileName}`;

    // Generate QR code
    await QRCode.toFile(qrPath, payload, {
      width: 200,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    // Update student record with QR info
    await StudentData.updateOne(
      { studentId },
      {
        qr: {
          payload,
          qrImagePath: qrPath,
          generatedAt: new Date()
        }
      }
    );

    res.json({
      success: true,
      qrUrl: `/uploads/qr-codes/${qrFileName}`,
      generatedAt: new Date()
    });

  } catch (error) {
    console.error("Generate QR code error:", error);
    res.status(500).json({ success: false, message: "Server error occurred" });
  }
});

// 3. Attendance Management

// Mark attendance via QR scan
app.post("/api/admin/attendance/scan", async (req, res) => {
  try {
    const { payload } = req.body;
    const adminId = req.body.adminId; // Should be validated via middleware

    if (!payload || !adminId) {
      return res.status(400).json({ success: false, message: "Invalid request data" });
    }

    // Verify QR signature
    const qrData = verifyQRSignature(payload);
    if (!qrData) {
      return res.status(400).json({ success: false, message: "Invalid QR code" });
    }

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    if (!dbAvailable) {
      return res.status(503).json({ success: false, message: "Database not available" });
    }

    // Check if attendance already marked for today
    const existingAttendance = await Attendance.findOne({
      studentId: qrData.studentId,
      date: today
    });

    if (existingAttendance) {
      return res.json({
        success: true,
        message: "Attendance already marked for today",
        attendance: existingAttendance
      });
    }

    // Get student info
    const student = await StudentData.findOne({ studentId: qrData.studentId })
      .populate('studentId', 'name email');

    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    // Mark attendance
    const attendance = await Attendance.create({
      studentId: qrData.studentId,
      date: today,
      status: 'present',
      markedBy: adminId,
      markedAt: new Date(),
      course: student.academicInfo.course,
      branch: student.academicInfo.branch
    });

    console.log(`✅ Attendance marked for ${student.studentId.name} (${student.academicInfo.registrationNo})`);

    res.json({
      success: true,
      message: "Attendance marked successfully",
      attendance,
      studentName: student.studentId.name,
      registrationNo: student.academicInfo.registrationNo
    });

  } catch (error) {
    console.error("Mark attendance error:", error);
    res.status(500).json({ success: false, message: "Server error occurred" });
  }
});

// Manual attendance marking
app.post("/api/admin/attendance/manual", async (req, res) => {
  try {
    const { studentId, status, date, remarks, course, subject, adminId } = req.body;

    if (!studentId || !status || !date || !adminId) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    if (!dbAvailable) {
      return res.status(503).json({ success: false, message: "Database not available" });
    }

    // Upsert attendance (update if exists, create if not)
    const attendance = await Attendance.findOneAndUpdate(
      { studentId, date },
      {
        status,
        markedBy: adminId,
        markedAt: new Date(),
        remarks,
        course,
        subject
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: "Attendance marked successfully",
      attendance
    });

  } catch (error) {
    console.error("Manual attendance marking error:", error);
    res.status(500).json({ success: false, message: "Server error occurred" });
  }
});

// Get attendance records
app.get("/api/admin/attendance/report", async (req, res) => {
  try {
    const { fromDate, toDate, branch, yearOfStudy } = req.query;

    if (!dbAvailable) {
      return res.status(503).json({ success: false, message: "Database not available" });
    }

    const matchQuery = {};
    if (fromDate && toDate) {
      matchQuery.date = { $gte: fromDate, $lte: toDate };
    }

    // Get attendance records with student info
    const attendanceRecords = await Attendance.find(matchQuery)
      .populate({
        path: 'studentId',
        select: 'name email',
        match: { role: 'student' }
      })
      .populate('markedBy', 'name')
      .sort({ date: -1, markedAt: -1 });

    // Filter by branch/year if specified
    let filteredRecords = attendanceRecords;
    if (branch || yearOfStudy) {
      const studentIds = attendanceRecords.map(r => r.studentId._id);
      const studentFilter = {};
      if (branch) studentFilter['academicInfo.branch'] = branch;
      if (yearOfStudy) studentFilter['academicInfo.yearOfStudy'] = parseInt(yearOfStudy);

      const students = await StudentData.find({
        studentId: { $in: studentIds },
        ...studentFilter
      }).select('studentId');

      const validStudentIds = students.map(s => s.studentId);
      filteredRecords = attendanceRecords.filter(r => validStudentIds.includes(r.studentId._id));
    }

    res.json({
      success: true,
      attendanceRecords: filteredRecords,
      total: filteredRecords.length
    });

  } catch (error) {
    console.error("Get attendance report error:", error);
    res.status(500).json({ success: false, message: "Server error occurred" });
  }
});

// 4. Student Attendance Views

// Get student attendance with date range
app.get("/api/student/:studentId/attendance", async (req, res) => {
  try {
    const { studentId } = req.params;
    const { from, to } = req.query;

    if (!dbAvailable) {
      return res.status(503).json({ success: false, message: "Database not available" });
    }

    const matchQuery = { studentId };
    if (from && to) {
      matchQuery.date = { $gte: from, $lte: to };
    }

    const attendanceRecords = await Attendance.find(matchQuery)
      .populate('markedBy', 'name')
      .sort({ date: -1 });

    res.json({
      success: true,
      attendanceRecords
    });

  } catch (error) {
    console.error("Get student attendance error:", error);
    res.status(500).json({ success: false, message: "Server error occurred" });
  }
});

// Get student attendance summary
app.get("/api/student/:studentId/attendance/summary", async (req, res) => {
  try {
    const { studentId } = req.params;

    if (!dbAvailable) {
      return res.status(503).json({ success: false, message: "Database not available" });
    }

    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const monthStart = `${currentMonth}-01`;
    const monthEnd = `${currentMonth}-31`;

    // Get current month attendance
    const currentMonthAttendance = await Attendance.find({
      studentId,
      date: { $gte: monthStart, $lte: monthEnd }
    });

    const totalDays = currentMonthAttendance.length;
    const presentDays = currentMonthAttendance.filter(a => a.status === 'present' || a.status === 'late').length;
    const percentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

    // Get overall attendance
    const overallPercentage = await calculateAttendancePercentage(studentId);

    res.json({
      success: true,
      summary: {
        currentMonth: {
          totalDays,
          presentDays,
          percentage,
          month: currentMonth
        },
        overall: {
          percentage: overallPercentage
        }
      }
    });

  } catch (error) {
    console.error("Get attendance summary error:", error);
    res.status(500).json({ success: false, message: "Server error occurred" });
  }
});

// 5. Notices Management

// Create notice
app.post("/api/admin/notice", async (req, res) => {
  try {
    const { title, message, durationHours = 24, targetAudience = 'all', postedBy } = req.body;

    if (!title || !message || !postedBy) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    if (!dbAvailable) {
      return res.status(503).json({ success: false, message: "Database not available" });
    }

    const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);

    const notice = await Notice.create({
      title,
      message,
      postedBy,
      postedAt: new Date(),
      expiresAt,
      targetAudience,
      isActive: true
    });

    // Send email notification to all students
    if (targetAudience === 'all' || targetAudience === 'students') {
      const students = await User.find({ role: 'student' }, 'email');
      const studentEmails = students.map(s => s.email);
      if (studentEmails.length > 0) {
        await sendNotificationEmail(studentEmails, title, message, 'notice');
      }
    }

    res.json({
      success: true,
      message: "Notice created successfully",
      notice
    });

  } catch (error) {
    console.error("Create notice error:", error);
    res.status(500).json({ success: false, message: "Server error occurred" });
  }
});

// Get active notices
app.get("/api/notices", async (req, res) => {
  try {
    if (!dbAvailable) {
      return res.json({ success: true, notices: [] });
    }

    const notices = await Notice.find({
      isActive: true,
      expiresAt: { $gt: new Date() }
    })
      .populate('postedBy', 'name')
      .sort({ postedAt: -1 });

    res.json({
      success: true,
      notices
    });

  } catch (error) {
    console.error("Get notices error:", error);
    res.status(500).json({ success: false, message: "Server error occurred" });
  }
});

// 6. Assignments Management

// Create assignment
app.post("/api/admin/assignment", upload.array('assignmentAttachment', 5), async (req, res) => {
  try {
    const { title, description, dueDate, course, branch, yearOfStudy, semester, postedBy } = req.body;

    if (!title || !description || !dueDate || !course || !postedBy) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    if (!dbAvailable) {
      return res.status(503).json({ success: false, message: "Database not available" });
    }

    // Process attachments
    const attachments = [];
    if (req.files) {
      req.files.forEach(file => {
        attachments.push({
          originalName: file.originalname,
          storedPath: file.path,
          mimeType: file.mimetype,
          size: file.size
        });
      });
    }

    const assignment = await Assignment.create({
      title,
      description,
      postedBy,
      postedAt: new Date(),
      dueDate: new Date(dueDate),
      course,
      branch,
      yearOfStudy: yearOfStudy ? parseInt(yearOfStudy) : undefined,
      semester: semester ? parseInt(semester) : undefined,
      attachments
    });

    // Send notification to relevant students
    const studentFilter = { role: 'student' };
    if (branch) studentFilter['academicInfo.branch'] = branch;
    if (yearOfStudy) studentFilter['academicInfo.yearOfStudy'] = parseInt(yearOfStudy);
    if (semester) studentFilter['academicInfo.semester'] = parseInt(semester);

    const relevantStudents = await StudentData.find(studentFilter)
      .populate('studentId', 'email');

    const studentEmails = relevantStudents.map(s => s.studentId.email);
    if (studentEmails.length > 0) {
      await sendNotificationEmail(studentEmails, title, description, 'assignment');
    }

    res.json({
      success: true,
      message: "Assignment created successfully",
      assignment
    });

  } catch (error) {
    console.error("Create assignment error:", error);
    res.status(500).json({ success: false, message: "Server error occurred" });
  }
});

// Get assignments for student
app.get("/api/student/:studentId/assignments", async (req, res) => {
  try {
    const { studentId } = req.params;

    if (!dbAvailable) {
      return res.status(503).json({ success: false, message: "Database not available" });
    }

    const student = await StudentData.findOne({ studentId })
      .select('academicInfo.branch academicInfo.yearOfStudy academicInfo.semester');

    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    const assignments = await Assignment.find({
      $or: [
        { branch: { $in: [student.academicInfo.branch, undefined] } },
        { yearOfStudy: { $in: [student.academicInfo.yearOfStudy, undefined] } },
        { semester: { $in: [student.academicInfo.semester, undefined] } }
      ],
      isActive: true
    })
      .populate('postedBy', 'name')
      .sort({ dueDate: 1 });

    // Check submission status for each assignment
    const assignmentsWithStatus = await Promise.all(
      assignments.map(async (assignment) => {
        const submission = await AssignmentSubmission.findOne({
          assignmentId: assignment._id,
          studentId
        });

        return {
          ...assignment.toObject(),
          submissionStatus: submission ? submission.status : 'not_submitted',
          submittedAt: submission ? submission.submittedAt : null,
          grade: submission ? submission.grade : null
        };
      })
    );

    res.json({
      success: true,
      assignments: assignmentsWithStatus
    });

  } catch (error) {
    console.error("Get student assignments error:", error);
    res.status(500).json({ success: false, message: "Server error occurred" });
  }
});

// Submit assignment
app.post("/api/student/assignment/submit", upload.array('submissionAttachment', 3), async (req, res) => {
  try {
    const { assignmentId, studentId, remarks } = req.body;

    if (!assignmentId || !studentId) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    if (!dbAvailable) {
      return res.status(503).json({ success: false, message: "Database not available" });
    }

    // Check if already submitted
    const existingSubmission = await AssignmentSubmission.findOne({
      assignmentId,
      studentId
    });

    if (existingSubmission) {
      return res.status(400).json({ success: false, message: "Assignment already submitted" });
    }

    // Process attachments
    const attachments = [];
    if (req.files) {
      req.files.forEach(file => {
        attachments.push({
          originalName: file.originalname,
          storedPath: file.path,
          mimeType: file.mimetype,
          size: file.size
        });
      });
    }

    const submission = await AssignmentSubmission.create({
      assignmentId,
      studentId,
      submittedAt: new Date(),
      attachments,
      remarks,
      status: 'submitted'
    });

    res.json({
      success: true,
      message: "Assignment submitted successfully",
      submission
    });

  } catch (error) {
    console.error("Submit assignment error:", error);
    res.status(500).json({ success: false, message: "Server error occurred" });
  }
});

// 7. Results Management

// Create result
app.post("/api/admin/result", async (req, res) => {
  try {
    const { studentId, subject, marks, maxMarks, grade, remarks, semester, course, academicYear, postedBy } = req.body;

    if (!studentId || !subject || marks === undefined || !maxMarks || !grade || !postedBy) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    if (!dbAvailable) {
      return res.status(503).json({ success: false, message: "Database not available" });
    }

    const result = await Result.create({
      studentId,
      subject,
      marks: parseFloat(marks),
      maxMarks: parseFloat(maxMarks),
      grade,
      remarks,
      semester: semester ? parseInt(semester) : undefined,
      course,
      academicYear,
      postedBy,
      postedAt: new Date()
    });

    res.json({
      success: true,
      message: "Result created successfully",
      result
    });

  } catch (error) {
    console.error("Create result error:", error);
    res.status(500).json({ success: false, message: "Server error occurred" });
  }
});

// Get student results
app.get("/api/student/:studentId/results", async (req, res) => {
  try {
    const { studentId } = req.params;

    if (!dbAvailable) {
      return res.status(503).json({ success: false, message: "Database not available" });
    }

    const results = await Result.find({ studentId })
      .populate('postedBy', 'name')
      .sort({ academicYear: -1, semester: -1, subject: 1 });

    res.json({
      success: true,
      results
    });

  } catch (error) {
    console.error("Get student results error:", error);
    res.status(500).json({ success: false, message: "Server error occurred" });
  }
});

// 8. Chat System

// Get or create chat
app.get("/api/chat/:otherUserId", async (req, res) => {
  try {
    const { otherUserId } = req.params;
    const currentUserId = req.query.currentUserId; // Should come from auth middleware

    if (!currentUserId || !otherUserId) {
      return res.status(400).json({ success: false, message: "Missing user IDs" });
    }

    if (currentUserId === otherUserId) {
      return res.status(400).json({ success: false, message: "Cannot chat with yourself" });
    }

    if (!dbAvailable) {
      return res.status(503).json({ success: false, message: "Database not available" });
    }

    const chat = await getOrCreateChat(currentUserId, otherUserId);

    if (!chat) {
      return res.status(500).json({ success: false, message: "Failed to create chat" });
    }

    res.json({
      success: true,
      chatId: chat._id
    });

  } catch (error) {
    console.error("Get/create chat error:", error);
    res.status(500).json({ success: false, message: "Server error occurred" });
  }
});

// Get chat messages
app.get("/api/chat/:chatId/messages", async (req, res) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    if (!dbAvailable) {
      return res.status(503).json({ success: false, message: "Database not available" });
    }

    const messages = await Message.find({ chatId })
      .populate('from', 'name')
      .populate('to', 'name')
      .sort({ sentAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Mark messages as read
    const currentUserId = req.query.currentUserId; // Should come from auth middleware
    if (currentUserId) {
      await Message.updateMany(
        { chatId, to: currentUserId, readAt: { $exists: false } },
        { readAt: new Date() }
      );
    }

    res.json({
      success: true,
      messages: messages.reverse(), // Reverse to show oldest first
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error("Get chat messages error:", error);
    res.status(500).json({ success: false, message: "Server error occurred" });
  }
});

// 9. Student to Admin Messaging

// Send message to admin
app.post("/api/contact/admin", async (req, res) => {
  try {
    const { fromStudent, subject, message } = req.body;

    if (!fromStudent || !subject || !message) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    if (!dbAvailable) {
      return res.status(503).json({ success: false, message: "Database not available" });
    }

    const contactMessage = await ContactMessage.create({
      fromStudent,
      subject,
      message,
      sentAt: new Date(),
      status: 'pending'
    });

    // Send email to admin
    const student = await User.findById(fromStudent, 'name email');
    const adminEmails = await User.find({ role: 'admin' }, 'email');

    if (student && adminEmails.length > 0) {
      const emailContent = `
        <p><strong>From:</strong> ${student.name} (${student.email})</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Message:</strong></p>
        <div style="background-color: #f8f9fa; padding: 15px; border-left: 4px solid #007bff; margin: 10px 0;">
          ${message.replace(/\n/g, '<br>')}
        </div>
      `;

      await sendNotificationEmail(
        adminEmails.map(a => a.email),
        `Student Message: ${subject}`,
        emailContent,
        'contact'
      );

      // Update status
      await ContactMessage.updateOne(
        { _id: contactMessage._id },
        { status: 'sent' }
      );
    }

    res.json({
      success: true,
      message: "Message sent to admin successfully",
      contactMessage
    });

  } catch (error) {
    console.error("Send contact message error:", error);
    res.status(500).json({ success: false, message: "Server error occurred" });
  }
});

// Get contact messages for admin
app.get("/api/admin/contact-messages", async (req, res) => {
  try {
    if (!dbAvailable) {
      return res.status(503).json({ success: false, message: "Database not available" });
    }

    const messages = await ContactMessage.find()
      .populate('fromStudent', 'name email')
      .populate('repliedBy', 'name')
      .sort({ sentAt: -1 });

    res.json({
      success: true,
      messages
    });

  } catch (error) {
    console.error("Get contact messages error:", error);
    res.status(500).json({ success: false, message: "Server error occurred" });
  }
});

// Reply to contact message
app.post("/api/admin/contact-messages/:messageId/reply", async (req, res) => {
  try {
    const { messageId } = req.params;
    const { adminReply, repliedBy } = req.body;

    if (!adminReply || !repliedBy) {
      return res.status(400).json({ success: false, message: "Missing reply details" });
    }

    if (!dbAvailable) {
      return res.status(503).json({ success: false, message: "Database not available" });
    }

    const contactMessage = await ContactMessage.findByIdAndUpdate(
      messageId,
      {
        adminReply,
        repliedAt: new Date(),
        repliedBy,
        status: 'replied'
      },
      { new: true }
    ).populate('fromStudent', 'name email');

    // Send reply email to student
    if (contactMessage && contactMessage.fromStudent) {
      await sendNotificationEmail(
        contactMessage.fromStudent.email,
        `Re: ${contactMessage.subject}`,
        adminReply,
        'contact'
      );
    }

    res.json({
      success: true,
      message: "Reply sent successfully",
      contactMessage
    });

  } catch (error) {
    console.error("Reply to contact message error:", error);
    res.status(500).json({ success: false, message: "Server error occurred" });
  }
});

// 8. Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "Server is running",
    timestamp: new Date().toISOString(),
    database: dbAvailable ? "connected" : "memory",
    users: dbAvailable ? "database" : memoryUsers.size,
    activeOTPs: dbAvailable ? "database" : memoryPending.size,
    activeResetTokens: dbAvailable ? "database" : memoryResets.size,
  });
});

// 9. Debug endpoint (remove in production)
app.get("/api/debug/users", async (req, res) => {
  try {
    if (dbAvailable) {
      const users = await User.find({}, { password: 0 });
      res.json({
        users: users.map((u) => ({
          id: u._id,
          name: u.name,
          email: u.email,
          role: u.role,
          verified: u.verified,
        })),
      });
    } else {
      const users = Array.from(memoryUsers.values()).map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        verified: user.verified,
      }));
      res.json({ users });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch users" });
  }
});

// Serve static files
app.use(express.static(__dirname + "/.."));

// Start server
const server = app.listen(PORT, () => {
  console.log(`\n🚀 Student Management System API Server`);
  console.log(`📍 Running on port ${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔧 Debug users: http://localhost:${PORT}/api/debug/users`);
  console.log(
    `📧 Email configured: ${process.env.EMAIL_USER || "Console only"}`
  );
  console.log(
    `🗄️ Database: ${dbAvailable ? "MongoDB Connected" : "In-Memory Mode"}`
  );
  console.log(`=`.repeat(60));
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`❌ Port ${PORT} is already in use`);
    process.exit(1);
  } else {
    console.error("❌ Server error:", err);
  }
});
