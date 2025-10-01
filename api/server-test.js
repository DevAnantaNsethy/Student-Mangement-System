const express = require("express");
const cors = require("cors");

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

// Generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Simulate sending email (for testing without actual email)
async function sendOTPEmail(email, otp) {
  console.log(`📧 SIMULATED EMAIL SENT TO: ${email}`);
  console.log(`🔑 OTP CODE: ${otp}`);
  console.log(`⏰ This OTP expires in 10 minutes`);
  return true;
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

    // Send email (simulated)
    const emailSent = await sendOTPEmail(email, otp);

    if (emailSent) {
      res.json({
        success: true,
        message: "OTP sent successfully! Check console for the code.",
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Failed to send OTP. Please try again.",
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

    // Store user data (in production, save to database)
    console.log("✅ USER REGISTERED:", { name, email, verified: true });

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
    message: "Email verification system is ready!",
  });
});

// Start server
app.listen(PORT, () => {
  console.log("🚀 EMAIL VERIFICATION SERVER STARTED!");
  console.log(`📡 Server running on: http://localhost:${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
  console.log("");
  console.log("📧 TESTING MODE: OTP codes will be displayed in console");
  console.log("🔑 No actual emails will be sent (for testing purposes)");
  console.log("");
  console.log("✅ Ready to test the signup flow!");
});
