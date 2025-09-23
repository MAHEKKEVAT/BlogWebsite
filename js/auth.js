// auth.js - Fixed version with better debugging
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, checking Firebase...');

    // Check if Firebase is properly loaded
    if (typeof firebase === 'undefined') {
        console.error('Firebase SDK not loaded');
        showErrorAndRetry('Firebase SDK not loaded. Please check your internet connection.');
        return;
    }

    // Check if Firebase services are available
    let auth, db;
    try {
        auth = firebase.auth();
        db = firebase.firestore();
        console.log('Firebase services available, proceeding...');
        console.log('Firebase app:', firebase.app().name);
    } catch (error) {
        console.error('Firebase services not available:', error);
        showErrorAndRetry('Firebase services not available. Please refresh the page.');
        return;
    }

    const splashScreen = document.getElementById('splash-screen');
    const signinPage = document.getElementById('signin-page');
    const registerPage = document.getElementById('register-page');
    const signinForm = document.getElementById('signin-form');
    const registerForm = document.getElementById('register-form');
    const createAccountLink = document.getElementById('create-account');
    const backToLoginLink = document.getElementById('back-to-login');
    const forgotPasswordLink = document.getElementById('forgot-password');

    // Debug: Check if elements exist
    console.log('Elements found:', {
        splashScreen: !!splashScreen,
        signinPage: !!signinPage,
        registerPage: !!registerPage,
        signinForm: !!signinForm,
        registerForm: !!registerForm
    });

    // Check if user is already logged in
    auth.onAuthStateChanged(function(user) {
        console.log('Auth state changed, user:', user);
        
        if (user) {
            // User is signed in, redirect to dashboard
            console.log('User signed in:', user.email);
            showSuccessMessage('Welcome back! Redirecting to dashboard...', signinPage);
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 2000);
        } else {
            // User is not signed in, show sign-in page after splash
            console.log('No user signed in, showing sign-in page');
            setTimeout(showSignInPage, 2000);
        }
    });

    function showErrorAndRetry(message) {
        const splashScreen = document.getElementById('splash-screen');
        if (splashScreen) {
            splashScreen.innerHTML = `
                <div style="text-align: center; color: white; padding: 20px;">
                    <div class="logo" style="font-size: 3rem; margin-bottom: 20px;">MindScribe</div>
                    <p style="margin: 20px 0; color: rgba(255,255,255,0.8); font-size: 1.2rem;">${message}</p>
                    <button onclick="window.location.reload()" style="
                        padding: 12px 24px;
                        background: white;
                        border: none;
                        border-radius: 8px;
                        color: #6a11cb;
                        cursor: pointer;
                        font-weight: bold;
                        font-size: 1rem;
                        margin: 10px;
                    ">Retry</button>
                    <button onclick="checkFirebaseConfig()" style="
                        padding: 12px 24px;
                        background: transparent;
                        border: 2px solid white;
                        border-radius: 8px;
                        color: white;
                        cursor: pointer;
                        font-weight: bold;
                        font-size: 1rem;
                        margin: 10px;
                    ">Check Configuration</button>
                </div>
            `;
        }
    }

    function checkFirebaseConfig() {
        alert('Please make sure:\n1. Firebase project exists\n2. Authentication is enabled\n3. Email/Password provider is enabled\n4. Firestore is enabled\n5. Correct project ID in configuration');
        
        // Test Firebase connection
        testFirebaseConnection();
    }

    function testFirebaseConnection() {
        console.log('=== Testing Firebase Connection ===');
        
        // Test Auth
        console.log('Testing Auth service...');
        const testEmail = 'test@test.com';
        const testPassword = 'wrongpassword';
        
        auth.signInWithEmailAndPassword(testEmail, testPassword)
            .then(() => {
                console.log('✅ Auth test: Unexpected success');
            })
            .catch(error => {
                console.log('Auth test error (expected):', error.code);
                if (error.code === 'auth/invalid-email' || error.code === 'auth/invalid-login-credentials') {
                    console.log('✅ Firebase Auth is working correctly');
                } else {
                    console.log('❌ Firebase Auth error:', error);
                }
            });
        
        // Test Firestore
        console.log('Testing Firestore service...');
        db.collection('test').doc('test').get()
            .then(() => console.log('✅ Firestore is working'))
            .catch(error => console.log('Firestore test error:', error.code));
    }

    function showSignInPage() {
        console.log('Showing sign-in page');
        if (!splashScreen || !signinPage) {
            console.error('Required elements not found');
            return;
        }
        
        splashScreen.style.opacity = '0';
        
        setTimeout(function() {
            splashScreen.style.display = 'none';
            signinPage.style.display = 'block';
            
            // Focus on email input
            const emailInput = document.getElementById('email');
            if (emailInput) emailInput.focus();
            
            console.log('Sign-in page displayed');
        }, 800);
    }

    // Switch to registration form
    if (createAccountLink) {
        createAccountLink.addEventListener('click', function(e) {
            e.preventDefault();
            showRegistrationForm();
        });
    }

    // Switch back to login form
    if (backToLoginLink) {
        backToLoginLink.addEventListener('click', function(e) {
            e.preventDefault();
            showLoginForm();
        });
    }

    // Forgot password functionality
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', function(e) {
            e.preventDefault();
            showPasswordResetForm();
        });
    }

    // Login form submission
    if (signinForm) {
        signinForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleLogin();
        });
    }

    // Registration form submission
    if (registerForm) {
        registerForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleRegistration();
        });
    }

    async function handleLogin() {
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        
        if (!emailInput || !passwordInput) {
            showMessage('Form elements not found', 'error', 'signin');
            return;
        }

        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const submitBtn = signinForm.querySelector('.btn');

        // Clear previous messages
        clearMessages('signin');

        // Validation
        if (!email || !password) {
            showMessage('Please fill in all fields', 'error', 'signin');
            return;
        }

        if (!isValidEmail(email)) {
            showMessage('Please enter a valid email address', 'error', 'signin');
            return;
        }

        // Show loading state
        setButtonLoading(submitBtn, true, 'Signing In...');

        try {
            console.log('Attempting to sign in with:', email);
            console.log('Password length:', password.length);
            
            // Firebase authentication
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            console.log('✅ User signed in successfully:', user.email);
            console.log('User UID:', user.uid);
            
            // Update last login timestamp in Firestore
            await db.collection('users').doc(user.uid).set({
                lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                lastActive: new Date().toISOString()
            }, { merge: true });
            
            showSuccessMessage('Welcome back! Redirecting to your dashboard...', signinPage);
            
            // Redirect to dashboard after delay
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 2000);
            
        } catch (error) {
            console.error('❌ Login error:', error);
            console.error('Error code:', error.code);
            console.error('Error message:', error.message);
            
            handleAuthError(error, 'signin');
            setButtonLoading(submitBtn, false, 'Sign In');
        }
    }

    async function handleRegistration() {
        const fullNameInput = document.getElementById('fullName');
        const nickNameInput = document.getElementById('nickName');
        const emailInput = document.getElementById('reg-email');
        const cityInput = document.getElementById('city');
        const passwordInput = document.getElementById('reg-password');
        const confirmInput = document.getElementById('confirm-password');

        if (!fullNameInput || !nickNameInput || !emailInput || !cityInput || !passwordInput || !confirmInput) {
            showMessage('Form elements not found', 'error', 'register');
            return;
        }

        const fullName = fullNameInput.value.trim();
        const nickName = nickNameInput.value.trim();
        const email = emailInput.value.trim();
        const city = cityInput.value.trim();
        const password = passwordInput.value;
        const confirmPassword = confirmInput.value;
        const submitBtn = registerForm.querySelector('.btn');

        // Clear previous messages
        clearMessages('register');

        // Validation
        if (!fullName || !nickName || !email || !city || !password || !confirmPassword) {
            showMessage('Please fill in all fields', 'error', 'register');
            return;
        }

        if (!isValidEmail(email)) {
            showMessage('Please enter a valid email address', 'error', 'register');
            return;
        }

        if (password.length < 6) {
            showMessage('Password must be at least 6 characters long', 'error', 'register');
            return;
        }

        if (password !== confirmPassword) {
            showMessage('Passwords do not match', 'error', 'register');
            return;
        }

        // Show loading state
        setButtonLoading(submitBtn, true, 'Creating Account...');

        try {
            console.log('Attempting to create account for:', email);
            
            // Create user with Firebase Auth
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            console.log('✅ User created successfully:', user.email);
            console.log('User UID:', user.uid);
            
            // Create user document in Firestore
            const userData = {
                uid: user.uid,
                fullName: fullName,
                nickName: nickName,
                displayName: nickName || fullName.split(' ')[0],
                email: email,
                city: city,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                lastActive: new Date().toISOString(),
                profileComplete: true,
                role: 'user',
                status: 'active',
                emailVerified: user.emailVerified,
                stats: {
                    postsCount: 0,
                    draftsCount: 0,
                    publishedCount: 0
                }
            };
            
            await db.collection('users').doc(user.uid).set(userData);
            
            console.log('✅ User document created in Firestore');
            showRegistrationSuccess();
            
        } catch (error) {
            console.error('❌ Registration error:', error);
            console.error('Error code:', error.code);
            console.error('Error message:', error.message);
            
            handleAuthError(error, 'register');
            setButtonLoading(submitBtn, false, 'Create Account');
        }
    }

    function showRegistrationSuccess() {
        const container = document.querySelector('#register-page .container');
        if (!container) return;
        
        container.innerHTML = `
            <div class="success-checkmark">
                <div style="width: 80px; height: 80px; background: #10b981; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
                    <span style="color: white; font-size: 2rem;">✓</span>
                </div>
            </div>
            <h1 style="text-align: center; color: #333; margin-bottom: 10px;">Welcome to MindScribe!</h1>
            <p class="subtitle" style="text-align: center; color: #666; margin-bottom: 30px;">Your account has been created successfully</p>
            <div style="background: #d1fae5; color: #065f46; padding: 15px; border-radius: 8px; text-align: left;">
                <strong>Account Details:</strong><br>
                • User profile created successfully<br>
                • You can now start writing<br>
                • Redirecting to dashboard...
            </div>
        `;

        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 3000);
    }

    function showPasswordResetForm() {
        const email = prompt('Please enter your email address to reset your password:');
        if (email) {
            if (isValidEmail(email)) {
                auth.sendPasswordResetEmail(email)
                    .then(() => {
                        showMessage('Password reset email sent! Check your inbox.', 'success', 'signin');
                    })
                    .catch((error) => {
                        console.error('Password reset error:', error);
                        showMessage('Error sending reset email: ' + error.message, 'error', 'signin');
                    });
            } else {
                showMessage('Please enter a valid email address', 'error', 'signin');
            }
        }
    }

    function showRegistrationForm() {
        if (signinPage && registerPage) {
            signinPage.style.display = 'none';
            registerPage.style.display = 'block';
            clearMessages('register');
            
            // Focus on first input
            const firstInput = registerPage.querySelector('input');
            if (firstInput) firstInput.focus();
        }
    }

    function showLoginForm() {
        if (registerPage && signinPage) {
            registerPage.style.display = 'none';
            signinPage.style.display = 'block';
            clearMessages('signin');
            
            // Focus on email input
            const emailInput = signinPage.querySelector('#email');
            if (emailInput) emailInput.focus();
        }
    }

    // Utility functions
    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    function setButtonLoading(button, isLoading, text) {
        if (!button) return;
        
        if (isLoading) {
            button.disabled = true;
            button.innerHTML = '<span class="btn-spinner"></span> ' + text;
        } else {
            button.disabled = false;
            button.innerHTML = text;
        }
    }

    function showMessage(message, type, formType) {
        const messagesContainer = document.getElementById(`${formType}-messages`);
        if (!messagesContainer) {
            console.error(`Messages container not found for: ${formType}`);
            // Fallback: show alert for now
            alert(`${type.toUpperCase()}: ${message}`);
            return;
        }
        
        const messageEl = document.createElement('div');
        messageEl.className = `message message-${type}`;
        messageEl.textContent = message;
        messageEl.style.cssText = `
            padding: 12px;
            margin: 10px 0;
            border-radius: 6px;
            font-weight: 500;
            animation: slideDown 0.3s ease;
        `;
        
        if (type === 'error') {
            messageEl.style.background = '#fee2e2';
            messageEl.style.color = '#991b1b';
            messageEl.style.border = '1px solid #fecaca';
        } else if (type === 'success') {
            messageEl.style.background = '#d1fae5';
            messageEl.style.color = '#065f46';
            messageEl.style.border = '1px solid #a7f3d0';
        }
        
        messagesContainer.innerHTML = '';
        messagesContainer.appendChild(messageEl);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.remove();
            }
        }, 5000);
    }

    function showSuccessMessage(message, page) {
        if (!page) return;
        
        const messageEl = document.createElement('div');
        messageEl.className = 'message message-success';
        messageEl.innerHTML = `✓ ${message}`;
        messageEl.style.cssText = `
            background: #d1fae5;
            color: #065f46;
            padding: 12px;
            margin: 10px 0;
            border-radius: 6px;
            border: 1px solid #a7f3d0;
            animation: slideDown 0.3s ease;
        `;
        
        const container = page.querySelector('.container');
        const form = page.querySelector('form');
        if (container && form) {
            container.insertBefore(messageEl, form);
        }
    }

    function clearMessages(formType) {
        const messagesContainer = document.getElementById(`${formType}-messages`);
        if (messagesContainer) {
            messagesContainer.innerHTML = '';
        }
    }

    function handleAuthError(error, formType) {
        console.error('Auth error details:', {
            code: error.code,
            message: error.message,
            formType: formType
        });
        
        let errorMessage = 'An error occurred. Please try again.';
        
        switch (error.code) {
            case 'auth/invalid-login-credentials':
            case 'auth/user-not-found':
            case 'auth/wrong-password':
                errorMessage = 'Invalid email or password. Please check your credentials.';
                break;
            case 'auth/email-already-in-use':
                errorMessage = 'This email address is already registered.';
                break;
            case 'auth/weak-password':
                errorMessage = 'Password is too weak. Please choose a stronger password (at least 6 characters).';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Please enter a valid email address.';
                break;
            case 'auth/network-request-failed':
                errorMessage = 'Network error. Please check your internet connection.';
                break;
            case 'auth/too-many-requests':
                errorMessage = 'Too many failed attempts. Please try again later.';
                break;
            case 'auth/operation-not-allowed':
                errorMessage = 'Email/password authentication is not enabled. Please contact support.';
                break;
            case 'auth/app-not-authorized':
                errorMessage = 'App not authorized. Please check Firebase configuration.';
                break;
            default:
                errorMessage = `Authentication error: ${error.message}`;
        }
        
        showMessage(errorMessage, 'error', formType);
        
        // Additional debugging info
        if (error.code === 'auth/invalid-login-credentials') {
            console.log('🔧 Debug info for invalid-login-credentials:');
            console.log('1. Check if user exists in Firebase Auth console');
            console.log('2. Check if Email/Password provider is enabled');
            console.log('3. Verify Firebase project configuration');
            console.log('4. Check if the user was created successfully');
        }
    }
});

// Add CSS for loading spinner
const style = document.createElement('style');
style.textContent = `
    .btn-spinner {
        display: inline-block;
        width: 12px;
        height: 12px;
        border: 2px solid transparent;
        border-top: 2px solid currentColor;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-right: 8px;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    @keyframes slideDown {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
    }
`;
document.head.appendChild(style);

// Test function to check Firebase configuration
function testFirebaseConfig() {
    console.log('=== Firebase Configuration Test ===');
    console.log('Firebase app name:', firebase.app().name);
    console.log('Firebase project ID:', firebase.app().options.projectId);
    console.log('Auth domain:', firebase.app().options.authDomain);
    
    // Check if auth is enabled
    firebase.auth().onAuthStateChanged((user) => {
        console.log('Auth state listener working - user:', user);
    });
}