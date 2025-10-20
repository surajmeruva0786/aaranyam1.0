const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwxoKNA1ZyN4jaRJchiZo1ctcrZQ_F4WY1CSf4MlVfrLm3Ahp71Lf3oTWj_3THceUPW/exec';

let allClaims = [];
let filteredClaims = [];
let currentClaim = null;

function logout() {
    localStorage.removeItem('officialData');
    window.location.href = 'official_login.html';
}

window.addEventListener('DOMContentLoaded', function() {
    const officialData = localStorage.getItem('officialData');
    
    if (!officialData) {
        window.location.href = 'official_login.html';
        return;
    }

    try {
        const data = JSON.parse(officialData);
        if (data.role !== 'treasury_officer') {
            alert('Access Denied: This dashboard is only for treasury officers.');
            window.location.href = 'official_login.html';
            return;
        }
        
        document.getElementById('officialName').textContent = `Welcome back, ${data.username}!`;
        
        const loginTime = new Date(data.loginTime);
        document.getElementById('loginTime').textContent = loginTime.toLocaleTimeString();
        
        initializeFilters();
        loadClaims();
    } catch (e) {
        console.error('Error parsing official data:', e);
        window.location.href = 'official_login.html';
    }
});

function initializeFilters() {
    const filters = ['filterStatus', 'filterSearch'];
    filters.forEach(filterId => {
        const element = document.getElementById(filterId);
        if (element) {
            if (filterId === 'filterSearch') {
                element.addEventListener('input', applyFilters);
            } else {
                element.addEventListener('change', applyFilters);
            }
        }
    });
}

