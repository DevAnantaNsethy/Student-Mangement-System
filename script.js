/* script.js
   Handles:
   - Password visibility toggle
   - Front-end validation
   - Real API integration with backend
*/

/* Elements */
const togglePasswordBtn = document.getElementById("togglePassword");
const passwordInput = document.getElementById("password");
const signupForm = document.getElementById("signupForm");
const continueEmailBtn = document.getElementById("continueEmailBtn");
const loginLink = document.getElementById("loginLink");

/* Toggle password visibility */
if (togglePasswordBtn && passwordInput) {
  togglePasswordBtn.addEventListener("click", () => {
    const isPressed = togglePasswordBtn.getAttribute("aria-pressed") === "true";
    togglePasswordBtn.setAttribute("aria-pressed", String(!isPressed));

    if (passwordInput.type === "password") {
      passwordInput.type = "text";
      togglePasswordBtn.setAttribute("aria-label", "Hide password");
    } else {
      passwordInput.type = "password";
      togglePasswordBtn.setAttribute("aria-label", "Show password");
    }
  });
}

/* Real API integration for signup form */
if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Clear previous errors
    document.querySelectorAll(".field-error").forEach((el) => {
      el.classList.remove("show");
      el.textContent = "";
    });

    let valid = true;

    // Name validation
    const name = signupForm.name.value.trim();
    if (name.length < 2) {
      showError("name", "Please enter your name");
      valid = false;
    }

    // Email validation
    const email = signupForm.email.value.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      showError("email", "Please enter a valid email");
      valid = false;
    }

    // Password validation
    const pwd = signupForm.password.value;
    if (pwd.length < 6) {
      showError("password", "Password must be at least 6 characters");
      valid = false;
    }

    if (!valid) {
      return;
    }

    // Real API call to backend
    const primaryBtn = signupForm.querySelector(".btn-primary");
    primaryBtn.disabled = true;
    primaryBtn.textContent = "Signing up...";

    try {
      // Step 1: Send OTP
      const otpResponse = await fetch("/api/send-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, role: "student" }),
      });

      const otpData = await otpResponse.json();

      if (!otpData.success) {
        throw new Error(otpData.message || "Failed to send OTP");
      }

      // Step 2: Get OTP from user
      const otp = prompt("Please enter the OTP sent to your email:");
      if (!otp) {
        throw new Error("OTP is required");
      }

      // Step 3: Verify OTP
      const verifyResponse = await fetch("/api/verify-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, otp }),
      });

      const verifyData = await verifyResponse.json();

      if (!verifyData.success) {
        throw new Error(verifyData.message || "Invalid OTP");
      }

      // Step 4: Complete registration
      const registerResponse = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password: pwd,
          confirmPassword: pwd,
          role: "student",
        }),
      });

      const registerData = await registerResponse.json();

      if (registerData.success) {
        primaryBtn.textContent = "Signed up ✓";
        primaryBtn.style.boxShadow = "0 12px 30px rgba(34,197,94,0.12)";
        primaryBtn.style.background =
          "linear-gradient(90deg, #22c55e, #16a34a)";

        // Show success message
        showSuccess("Registration successful! Redirecting to login...");

        // Redirect to login page after delay
        setTimeout(() => {
          window.location.href = "./stu_login.html";
        }, 2000);
      } else {
        throw new Error(registerData.message || "Registration failed");
      }
    } catch (error) {
      console.error("Signup error:", error);
      showError("email", error.message);
      primaryBtn.disabled = false;
      primaryBtn.textContent = "Sign up";
    }
  });
}

/* Helper function to display error near a field */
function showError(fieldName, message) {
  const field = document.getElementById(fieldName);
  if (!field) return;
  const wrapper = field.closest(".field");
  const err = wrapper.querySelector(".field-error");
  if (err) {
    err.textContent = message;
    err.classList.add("show");
  } else {
    // Create error element if it doesn't exist
    const errorDiv = document.createElement("div");
    errorDiv.className = "field-error show";
    errorDiv.textContent = message;
    wrapper.appendChild(errorDiv);
  }
}

/* Helper function to show success message */
function showSuccess(message) {
  // Create or update success message
  let successDiv = document.querySelector(".success-message");
  if (!successDiv) {
    successDiv = document.createElement("div");
    successDiv.className = "success-message";
    document.body.appendChild(successDiv);
  }
  successDiv.textContent = message;
  successDiv.style.display = "block";
  successDiv.style.color = "#22c55e";
  successDiv.style.textAlign = "center";
  successDiv.style.margin = "20px 0";
  successDiv.style.fontWeight = "bold";
}

/* Secondary button demo: "Continue with email" */
if (continueEmailBtn) {
  continueEmailBtn.addEventListener("click", () => {
    alert(
      "Continue with email — this button is intentionally left as a demo action.\nIn production integrate your OAuth or continuation flow here."
    );
  });
}

/* Demo login link action */
if (loginLink) {
  loginLink.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href = "./stu_login.html";
  });
}

/* Accessibility: Move focus to first invalid field when error occurs */
document.addEventListener(
  "invalid",
  function (e) {
    e.preventDefault();
    const field = e.target;
    field.focus();
  },
  true
);

/* Utility function to check if user is logged in */
function checkAuthStatus() {
  const user = localStorage.getItem("user");
  if (user) {
    const userData = JSON.parse(user);
    console.log("User logged in:", userData);
    return userData;
  }
  return null;
}

/* Auto-redirect if user is already logged in */
window.addEventListener("load", () => {
  const user = checkAuthStatus();
  if (user && window.location.pathname.includes("login")) {
    // Redirect to appropriate dashboard based on role
    if (user.role === "admin") {
      window.location.href = "./admin-dashboard.html";
    } else {
      window.location.href = "./student-dashboard.html";
    }
  }
});
