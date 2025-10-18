const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwxoKNA1ZyN4jaRJchiZo1ctcrZQ_F4WY1CSf4MlVfrLm3Ahp71Lf3oTWj_3THceUPW/exec';

const roleDescriptions = {
    verifier: {
        title: 'Verifier',
        description: 'Review and verify submitted crop loss claims from farmers. Validate documentation and assess claim authenticity.',
        icon: '✓',
        dashboard: 'verifier.html'
    },
    field_officer: {
        title: 'Field Officer',
        description: 'Conduct on-site inspections of claimed agricultural losses. Document field conditions and verify damage extent.',
        icon: '🔍',
        dashboard: 'field_officer.html'
    },
    revenue_officer: {
        title: 'Revenue Officer',
        description: 'Process approved claims and calculate compensation amounts. Manage financial disbursements to farmers.',
        icon: '💰',
        dashboard: 'revenue_officer.html'
    },
    treasury_officer: {
        title: 'Treasury Officer',
        description: 'Oversee fund allocation and payment processing. Ensure secure transfer of compensation to beneficiaries.',
        icon: '🏦',
        dashboard: 'treasury_officer.html'
    }
};

let currentRole = 'verifier';

document.addEventListener('DOMContentLoaded', function() {
    initializeRoleSelector();
    initializeForm();
    updateRoleIndicator();
});

function initializeRoleSelector() {
    const roleButtons = document.querySelectorAll('.role-btn');
    
    roleButtons.forEach(button => {
        button.addEventListener('click', function() {
            const role = this.getAttribute('data-role');
            selectRole(role);
        });
    });
}

function selectRole(role) {
    currentRole = role;
    
    const roleButtons = document.querySelectorAll('.role-btn');
    roleButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-role') === role) {
            btn.classList.add('active');
        }
    });
    
    updateRoleDescription(role);
    updateRoleIndicator();
    updateHeaderIcon(role);
}

function updateRoleDescription(role) {
    const descriptionContainer = document.getElementById('roleDescription');
    const roleData = roleDescriptions[role];
    
    descriptionContainer.style.opacity = '0';
    descriptionContainer.style.transform = 'translateY(-10px)';
    
    setTimeout(() => {
        descriptionContainer.innerHTML = `
            <div class="description-content">
                <h3 class="description-title">${roleData.title}</h3>
                <p class="description-text">${roleData.description}</p>
            </div>
        `;
        
        descriptionContainer.style.transition = 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
        descriptionContainer.style.opacity = '1';
        descriptionContainer.style.transform = 'translateY(0)';
    }, 200);
}

function updateRoleIndicator() {
    const indicator = document.querySelector('.role-indicator');
    const activeButton = document.querySelector('.role-btn.active');
    
    if (activeButton && indicator) {
        const rect = activeButton.getBoundingClientRect();
        const containerRect = activeButton.parentElement.getBoundingClientRect();
        
        const left = rect.left - containerRect.left;
        const width = rect.width;
        
        indicator.style.width = width + 'px';
        indicator.style.left = left + 'px';
    }
}

function updateHeaderIcon(role) {
    const headerIcon = document.getElementById('roleIcon');
    const roleData = roleDescriptions[role];
    
    headerIcon.style.transform = 'scale(0.8) rotate(-10deg)';
    headerIcon.style.opacity = '0';
    
    setTimeout(() => {
        headerIcon.textContent = roleData.icon;
        headerIcon.style.transition = 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
        headerIcon.style.transform = 'scale(1) rotate(0deg)';
        headerIcon.style.opacity = '1';
    }, 200);
}

function initializeForm() {
    const form = document.getElementById('officialLoginForm');
    const loginBtn = document.getElementById('officialLoginBtn');
    
    ['officialUsername', 'officialPassword'].forEach(fieldId => {
        const input = document.getElementById(fieldId);
        if (input) {
            input.addEventListener('input', () => clearError(fieldId));
            input.addEventListener('focus', () => {
                input.parentElement.style.transform = 'scale(1.02)';
            });
            input.addEventListener('blur', () => {
                input.parentElement.style.transform = 'scale(1)';
            });
        }
    });
    
    if (form) {
        form.addEventListener('submit', handleLogin);
    }
}