async function loadClaims() {
    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');
    const claimsGrid = document.getElementById('claimsGrid');
    
    loadingState.style.display = 'block';
    emptyState.style.display = 'none';
    claimsGrid.innerHTML = '';
    
    try {
        const response = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?action=getAllClaims`, {
            method: 'GET'
        });

        if (response.ok) {
            const result = await response.json();
            if (result.success && result.claims) {
                allClaims = result.claims.filter(c => 
                    c.status === 'Forwarded to Treasury' || 
                    c.status === 'Payment Approved' ||
                    c.status === 'Rejected by Treasury'
                );
            } else {
                allClaims = [];
            }
        } else {
            allClaims = [];
        }
    } catch (error) {
        console.error('Error fetching from Google Sheets:', error);
        allClaims = loadLocalClaims();
    }
    
    loadingState.style.display = 'none';
    applyFilters();
}

function loadLocalClaims() {
    const localClaims = JSON.parse(localStorage.getItem('farmerClaims') || '[]');
    return localClaims.filter(c => 
        c.status === 'Forwarded to Treasury' || 
        c.status === 'Payment Approved' ||
        c.status === 'Rejected by Treasury'
    );
}

function applyFilters() {
    const statusFilter = document.getElementById('filterStatus').value;
    const searchFilter = document.getElementById('filterSearch').value.toLowerCase();
    
    filteredClaims = allClaims.filter(claim => {
        const matchesStatus = !statusFilter || claim.status === statusFilter;
        const matchesSearch = !searchFilter || 
            claim.farmerName.toLowerCase().includes(searchFilter) ||
            claim.claimId.toLowerCase().includes(searchFilter) ||
            (claim.farmerContact && claim.farmerContact.includes(searchFilter));
        
        return matchesStatus && matchesSearch;
    });
    
    displayClaims();
    updateStats();
}

function resetFilters() {
    document.getElementById('filterStatus').value = 'Forwarded to Treasury';
    document.getElementById('filterSearch').value = '';
    applyFilters();
}

function displayClaims() {
    const claimsGrid = document.getElementById('claimsGrid');
    const emptyState = document.getElementById('emptyState');
    
    claimsGrid.innerHTML = '';
    
    if (filteredClaims.length === 0) {
        emptyState.style.display = 'flex';
        claimsGrid.style.display = 'none';
        return;
    }
    
    emptyState.style.display = 'none';
    claimsGrid.style.display = 'grid';
    
    filteredClaims.forEach((claim, index) => {
        const card = createClaimCard(claim, index);
        claimsGrid.appendChild(card);
    });
}

function createClaimCard(claim, index) {
    const card = document.createElement('div');
    card.className = 'claim-card';
    card.style.animationDelay = `${index * 0.05}s`;
    
    const statusClass = getStatusClass(claim.status);
    const formattedDate = formatDate(claim.lossDate);
    const submittedDate = formatDate(claim.submittedOn);
    
    const isPending = claim.status === 'Forwarded to Treasury';
    
    const historyTimeline = createHistoryTimeline(claim);
    
    card.innerHTML = `
        <div class="claim-header">
            <div class="claim-id">
                <span class="claim-id-icon">📋</span>
                <span>${claim.claimId}</span>
            </div>
            <div class="claim-status ${statusClass}">${claim.status}</div>
        </div>
        
        <div class="compensation-highlight">
            <div class="compensation-label">Approved Compensation</div>
            <div class="compensation-amount">₹${formatCurrency(claim.estimatedCompensation || 0)}</div>
        </div>
        
        <div class="farmer-info">
            <div class="farmer-avatar">👨‍🌾</div>
            <div class="farmer-details">
                <div class="farmer-name">${claim.farmerName}</div>
                <div class="farmer-meta">
                    <span class="meta-item">📞 ${claim.farmerContact || 'N/A'}</span>
                </div>
            </div>
        </div>
        
        <div class="crop-summary">
            <div class="summary-item">
                <div class="summary-label">Crop Type</div>
                <div class="summary-value">${claim.cropType}</div>
            </div>
            <div class="summary-item">
                <div class="summary-label">Verified Loss</div>
                <div class="summary-value">${claim.verifiedDamage || claim.damageExtent}%</div>
            </div>
            <div class="summary-item">
                <div class="summary-label">Loss Cause</div>
                <div class="summary-value">${claim.lossCause}</div>
            </div>
            <div class="summary-item">
                <div class="summary-label">Submitted</div>
                <div class="summary-value">${submittedDate}</div>
            </div>
        </div>
        
        ${historyTimeline}
        
        <div class="action-buttons">
            ${isPending ? `
                <button class="action-btn btn-approve" onclick="openApprovalModal('${claim.claimId}')">
                    <span class="btn-icon">✓</span>
                    <span class="btn-text">Approve Payment</span>
                </button>
                <button class="action-btn btn-reject" onclick="openRejectModal('${claim.claimId}')">
                    <span class="btn-icon">✗</span>
                    <span class="btn-text">Reject</span>
                </button>
            ` : `
                <button class="action-btn btn-details" onclick="viewClaimHistory('${claim.claimId}')">
                    <span class="btn-icon">👁</span>
                    <span class="btn-text">View Full History</span>
                </button>
            `}
        </div>
    `;
    
    return card;
}

function createHistoryTimeline(claim) {
    const history = [];
    
    if (claim.submittedOn) {
        history.push({
            step: 'Claim Submitted',
            date: claim.submittedOn,
            icon: '📝',
            status: 'completed'
        });
    }
    
    if (claim.fieldInspectionReport) {
        history.push({
            step: 'Field Inspection',
            date: claim.fieldInspectionDate || claim.submittedOn,
            icon: '🔍',
            status: 'completed'
        });
    }
    
    if (claim.revenueOfficer) {
        history.push({
            step: 'Revenue Approval',
            date: claim.processedOn,
            officer: claim.revenueOfficer,
            icon: '💰',
            status: 'completed'
        });
    }
    
    if (claim.status === 'Forwarded to Treasury') {
        history.push({
            step: 'Treasury Processing',
            icon: '🏦',
            status: 'current'
        });
    } else if (claim.status === 'Payment Approved') {
        history.push({
            step: 'Payment Approved',
            date: claim.treasuryProcessedOn,
            officer: claim.treasuryOfficer,
            icon: '✅',
            status: 'completed'
        });
    } else if (claim.status === 'Rejected by Treasury') {
        history.push({
            step: 'Rejected',
            date: claim.treasuryProcessedOn,
            icon: '❌',
            status: 'rejected'
        });
    }
    
    return `
        <div class="history-timeline">
            <div class="timeline-header">Claim Progress</div>
            <div class="timeline-steps">
                ${history.map((item, idx) => `
                    <div class="timeline-step ${item.status}">
                        <div class="step-icon">${item.icon}</div>
                        <div class="step-content">
                            <div class="step-title">${item.step}</div>
                            ${item.date ? `<div class="step-date">${formatDate(item.date)}</div>` : ''}
                            ${item.officer ? `<div class="step-officer">by ${item.officer}</div>` : ''}
                        </div>
                        ${idx < history.length - 1 ? '<div class="step-connector"></div>' : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function getStatusClass(status) {
    const statusMap = {
        'Forwarded to Treasury': 'status-pending',
        'Payment Approved': 'status-approved',
        'Rejected by Treasury': 'status-rejected'
    };
    return statusMap[status] || 'status-pending';
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatCurrency(amount) {
    return Number(amount).toLocaleString('en-IN');
}

function updateStats() {
    const today = new Date().toDateString();
    
    const pending = allClaims.filter(c => c.status === 'Forwarded to Treasury').length;
    
    const approvedToday = allClaims.filter(c => {
        const claimDate = new Date(c.treasuryProcessedOn || c.timestamp).toDateString();
        return c.status === 'Payment Approved' && claimDate === today;
    }).length;
    
    const totalDisbursed = allClaims
        .filter(c => c.status === 'Payment Approved')
        .reduce((sum, c) => sum + (parseFloat(c.estimatedCompensation) || 0), 0);
    
    const rejected = allClaims.filter(c => c.status === 'Rejected by Treasury').length;
    
    document.getElementById('totalPending').textContent = pending;
    document.getElementById('totalApproved').textContent = approvedToday;
    document.getElementById('totalDisbursed').textContent = '₹' + formatCurrency(totalDisbursed);
    document.getElementById('totalRejected').textContent = rejected;
}

function openApprovalModal(claimId) {
    const claim = allClaims.find(c => c.claimId === claimId);
    if (!claim) return;
    
    currentClaim = claim;
    
    const modalBody = document.getElementById('approvalModalBody');
    modalBody.innerHTML = `
        <div class="modal-claim-summary">
            <div class="summary-header">
                <div class="summary-id">
                    <span class="id-icon">📋</span>
                    <span>${claim.claimId}</span>
                </div>
                <div class="summary-amount">₹${formatCurrency(claim.estimatedCompensation || 0)}</div>
            </div>
            <div class="summary-details">
                <div class="detail-row">
                    <span class="detail-label">Farmer Name:</span>
                    <span class="detail-value">${claim.farmerName}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Crop Type:</span>
                    <span class="detail-value">${claim.cropType}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Verified Loss:</span>
                    <span class="detail-value">${claim.verifiedDamage || claim.damageExtent}%</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Revenue Officer:</span>
                    <span class="detail-value">${claim.revenueOfficer || 'N/A'}</span>
                </div>
            </div>
        </div>
        
        <div class="confirmation-message">
            <div class="confirmation-icon">💰</div>
            <h3>Approve Payment Disbursement?</h3>
            <p>This action will mark the claim as approved for payment. The compensation amount of <strong>₹${formatCurrency(claim.estimatedCompensation || 0)}</strong> will be queued for disbursement to the farmer.</p>
        </div>
        
        <div class="form-group">
            <label class="form-label">Treasury Remarks (Optional)</label>
            <textarea 
                id="treasuryRemarks" 
                class="form-input" 
                rows="3" 
                placeholder="Add any remarks or notes for this approval..."
            ></textarea>
        </div>
        
        <div class="modal-actions">
            <button class="btn-modal btn-cancel" onclick="closeApprovalModal()">
                <span>Cancel</span>
            </button>
            <button class="btn-modal btn-confirm" onclick="confirmApproval()">
                <span class="btn-icon">✓</span>
                <span class="btn-text">Confirm Approval</span>
                <div class="spinner"></div>
            </button>
        </div>
    `;
    
    const modal = document.getElementById('approvalModal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    setTimeout(() => {
        modal.querySelector('.modal-content').classList.add('scale-in');
    }, 10);
}

function closeApprovalModal() {
    const modal = document.getElementById('approvalModal');
    modal.querySelector('.modal-content').classList.remove('scale-in');
    
    setTimeout(() => {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
        currentClaim = null;
    }, 300);
}

function openRejectModal(claimId) {
    const claim = allClaims.find(c => c.claimId === claimId);
    if (!claim) return;
    
    currentClaim = claim;
    
    const modalBody = document.getElementById('rejectModalBody');
    modalBody.innerHTML = `
        <div class="modal-claim-summary">
            <div class="summary-header">
                <div class="summary-id">
                    <span class="id-icon">📋</span>
                    <span>${claim.claimId}</span>
                </div>
            </div>
            <div class="summary-details">
                <div class="detail-row">
                    <span class="detail-label">Farmer Name:</span>
                    <span class="detail-value">${claim.farmerName}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Compensation:</span>
                    <span class="detail-value">₹${formatCurrency(claim.estimatedCompensation || 0)}</span>
                </div>
            </div>
        </div>
        
        <div class="warning-message">
            <div class="warning-icon">⚠️</div>
            <h3>Reject Payment Disbursement?</h3>
            <p>You are about to reject this claim. This action will notify the farmer and send the claim back for review.</p>
        </div>
        
        <div class="form-group">
            <label class="form-label">Reason for Rejection *</label>
            <textarea 
                id="rejectionReason" 
                class="form-input" 
                rows="4" 
                placeholder="Please provide a detailed reason for rejecting this payment..."
                required
            ></textarea>
            <div class="error-message" id="rejectionReasonError"></div>
        </div>
        
        <div class="modal-actions">
            <button class="btn-modal btn-cancel" onclick="closeRejectModal()">
                <span>Cancel</span>
            </button>
            <button class="btn-modal btn-confirm-reject" onclick="confirmRejection()">
                <span class="btn-icon">✗</span>
                <span class="btn-text">Confirm Rejection</span>
                <div class="spinner"></div>
            </button>
        </div>
    `;
    
    const modal = document.getElementById('rejectModal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    setTimeout(() => {
        modal.querySelector('.modal-content').classList.add('scale-in');
    }, 10);
}

function closeRejectModal() {
    const modal = document.getElementById('rejectModal');
    modal.querySelector('.modal-content').classList.remove('scale-in');
    
    setTimeout(() => {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
        currentClaim = null;
    }, 300);
}

async function confirmApproval() {
    const remarks = document.getElementById('treasuryRemarks').value.trim();
    
    const btn = document.querySelector('.btn-confirm');
    btn.disabled = true;
    btn.classList.add('loading');
    
    try {
        const updateData = {
            claimId: currentClaim.claimId,
            status: 'Payment Approved',
            treasuryRemarks: remarks,
            treasuryOfficer: JSON.parse(localStorage.getItem('officialData')).username,
            treasuryProcessedOn: new Date().toISOString()
        };
        
        const result = await updateClaimStatus(updateData);
        
        if (result.success) {
            showSuccessNotification('Payment approved successfully! The farmer will be notified.');
            closeApprovalModal();
            loadClaims();
        } else {
            alert(result.message || 'Failed to approve payment. Please try again.');
        }
    } catch (error) {
        console.error('Error approving payment:', error);
        alert('An error occurred. Please try again.');
    } finally {
        btn.disabled = false;
        btn.classList.remove('loading');
    }
}

async function confirmRejection() {
    const reason = document.getElementById('rejectionReason').value.trim();
    
    if (!reason || reason.length < 10) {
        showFieldError('rejectionReason', 'Please provide a detailed reason (at least 10 characters)');
        return;
    }
    
    const btn = document.querySelector('.btn-confirm-reject');
    btn.disabled = true;
    btn.classList.add('loading');
    
    try {
        const updateData = {
            claimId: currentClaim.claimId,
            status: 'Rejected by Treasury',
            treasuryRejectionReason: reason,
            treasuryOfficer: JSON.parse(localStorage.getItem('officialData')).username,
            treasuryProcessedOn: new Date().toISOString()
        };
        
        const result = await updateClaimStatus(updateData);
        
        if (result.success) {
            showSuccessNotification('Claim rejected. The farmer and revenue officer will be notified.');
            closeRejectModal();
            loadClaims();
        } else {
            alert(result.message || 'Failed to reject claim. Please try again.');
        }
    } catch (error) {
        console.error('Error rejecting claim:', error);
        alert('An error occurred. Please try again.');
    } finally {
        btn.disabled = false;
        btn.classList.remove('loading');
    }
}

async function updateClaimStatus(updateData) {
    try {
        const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'updateClaim',
                ...updateData
            })
        });

        if (response.ok) {
            const result = await response.json();
            return result;
        } else {
            return { success: false, message: 'Update request failed' };
        }
    } catch (error) {
        console.error('Error updating claim:', error);
        return updateLocalClaim(updateData);
    }
}

function updateLocalClaim(updateData) {
    const localClaims = JSON.parse(localStorage.getItem('farmerClaims') || '[]');
    const index = localClaims.findIndex(c => c.claimId === updateData.claimId);
    
    if (index !== -1) {
        localClaims[index] = { ...localClaims[index], ...updateData };
        localStorage.setItem('farmerClaims', JSON.stringify(localClaims));
        return { success: true, fallback: true };
    }
    
    return { success: false, message: 'Claim not found' };
}

function viewClaimHistory(claimId) {
    const claim = allClaims.find(c => c.claimId === claimId);
    if (!claim) return;
    
    const modalBody = document.getElementById('historyModalBody');
    
    modalBody.innerHTML = `
        <div class="history-detail-header">
            <div class="history-detail-id">
                <span class="id-icon">📋</span>
                <span>${claim.claimId}</span>
            </div>
            <div class="history-detail-status ${getStatusClass(claim.status)}">${claim.status}</div>
        </div>
        
        <div class="history-section">
            <h4>Farmer Information</h4>
            <div class="history-grid">
                <div class="history-item"><strong>Name:</strong> ${claim.farmerName}</div>
                <div class="history-item"><strong>Contact:</strong> ${claim.farmerContact || 'N/A'}</div>
                <div class="history-item"><strong>Submitted:</strong> ${formatDate(claim.submittedOn)}</div>
            </div>
        </div>
        
        <div class="history-section">
            <h4>Crop Loss Details</h4>
            <div class="history-grid">
                <div class="history-item"><strong>Crop:</strong> ${claim.cropType}</div>
                <div class="history-item"><strong>Loss Cause:</strong> ${claim.lossCause}</div>
                <div class="history-item"><strong>Damage:</strong> ${claim.damageExtent}%</div>
                <div class="history-item"><strong>Verified:</strong> ${claim.verifiedDamage || claim.damageExtent}%</div>
            </div>
            ${claim.description ? `<div class="history-description">${claim.description}</div>` : ''}
        </div>
        
        ${claim.fieldInspectionReport ? `
        <div class="history-section">
            <h4>Field Inspection</h4>
            <div class="history-content">${claim.fieldInspectionReport}</div>
        </div>
        ` : ''}
        
        <div class="history-section">
            <h4>Revenue Assessment</h4>
            <div class="history-grid">
                <div class="history-item"><strong>Officer:</strong> ${claim.revenueOfficer || 'N/A'}</div>
                <div class="history-item"><strong>Compensation:</strong> ₹${formatCurrency(claim.estimatedCompensation || 0)}</div>
                <div class="history-item"><strong>Processed:</strong> ${formatDate(claim.processedOn)}</div>
            </div>
            ${claim.revenueRemarks ? `<div class="history-content">${claim.revenueRemarks}</div>` : ''}
        </div>
        
        ${claim.treasuryOfficer ? `
        <div class="history-section">
            <h4>Treasury Decision</h4>
            <div class="history-grid">
                <div class="history-item"><strong>Officer:</strong> ${claim.treasuryOfficer}</div>
                <div class="history-item"><strong>Status:</strong> ${claim.status}</div>
                <div class="history-item"><strong>Date:</strong> ${formatDate(claim.treasuryProcessedOn)}</div>
            </div>
            ${claim.treasuryRemarks ? `<div class="history-content"><strong>Remarks:</strong> ${claim.treasuryRemarks}</div>` : ''}
            ${claim.treasuryRejectionReason ? `<div class="history-content"><strong>Rejection Reason:</strong> ${claim.treasuryRejectionReason}</div>` : ''}
        </div>
        ` : ''}
    `;
    
    const modal = document.getElementById('historyModal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeHistoryModal() {
    const modal = document.getElementById('historyModal');
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
}

function showFieldError(fieldId, message) {
    const errorElement = document.getElementById(`${fieldId}Error`);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.classList.add('show');
    }
}

function showSuccessNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'success-notification';
    notification.innerHTML = `
        <div class="notification-icon">✅</div>
        <div class="notification-message">${message}</div>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}
