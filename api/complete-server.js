const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Load environment variables
try { 
  require('dotenv').config(); 
} catch (e) {
  console.log('⚠️ Dotenv not found, setting manually...');
}

console.log('📧 Email will be sent using the configured EMAIL_USER environment variable.');

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3003;

// Security & Middleware
app.use(cors());
app.use(express.json());
app.use(helmet());

// Rate limiting
const otpLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false });
app.use('/api/send-otp', otpLimiter);
app.use('/api/verify-otp', otpLimiter);
app.use('/api/forgot-password', otpLimiter);
app.use('/api/login', authLimiter);

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/student-management';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((err) => console.error('❌ MongoDB connection error:', err.message));

// Mount Student routes
const studentRoutes = require('../routes/student');
app.use('/api/student', studentRoutes);

// In-memory database simulation
const users = new Map(); // email -> user data
const otpStorage = new Map(); // email -> {otp, expiry, type}
const passwordResetTokens = new Map(); // token -> {email, expiry}

// Email configuration
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Utility functions
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateResetToken() {
  return crypto.randomUUID();
}

function hashPassword(password) {
  // In production, use bcrypt or similar
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Email functions
async function sendOTPEmail(email, otp, type = 'signup') {
  const subject = type === 'signup' ? 'Email Verification - Student Management System' : 'Password Reset OTP';
  const title = type === 'signup' ? 'Email Verification' : 'Password Reset';
  
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
            ${type === 'signup' ? 'Thank you for signing up for the Student Management System.' : 'You requested to reset your password.'} 
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
      `
    };
    
    await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent successfully to ${email}!`);
    return true;
    
  } catch (error) {
    console.error(`❌ Failed to send email to ${email}:`, error.message);
    
    // Check for common Gmail errors
    if (error.message.includes('Invalid login')) {
      console.error('🚨 Gmail Authentication Error: Check your app password!');
    } else if (error.message.includes('self signed certificate')) {
      console.error('🚨 Certificate Error: Gmail SMTP connection failed');
    }
    
    return false;
  }
}