async function handleLogin(e) {
    e.preventDefault();
    clearAllErrors();
    
    const username = document.getElementById('officialUsername').value.trim();
    const password = document.getElementById('officialPassword').value;
    
    let hasError = false;
    
    if (!username || username.length < 3) {
        showError('officialUsername', 'Please enter a valid username or employee ID');
        hasError = true;
    }
    
    if (!password || password.length < 6) {
        showError('officialPassword', 'Password must be at least 6 characters');
        hasError = true;
    }
    
    if (hasError) {
        return;
    }
    
    const loginBtn = document.getElementById('officialLoginBtn');
    loginBtn.disabled = true;
    loginBtn.classList.add('loading');
    
    try {
        const result = await verifyOfficialLogin(username, password, currentRole);
        
        if (result.success) {
            const officialData = {
                username: username,
                role: currentRole,
                roleTitle: roleDescriptions[currentRole].title,
                loginTime: new Date().toISOString()
            };
            
            localStorage.setItem('officialData', JSON.stringify(officialData));
            
            showSuccessAnimation();
            
            setTimeout(() => {
                window.location.href = roleDescriptions[currentRole].dashboard;
            }, 1500);
        } else {
            showError('officialPassword', result.message || 'Invalid credentials. Please try again.');
            loginBtn.disabled = false;
            loginBtn.classList.remove('loading');
        }
    } catch (error) {
        console.error('Login error:', error);
        showError('officialPassword', 'An error occurred. Please try again.');
        loginBtn.disabled = false;
        loginBtn.classList.remove('loading');
    }
}

async function verifyOfficialLogin(username, password, role) {
    try {
        const response = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?action=officialLogin&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&role=${role}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (!response.ok) {
            throw new Error('Login request failed');
        }
        
        const result = await response.json();
        
        if (result.success) {
            return { success: true, official: result.official };
        } else {
            return { success: false, message: result.message };
        }
    } catch (error) {
        console.error('Error verifying login with Google Sheets:', error);
        return useLocalStorageOfficialLogin(username, password, role);
    }
}

function useLocalStorageOfficialLogin(username, password, role) {
    const mockOfficials = [
        { username: 'verifier1', password: 'verify123', role: 'verifier' },
        { username: 'field1', password: 'field123', role: 'field_officer' },
        { username: 'revenue1', password: 'revenue123', role: 'revenue_officer' },
        { username: 'treasury1', password: 'treasury123', role: 'treasury_officer' },
        { username: 'admin', password: 'admin123', role: 'all' }
    ];
    
    const official = mockOfficials.find(o => 
        o.username === username && 
        o.password === password && 
        (o.role === role || o.role === 'all')
    );
    
    if (official) {
        console.log('Login verified using fallback credentials');
        return { success: true, official: official, fallback: true };
    }
    
    return { success: false, message: 'Invalid credentials or incorrect role' };
}

function showError(fieldId, message) {
    const input = document.getElementById(fieldId);
    const errorElement = document.getElementById(`${fieldId}Error`);
    
    if (input && errorElement) {
        input.classList.add('error');
        errorElement.textContent = message;
        errorElement.classList.add('show');
        
        input.parentElement.style.animation = 'none';
        setTimeout(() => {
            input.parentElement.style.animation = 'inputShake 0.4s ease';
        }, 10);
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

function showSuccessAnimation() {
    const card = document.querySelector('.official-login-card');
    card.style.transform = 'scale(0.98)';
    card.style.opacity = '0.8';
    
    setTimeout(() => {
        card.style.transition = 'all 0.5s ease';
        card.style.transform = 'scale(1)';
        card.style.opacity = '1';
    }, 200);
}

window.addEventListener('resize', updateRoleIndicator);
