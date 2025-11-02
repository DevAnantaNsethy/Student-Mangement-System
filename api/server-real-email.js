const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
// Optional: load environment variables from .env if present
try { require('dotenv').config(); } catch (e) {}

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "file://",
      "null",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

// In-memory storage for demo
const otpStorage = new Map();
const pendingUsers = new Map();
const verifiedEmails = new Set();

// Generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// REAL EMAIL CONFIGURATION - Replace these with your Gmail credentials
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER || "your-email@gmail.com",
    pass: process.env.EMAIL_PASS || "your-app-password",
  },
});

// Send REAL OTP email
async function sendRealOTPEmail(email, otp) {
  try {
    const mailOptions = {
      from: "anantanarayansethy350@gmail.com", // YOUR Gmail address
      to: email,
      subject: "🔐 Email Verification - Student Management System",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
          <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #7b61ff; text-align: center; margin-bottom: 20px;">🔐 Email Verification</h2>
            
            <p style="color: #333; font-size: 16px;">Hello,</p>
            
            <p style="color: #333; font-size: 16px;">Thank you for signing up for the Student Management System. Please use the following OTP to verify your email address:</p>
            
            <div style="background: linear-gradient(135deg, #7b61ff, #b66dff); padding: 25px; text-align: center; margin: 25px 0; border-radius: 10px;">
              <h1 style="color: white; font-size: 36px; margin: 0; letter-spacing: 5px;">${otp}</h1>
            </div>
            
            <p style="color: #666; font-size: 14px;">⏰ This OTP will expire in <strong>10 minutes</strong>.</p>
            
            <p style="color: #666; font-size: 14px;">If you didn't request this verification, please ignore this email.</p>
            
            <hr style="margin: 25px 0; border: none; border-top: 1px solid #eee;">
            
            <p style="color: #999; font-size: 12px; text-align: center;">
              Roland Institute of Technology<br>
              Student Management System
            </p>
          </div>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("📧 REAL EMAIL SENT:", info.messageId);
    return true;
  } catch (error) {
    console.error("❌ EMAIL ERROR:", error);
    return false;
  }
}

// API Routes

// Send OTP for email verification
app.post("/api/send-otp", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid email address" });
    }

    // Generate OTP
    const otp = generateOTP();
    const expiryTime = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store OTP with expiry
    otpStorage.set(email, { otp, expiry: expiryTime });

    console.log(`📧 SENDING REAL EMAIL TO: ${email}`);
    console.log(`🔑 OTP CODE: ${otp}`);

    // Send REAL email
    const emailSent = await sendRealOTPEmail(email, otp);

    if (emailSent) {
      res.json({
        success: true,
        message: "OTP sent successfully to your email! Check your inbox.",
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Failed to send OTP. Please check email configuration.",
      });
    }
  } catch (error) {
    console.error("Send OTP error:", error);
    res.status(500).json({
      success: false,
      message: "Server error occurred",
    });
  }
});

// Verify OTP
app.post("/api/verify-otp", (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    const storedData = otpStorage.get(email);

    if (!storedData) {
      return res.status(400).json({
        success: false,
        message: "OTP not found or expired",
      });
    }

    // Check if OTP has expired
    if (Date.now() > storedData.expiry) {
      otpStorage.delete(email);
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
      });
    }

    // Verify OTP
    if (storedData.otp === otp) {
      verifiedEmails.add(email);
      otpStorage.delete(email);
      res.json({
        success: true,
        message: "Email verified successfully",
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }
  } catch (error) {
    console.error("Verify OTP error:", error);
    res.status(500).json({
      success: false,
      message: "Server error occurred",
    });
  }
});

// Complete registration after email verification
app.post("/api/register", (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;

    // Validation
    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email address",
      });
    }

    // Ensure email was verified via OTP before registration
    if (!verifiedEmails.has(email)) {
      return res.status(400).json({
        success: false,
        message: "Email not verified. Please complete OTP verification first",
      });
    }

    // Store user data (in production, save to database)
    console.log("✅ USER REGISTERED:", { name, email, verified: true });

    // Clear verification marker after successful registration
    verifiedEmails.delete(email);

    res.json({
      success: true,
      message: "Registration completed successfully",
      userId: "user_" + Date.now(),
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Server error occurred",
    });
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "Server is running",
    timestamp: new Date().toISOString(),
    message: "REAL EMAIL verification system is ready!",
  });
});

// Start server
app.listen(PORT, () => {
  console.log("🚀 REAL EMAIL VERIFICATION SERVER STARTED!");
  console.log(`📡 Server running on: http://localhost:${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
  console.log("");
  console.log(
    "📧 REAL EMAIL MODE: OTP codes will be sent to actual email addresses"
  );
  console.log("");
  console.log(
    "⚠️  IMPORTANT: Configure your Gmail credentials in this file first!"
  );
  console.log("");
  console.log("✅ Ready to send real emails!");
});
