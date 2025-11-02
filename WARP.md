# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

Project: Student Management System (email OTP verification)

What this covers
- How to install and run the backend API (with dev/simulated and real-email options)
- How to exercise the frontend flow and run the provided system test
- High-level architecture: frontend pages, client-side flow, API variants, and data flow
- Important caveats discovered from the code

Common commands (Windows PowerShell)
- Install backend dependencies
```powershell path=null start=null
cd api
npm install
```

- Start the API (development with hot reload)
```powershell path=null start=null
cd api
npm run dev
```

- Start the API (standard)
```powershell path=null start=null
cd api
npm start
```

- Start the simulated-email API (prints OTPs to console; permissive CORS for file:// origins)
```powershell path=null start=null
node api/server-test.js
```

- Start the real-email API (requires Gmail app password; see notes below)
```powershell path=null start=null
# Option A: Edit api/server-real-email.js per api/email-setup-instructions.txt, then:
node api/server-real-email.js

# Option B (server.js path): set environment variables before starting
$env:EMAIL_USER = "your-email@gmail.com"
$env:EMAIL_PASS = "your-16-char-app-password"
$env:PORT = "3001"
cd api
npm start
```

- Health check
```powershell path=null start=null
# When API is running on port 3001
curl http://localhost:3001/api/health
```

- Run the end-to-end system test
```powershell path=null start=null
node test-system.js
```

- Manually exercise a single API endpoint (example: send OTP)
```powershell path=null start=null
$body = @{ email = "you@example.com" } | ConvertTo-Json
Invoke-WebRequest -Uri "http://localhost:3001/api/send-otp" -Method Post -Body $body -ContentType "application/json"
```

- Frontend usage
```powershell path=null start=null
# With the API running (port 3001), open a frontend page directly in your browser
# Example: file:///D:/ALL%20Programs/Student-Mangement-System/index.html
# or double-click index.html in Explorer.
```

High-level architecture and code structure
- Frontend (static HTML/CSS/JS in repo root)
  - Key pages: index.html (entry), stu_signup.html (signup), otp-verification.html (OTP entry), stu_login.html (login). Styles live alongside as *.css files.
  - Client-side signup flow (signup-verification.js):
    - Validates form input, POSTs to POST /api/send-otp.
    - On success: stores pendingEmail and pendingUserData in localStorage and navigates to otp-verification.html.
  - Client-side OTP flow (otp-verification.js):
    - Collects 6-digit OTP, POSTs to POST /api/verify-otp.
    - If verified, POSTs to POST /api/register using stored pendingUserData, then redirects to stu_login.html.
  - CORS/origin: server-test.js allows file:// and null origins, so opening HTML files directly from disk works for development.

- Backend API (Node/Express under api/)
  - api/server.js (default API)
    - Endpoints: POST /api/send-otp, POST /api/verify-otp, POST /api/register, GET /api/health
    - Stores OTPs in-memory (Map) with 10-minute expiry. Intended to send email via Nodemailer using environment variables EMAIL_USER/EMAIL_PASS.
    - Note: transporter is constructed via nodemailer.createTransporter(...) in code; see “Caveats” below.
  - api/server-test.js (simulated email)
    - Same endpoints and in-memory OTP storage.
    - Does not send emails; logs OTP to console. CORS configured for common local and file:// origins.
  - api/server-real-email.js (real email)
    - Same endpoints and in-memory OTP storage.
    - Uses a Nodemailer transporter wired for Gmail. Credentials must be edited in-file as per api/email-setup-instructions.txt.
  - api/package.json
    - Scripts: "start": node server.js, "dev": nodemon server.js
    - Dependencies: express, cors, nodemailer, node-fetch; devDependency: nodemon.

- Alternate local server with persistence (root/start-local-server.js)
  - Runs an Express server that serves static files and provides API endpoints backed by MongoDB (via mongoose). Also defines User and PendingUser models and implements a stricter register flow that cleans up pending users only after successful registration.
  - This path is independent from the api/ servers and is optional for local development.

Data and request flow (big picture)
1) Signup
   - Frontend (signup-verification.js) → POST /api/send-otp with email → API generates 6-digit OTP, stores it (Map or Mongo) with 10-min expiry, and sends OTP (real or simulated).
   - Frontend persists pendingEmail + pendingUserData in localStorage, then navigates to otp-verification.html.
2) Verify + Register
   - Frontend (otp-verification.js) → POST /api/verify-otp with email+otp.
   - If valid and not expired, API returns success. Frontend then POSTs /api/register with stored name/email/password.
   - On success, frontend clears pending storage and redirects to login page.

Important notes and caveats
- Environment variables and .env
  - The guides mention creating an .env file, but api/server.js does not load it automatically (no dotenv import). Prefer setting EMAIL_USER/EMAIL_PASS/PORT in the environment (see commands above), or use api/server-real-email.js and edit credentials in-file as directed by api/email-setup-instructions.txt.

- Nodemailer transporter in api/server.js
  - The code uses nodemailer.createTransporter(...). Nodemailer’s API is createTransport(...). If you encounter a runtime error like “createTransporter is not a function”, update that call accordingly in code before running.

- Origins and CORS
  - server-test.js and server-real-email.js explicitly include file:// and null origins for local HTML testing. The default server.js uses a generic cors() setup; if your browser denies requests when opening HTML from disk, use server-test.js for development or serve the frontend via a local static server.

- Credentials present in code
  - Some helper/alt server code includes embedded credentials (email or database URIs). Do not rely on these for development or commit history. Prefer using environment variables as shown in the command examples.

Key docs in this repo (summarized)
- FINAL-SETUP-GUIDE.md
  - Quick path: cd api && npm install, configure email credentials, npm start, open index.html, follow signup → OTP → login.
  - Includes consolidated troubleshooting (ports, credentials, server running) and system test command (node test-system.js).
- SETUP-GUIDE.md
  - Details Gmail App Password setup and the expected API endpoints: POST /api/send-otp, POST /api/verify-otp, POST /api/register, GET /api/health.
  - Notes the 10-minute OTP expiry and resend cooldown.

That’s it—use the commands above to run the API (simulated or real), open the frontend HTML files locally, and run the end-to-end system test. If you need real email, follow api/email-setup-instructions.txt or export EMAIL_USER/EMAIL_PASS in your shell before starting the API.
