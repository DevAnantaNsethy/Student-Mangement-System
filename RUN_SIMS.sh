#!/bin/bash

echo "🚀 STUDENT INFORMATION MANAGEMENT SYSTEM (S.I.M.S)"
echo "=================================================="
echo ""

# Kill any existing processes on ports 3000, 8000, 3002
echo "🧹 Cleaning up existing processes..."
pkill -f "node.*unified-server" 2>/dev/null || true
pkill -f "python.*http.server" 2>/dev/null || true
sleep 1

echo "📁 Changing to project directory..."
cd /workspace/cmhhts6nc01zvocilv70if8ox/Student-Mangement-System

echo "📦 Installing dependencies..."
cd api
npm install --silent 2>/dev/null
cd ..

echo ""
echo "🔧 Starting Backend Server on port 3000..."
cd api
PORT=3000 node unified-server.js &
BACKEND_PID=$!
cd ..

sleep 3

echo "🌐 Starting Frontend Server on port 8000..."
python3 -m http.server 8000 &
FRONTEND_PID=$!

sleep 2

echo ""
echo "✅ S.I.M.S IS RUNNING!"
echo "====================="
echo ""
echo "🌐 ACCESS URLs:"
echo "   🎓 Student Login:     http://localhost:8000/stu_login.html"
echo "   📊 Student Dashboard: http://localhost:8000/student-dashboard.html"
echo "   👨‍💼 Admin Login:       http://localhost:8000/admin-login.html"
echo "   📈 Admin Dashboard:   http://localhost:8000/admin-dashboard.html"
echo ""
echo "🔧 System Status:"
echo "   📡 Backend API: http://localhost:3000/api/health"
echo "   📊 System Info: http://localhost:3000/api/debug/users"
echo ""
echo "👥 Test Accounts:"
echo "   🎓 Student: test@example.com / test123456"
echo "   👨‍💼 Admin:   admin@example.com / admin123456"
echo ""
echo "🎯 QUICK START:"
echo "   1. Open: http://localhost:8000/stu_login.html"
echo "   2. Login: test@example.com / test123456"
echo "   3. Explore your student dashboard!"
echo ""
echo "⏹️  To stop: Press Ctrl+C"
echo ""

# Keep script running
trap "echo ''; echo '🛑 Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT

# Wait for user interrupt
echo "🌟 S.I.M.S is ready for use! Press Ctrl+C to stop."
wait