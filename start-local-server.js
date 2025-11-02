const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
// Optional: load environment variables from .env if present
try { require('dotenv').config(); } catch (e) {}

const app = express();

// --- Middleware ---
app.use(
  cors({
    origin: [
      "http://localhost:8000",
      "http://localhost:3000",
      "http://localhost:3001",
    ],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);
app.use(express.json());
app.use(express.static(__dirname)); // Serve static files like stu_signup.html

// --- MongoDB Connection ---
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/sms";
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ [SUCCESS] Connected to MongoDB."))
  .catch((err) =>
    console.error("❌ [FATAL] MongoDB connection error:", err.message)
  );

// Track DB availability and provide in-memory fallbacks when DB is down
let dbAvailable = false;
mongoose.connection.on('connected', () => {
  dbAvailable = true;
  console.log("📦 MongoDB connection: connected");
});
mongoose.connection.on('error', (err) => {
  dbAvailable = false;
  console.warn("📦 MongoDB connection error:", err.message);
});
mongoose.connection.on('disconnected', () => {
  dbAvailable = false;
  console.warn("📦 MongoDB connection: disconnected");
});

// In-memory fallbacks (used only when dbAvailable === false)
const memoryUsers = new Map(); // key=email, value={name,email,password,role}
const memoryPending = new Map(); // key=email, value={otp, otpExpires}
const memoryResets = new Map(); // key=token, value={email, expires}

// --- Mongoose Schemas ---
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'admin'], default: 'student' },
  resetToken: { type: String },
  resetExpires: { type: Date }
});
const User = mongoose.model("User", userSchema);

const pendingUserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  otp: { type: String, required: true },
  otpExpires: { type: Date, required: true },
});
const PendingUser = mongoose.model("PendingUser", pendingUserSchema);

// --- API Endpoints ---

// Endpoint 1: Send OTP
app.post("/api/send-otp", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res
      .status(400)
      .json({ success: false, message: "Email is required." });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  try {
    if (dbAvailable) {
      await PendingUser.findOneAndUpdate(
        { email },
        { otp, otpExpires },
        { upsert: true, new: true, runValidators: true }
      );
    } else {
      memoryPending.set(email, { otp, otpExpires });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // --- Creative & Modern HTML Email Template ---
    const mailOptions = {
      from: `${process.env.EMAIL_USER ? '"Student Portal" <' + process.env.EMAIL_USER + '>' : '"Student Portal" <no-reply@example.com>'}`,
      to: email,
      subject: "Your Verification Code for Student Portal",
      html: `
        <body style="margin: 0; padding: 0; font-family: 'Poppins', sans-serif; background-color: #f0f2f5;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="padding: 20px 0;">
                <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
                  
                  <!-- Header -->
                  <tr>
                    <td align="center" style="background: linear-gradient(90deg, #6a11cb 0%, #2575fc 100%); padding: 30px 0; border-radius: 12px 12px 0 0;">
                      <h1 style="color: #ffffff; font-size: 28px; margin: 0;">Verification Required</h1>
                    </td>
                  </tr>

                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px 30px;">
                      <p style="color: #333333; font-size: 16px; margin: 0 0 20px 0;">Hi there,</p>
                      <p style="color: #555555; font-size: 16px; line-height: 1.5;">
                        Your verification code for the <strong>Student Portal</strong> is ready. Use the code below to complete your sign-up process.
                      </p>
                      
                      <!-- OTP Code Box -->
                      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 30px 0;">
                        <tr>
                          <td align="center">
                            <div style="background-color: #f0f2f5; border: 2px dashed #cccccc; border-radius: 8px; padding: 15px 25px; display: inline-block;">
                              <p style="color: #0f1c3f; font-size: 32px; font-weight: 600; letter-spacing: 4px; margin: 0;">
                                ${otp}
                              </p>
                            </div>
                          </td>
                        </tr>
                      </table>

                      <p style="color: #555555; font-size: 16px; line-height: 1.5;">
                        This code will expire in 10 minutes. If you did not request this, please disregard this email.
                      </p>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f9f9f9; padding: 20px 30px; border-radius: 0 0 12px 12px;">
                      <p style="color: #999999; font-size: 12px; text-align: center; margin: 0;">
                        &copy; ${new Date().getFullYear()} Student Management System. All Rights Reserved.
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
      `,
    };

    await transporter.sendMail(mailOptions);

    console.log(`[INFO] Modern OTP email sent to ${email}`);
    return res.json({ success: true, message: "OTP sent successfully." });
  } catch (error) {
    console.warn(`[WARN] /api/send-otp email send failed for ${email}:`, error.message);
    // Development fallback: still succeed and log OTP to server if email fails
    console.log(`[DEV] OTP for ${email}: ${otp} (email not sent, fallback mode)`);
    return res.json({ success: true, message: "OTP generated (fallback mode)." });
  }
});

