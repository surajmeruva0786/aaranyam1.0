const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwxoKNA1ZyN4jaRJchiZo1ctcrZQ_F4WY1CSf4MlVfrLm3Ahp71Lf3oTWj_3THceUPW/exec';

const USE_GOOGLE_SHEETS = true;

// Firebase Authentication Functions
async function registerWithFirebase(formData) {
    try {
        // Wait for Firebase to be ready
        await new Promise((resolve) => {
            if (window.firebaseServices && window.firebaseServices.isInitialized()) {
                resolve();
            } else {
                window.addEventListener('firebaseReady', resolve);
            }
        });

        const { auth, db } = window.firebaseServices;
        
        // Create user with email and password
        const userCredential = await auth.createUserWithEmailAndPassword(formData.email, formData.password);
        const user = userCredential.user;
        
        // Save profile to Firestore
        const userProfile = {
            name: formData.fullName,
            email: formData.email,
            contactNumber: formData.contactNumber,
            aadharId: formData.aadharId,
            address: formData.address,
            landArea: formData.landArea,
            landType: formData.landType,
            role: "Farmer",
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        console.log('Saving user profile to Firestore:', userProfile);
        await db.collection("users").doc(user.uid).set(userProfile);
        console.log('User profile saved successfully');
        
        return { success: true, user: user };
    } catch (error) {
        console.error('Firebase registration error:', error);
        return { success: false, message: getFirebaseErrorMessage(error) };
    }
}

async function loginWithFirebase(email, password) {
    try {
        console.log('Waiting for Firebase to be ready...');
        // Wait for Firebase to be ready
        await new Promise((resolve) => {
            if (window.firebaseServices && window.firebaseServices.isInitialized()) {
                console.log('Firebase is ready');
                resolve();
            } else {
                console.log('Waiting for firebaseReady event...');
                window.addEventListener('firebaseReady', resolve);
            }
        });

        const { auth } = window.firebaseServices;
        console.log('Firebase auth service:', auth);
        
        // Sign in with email and password
        console.log('Attempting Firebase sign in...');
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        console.log('Firebase sign in successful:', userCredential.user);
        return { success: true, user: userCredential.user };
    } catch (error) {
        console.error('Firebase login error:', error);
        return { success: false, message: getFirebaseErrorMessage(error) };
    }
}

function getFirebaseErrorMessage(error) {
    switch (error.code) {
        case 'auth/email-already-in-use':
            return 'This email is already registered. Please use a different email.';
        case 'auth/invalid-email':
            return 'Please enter a valid email address.';
        case 'auth/weak-password':
            return 'Password should be at least 6 characters long.';
        case 'auth/user-not-found':
            return 'No account found with this email. Please register first.';
        case 'auth/wrong-password':
            return 'Incorrect password. Please try again.';
        case 'auth/too-many-requests':
            return 'Too many failed attempts. Please try again later.';
        default:
            return 'Authentication failed. Please try again.';
    }
}

// Auth state persistence
function setupAuthStateListener() {
    if (window.firebaseServices && window.firebaseServices.auth) {
        window.firebaseServices.auth.onAuthStateChanged((user) => {
            if (user) {
                console.log('User is signed in:', user.email);
                // User is signed in, you can redirect to dashboard or update UI
            } else {
                console.log('User is signed out');
                // User is signed out, redirect to login or update UI
            }
        });
    }
}

const validators = {
    fullName: (value) => {
        if (!value || value.trim().length < 3) {
            return 'Full name must be at least 3 characters';
        }
        if (!/^[a-zA-Z\s]+$/.test(value)) {
            return 'Full name should only contain letters and spaces';
        }
        return '';
    },

    email: (value) => {
        if (!value || value.trim().length === 0) {
            return 'Email address is required';
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
            return 'Please enter a valid email address';
        }
        return '';
    },

    contactNumber: (value) => {
        if (!value || !/^\d{10}$/.test(value.replace(/\s/g, ''))) {
            return 'Please enter a valid 10-digit mobile number';
        }
        return '';
    },

    aadharId: (value) => {
        const cleaned = value.replace(/\s/g, '');
        if (!cleaned || !/^\d{12}$/.test(cleaned)) {
            return 'Please enter a valid 12-digit Aadhar number';
        }
        return '';
    },

    address: (value) => {
        if (!value || value.trim().length < 10) {
            return 'Please enter a complete address (minimum 10 characters)';
        }
        return '';
    },

    landArea: (value) => {
        if (!value || parseFloat(value) <= 0) {
            return 'Please enter a valid land area greater than 0';
        }
        return '';
    },

    landType: (value) => {
        if (!value || value.trim().length < 2) {
            return 'Please enter a valid land type';
        }
        return '';
    },

    password: (value) => {
        if (!value || value.length < 6) {
            return 'Password must be at least 6 characters';
        }
        return '';
    },

    confirmPassword: (value, password) => {
        if (!value) {
            return 'Please confirm your password';
        }
        if (value !== password) {
            return 'Passwords do not match';
        }
        return '';
    }
};

function showError(fieldId, message) {
    const input = document.getElementById(fieldId);
    const errorElement = document.getElementById(`${fieldId}Error`);
    
    if (input && errorElement) {
        input.classList.add('error');
        errorElement.textContent = message;
        errorElement.classList.add('show');
    }
}

function clearError(fieldId) {
    const input = document.getElementById(fieldId);
    const errorElement = document.getElementById(`${fieldId}Error`);
    
    if (input && errorElement) {
        input.classList.remove('error');
        errorElement.classList.remove('show');
    }
}

function clearAllErrors() {
    const allInputs = document.querySelectorAll('.form-input');
    allInputs.forEach(input => {
        input.classList.remove('error');
    });
    
    const allErrors = document.querySelectorAll('.error-message');
    allErrors.forEach(error => {
        error.classList.remove('show');
    });
}

async function sendToGoogleSheets(action, data) {
    if (!USE_GOOGLE_SHEETS || GOOGLE_APPS_SCRIPT_URL === 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE') {
        console.log('Google Sheets not configured - using localStorage');
        return useLocalStorageFallback(action, data);
    }

    try {
        const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: action,
                ...data
            })
        });

        if (!response.ok) {
            throw new Error('Google Sheets request failed');
        }

        const result = await response.json();
        
        if (result.success) {
            return { success: true, data: result };
        } else {
            return { success: false, message: result.message || 'Registration failed' };
        }
    } catch (error) {
        console.error('Error sending data to Google Sheets:', error);
        console.log('Falling back to localStorage due to error');
        return useLocalStorageFallback(action, data);
    }
}

