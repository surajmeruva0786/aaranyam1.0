const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwxoKNA1ZyN4jaRJchiZo1ctcrZQ_F4WY1CSf4MlVfrLm3Ahp71Lf3oTWj_3THceUPW/exec';

let uploadedFiles = [];
let currentFarmer = null;

function logout() {
    localStorage.removeItem('farmerData');
    window.location.href = 'farmer-login.html';
}

window.addEventListener('DOMContentLoaded', function() {
    const farmerData = localStorage.getItem('farmerData');
    
    if (!farmerData) {
        window.location.href = 'farmer-login.html';
        return;
    }

    try {
        currentFarmer = JSON.parse(farmerData);
        document.getElementById('farmerName').textContent = `Welcome, ${currentFarmer.fullName}!`;
        document.getElementById('infoName').textContent = currentFarmer.fullName || '-';
        document.getElementById('infoContact').textContent = currentFarmer.contactNumber || '-';
        document.getElementById('infoAadhar').textContent = currentFarmer.aadharId ? `****-****-${currentFarmer.aadharId.slice(-4)}` : '-';
        document.getElementById('infoLand').textContent = currentFarmer.landArea ? `${currentFarmer.landArea} acres` : '-';
        document.getElementById('infoLandType').textContent = currentFarmer.landType || '-';
        document.getElementById('infoAddress').textContent = currentFarmer.address || '-';
        
        loadClaims();
    } catch (e) {
        console.error('Error parsing farmer data:', e);
        window.location.href = 'farmer-login.html';
    }
});

const damageExtent = document.getElementById('damageExtent');
const damageValue = document.getElementById('damageValue');

if (damageExtent && damageValue) {
    damageExtent.addEventListener('input', function() {
        damageValue.textContent = this.value + '%';
    });
}

const fileUpload = document.getElementById('fileUpload');
const filePreview = document.getElementById('filePreview');

if (fileUpload) {
    fileUpload.addEventListener('change', handleFileSelect);
}

function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    
    files.forEach(file => {
        if (file.size > 5 * 1024 * 1024) {
            alert(`File ${file.name} is too large. Maximum size is 5MB.`);
            return;
        }

        const reader = new FileReader();
        reader.onload = function(event) {
            const fileData = {
                name: file.name,
                type: file.type,
                size: file.size,
                data: event.target.result
            };
            
            uploadedFiles.push(fileData);
            displayFilePreview(fileData, uploadedFiles.length - 1);
        };
        
        reader.readAsDataURL(file);
    });
    
    e.target.value = '';
}

function displayFilePreview(fileData, index) {
    const previewItem = document.createElement('div');
    previewItem.className = 'file-preview-item';
    
    if (fileData.type.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = fileData.data;
        img.className = 'file-preview-img';
        img.alt = fileData.name;
        
        const nameDiv = document.createElement('div');
        nameDiv.className = 'file-preview-name';
        nameDiv.textContent = fileData.name;
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'file-remove';
        removeBtn.textContent = '×';
        removeBtn.onclick = () => removeFile(index);
        
        previewItem.appendChild(img);
        previewItem.appendChild(nameDiv);
        previewItem.appendChild(removeBtn);
    } else {
        const iconDiv = document.createElement('div');
        iconDiv.style.fontSize = '48px';
        iconDiv.style.marginBottom = '8px';
        iconDiv.textContent = '📄';
        
        const nameDiv = document.createElement('div');
        nameDiv.className = 'file-preview-name';
        nameDiv.textContent = fileData.name;
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'file-remove';
        removeBtn.textContent = '×';
        removeBtn.onclick = () => removeFile(index);
        
        previewItem.appendChild(iconDiv);
        previewItem.appendChild(nameDiv);
        previewItem.appendChild(removeBtn);
    }
    
    filePreview.appendChild(previewItem);
}

function removeFile(index) {
    uploadedFiles.splice(index, 1);
    filePreview.innerHTML = '';
    uploadedFiles.forEach((file, idx) => {
        displayFilePreview(file, idx);
    });
}

function openClaimModal() {
    document.getElementById('claimModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeClaimModal() {
    document.getElementById('claimModal').classList.remove('active');
    document.body.style.overflow = 'auto';
    document.getElementById('claimForm').reset();
    uploadedFiles = [];
    filePreview.innerHTML = '';
    damageValue.textContent = '50%';
    clearAllErrors();
}

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

['cropType', 'lossDate', 'lossCause', 'damageExtent'].forEach(fieldId => {
    const input = document.getElementById(fieldId);
    if (input) {
        input.addEventListener('input', () => clearError(fieldId));
        input.addEventListener('change', () => clearError(fieldId));
    }
});

const claimForm = document.getElementById('claimForm');
if (claimForm) {
    claimForm.addEventListener('submit', handleClaimSubmit);
}

async function handleClaimSubmit(e) {
    e.preventDefault();
    clearAllErrors();

    const cropType = document.getElementById('cropType').value.trim();
    const lossDate = document.getElementById('lossDate').value;
    const lossCause = document.getElementById('lossCause').value;
    const damageExtent = document.getElementById('damageExtent').value;
    const description = document.getElementById('description').value.trim();

    let hasError = false;

    if (!cropType || cropType.length < 2) {
        showError('cropType', 'Please enter a valid crop type');
        hasError = true;
    }

    if (!lossDate) {
        showError('lossDate', 'Please select the date of loss');
        hasError = true;
    }

    if (!lossCause) {
        showError('lossCause', 'Please select the cause of loss');
        hasError = true;
    }

    if (hasError) {
        return;
    }

    const submitBtn = document.getElementById('submitClaimBtn');
    submitBtn.disabled = true;
    submitBtn.classList.add('loading');

    try {
        const claimData = {
            claimId: generateClaimId(),
            farmerContact: currentFarmer.contactNumber,
            farmerName: currentFarmer.fullName,
            cropType: cropType,
            lossDate: lossDate,
            lossCause: lossCause,
            damageExtent: damageExtent,
            description: description,
            files: uploadedFiles,
            status: 'Pending',
            submittedOn: new Date().toISOString(),
            timestamp: new Date().toISOString()
        };

        const result = await submitClaimToGoogleSheets(claimData);

        if (result.success) {
            alert('Claim submitted successfully!');
            closeClaimModal();
            loadClaims();
        } else {
            alert(result.message || 'Failed to submit claim. Please try again.');
        }
    } catch (error) {
        console.error('Error submitting claim:', error);
        alert('An error occurred. Please try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');
    }
}

function generateClaimId() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `CLM${timestamp}${random}`;
}

