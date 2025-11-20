// notices.js - Shared for admin and student dashboards
// Uses localStorage to store and sync notices

const NOTICE_KEY = 'dashboardNotices';

function getNotices() {
  return JSON.parse(localStorage.getItem(NOTICE_KEY) || '[]');
}

function saveNotices(notices) {
  localStorage.setItem(NOTICE_KEY, JSON.stringify(notices));
}

function renderAdminNotices() {
  const list = document.getElementById('adminNoticesList');
  if (!list) return;
  const notices = getNotices();
  list.innerHTML = '';
  if (notices.length === 0) {
    list.innerHTML =
      '<div style="color:#888;text-align:center;margin-top:18px;">No notices published yet.</div>';
    return;
  }
  notices.forEach((notice, idx) => {
    const div = document.createElement('div');
    div.className = 'notice-item';
    div.innerHTML = `
      <div class="notice-title">${notice.title}</div>
      <div class="notice-content">${notice.content}</div>
      <div class="notice-date">${notice.date}</div>
      <button class="notice-delete" data-idx="${idx}">Delete</button>
    `;
    div.querySelector('.notice-delete').onclick = function () {
      if (confirm('Delete this notice?')) {
        notices.splice(idx, 1);
        saveNotices(notices);
        renderAdminNotices();
        renderStudentNotices();
      }
    };
    list.appendChild(div);
  });
}

function renderStudentNotices() {
  const list = document.getElementById('studentNoticesList');
  if (!list) return;
  const notices = getNotices();
  list.innerHTML = '';
  if (notices.length === 0) {
    list.innerHTML =
      '<div style="color:#888;text-align:center;margin-top:18px;">No notices available.</div>';
    return;
  }
  notices.forEach((notice) => {
    const div = document.createElement('div');
    div.className = 'notice-item';
    div.innerHTML = `
      <div class="notice-title">${notice.title}</div>
      <div class="notice-content">${notice.content}</div>
      <div class="notice-date">${notice.date}</div>
    `;
    list.appendChild(div);
  });
}

// Admin: handle notice form
const noticeForm = document.getElementById('noticeForm');
if (noticeForm) {
  noticeForm.onsubmit = function (e) {
    e.preventDefault();
    const title = document.getElementById('noticeTitle').value.trim();
    const content = document.getElementById('noticeContent').value.trim();
    if (!title || !content) return;
    const notices = getNotices();
    notices.unshift({
      title,
      content,
      date: new Date().toLocaleString(),
    });
    saveNotices(notices);
    noticeForm.reset();
    renderAdminNotices();
    renderStudentNotices();
  };
}

// Initial render and live update
renderAdminNotices();
renderStudentNotices();
setInterval(() => {
  renderAdminNotices();
  renderStudentNotices();
}, 2000);
