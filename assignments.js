// assignments.js
// Assignment management: add, list, file upload, localStorage, admin+student dashboard

const ASSIGNMENTS_KEY = 'assignments';

function getAssignments() {
  return JSON.parse(localStorage.getItem(ASSIGNMENTS_KEY) || '[]');
}

function saveAssignments(assignments) {
  localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(assignments));
}

function addAssignment(title, description, fileData, fileName) {
  const assignments = getAssignments();
  assignments.push({
    id: Date.now(),
    title,
    description,
    fileData, // base64 or null
    fileName: fileName || '',
    createdAt: new Date().toISOString(),
  });
  saveAssignments(assignments);
}

function deleteAssignment(id) {
  let assignments = getAssignments();
  assignments = assignments.filter((a) => a.id !== id);
  saveAssignments(assignments);
}

function renderAssignmentsTable(containerId, isAdmin) {
  const assignments = getAssignments();
  const container = document.getElementById(containerId);
  if (!container) return;
  if (assignments.length === 0) {
    container.innerHTML =
      '<div class="empty-message">No assignments found.</div>';
    return;
  }
  let html = `<table class="assignments-table"><thead><tr><th>Title</th><th>Description</th><th>File</th><th>Date</th>${
    isAdmin ? '<th>Actions</th>' : ''
  }</tr></thead><tbody>`;
  assignments.forEach((a) => {
    html += `<tr>
      <td>${a.title}</td>
      <td>${a.description}</td>
      <td>${
        a.fileName
          ? `<a href="${a.fileData}" download="${a.fileName}">${a.fileName}</a>`
          : '—'
      }</td>
      <td>${a.createdAt.split('T')[0]}</td>
      ${
        isAdmin
          ? `<td><button onclick="deleteAssignment(${a.id});renderAssignmentsTable('${containerId}',true)">Delete</button></td>`
          : ''
      }
    </tr>`;
  });
  html += '</tbody></table>';
  container.innerHTML = html;
}

// File input handler for assignment form
function handleAssignmentFileInput(input, cb) {
  const file = input.files[0];
  if (!file) return cb(null, '');
  const reader = new FileReader();
  reader.onload = function (e) {
    cb(e.target.result, file.name);
  };
  reader.readAsDataURL(file);
}

window.getAssignments = getAssignments;
window.saveAssignments = saveAssignments;
window.addAssignment = addAssignment;
window.deleteAssignment = deleteAssignment;
window.renderAssignmentsTable = renderAssignmentsTable;
window.handleAssignmentFileInput = handleAssignmentFileInput;