async function sendPasswordResetEmail(email, resetToken) {
  const resetLink = `http://localhost:8000/reset-password.html?token=${resetToken}`;
  
  try {
    console.log(`\n🔄 Sending password reset email to: ${email}`);
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset - Student Management System',
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
      `
    };
    
    await transporter.sendMail(mailOptions);
    console.log(`✅ Password reset email sent successfully to ${email}!`);
    return true;
    
  } catch (error) {
    console.error(`❌ Failed to send password reset email to ${email}:`, error.message);
    return false;
  }
}

// ===== API ROUTES =====

// 1. Send OTP for signup
app.post('/api/send-otp', async (req, res) => {
  try {
    const { email, role = 'student' } = req.body;
    
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email address' });
    }
    
    // Check if user already exists
    if (users.has(email)) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }
    
    const otp = generateOTP();
    const expiryTime = Date.now() + (10 * 60 * 1000); // 10 minutes
    
    otpStorage.set(email, { otp, expiry: expiryTime, type: 'signup', role });
    
    const emailSent = await sendOTPEmail(email, otp, 'signup');
    
    if (emailSent) {
      res.json({ success: true, message: 'OTP sent successfully to your email' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to send OTP' });
    }
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ success: false, message: 'Server error occurred' });
  }
});

// 2. Verify OTP for signup
app.post('/api/verify-otp', (req, res) => {
  try {
    const { email, otp } = req.body;
    
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required' });
    }
    
    const storedData = otpStorage.get(email);
    
    if (!storedData) {
      return res.status(400).json({ success: false, message: 'OTP not found or expired' });
    }
    
    if (Date.now() > storedData.expiry) {
      otpStorage.delete(email);
      return res.status(400).json({ success: false, message: 'OTP has expired' });
    }
    
    if (storedData.otp === otp) {
      // Mark as verified but keep in storage for signup completion
      storedData.verified = true;
      res.json({ success: true, message: 'Email verified successfully' });
    } else {
      res.status(400).json({ success: false, message: 'Invalid OTP' });
    }
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ success: false, message: 'Server error occurred' });
  }
});

// 3. Complete registration
app.post('/api/register', (req, res) => {
  try {
    const { name, email, password, confirmPassword, role = 'student' } = req.body;
    
    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }
    
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }
    
    // Check if email was verified
    const otpData = otpStorage.get(email);
    if (!otpData || !otpData.verified) {
      return res.status(400).json({ success: false, message: 'Email not verified' });
    }
    
    // Check if user already exists
    if (users.has(email)) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }
    
    // Create user
    const userId = crypto.randomUUID();
    const userData = {
      id: userId,
      name,
      email,
      password: hashPassword(password),
      role: otpData.role || role,
      verified: true,
      createdAt: new Date().toISOString()
    };
    
    users.set(email, userData);
    otpStorage.delete(email); // Clean up
    
    console.log(`✅ ${userData.role.toUpperCase()} registered:`, { email, name, role: userData.role });
    
    res.json({
      success: true,
      message: 'Registration completed successfully',
      user: { id: userId, name, email, role: userData.role }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Server error occurred' });
  }
});

// 4. Login (both student and admin)
app.post('/api/login', (req, res) => {
  try {
    const { email, password, role } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }
    
    const user = users.get(email);
    
    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }
    
    if (user.password !== hashPassword(password)) {
      return res.status(400).json({ success: false, message: 'Invalid password' });
    }
    
    // Check role if specified
    if (role && user.role !== role) {
      return res.status(400).json({ success: false, message: `Access denied. This is for ${role}s only.` });
    }
    
    console.log(`✅ ${user.role.toUpperCase()} logged in:`, user.email);
    
    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error occurred' });
  }
});

// 5. Forgot password - send reset link
app.post('/api/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }
    
    const user = users.get(email);
    if (!user) {
      // Don't reveal if user exists for security
      return res.json({ success: true, message: 'If the email exists, a reset link has been sent' });
    }
    
    const resetToken = generateResetToken();
    const expiryTime = Date.now() + (60 * 60 * 1000); // 1 hour
    
    passwordResetTokens.set(resetToken, { email, expiry: expiryTime });
    
    await sendPasswordResetEmail(email, resetToken);
    
    res.json({ success: true, message: 'Password reset link sent to your email' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Server error occurred' });
  }
});

// 6. Reset password with token
app.post('/api/reset-password', (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;
    
    if (!token || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }
    
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }
    
    const tokenData = passwordResetTokens.get(token);
    if (!tokenData) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
    }
    
    if (Date.now() > tokenData.expiry) {
      passwordResetTokens.delete(token);
      return res.status(400).json({ success: false, message: 'Reset token has expired' });
    }
    
    const user = users.get(tokenData.email);
    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }
    
    // Update password
    user.password = hashPassword(newPassword);
    users.set(tokenData.email, user);
    passwordResetTokens.delete(token);
    
    console.log(`✅ Password reset for:`, tokenData.email);
    
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Server error occurred' });
  }
});

// 7. Get user info (for dashboard)
app.get('/api/user/:email', (req, res) => {
  try {
    const { email } = req.params;
    const user = users.get(email);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, message: 'Server error occurred' });
  }
});

// 8. Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'Server is running',
    timestamp: new Date().toISOString(),
    users: users.size,
    activeOTPs: otpStorage.size,
    activeResetTokens: passwordResetTokens.size
  });
});

// 9. Debug endpoint (remove in production)
app.get('/api/debug/users', (req, res) => {
  const userList = Array.from(users.values()).map(user => ({
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt
  }));
  res.json({ users: userList });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`\n🚀 Student Management System API Server`);
  console.log(`📍 Running on port ${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔧 Debug users: http://localhost:${PORT}/api/debug/users`);
  console.log(`\n📧 Email configured: ${process.env.EMAIL_USER || 'Console only'}`);
  console.log(`=`.repeat(60));
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
    process.exit(1);
  } else {
    console.error('❌ Server error:', err);
  }
});