function useLocalStorageFallback(action, data) {
    if (action === 'register') {
        const mockStoredData = JSON.parse(localStorage.getItem('mockFarmers') || '[]');
        
        const exists = mockStoredData.find(f => f.contactNumber === data.contactNumber);
        if (exists) {
            return { success: false, message: 'Contact number already registered' };
        }
        
        mockStoredData.push(data);
        localStorage.setItem('mockFarmers', JSON.stringify(mockStoredData));
        console.log('Registration saved to localStorage');
        return { success: true, fallback: true };
    }
    
    return { success: false, message: 'Invalid action' };
}

async function verifyLogin(contactNumber, password) {
    if (!USE_GOOGLE_SHEETS || GOOGLE_APPS_SCRIPT_URL === 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE') {
        console.log('Google Sheets not configured - using localStorage');
        return useLocalStorageLogin(contactNumber, password);
    }

    try {
        const response = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?action=login&contact=${contactNumber}&password=${password}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error('Login request failed');
        }

        const result = await response.json();
        
        if (result.success && result.farmer) {
            return { success: true, farmer: result.farmer };
        } else {
            return { success: false, message: result.message || 'Invalid credentials' };
        }
    } catch (error) {
        console.error('Error verifying login with Google Sheets:', error);
        console.log('Falling back to localStorage');
        return useLocalStorageLogin(contactNumber, password);
    }
}

function useLocalStorageLogin(contactNumber, password) {
    const mockStoredData = JSON.parse(localStorage.getItem('mockFarmers') || '[]');
    const farmer = mockStoredData.find(f => 
        f.contactNumber === contactNumber && f.password === password
    );
    
    if (farmer) {
        console.log('Login verified using localStorage');
        return { success: true, farmer: farmer, fallback: true };
    }
    
    return { success: false, message: 'Invalid credentials' };
}

