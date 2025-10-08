const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const mongoose = require("mongoose");
const crypto = require("crypto"); // Add this to the top with other requires
const bcrypt = require("bcrypt"); // Add this to the top
const jwt = require("jsonwebtoken"); // Add this to the top

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
const MONGO_URI =
  "mongodb+srv://ananta_db_user:Ananta%407532@cluster0.39xr1bs.mongodb.net/?retryWrites=true&w=majority";
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ [SUCCESS] Connected to MongoDB Atlas."))
  .catch((err) =>
    console.error("❌ [FATAL] MongoDB connection error:", err.message)
  );

// --- Mongoose Schemas ---
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  // --- ADD THESE TWO LINES ---
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
});
const User = mongoose.model("User", userSchema);

const pendingUserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  otp: { type: String, required: true },
  otpExpires: { type: Date, required: true },
});
const PendingUser = mongoose.model("PendingUser", pendingUserSchema);

// --- API Endpoints ---

// Endpoint 1: Send OTP - UPDATED
app.post("/api/send-otp", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res
      .status(400)
      .json({ success: false, message: "Email is required." });
  }

  try {
    // --- NEW: Check if user is already registered ---
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.warn(
        `[WARN] /api/send-otp: Signup attempt for existing user ${email}`
      );
      // Send a specific response indicating the user already exists.
      return res.status(409).json({
        success: false,
        userExists: true, // Custom flag for the frontend
        message: "A user with this email already exists. Please log in.",
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    await PendingUser.findOneAndUpdate(
      { email },
      { otp, otpExpires },
      { upsert: true, new: true, runValidators: true }
    );

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "ananta10092004@gmail.com",
        pass: "fopj wngw nscr fksu",
      },
    });

    // --- Creative & Modern HTML Email Template ---
    const mailOptions = {
      from: '"Student Portal" <ananta10092004@gmail.com>',
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

    console.log(`[INFO] Professional OTP email sent to ${email}`);
    return res.json({ success: true, message: "OTP sent successfully." });
  } catch (error) {
    console.error(`[ERROR] /api/send-otp failed for ${email}:`, error.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to send OTP." });
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

  const pending = await PendingUser.findOne({ email });
  if (!pending) {
    console.warn(`[WARN] /api/verify-otp: No pending user found for ${email}`);
    return res
      .status(404)
      .json({ success: false, message: "OTP not requested for this email." });
  }

  if (pending.otp !== otp || pending.otpExpires < new Date()) {
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
  const { name, email, password } = req.body;
  console.log(`[INFO] /api/register attempt for: ${email}`); // Log the attempt

  if (!name || !email || !password) {
    console.error("[ERROR] /api/register: Missing fields.", req.body);
    return res.status(400).json({
      success: false,
      message: "Name, email, and password are required.",
    });
  }

  // CORRECT LOGIC: Check for the pending user again.
  const pending = await PendingUser.findOne({ email });
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
    // BEFORE saving the user, hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create the user with the HASHED password
    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
    });
    console.log(`[SUCCESS] /api/register: User ${newUser.email} created.`);

    // CORRECT LOGIC: NOW delete the pending user.
    await PendingUser.deleteOne({ email });
    console.log(`[INFO] /api/register: Pending user ${email} cleaned up.`);

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

// Endpoint 4: Login User - UPDATED
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password." });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password." });
    }

    // --- Generate JWT Token ---
    const token = jwt.sign(
      { id: user._id }, // Payload: contains user's unique ID
      "your_jwt_secret_key", // Secret Key: CHANGE THIS to a long, random string
      { expiresIn: "1d" } // Token expires in 1 day
    );

    console.log(
      `[SUCCESS] /api/login: User ${email} logged in. Token generated.`
    );
    // Send the token back to the client
    return res.json({
      success: true,
      message: "Login successful.",
      token: token,
    });
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

// --- NEW PROTECTED ENDPOINT ---
// This endpoint will only be accessible if a valid token is provided.
app.get("/api/profile", async (req, res) => {
  try {
    // Check for the token in the Authorization header
    const token = req.headers.authorization.split(" ")[1]; // "Bearer TOKEN"
    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "Not authorized, no token" });
    }

    // Verify the token
    const decoded = jwt.verify(token, "your_jwt_secret_key"); // Use the same secret key

    // Get user from the token's ID, but don't send back the password
    const user = await User.findById(decoded.id).select("-password");

    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ success: false, message: "User not found" });
    }
  } catch (error) {
    res
      .status(401)
      .json({ success: false, message: "Not authorized, token failed" });
  }
});

// Endpoint 5: Forgot Password - Generate Token
app.post("/api/forgot-password", async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  if (!user) {
    // To prevent email enumeration, we send a generic success response even if the user doesn't exist.
    console.warn(
      `[WARN] /api/forgot-password: Attempt for non-existent user ${email}`
    );
    return res.json({
      success: true,
      message:
        "If an account with that email exists, a password reset link has been sent.",
    });
  }

  // Generate a random token
  const token = crypto.randomBytes(20).toString("hex");

  user.resetPasswordToken = token;
  user.resetPasswordExpires = Date.now() + 3600000; // Token expires in 1 hour

  await user.save();

  const resetURL = `http://localhost:3001/reset-password.html?token=${token}`;

  // Send the email to the user
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "ananta10092004@gmail.com",
      pass: "fopj wngw nscr fksu",
    },
  });
  await transporter.sendMail({
    to: user.email,
    from: '"Student Management System" <ananta10092004@gmail.com>',
    subject: "Password Reset Request",
    html: `
      <p>You are receiving this because you (or someone else) have requested the reset of the password for your account.</p>
      <p>Please click on the following link, or paste this into your browser to complete the process:</p>
      <p><a href="${resetURL}">${resetURL}</a></p>
      <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
    `,
  });

  res.json({
    success: true,
    message: "A password reset link has been sent to your email.",
  });
});

// Endpoint 6: Reset Password - Update Password
app.post("/api/reset-password", async (req, res) => {
  const { token, password } = req.body;

  const user = await User.findOne({
    resetPasswordToken: token,
    resetPasswordExpires: { $gt: Date.now() }, // Check if token is not expired
  });

  if (!user) {
    return res.status(400).json({
      success: false,
      message: "Password reset token is invalid or has expired.",
    });
  }

  // Hash the new password before saving it
  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(password, salt);

  await user.save();

  res.json({ success: true, message: "Password has been successfully reset." });
});

// --- DEBUGGING ENDPOINT ---
// WARNING: This is for debugging only. Remove it in a real application.
app.get("/api/all-users", async (req, res) => {
  try {
    // Find all users, but hide the password field for security
    const users = await User.find({}, { password: 0 });
    console.log("[DEBUG] Fetched all users:", users);
    res.json(users);
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch users." });
  }
});

// --- Server Start ---
const PORT = 3001; // or any port you want your backend to run on

// Start server
app.listen(PORT, () => {
  console.log("🌐 LOCAL SERVER STARTED!");
  console.log(`📡 Serving files at: http://localhost:${PORT}`);
  console.log(`🏠 Homepage: http://localhost:${PORT}/index.html`);
  console.log(`📝 Signup: http://localhost:${PORT}/stu_signup.html`);
  console.log("");
  console.log("✅ Open http://localhost:3000/index.html in your browser");
  console.log("✅ Then test the signup form - it should work now!");
});
