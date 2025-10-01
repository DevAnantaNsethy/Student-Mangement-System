// OTP Verification JavaScript
class OTPVerification {
    constructor() {
        this.apiBaseUrl = 'http://localhost:3001/api';
        this.otpInputs = document.querySelectorAll('.otp-digit');
        this.otpForm = document.getElementById('otpForm');
        this.verifyBtn = document.getElementById('verifyBtn');
        this.resendBtn = document.getElementById('resendBtn');
        this.errorMessage = document.getElementById('errorMessage');
        this.successMessage = document.getElementById('successMessage');
        this.emailDisplay = document.getElementById('emailDisplay');
        this.countdown = document.getElementById('countdown');
        
        this.userEmail = this.getEmailFromStorage();
        this.countdownTimer = null;
        this.resendCooldown = 60; // 60 seconds cooldown
        
        this.init();
    }

    init() {
        // Set email display
        this.emailDisplay.textContent = this.userEmail || 'your-email@example.com';
        
        // Setup OTP input handlers
        this.setupOTPInputs();
        
        // Setup form submission
        this.otpForm.addEventListener('submit', (e) => this.handleVerifyOTP(e));
        
        // Setup resend button
        this.resendBtn.addEventListener('click', () => this.handleResendOTP());
        
        // Auto-focus first input
        this.otpInputs[0].focus();
        
        // Start resend cooldown
        this.startResendCooldown();
    }

    getEmailFromStorage() {
        // Get email from localStorage (set during signup)
        return localStorage.getItem('pendingEmail') || sessionStorage.getItem('pendingEmail');
    }

    setupOTPInputs() {
        this.otpInputs.forEach((input, index) => {
            // Handle input
            input.addEventListener('input', (e) => {
                const value = e.target.value;
                
                // Only allow digits
                if (!/^\d$/.test(value)) {
                    e.target.value = '';
                    return;
                }
                
                // Auto-focus next input
                if (value && index < this.otpInputs.length - 1) {
                    this.otpInputs[index + 1].focus();
                }
                
                // Update visual state
                this.updateOTPVisualState();
                
                // Auto-submit when all fields are filled
                if (this.isAllFieldsFilled()) {
                    setTimeout(() => this.otpForm.dispatchEvent(new Event('submit')), 100);
                }
            });
            
            // Handle backspace
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !e.target.value && index > 0) {
                    this.otpInputs[index - 1].focus();
                }
            });
            
            // Handle paste
            input.addEventListener('paste', (e) => this.handlePaste(e, index));
        });
    }

    handlePaste(e, startIndex) {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text');
        const digits = pastedData.replace(/\D/g, '').slice(0, 6);
        
        digits.split('').forEach((digit, index) => {
            if (startIndex + index < this.otpInputs.length) {
                this.otpInputs[startIndex + index].value = digit;
            }
        });
        
        this.updateOTPVisualState();
        
        // Focus last filled input or submit
        const lastFilledIndex = Math.min(startIndex + digits.length - 1, this.otpInputs.length - 1);
        this.otpInputs[lastFilledIndex].focus();
        
        if (this.isAllFieldsFilled()) {
            setTimeout(() => this.otpForm.dispatchEvent(new Event('submit')), 100);
        }
    }

    updateOTPVisualState() {
        this.otpInputs.forEach(input => {
            input.classList.toggle('filled', input.value !== '');
        });
    }

    isAllFieldsFilled() {
        return Array.from(this.otpInputs).every(input => input.value !== '');
    }

    getOTPValue() {
        return Array.from(this.otpInputs).map(input => input.value).join('');
    }

    clearOTPInputs() {
        this.otpInputs.forEach(input => {
            input.value = '';
            input.classList.remove('filled');
        });
        this.otpInputs[0].focus();
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
        const btnText = this.verifyBtn.querySelector('.btn-text');
        const btnSpinner = this.verifyBtn.querySelector('.btn-spinner');
        
        this.verifyBtn.disabled = loading;
        
        if (loading) {
            btnText.style.display = 'none';
            btnSpinner.style.display = 'inline-block';
        } else {
            btnText.style.display = 'inline';
            btnSpinner.style.display = 'none';
        }
    }

    async handleVerifyOTP(e) {
        e.preventDefault();
        
        const otp = this.getOTPValue();
        
        if (otp.length !== 6) {
            this.showError('Please enter all 6 digits');
            return;
        }
        
        if (!this.userEmail) {
            this.showError('Email not found. Please go back to signup.');
            return;
        }
        
        this.hideMessages();
        this.setLoadingState(true);
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/verify-otp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: this.userEmail,
                    otp: otp
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showSuccess('Email verified successfully!');
                
                // Complete registration
                await this.completeRegistration();
            } else {
                this.showError(data.message || 'Invalid OTP. Please try again.');
                this.clearOTPInputs();
            }
        } catch (error) {
            console.error('Verification error:', error);
            this.showError('Network error. Please check your connection and try again.');
            this.clearOTPInputs();
        } finally {
            this.setLoadingState(false);
        }
    }

    async completeRegistration() {
        // Get user data from localStorage
        const userData = JSON.parse(localStorage.getItem('pendingUserData') || '{}');
        
        if (!userData.name || !userData.email || !userData.password) {
            this.showError('User data not found. Please sign up again.');
            return;
        }
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: userData.name,
                    email: userData.email,
                    password: userData.password,
                    confirmPassword: userData.password
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Clear pending data
                localStorage.removeItem('pendingEmail');
                localStorage.removeItem('pendingUserData');
                sessionStorage.removeItem('pendingEmail');
                
                // Show success and redirect
                this.showSuccess('Registration completed successfully! Redirecting to login...');
                
                setTimeout(() => {
                    window.location.href = './stu_login.html';
                }, 2000);
            } else {
                this.showError(data.message || 'Registration failed. Please try again.');
            }
        } catch (error) {
            console.error('Registration error:', error);
            this.showError('Registration failed. Please try again.');
        }
    }

    async handleResendOTP() {
        if (!this.userEmail) {
            this.showError('Email not found. Please go back to signup.');
            return;
        }
        
        this.resendBtn.disabled = true;
        this.hideMessages();
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/send-otp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: this.userEmail
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showSuccess('New OTP sent successfully!');
                this.clearOTPInputs();
                this.startResendCooldown();
            } else {
                this.showError(data.message || 'Failed to send OTP. Please try again.');
                this.resendBtn.disabled = false;
            }
        } catch (error) {
            console.error('Resend OTP error:', error);
            this.showError('Network error. Please check your connection and try again.');
            this.resendBtn.disabled = false;
        }
    }

    startResendCooldown() {
        this.resendBtn.disabled = true;
        this.countdown.style.display = 'block';
        
        let timeLeft = this.resendCooldown;
        
        this.countdownTimer = setInterval(() => {
            this.countdown.textContent = `Resend available in ${timeLeft} seconds`;
            timeLeft--;
            
            if (timeLeft < 0) {
                clearInterval(this.countdownTimer);
                this.resendBtn.disabled = false;
                this.countdown.style.display = 'none';
            }
        }, 1000);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new OTPVerification();
});