// Endpoint 2: Verify OTP
app.post("/api/verify-otp", async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res
      .status(400)
      .json({ success: false, message: "Email and OTP are required." });
  }

  const pending = dbAvailable
    ? await PendingUser.findOne({ email })
    : memoryPending.get(email);
  if (!pending) {
    console.warn(`[WARN] /api/verify-otp: No pending user found for ${email}`);
    return res
      .status(404)
      .json({ success: false, message: "OTP not requested for this email." });
  }

  const pendingOtp = dbAvailable ? pending.otp : pending.otp;
  const pendingExp = dbAvailable ? pending.otpExpires : pending.otpExpires;
  if (pendingOtp !== otp || pendingExp < new Date()) {
    console.warn(`[WARN] /api/verify-otp: Invalid or expired OTP for ${email}`);
    return res
      .status(400)
      .json({ success: false, message: "Invalid or expired OTP." });
  }

  // CORRECT LOGIC: DO NOT DELETE THE PENDING USER HERE.
  console.log(`[INFO] OTP verified for ${email}`);
  return res.json({ success: true, message: "OTP verified." });
});

// Endpoint 3: Register User
app.post("/api/register", async (req, res) => {
  const { name, email, password, role } = req.body;
  console.log(`[INFO] /api/register attempt for: ${email}`); // Log the attempt

  if (!name || !email || !password) {
    console.error("[ERROR] /api/register: Missing fields.", req.body);
    return res.status(400).json({
      success: false,
      message: "Name, email, and password are required.",
    });
  }
  const safeRole = role === 'admin' ? 'admin' : 'student';

  // CORRECT LOGIC: Check for the pending user again.
  const pending = dbAvailable
    ? await PendingUser.findOne({ email })
    : memoryPending.get(email);
  if (!pending) {
    console.error(
      `[ERROR] /api/register: No verified pending user found for ${email}.`
    );
    return res.status(400).json({
      success: false,
      message: "Email not verified. Please complete OTP step first.",
    });
  }

  try {
    if (dbAvailable) {
      const newUser = await User.create({ name, email, password, role: safeRole });
      console.log(`[SUCCESS] /api/register: User ${newUser.email} created.`);
      await PendingUser.deleteOne({ email });
      console.log(`[INFO] /api/register: Pending user ${email} cleaned up.`);
    } else {
      if (memoryUsers.has(email)) {
        return res.status(409).json({ success: false, message: "User with this email already exists." });
      }
      memoryUsers.set(email, { name, email, password, role: safeRole });
      memoryPending.delete(email);
      console.log(`[SUCCESS] /api/register: User ${email} created (memory).`);
    }

    return res
      .status(201)
      .json({ success: true, message: "Registration successful!" });
  } catch (error) {
    if (error.code === 11000) {
      // This is the MongoDB error for a duplicate entry
      console.error(`[ERROR] /api/register: User ${email} already exists.`);
      return res.status(409).json({
        // This sends the 409 Conflict error
        success: false,
        message: "User with this email already exists.",
      });
    }
    console.error(
      `[ERROR] /api/register: Database error for ${email}:`,
      error.message
    );
    return res.status(500).json({
      success: false,
      message: "Registration failed. Please try again.",
    });
  }
});

