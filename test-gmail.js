const nodemailer = require('nodemailer');

// Load environment variables
try {
  require('dotenv').config({ path: './api/.env' });
} catch (e) {
  console.log('Dotenv not found, setting manually...');
  process.env.EMAIL_USER = 'ananta10092004@gmail.com';
  process.env.EMAIL_PASS = 'gudwwhogwhhiynnd';
}

console.log('Testing Gmail Configuration...');
console.log('EMAIL_USER:', process.env.EMAIL_USER);
console.log('EMAIL_PASS length:', process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : 'undefined');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

async function testEmail() {
  try {
    console.log('Verifying SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection verified successfully!');
    
    console.log('Sending test email...');
    const info = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER, // Send to yourself
      subject: 'Test Email - Student Management System',
      html: `
        <h2>Test Email</h2>
        <p>This is a test email to verify Gmail configuration.</p>
        <p>Time: ${new Date().toLocaleString()}</p>
      `
    });
    
    console.log('✅ Test email sent successfully!');
    console.log('Message ID:', info.messageId);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.code === 'EAUTH') {
      console.error('🚨 Authentication failed! Check your Gmail app password.');
      console.error('Make sure you have:');
      console.error('1. Enabled 2-factor authentication on your Gmail account');
      console.error('2. Generated an "App Password" (not your regular password)');
      console.error('3. Used the app password without spaces');
    } else if (error.code === 'ECONNECTION') {
      console.error('🚨 Connection failed! Check your internet connection.');
    } else if (error.code === 'ESOCKET') {
      console.error('🚨 Network error! Try again later.');
    }
  }
}

testEmail();