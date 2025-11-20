// admin-qr-attendance.js

document.addEventListener('DOMContentLoaded', function () {
  const attendanceKey = 'attendanceList';
  const tableBody = document.querySelector('#attendanceTable tbody');
  const scanStatus = document.getElementById('scan-status');

  // Load and render attendance list
  function loadAttendance() {
    tableBody.innerHTML = '';
    const data = JSON.parse(localStorage.getItem(attendanceKey) || '[]');
    data.forEach((row) => {
      const tr = document.createElement('tr');
      tr.classList.add('attended');
      tr.innerHTML = `<td>${row.name}</td><td>${row.regNo}</td><td>${row.time}</td>`;
      tableBody.appendChild(tr);
    });
  }

  // Add new attendance record
  function addAttendance(name, regNo) {
    const now = new Date();
    const time = now.toLocaleString();
    let data = JSON.parse(localStorage.getItem(attendanceKey) || '[]');
    // Prevent duplicate attendance for same regNo in same session
    if (data.some((row) => row.regNo === regNo)) {
      scanStatus.textContent = 'Attendance already marked for this student.';
      scanStatus.style.color = '#d32f2f';
      return;
    }
    data.push({ name, regNo, time });
    localStorage.setItem(attendanceKey, JSON.stringify(data));
    scanStatus.textContent = 'Attendance marked successfully!';
    scanStatus.style.color = '#388e3c';
    loadAttendance();
  }

  // QR code scanner setup
  const html5QrCode = new Html5Qrcode('scanner');
  const qrConfig = { fps: 10, qrbox: 220 };
  function startScanner() {
    html5QrCode
      .start(
        { facingMode: 'environment' },
        qrConfig,
        (qrCodeMessage) => {
          try {
            const data = JSON.parse(qrCodeMessage);
            if (data.name && data.regNo) {
              addAttendance(data.name, data.regNo);
            } else {
              scanStatus.textContent = 'Invalid QR code data.';
              scanStatus.style.color = '#d32f2f';
            }
          } catch (e) {
            scanStatus.textContent = 'Invalid QR code format.';
            scanStatus.style.color = '#d32f2f';
          }
        },
        (errorMessage) => {
          // Optionally show scanning errors
        }
      )
      .catch((err) => {
        scanStatus.textContent = 'Camera access denied or not available.';
        scanStatus.style.color = '#d32f2f';
      });
  }

  loadAttendance();
  startScanner();
});