// Endpoint 4: Login User
app.post("/api/login", async (req, res) => {
  const { email, password, role } = req.body;
  console.log(`[INFO] /api/login attempt for: ${email}`);

  if (!email || !password) {
    return res
      .status(400)
      .json({ success: false, message: "Email and password are required." });
  }

  try {
    if (dbAvailable) {
      const user = await User.findOne({ email });
      if (!user) {
        console.warn(`[WARN] /api/login: User not found for ${email}`);
        return res
          .status(404)
          .json({ success: false, message: "Invalid email or password." });
      }

      // Password check (plain for demo)
      if (user.password !== password) {
        console.warn(`[WARN] /api/login: Invalid password for ${email}`);
        return res
          .status(401)
          .json({ success: false, message: "Invalid email or password." });
      }
      if (role && user.role !== role) {
        return res.status(403).json({ success: false, message: "Invalid role for this account." });
      }
      console.log(`[SUCCESS] /api/login: User ${email} logged in successfully.`);
      return res.json({ success: true, message: "Login successful.", user: { name: user.name, email: user.email, role: user.role } });
    } else {
      const user = memoryUsers.get(email);
      if (!user || user.password !== password) {
        console.warn(`[WARN] /api/login(memory): Invalid credentials for ${email}`);
        return res
          .status(401)
          .json({ success: false, message: "Invalid email or password." });
      }
      if (role && user.role !== role) {
        return res.status(403).json({ success: false, message: "Invalid role for this account." });
      }
      console.log(`[SUCCESS] /api/login: User ${email} logged in successfully.`);
      return res.json({ success: true, message: "Login successful.", user: { name: user.name, email: user.email, role: user.role } });
    }
  } catch (error) {
    console.error(
      `[ERROR] /api/login: Server error for ${email}:`,
      error.message
    );
    return res
      .status(500)
      .json({ success: false, message: "Server error during login." });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', db: dbAvailable ? 'connected' : 'memory', timestamp: new Date().toISOString() });
});


// Forgot Password - request reset link
app.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }
  try {
    let user;
    if (dbAvailable) {
      user = await User.findOne({ email });
    } else {
      user = memoryUsers.get(email);
    }
    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found for this email' });
    }
    const token = require('crypto').randomBytes(20).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    if (dbAvailable) {
      await User.updateOne({ email }, { resetToken: token, resetExpires: expires });
    } else {
      memoryResets.set(token, { email, expires });
    }

    const resetLink = `http://localhost:${process.env.PORT || 3001}/reset-password.html?token=${token}`;
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
      });
      await transporter.sendMail({
        from: process.env.EMAIL_USER ? `"Student Portal" <${process.env.EMAIL_USER}>` : 'no-reply@example.com',
        to: email,
        subject: 'Password Reset',
        html: `<p>Click the link below to reset your password (valid for 1 hour):</p><p><a href="${resetLink}">${resetLink}</a></p>`
      });
      return res.json({ success: true, message: 'Password reset link sent to your email' });
    } catch (err) {
      console.warn('[WARN] reset email failed:', err.message);
      console.log('[DEV] Password reset link:', resetLink);
      return res.json({ success: true, message: 'Reset link generated (fallback mode). Check server console.' });
    }
  } catch (e) {
    console.error('forgot-password error:', e.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Reset Password
app.post('/api/reset-password', async (req, res) => {
  const { token, newPassword, confirmPassword } = req.body;
  if (!token || !newPassword || !confirmPassword) {
    return res.status(400).json({ success: false, message: 'Token and passwords are required' });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ success: false, message: 'Passwords do not match' });
  }
  try {
    if (dbAvailable) {
      const user = await User.findOne({ resetToken: token, resetExpires: { $gt: new Date() } });
      if (!user) return res.status(400).json({ success: false, message: 'Invalid or expired token' });
      user.password = newPassword;
      user.resetToken = undefined;
      user.resetExpires = undefined;
      await user.save();
      return res.json({ success: true, message: 'Password reset successfully' });
    } else {
      const entry = memoryResets.get(token);
      if (!entry || entry.expires < new Date()) return res.status(400).json({ success: false, message: 'Invalid or expired token' });
      const u = memoryUsers.get(entry.email);
      if (!u) return res.status(400).json({ success: false, message: 'User not found' });
      u.password = newPassword;
      memoryResets.delete(token);
      return res.json({ success: true, message: 'Password reset successfully' });
    }
  } catch (e) {
    console.error('reset-password error:', e.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// --- DEBUGGING ENDPOINT ---
// WARNING: This is for debugging only. Remove it in a real application.
app.get("/api/all-users", async (req, res) => {
  try {
    if (dbAvailable) {
      // Find all users, but hide the password field for security
      const users = await User.find({}, { password: 0 });
      console.log("[DEBUG] Fetched all users:", users);
      res.json(users);
    } else {
      const users = Array.from(memoryUsers.values()).map(u => ({ name: u.name, email: u.email }));
      console.log("[DEBUG] Fetched all memory users:", users);
      res.json(users);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch users." });
  }
});

// --- Server Start ---
const PORT = process.env.PORT || 3001; // or any port you want your backend to run on

// Start server
app.listen(PORT, () => {
  console.log("🌐 LOCAL SERVER STARTED!");
  console.log(`📡 Serving files at: http://localhost:${PORT}`);
  console.log(`🏠 Homepage: http://localhost:${PORT}/index.html`);
  console.log(`📝 Signup: http://localhost:${PORT}/stu_signup.html`);
  console.log("");
  console.log("✅ Open http://localhost:" + PORT + "/index.html in your browser");
  console.log("✅ Then test the signup form - it should work now!");
});
