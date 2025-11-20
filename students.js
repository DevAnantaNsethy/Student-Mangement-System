// In-memory student storage for demo (no localStorage)
let _studentsMemory = [];
function getStudents() {
  return _studentsMemory;
}
function saveStudents(students) {
  _studentsMemory = students;
}

function renderStudentsTable(filter = '') {
  const tbody = document.getElementById('studentsTableBody');
  if (!tbody) return;
  let students = getStudents();
  if (filter) {
    students = students.filter((s) =>
      s.name.toLowerCase().includes(filter.toLowerCase())
    );
  }
  tbody.innerHTML = '';
  if (students.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="7" style="text-align:center;color:#888;">No students found.</td></tr>';
    return;
  }
  students.forEach((stu, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${stu.name}</td>
      <td>${stu.regNo}</td>
      <td>${stu.course}</td>
      <td>${stu.year}</td>
      <td>${stu.attendance || '-'}</td>
      <td>${stu.status || '-'}</td>
      <td><button class="delete-btn" data-idx="${idx}">Delete</button></td>
    `;
    tr.querySelector('.delete-btn').onclick = function () {
      if (confirm('Delete this student?')) {
        students.splice(idx, 1);
        saveStudents(students);
        renderStudentsTable(document.getElementById('studentSearch').value);
      }
    };
    tbody.appendChild(tr);
  });
}
/* students.js - Admin student management logic */
const STUDENT_KEY = 'dashboardStudents';

// Add Student Form (always visible)
const addStudentForm = document.getElementById('addStudentForm');
if (addStudentForm) {
  addStudentForm.onsubmit = function (e) {
    e.preventDefault();
    const name = document.getElementById('addName').value.trim();
    const regNo = document.getElementById('addRegNo').value.trim();
    const course = document.getElementById('addCourse').value.trim();
    const year = document.getElementById('addYear').value.trim();
    const attendance = document.getElementById('addAttendance').value.trim();
    const status = document.getElementById('addStatus').value.trim();
    if (!name || !regNo || !course || !year) {
      alert('Please fill all required fields.');
      return;
    }
    const students = getStudents();
    students.unshift({ name, regNo, course, year, attendance, status });
    saveStudents(students);
    renderStudentsTable(document.getElementById('studentSearch').value);
    addStudentForm.reset();
  };
}

// Search
const searchInput = document.getElementById('studentSearch');
if (searchInput) {
  searchInput.addEventListener('input', function () {
    renderStudentsTable(this.value);
  });
}

// Remove old add student button logic (now always visible)

// Initial render and live update
renderStudentsTable();
setInterval(
  () => renderStudentsTable(searchInput ? searchInput.value : ''),
  2000
);
