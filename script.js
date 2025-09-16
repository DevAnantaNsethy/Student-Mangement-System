/* script.js
   Handles:
   - Password visibility toggle
   - Simple front-end validation
   - Demo success feedback on submit
*/

/* Elements */
const togglePasswordBtn = document.getElementById('togglePassword');
const passwordInput = document.getElementById('password');
const signupForm = document.getElementById('signupForm');
const continueEmailBtn = document.getElementById('continueEmailBtn');
const loginLink = document.getElementById('loginLink');

/* Toggle password visibility */
togglePasswordBtn.addEventListener('click', () => {
  const isPressed = togglePasswordBtn.getAttribute('aria-pressed') === 'true';
  togglePasswordBtn.setAttribute('aria-pressed', String(!isPressed));

  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    togglePasswordBtn.setAttribute('aria-label', 'Hide password');
  } else {
    passwordInput.type = 'password';
    togglePasswordBtn.setAttribute('aria-label', 'Show password');
  }
});

/* Simple front-end form validation + demo success feedback */
signupForm.addEventListener('submit', (e) => {
  e.preventDefault();

  // Clear previous errors
  document.querySelectorAll('.field-error').forEach(el => {
    el.classList.remove('show');
    el.textContent = '';
  });

  let valid = true;

  // Name validation
  const name = signupForm.name.value.trim();
  if (name.length < 2) {
    showError('name', 'Please enter your name');
    valid = false;
  }

  // Email validation (simple)
  const email = signupForm.email.value.trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    showError('email', 'Please enter a valid email');
    valid = false;
  }

  // Password validation
  const pwd = signupForm.password.value;
  if (pwd.length < 6) {
    showError('password', 'Password must be at least 6 characters');
    valid = false;
  }

  if (!valid) {
    return;
  }

  // Demo success: show subtle confirmation in place of button and reset.
  // In a real project, submit to server here.
  const primaryBtn = signupForm.querySelector('.btn-primary');
  primaryBtn.disabled = true;
  primaryBtn.textContent = 'Signing up...';

  setTimeout(() => {
    primaryBtn.textContent = 'Signed up ✓';
    primaryBtn.style.boxShadow = '0 12px 30px rgba(34,197,94,0.12)';
    primaryBtn.style.background = 'linear-gradient(90deg, #22c55e, #16a34a)';
    signupForm.reset();

    // reset UI after a moment
    setTimeout(() => {
      primaryBtn.disabled = false;
      primaryBtn.textContent = 'Sign up';
      primaryBtn.style.removeProperty('box-shadow');
      primaryBtn.style.removeProperty('background');
    }, 1800);
  }, 900);
});

/* helper to display error near a field */
function showError(fieldName, message) {
  const field = document.getElementById(fieldName);
  if (!field) return;
  const wrapper = field.closest('.field');
  const err = wrapper.querySelector('.field-error');
  err.textContent = message;
  err.classList.add('show');
}

/* Secondary button demo: "Continue with email" — show small prompt */
continueEmailBtn.addEventListener('click', () => {
  alert('Continue with email — this button is intentionally left as a demo action.\nIn production integrate your OAuth or continuation flow here.');
});

/* Demo login link action */
loginLink.addEventListener('click', (e) => {
  e.preventDefault();
  alert('Open Log in screen — for demo this is a placeholder. Implement routing to /login or swap view here.');
});

/* Accessibility: Move focus to first invalid field when error occurs */
document.addEventListener('invalid', function (e) {
  e.preventDefault();
  const field = e.target;
  field.focus();
}, true);
