// Signup with Email Verification JavaScript
class SignupVerification {
    constructor() {
        this.apiBaseUrl = 'http://localhost:3001/api';
        this.signupForm = document.getElementById('signupForm');
        this.signupBtn = document.getElementById('signupBtn');
        this.errorMessage = document.getElementById('errorMessage');
        this.successMessage = document.getElementById('successMessage');
        
        this.init();
    }

    init() {
        this.signupForm.addEventListener('submit', (e) => this.handleSignup(e));
    }

    showError(message) {
        this.errorMessage.textContent = message;
        this.errorMessage.classList.add('show');
        this.successMessage.classList.remove('show');
    }

    showSuccess(message) {
        this.successMessage.textContent = message;
        this.successMessage.classList.add('show');
        this.errorMessage.classList.remove('show');
    }

    hideMessages() {
        this.errorMessage.classList.remove('show');
        this.successMessage.classList.remove('show');
    }

    setLoadingState(loading) {
        const btnText = this.signupBtn.querySelector('.btn-text');
        const btnSpinner = this.signupBtn.querySelector('.btn-spinner');
        
        this.signupBtn.disabled = loading;
        
        if (loading) {
            btnText.style.display = 'none';
            btnSpinner.style.display = 'inline-block';
        } else {
            btnText.style.display = 'inline';
            btnSpinner.style.display = 'none';
        }
    }

    validateForm() {
        const formData = new FormData(this.signupForm);
        const name = formData.get('name')?.trim();
        const email = formData.get('email')?.trim();
        const password = formData.get('password');
        const confirmPassword = formData.get('confirmPassword');

        // Clear previous errors
        this.hideMessages();

        // Validation
        if (!name || name.length < 2) {
            this.showError('Please enter your full name (at least 2 characters)');
            return false;
        }

        if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
            this.showError('Please enter a valid email address');
            return false;
        }

        if (!password || password.length < 6) {
            this.showError('Password must be at least 6 characters long');
            return false;
        }

        if (password !== confirmPassword) {
            this.showError('Passwords do not match');
            return false;
        }

        return { name, email, password };
    }

    async handleSignup(e) {
        e.preventDefault();
        
        const validation = this.validateForm();
        if (!validation) {
            return;
        }

        const { name, email, password } = validation;
        
        this.setLoadingState(true);
        this.hideMessages();

        try {
            // Step 1: Send OTP to email
            const otpResponse = await fetch(`${this.apiBaseUrl}/send-otp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email })
            });

            const otpData = await otpResponse.json();

            if (otpData.success) {
                // Store user data temporarily
                localStorage.setItem('pendingEmail', email);
                localStorage.setItem('pendingUserData', JSON.stringify({
                    name,
                    email,
                    password
                }));

                // Show success message
                this.showSuccess('OTP sent to your email! Redirecting to verification...');

                // Redirect to OTP verification page
                setTimeout(() => {
                    window.location.href = './otp-verification.html';
                }, 1500);

            } else {
                this.showError(otpData.message || 'Failed to send verification email. Please try again.');
            }

        } catch (error) {
            console.error('Signup error:', error);
            this.showError('Network error. Please check your connection and try again.');
        } finally {
            this.setLoadingState(false);
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SignupVerification();
});
