#!/bin/bash

echo "🚀 Starting Student Information Management System (S.I.M.S)"
echo "=========================================================="

# Change to project directory
cd /workspace/cmhhts6nc01zvocilv70if8ox/Student-Mangement-System

# Check dependencies
echo "📦 Checking dependencies..."
cd api && npm install --silent > /dev/null 2>&1

# Start the backend server
echo "🔧 Starting Backend API Server..."
PORT=3000 node unified-server.js &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 2

# Start the frontend server
echo "🌐 Starting Frontend Server..."
cd .. && python3 -m http.server 8000 &
FRONTEND_PID=$!

# Wait for servers to start
sleep 2

echo ""
echo "✅ S.I.M.S IS NOW RUNNING!"
echo "=========================="
echo ""
echo "🌐 ACCESS URLS:"
echo "   Student Login:    http://localhost:8000/stu_login.html"
echo "   Student Dashboard:http://localhost:8000/student-dashboard.html"
echo "   Admin Login:      http://localhost:8000/admin-login.html"
echo "   Admin Dashboard:  http://localhost:8000/admin-dashboard.html"
echo ""
echo "🔧 API ENDPOINTS:"
echo "   Health Check:     http://localhost:3000/api/health"
echo "   Debug Users:      http://localhost:3000/api/debug/users"
echo ""
echo "👥 TEST ACCOUNTS:"
echo "   Student: test@example.com / test123456"
echo "   Admin:   admin@example.com / admin123456"
echo ""
echo "⏹️  TO STOP: Press Ctrl+C or run: kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo "🎯 Quick Test: Open http://localhost:8000/stu_login.html"
echo ""

# Wait for user to stop
wait