if (document.getElementById('registerForm')) {
    const registerForm = document.getElementById('registerForm');
    const submitBtn = document.getElementById('submitBtn');

    const inputs = ['fullName', 'email', 'contactNumber', 'aadharId', 'address', 'landArea', 'landType', 'password', 'confirmPassword'];
    inputs.forEach(fieldId => {
        const input = document.getElementById(fieldId);
        if (input) {
            input.addEventListener('input', () => clearError(fieldId));
        }
    });

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearAllErrors();

        const formData = {
            fullName: document.getElementById('fullName').value.trim(),
            email: document.getElementById('email').value.trim(),
            contactNumber: document.getElementById('contactNumber').value.trim(),
            aadharId: document.getElementById('aadharId').value.trim(),
            address: document.getElementById('address').value.trim(),
            landArea: document.getElementById('landArea').value.trim(),
            landType: document.getElementById('landType').value.trim(),
            password: document.getElementById('password').value,
            confirmPassword: document.getElementById('confirmPassword').value
        };

        let hasError = false;

        const validationChecks = [
            { field: 'fullName', validator: validators.fullName },
            { field: 'email', validator: validators.email },
            { field: 'contactNumber', validator: validators.contactNumber },
            { field: 'aadharId', validator: validators.aadharId },
            { field: 'address', validator: validators.address },
            { field: 'landArea', validator: validators.landArea },
            { field: 'landType', validator: validators.landType },
            { field: 'password', validator: validators.password },
            { field: 'confirmPassword', validator: (value) => validators.confirmPassword(value, formData.password) }
        ];

        validationChecks.forEach(({ field, validator }) => {
            const error = validator(formData[field]);
            if (error) {
                showError(field, error);
                hasError = true;
            }
        });

        if (hasError) {
            return;
        }

        submitBtn.disabled = true;
        submitBtn.classList.add('loading');

        try {
            // Use Firebase Authentication
            const result = await registerWithFirebase(formData);

            if (result.success) {
                const successMsg = document.getElementById('successMessage');
                successMsg.textContent = 'Registration successful! Redirecting to dashboard...';
                successMsg.classList.add('show');
                registerForm.reset();

                // Add success animation
                submitBtn.classList.add('success');
                
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 2000);
            } else {
                const errorMsg = result.message || 'Registration failed. Please try again.';
                if (errorMsg.toLowerCase().includes('email')) {
                    showError('email', errorMsg);
                } else if (errorMsg.toLowerCase().includes('password')) {
                    showError('password', errorMsg);
                } else {
                    showError('fullName', errorMsg);
                }
            }
        } catch (error) {
            console.error('Registration error:', error);
            showError('fullName', 'An error occurred. Please try again.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.classList.remove('loading');
        }
    });
}

if (document.getElementById('loginForm')) {
    const loginForm = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');

    ['loginEmail', 'loginPassword'].forEach(fieldId => {
        const input = document.getElementById(fieldId);
        if (input) {
            input.addEventListener('input', () => clearError(fieldId));
        }
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearAllErrors();

        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;

        let hasError = false;

        const emailError = validators.email(email);
        if (emailError) {
            showError('loginEmail', emailError);
            hasError = true;
        }

        if (!password) {
            showError('loginPassword', 'Please enter your password');
            hasError = true;
        }

        if (hasError) {
            return;
        }

        loginBtn.disabled = true;
        loginBtn.classList.add('loading');

        try {
            console.log('Attempting login with:', email);
            // Use Firebase Authentication
            const result = await loginWithFirebase(email, password);
            console.log('Login result:', result);

            if (result.success) {
                console.log('Login successful, redirecting to dashboard');
                // Add success animation
                loginBtn.classList.add('success');
                
                // Redirect to dashboard
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1000);
            } else {
                console.log('Login failed:', result.message);
                const errorMsg = result.message || 'Invalid email or password';
                if (errorMsg.toLowerCase().includes('email')) {
                    showError('loginEmail', errorMsg);
                } else {
                    showError('loginPassword', errorMsg);
                }
            }
        } catch (error) {
            console.error('Login error:', error);
            showError('loginPassword', 'An error occurred. Please try again.');
        } finally {
            loginBtn.disabled = false;
            loginBtn.classList.remove('loading');
        }
    });
}

// Initialize auth state listener when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    setupAuthStateListener();
});

// Logout function
function logoutUser() {
    if (window.firebaseServices && window.firebaseServices.auth) {
        window.firebaseServices.auth.signOut().then(() => {
            console.log('User signed out successfully');
            // Clear any local storage
            localStorage.removeItem('farmerData');
            // Redirect to login page
            window.location.href = 'farmer-login.html';
        }).catch((error) => {
            console.error('Logout error:', error);
        });
    }
}

// Make logout function globally available
window.logoutUser = logoutUser;
