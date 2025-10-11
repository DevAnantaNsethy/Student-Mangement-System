# Email Verification System Setup Guide

## Overview
This email verification system allows students to sign up with email verification using OTP (One-Time Password) before completing their registration.

## Features
- ✅ Email OTP verification during signup
- ✅ 6-digit OTP with 10-minute expiry
- ✅ Resend OTP functionality with cooldown
- ✅ Responsive design matching your existing UI
- ✅ Error handling and user feedback
- ✅ Secure email sending via Gmail SMTP

## Setup Instructions

### 1. Install Node.js Dependencies
Navigate to the `api` folder and install required packages:

```bash
cd api
npm install
```

### 2. Configure Email Settings
1. Create a `.env` file in the `api` folder
2. Copy the contents from `email-config-example.txt`
3. Replace the email credentials:

```
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
PORT=3001
```

### 3. Gmail App Password Setup
1. Go to your Google Account settings
2. Enable 2-Factor Authentication
3. Go to Security → 2-Step Verification → App passwords
4. Generate a new app password for "Mail"
5. Use this password as `EMAIL_PASS` in your `.env` file

### 4. Start the Backend Server
```bash
cd api
npm start
```

The server will run on `http://localhost:3001`

### 5. Test the System
1. Open `stu_signup.html` in your browser
2. Fill in the registration form
3. Click "Sign Up" - you'll receive an OTP email
4. Enter the OTP on the verification page
5. Complete registration

## File Structure

```
├── api/
│   ├── server.js              # Backend API server
│   ├── package.json           # Node.js dependencies
│   └── email-config-example.txt # Email configuration template
├── stu_signup.html            # Updated signup page
├── studentsignup.css          # Updated signup styles
├── signup-verification.js     # Signup verification logic
├── otp-verification.html      # OTP verification page
├── otp-verification.css       # OTP page styles
└── otp-verification.js        # OTP verification logic
```

## API Endpoints

- `POST /api/send-otp` - Send OTP to email
- `POST /api/verify-otp` - Verify OTP code
- `POST /api/register` - Complete user registration
- `GET /api/health` - Health check

## How It Works

1. **User fills signup form** → Form validation
2. **Submit signup** → Send OTP to email
3. **Redirect to OTP page** → User enters 6-digit code
4. **Verify OTP** → Check against server
5. **Complete registration** → Save user data
6. **Redirect to login** → User can now login

## Security Features

- OTP expires in 10 minutes
- Resend cooldown (60 seconds)
- Email validation
- Password confirmation
- Secure SMTP email sending

## Troubleshooting

### Email Not Sending
- Check Gmail app password is correct
- Verify 2FA is enabled on Gmail account
- Check spam folder for OTP emails

### Server Errors
- Ensure Node.js is installed
- Check if port 3001 is available
- Verify all dependencies are installed

### Frontend Issues
- Check browser console for errors
- Ensure all JavaScript files are loaded
- Verify API server is running

## Production Considerations

For production deployment:
- Use a proper database instead of in-memory storage
- Hash passwords before storing
- Use environment variables for sensitive data
- Add rate limiting for OTP requests
- Implement proper error logging
- Use HTTPS for all communications
