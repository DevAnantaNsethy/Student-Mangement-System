# Student Management System

**Author:** Ananta Narayan Sethy

---

## Overview

A modern, full-featured Student Management System for educational institutions, built with a focus on usability, security, and professional design. This system is suitable for both administrators and students, providing seamless management and access to academic resources.

---

## Features

### 🛡️ Authentication & Security

- Email-based signup and login with OTP verification
- Password reset with secure email flow
- Role-based access (Admin & Student)

### 🏫 Admin Dashboard

- Modern, responsive UI with navigation
- **Student Management:** Add, search, and delete students (in-memory for demo)
- **Attendance Management:** QR code-based attendance for students and admins
- **Results Management:** Add, view, and delete exam results (localStorage)
- **Assignment Management:** Add assignments with title, description, and file upload (localStorage)
- **Notice Board:** Publish and delete notices for students (localStorage)
- **Chat:** Real-time chat feature with emoji picker and reply support
- **Quick Actions:** Fast access to key features
- **Statistics:** Dashboard cards for total students, attendance, pass rate, and notices

### 🎓 Student Dashboard

- Personalized dashboard with stats and quick actions
- **View Results:** See published exam results
- **View Assignments:** Download assignments and view details
- **Attendance:** View attendance records and generate QR code for marking
- **Notices:** Read all published notices
- **Profile Management:** Update personal and academic info
- **Chat:** Access chat feature for communication

### 📦 Technology Stack

- **Frontend:** HTML5, CSS3 (custom, responsive, modern), Vanilla JavaScript (ES6+)
- **Backend:** Node.js, Express.js, MongoDB (with in-memory fallback for demo)
- **Email:** Nodemailer (Gmail SMTP)
- **QR Code:** QRCode.js, html5-qrcode (CDN)
- **Storage:** localStorage for assignments, results, and notices (demo mode)

### 🛠️ Additional Highlights

- Modular, maintainable codebase
- Accessibility and mobile-friendly design
- All features isolated to prevent interference
- Professional error handling and user feedback

---

## Getting Started

1. Clone the repository
2. Install dependencies in `/api` (`npm install`)
3. Configure your `.env` for email and MongoDB
4. Start the backend (`node start-local-server.js` or use `/api/unified-server.js`)
5. Open `index.html` in your browser

---

## Credits

**Developed by:** Ananta Narayan Sethy

For any queries or contributions, please contact the author.# 🎓 Roland Institute of Technology - Dashboard System

A modern, responsive college management system with both admin and student portals featuring dark/light themes, advanced UI/UX, and comprehensive functionality.

## ✨ Features

### 🔧 Admin Dashboard (`index.html`)

- **Real-time Analytics**: Live system monitoring and statistics
- **Student Management**: Comprehensive student data management
- **Attendance Tracking**: Advanced attendance monitoring system
- **Exam & Results**: Complete examination and results management
- **Notifications**: Critical system notifications and announcements
- **Report Generation**: Advanced reporting capabilities
- **Bulk Operations**: Mass email and system operations

### 🎒 Student Portal (`StudentDashboard.html`)

- **Academic Overview**: CGPA tracking and performance metrics
- **Smart Actions**: QR attendance, assignment submission, lab booking
- **Grade Calculator**: Real-time GPA calculation tool
- **Study Planner**: Personalized study schedule management
- **Library Search**: Integrated library resource search
- **Course Management**: Complete course and schedule overview

## 🎨 Design Features

### 🌙 Modern Theme System

- **Dark Theme**: Ultra-dark theme matching professional standards
- **Light Theme**: Clean, accessible light mode
- **Smooth Transitions**: Animated theme switching
- **Persistent Settings**: Theme preference saved across sessions

### 🚀 Advanced UI/UX

- **Glassmorphism**: Modern glass effects with backdrop blur
- **Micro-interactions**: Hover effects, ripples, and animations
- **Responsive Design**: Perfect on desktop, tablet, and mobile
- **Accessibility**: Screen reader support, keyboard navigation
- **Performance Optimized**: Hardware-accelerated animations

### 🎭 Visual Enhancements

