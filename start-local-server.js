const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const mongoose = require("mongoose");
const app = express();

app.use(
  cors({
    origin: ["http://localhost:8000", "http://localhost:3000"], // allow both ports
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json());

// Serve static files from the current directory
app.use(express.static(__dirname));

// Replace with your connection string
const MONGO_URI =
  "mongodb+srv://ananta_db_user:Ananta%407532@cluster0.39xr1bs.mongodb.net/?retryWrites=true&w=majority";
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB Atlas"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  otp: String,
  otpExpires: Date,
});
const User = mongoose.model("User", userSchema);

app.post("/api/send-otp", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: "Email required" });
  }

  // Generate a 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Only update OTP if user exists, do NOT create new user here
  let user = await User.findOne({ email });
  if (user) {
    user.otp = otp;
    user.otpExpires = otpExpires;
    await user.save();
  } else {
    // Do NOT create a new user here
    return res.status(404).json({
      success: false,
      message: "User not found. Please register first.",
    });
  }

  // Send OTP email
  let transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "ananta10092004@gmail.com",
      pass: "fopj wngw nscr fksu",
    },
  });

  let mailOptions = {
    from: "ananta10092004@gmail.com",
    to: email,
    subject: "Your OTP Code",
    text: `Your OTP code is: ${otp}`,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: "OTP sent" });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to send OTP",
      error: error.message,
    });
  }
});

app.post("/api/verify-otp", async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res
      .status(400)
      .json({ success: false, message: "Email and OTP required" });
  }
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User data not found. Please sign up again.",
    });
  }
  if (user.otp !== otp || !user.otpExpires || user.otpExpires < new Date()) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid or expired OTP" });
  }
  // OTP is valid, clear it
  user.otp = undefined;
  user.otpExpires = undefined;
  await user.save();
  res.json({ success: true, message: "OTP verified" });
});

app.post("/api/register", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res
      .status(400)
      .json({ success: false, message: "All fields required" });
  }
  try {
    const existing = await User.findOne({ email });
    if (existing)
      return res
        .status(400)
        .json({ success: false, message: "Email already registered" });
    await User.create({ name, email, password });
    res.json({ success: true, message: "Registration successful" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error registering user" });
  }
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email, password });
    if (!user)
      return res
        .status(400)
        .json({ success: false, message: "Invalid credentials" });
    res.json({ success: true, message: "Login successful" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error logging in" });
  }
});

app.get("/api/all-users", async (req, res) => {
  const users = await User.find({}, { password: 0, otp: 0, otpExpires: 0 }); // hide sensitive fields
  res.json(users);
});

app.post("/api/delete-user", async (req, res) => {
  const { email } = req.body;
  await User.deleteOne({ email });
  res.json({ success: true, message: "User deleted" });
});

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
