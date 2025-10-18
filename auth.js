const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwxoKNA1ZyN4jaRJchiZo1ctcrZQ_F4WY1CSf4MlVfrLm3Ahp71Lf3oTWj_3THceUPW/exec';

const USE_GOOGLE_SHEETS = true;

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

    const inputs = ['fullName', 'contactNumber', 'aadharId', 'address', 'landArea', 'landType', 'password', 'confirmPassword'];
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
            const registrationData = {
                fullName: formData.fullName,
                contactNumber: formData.contactNumber,
                aadharId: formData.aadharId,
                address: formData.address,
                landArea: formData.landArea,
                landType: formData.landType,
                password: formData.password,
                timestamp: new Date().toISOString()
            };

            const result = await sendToGoogleSheets('register', registrationData);

            if (result.success) {
                const successMsg = document.getElementById('successMessage');
                if (result.fallback) {
                    successMsg.textContent = 'Registration successful (using local storage)! Redirecting to login...';
                } else {
                    successMsg.textContent = 'Registration successful! Redirecting to login...';
                }
                successMsg.classList.add('show');
                registerForm.reset();

                setTimeout(() => {
                    window.location.href = 'farmer-login.html';
                }, 2000);
            } else {
                const errorMsg = result.message || 'Registration failed. Please try again.';
                if (errorMsg.toLowerCase().includes('contact')) {
                    showError('contactNumber', errorMsg);
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

    ['loginContact', 'loginPassword'].forEach(fieldId => {
        const input = document.getElementById(fieldId);
        if (input) {
            input.addEventListener('input', () => clearError(fieldId));
        }
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearAllErrors();

        const contactNumber = document.getElementById('loginContact').value.trim();
        const password = document.getElementById('loginPassword').value;

        let hasError = false;

        const contactError = validators.contactNumber(contactNumber);
        if (contactError) {
            showError('loginContact', contactError);
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
            const result = await verifyLogin(contactNumber, password);

            if (result.success && result.farmer) {
                const farmerDataForStorage = {
                    fullName: result.farmer.fullName,
                    contactNumber: result.farmer.contactNumber,
                    aadharId: result.farmer.aadharId,
                    address: result.farmer.address,
                    landArea: result.farmer.landArea,
                    landType: result.farmer.landType,
                    usingLocalStorage: result.fallback || false
                };
                
                localStorage.setItem('farmerData', JSON.stringify(farmerDataForStorage));
                
                if (USE_GOOGLE_SHEETS && !result.fallback) {
                    window.location.href = 'dashboard.html';
                } else {
                    window.location.href = 'dashboard.html';
                }
            } else {
                const errorMsg = result.message || 'Invalid contact number or password';
                showError('loginPassword', errorMsg);
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