- **Modern Gradients**: Sophisticated color transitions
- **Premium Shadows**: Multi-layered shadow system
- **Enhanced Cards**: 3D hover effects and transformations
- **Loading States**: Shimmer animations for loading content

## ⌨️ Keyboard Shortcuts

### Admin Dashboard

- `Alt + T` - Toggle theme
- `Ctrl + K` - Focus search
- `1-9` - Navigate sections
- `Ctrl + B` - Toggle sidebar
- `Ctrl + /` - Show shortcuts

### Student Portal

- `Alt + T` - Toggle theme
- `Q` - Open QR attendance
- `C` - Open grade calculator
- `Ctrl + B` - Toggle sidebar

## 📱 Responsive Breakpoints

- **Desktop**: 1200px and above
- **Laptop**: 900px - 1199px
- **Tablet**: 768px - 899px
- **Mobile**: 480px - 767px
- **Small Mobile**: Below 480px

## 🔧 Technical Specifications

### CSS Architecture

- **CSS Custom Properties**: Comprehensive variable system
- **Modern Layout**: CSS Grid and Flexbox
- **Progressive Enhancement**: Graceful degradation
- **Cross-browser**: Webkit prefixes and fallbacks

### JavaScript Features

- **Vanilla JS**: No dependencies, pure JavaScript
- **ES6+**: Modern JavaScript features
- **Event Delegation**: Efficient event handling
- **Local Storage**: Persistent user preferences

### Performance

- **Hardware Acceleration**: GPU-accelerated animations
- **Optimized Assets**: Efficient loading strategies
- **Reduced Motion**: Accessibility compliance
- **Print Styles**: Optimized for printing

## 🚀 Getting Started

1. **Download**: Clone or download the project files
2. **Structure**: Ensure all files are in the same directory
3. **Assets**: Add images to the `assets/` folder:
   - `logo.png` - Institution logo
   - `admin-profile.jpg` - Admin avatar
   - `student-profile.jpg` - Student avatar
   - `aicte.png`, `naac.png`, `iso.png` - Certification badges
4. **Launch**: Open `index.html` or `StudentDashboard.html` in a modern browser

## 📁 File Structure

```
dashboard/
├── index.html              # Admin Dashboard
├── StudentDashboard.html   # Student Portal
├── style.css              # Admin Dashboard Styles
├── student-dashboard.css  # Student Portal Styles
├── README.md              # Documentation
└── assets/                # Image assets
    ├── logo.png
    ├── admin-profile.jpg
    ├── student-profile.jpg
    ├── aicte.png
    ├── naac.png
    └── iso.png
```

## 🌟 Browser Support

- **Chrome**: 80+
- **Firefox**: 75+
- **Safari**: 13+
- **Edge**: 80+

## 🎯 Key Technologies

- **HTML5**: Semantic markup, accessibility
- **CSS3**: Custom properties, grid, flexbox
- **JavaScript ES6+**: Modern JavaScript features
- **Font Awesome**: Icon library
- **Google Fonts**: Inter and Poppins typography

## 🔄 Theme Synchronization

Both dashboards share theme preferences through localStorage, ensuring a consistent experience across the entire system.

## 📋 Features Checklist

### ✅ Completed Features

- [x] Modern dark/light theme system
- [x] Responsive design across all devices
- [x] Smooth animations and micro-interactions
- [x] Accessibility compliance
- [x] Keyboard shortcuts
- [x] Local storage integration
- [x] Professional glassmorphism design
- [x] Cross-browser compatibility
- [x] Performance optimization
- [x] Print-friendly styles

### 🚀 Production Ready

This system is fully production-ready with:

- Clean, maintainable code
- Comprehensive error handling
- Accessibility compliance
- Performance optimization
- Cross-browser support
- Professional design standards

## 💡 Customization

The system uses CSS custom properties for easy theming. Modify the `:root` variables in the CSS files to customize colors, spacing, and animations.

## 📞 Support

For technical support or customization requests, refer to the code comments and documentation within the files. The system is built with clean, readable code and comprehensive commenting.

---

**Built with ❤️ for modern educational institutions**

_Last updated: October 2025_
