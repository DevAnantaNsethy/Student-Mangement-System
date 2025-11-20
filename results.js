// results.js
// Results management: add, list, localStorage, admin+student dashboard

const RESULTS_KEY = 'results';

function getResults() {
  return JSON.parse(localStorage.getItem(RESULTS_KEY) || '[]');
}

function saveResults(results) {
  localStorage.setItem(RESULTS_KEY, JSON.stringify(results));
}

function addResult(exam, subject, course, date, totalStudents, passRate) {
  const results = getResults();
  results.push({
    id: Date.now(),
    exam,
    subject,
    course,
    date,
    totalStudents,
    passRate,
    createdAt: new Date().toISOString(),
  });
  saveResults(results);
}

function deleteResult(id) {
  let results = getResults();
  results = results.filter((r) => r.id !== id);
  saveResults(results);
}

function renderResultsTable(containerId, isAdmin) {
  const results = getResults();
  const container = document.getElementById(containerId);
  if (!container) return;
  if (results.length === 0) {
    container.innerHTML = '<div class="empty-message">No results found.</div>';
    return;
  }
  let html = `<table class="results-table"><thead><tr><th>Exam</th><th>Subject</th><th>Course</th><th>Date</th><th>Total Students</th><th>Pass Rate</th>${
    isAdmin ? '<th>Actions</th>' : ''
  }</tr></thead><tbody>`;
  results.forEach((r) => {
    html += `<tr>
      <td>${r.exam}</td>
      <td>${r.subject}</td>
      <td>${r.course}</td>
      <td>${r.date}</td>
      <td>${r.totalStudents}</td>
      <td>${r.passRate}</td>
      ${
        isAdmin
          ? `<td><button onclick="deleteResult(${r.id});renderResultsTable('${containerId}',true)">Delete</button></td>`
          : ''
      }
    </tr>`;
  });
  html += '</tbody></table>';
  container.innerHTML = html;
}

window.getResults = getResults;
window.saveResults = saveResults;
window.addResult = addResult;
window.deleteResult = deleteResult;
window.renderResultsTable = renderResultsTable;