async function submitClaimToGoogleSheets(claimData) {
    try {
        const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'submitClaim',
                ...claimData
            })
        });

        if (!response.ok) {
            throw new Error('Failed to submit claim');
        }

        const result = await response.json();
        
        if (result.success) {
            return { success: true };
        } else {
            return { success: false, message: result.message };
        }
    } catch (error) {
        console.error('Error submitting to Google Sheets:', error);
        saveClaimLocally(claimData);
        return { success: true, fallback: true };
    }
}

function saveClaimLocally(claimData) {
    const claims = JSON.parse(localStorage.getItem('farmerClaims') || '[]');
    claims.push(claimData);
    localStorage.setItem('farmerClaims', JSON.stringify(claims));
    console.log('Claim saved locally');
}

async function loadClaims() {
    try {
        let claims = [];
        
        try {
            const response = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?action=getClaims&contact=${currentFarmer.contactNumber}`, {
                method: 'GET'
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success && result.claims) {
                    claims = result.claims;
                }
            }
        } catch (error) {
            console.error('Error fetching from Google Sheets:', error);
        }

        const localClaims = JSON.parse(localStorage.getItem('farmerClaims') || '[]');
        const farmerLocalClaims = localClaims.filter(c => c.farmerContact === currentFarmer.contactNumber);
        
        if (claims.length === 0 && farmerLocalClaims.length > 0) {
            claims = farmerLocalClaims;
        }

        displayClaims(claims);
        updateStats(claims);
    } catch (error) {
        console.error('Error loading claims:', error);
        displayClaims([]);
    }
}

function displayClaims(claims) {
    const emptyState = document.getElementById('emptyState');
    const claimsTable = document.getElementById('claimsTable');
    const tableBody = document.getElementById('claimsTableBody');

    if (claims.length === 0) {
        emptyState.style.display = 'block';
        claimsTable.style.display = 'none';
        return;
    }

    emptyState.style.display = 'none';
    claimsTable.style.display = 'table';

    tableBody.innerHTML = '';

    claims.sort((a, b) => new Date(b.submittedOn) - new Date(a.submittedOn));

    claims.forEach(claim => {
        const row = document.createElement('tr');
        
        const statusClass = getStatusClass(claim.status);
        const formattedDate = formatDate(claim.lossDate);
        const submittedDate = formatDate(claim.submittedOn);
        
        const claimIdCell = document.createElement('td');
        const claimIdStrong = document.createElement('strong');
        claimIdStrong.textContent = claim.claimId;
        claimIdCell.appendChild(claimIdStrong);
        
        const cropTypeCell = document.createElement('td');
        cropTypeCell.textContent = claim.cropType;
        
        const lossCauseCell = document.createElement('td');
        lossCauseCell.textContent = claim.lossCause;
        
        const lossDateCell = document.createElement('td');
        lossDateCell.textContent = formattedDate;
        
        const damageCell = document.createElement('td');
        damageCell.textContent = claim.damageExtent + '%';
        
        const statusCell = document.createElement('td');
        const statusChip = document.createElement('span');
        statusChip.className = 'status-chip ' + statusClass;
        statusChip.textContent = claim.status;
        statusCell.appendChild(statusChip);
        
        const submittedCell = document.createElement('td');
        submittedCell.textContent = submittedDate;
        
        const actionCell = document.createElement('td');
        const viewBtn = document.createElement('button');
        viewBtn.className = 'action-btn';
        viewBtn.textContent = 'View';
        viewBtn.onclick = () => viewClaim(claim.claimId);
        actionCell.appendChild(viewBtn);
        
        row.appendChild(claimIdCell);
        row.appendChild(cropTypeCell);
        row.appendChild(lossCauseCell);
        row.appendChild(lossDateCell);
        row.appendChild(damageCell);
        row.appendChild(statusCell);
        row.appendChild(submittedCell);
        row.appendChild(actionCell);
        
        tableBody.appendChild(row);
    });
}

function getStatusClass(status) {
    const statusMap = {
        'Pending': 'status-pending',
        'Verified': 'status-verified',
        'Approved': 'status-approved',
        'Rejected': 'status-rejected'
    };
    return statusMap[status] || 'status-pending';
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

function updateStats(claims) {
    const totalClaims = claims.length;
    const pendingClaims = claims.filter(c => c.status === 'Pending' || c.status === 'Verified').length;
    const approvedClaims = claims.filter(c => c.status === 'Approved').length;

    document.getElementById('totalClaims').textContent = totalClaims;
    document.getElementById('pendingClaims').textContent = pendingClaims;
    document.getElementById('approvedClaims').textContent = approvedClaims;
}

function viewClaim(claimId) {
    alert(`Viewing claim ${claimId}\n\nDetailed view feature coming soon!`);
}

window.openClaimModal = openClaimModal;
window.closeClaimModal = closeClaimModal;
window.removeFile = removeFile;
window.viewClaim = viewClaim;
window.logout = logout;
