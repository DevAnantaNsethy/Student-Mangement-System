// Simple API endpoint smoke tests for Student Management System API
// Usage:
//   node test-endpoints.js
//
// Requires the API server to be running (default: http://localhost:3001)

const fetch = require('node-fetch');

const BASE = process.env.API_BASE || 'http://localhost:3001';

async function main() {
  try {
    console.log(`→ GET ${BASE}/api/health`);
    const h = await fetch(`${BASE}/api/health`);
    const hjson = await h.json();
    console.log('Health:', hjson);

    const email = process.env.TEST_EMAIL || `test_${Date.now()}@example.com`;

    console.log(`→ POST ${BASE}/api/send-otp`);
    const sendRes = await fetch(`${BASE}/api/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    console.log('send-otp status:', sendRes.status);
    const sendJson = await sendRes.json().catch(() => ({}));
    console.log('send-otp body:', sendJson);

    console.log('\nNote: This test does not auto-verify the OTP. Use the UI or console output (in test server mode) to retrieve the OTP and exercise verify-otp/register flows.');
  } catch (e) {
    console.error('Test failed:', e.message);
    process.exit(1);
  }
}

main();
