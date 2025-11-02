const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const mongoose = require('mongoose');
// Optional: load environment variables from .env if present
try { require('dotenv').config(); } catch (e) {}

const app = express();
const PORT = process.env.PORT || 3003;

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://your-cluster.mongodb.net/student-management';

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB Atlas');
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    console.log('⚠️  Server will continue without database functionality');
  });

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increased limit for profile pictures

// In-memory storage for demo (use database in production)
const otpStorage = new Map();
const pendingUsers = new Map();
const verifiedEmails = new Set();

// Email configuration (using Gmail SMTP for demo)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASS || 'your-app-password'
  }
});

// Generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP email
async function sendOTPEmail(email, otp) {
  try {
    // For demo purposes, always display OTP in console
    console.log('\n' + '='.repeat(50));
    console.log('📧 OTP EMAIL VERIFICATION');
    console.log('='.repeat(50));
    console.log(`📧 Email: ${email}`);
    console.log(`🔐 OTP: ${otp}`);
    console.log(`⏰ Expires in 10 minutes`);
    console.log('='.repeat(50) + '\n');
    
    // Try to send real email if credentials are configured
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS && 
        process.env.EMAIL_USER !== 'your-email@gmail.com') {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Email Verification - Student Management System',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #7b61ff;">Email Verification</h2>
            <p>Hello,</p>
            <p>Thank you for signing up for the Student Management System. Please use the following OTP to verify your email address:</p>
            <div style="background-color: #f0f0f0; padding: 20px; text-align: center; margin: 20px 0;">
              <h1 style="color: #7b61ff; font-size: 32px; margin: 0;">${otp}</h1>
            </div>
            <p>This OTP will expire in 10 minutes.</p>
            <p>If you didn't request this verification, please ignore this email.</p>
            <hr style="margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">Roland Institute of Technology</p>
          </div>
        `
      };
      
      try {
        await transporter.sendMail(mailOptions);
        console.log('✅ Email also sent successfully!');
      } catch (emailError) {
        console.log('⚠️  Email sending failed, but OTP is shown above for testing');
        console.log('Email Error:', emailError.message);
      }
    } else {
      console.log('ℹ️  Email credentials not configured - using console display only');
    }
    
    return true; // Always return true for demo mode
  } catch (error) {
    console.error('Error in sendOTPEmail:', error);
    return false;
  }
}

// Import routes
const studentRoutes = require('../routes/student');

// API Routes
app.use('/api/student', studentRoutes);

// Send OTP for email verification
app.post('/api/send-otp', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email address' });
    }

    // Generate OTP
    const otp = generateOTP();
    const expiryTime = Date.now() + (10 * 60 * 1000); // 10 minutes

    // Store OTP with expiry
    otpStorage.set(email, { otp, expiry: expiryTime });

    // Send email
    const emailSent = await sendOTPEmail(email, otp);

    if (emailSent) {
      res.json({ 
        success: true, 
        message: 'OTP sent successfully to your email' 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to send OTP. Please try again.' 
      });
    }
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error occurred' 
    });
  }
});

// Verify OTP
app.post('/api/verify-otp', (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and OTP are required' 
      });
    }

    const storedData = otpStorage.get(email);

    if (!storedData) {
      return res.status(400).json({ 
        success: false, 
        message: 'OTP not found or expired' 
      });
    }

    // Check if OTP has expired
    if (Date.now() > storedData.expiry) {
      otpStorage.delete(email);
      return res.status(400).json({ 
        success: false, 
        message: 'OTP has expired. Please request a new one.' 
      });
    }

    // Verify OTP
    if (storedData.otp === otp) {
      verifiedEmails.add(email);
      otpStorage.delete(email);
      res.json({ 
        success: true, 
        message: 'Email verified successfully' 
      });
    } else {
      res.status(400).json({ 
        success: false, 
        message: 'Invalid OTP' 
      });
    }
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error occurred' 
    });
  }
});

// Complete registration after email verification
app.post('/api/register', (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;

    // Validation
    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields are required' 
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'Passwords do not match' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password must be at least 6 characters long' 
      });
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid email address' 
      });
    }

    // Ensure email was verified via OTP before registration
    if (!verifiedEmails.has(email)) {
      return res.status(400).json({
        success: false,
        message: 'Email not verified. Please complete OTP verification first'
      });
    }

    // Check if email is already registered (in production, check database)
    // For demo, we'll assume it's a new user

    // Store user data temporarily (in production, save to database)
    const userId = crypto.randomUUID();
    const userData = {
      id: userId,
      name,
      email,
      password, // In production, hash this password
      verified: true,
      createdAt: new Date().toISOString()
    };

    // In production, save to database here
    console.log('User registered:', userData);

    // Clear verification marker after successful registration
    verifiedEmails.delete(email);

    res.json({ 
      success: true, 
      message: 'Registration completed successfully',
      userId: userId
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error occurred' 
    });
  }
});

// Login endpoint (simplified for demo)
app.post('/api/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;

    // Basic validation
    if (!email || !password || !role) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email, password, and role are required' 
      });
    }

    // For demo purposes - in production, validate against actual user database
    // This is a simplified login that works with the existing frontend
    const userId = crypto.randomUUID();
    const userData = {
      id: userId,
      name: email.split('@')[0], // Extract name from email for demo
      email: email,
      role: role
    };

    console.log('Login successful:', { email, role });

    res.json({ 
      success: true, 
      message: 'Login successful',
      user: userData
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error occurred' 
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running', timestamp: new Date().toISOString() });
});

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Please use a different port or stop the process currently using it.`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
  }
});
