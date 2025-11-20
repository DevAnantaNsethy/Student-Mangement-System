// student-generate-qr.js

document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('qrForm');
  const qrResult = document.getElementById('qrResult');
  const qrCodeDiv = document.getElementById('qrcode');
  const nameInput = document.getElementById('studentName');
  const regInput = document.getElementById('regNo');

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const name = nameInput.value.trim();
    const regNo = regInput.value.trim();
    if (!name || !regNo) {
      alert('Please fill in both fields.');
      return;
    }
    // Store data locally
    localStorage.setItem('studentQRData', JSON.stringify({ name, regNo }));
    // Generate QR code
    qrCodeDiv.innerHTML = '';
    const qrData = JSON.stringify({ name, regNo });
    new QRCode(qrCodeDiv, {
      text: qrData,
      width: 180,
      height: 180,
      colorDark: '#000000',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H,
    });
    qrResult.classList.remove('hidden');
  });
});
