const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwxoKNA1ZyN4jaRJchiZo1ctcrZQ_F4WY1CSf4MlVfrLm3Ahp71Lf3oTWj_3THceUPW/exec';

let allClaims = [];
let filteredClaims = [];
let unsubscribeClaims = null;
let currentView = 'grid';
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
        if (data.role !== 'revenue_officer') {
            alert('Access Denied: This dashboard is only for revenue officers.');
            window.location.href = 'official_login.html';
            return;
        }
        // Firestore role guard
        (async () => {
            try {
                await new Promise((resolve) => {
                    if (window.firebaseServices && window.firebaseServices.isInitialized()) { resolve(); } else { window.addEventListener('firebaseReady', resolve); }
                });
                const { db } = window.firebaseServices;
                const doc = await db.collection('officials').doc(data.username).get();
                const info = doc.exists ? doc.data() : null;
                if (info && (info.role !== 'revenue_officer' && info.role !== 'all')) {
                    alert('Access Denied: Role mismatch.');
                    window.location.href = 'official_login.html';
                    return;
                }
            } catch (e) {
                console.error('Role verification failed:', e);
            }
        })();
        
        document.getElementById('officialName').textContent = `Welcome back, ${data.username}!`;
        
        initializeFilters();
        initializeCompensationSlider();
        loadClaimsRealtime();
    } catch (e) {
        console.error('Error parsing official data:', e);
        window.location.href = 'official_login.html';
    }
});

function initializeFilters() {
    const filters = ['filterStatus', 'filterCrop', 'filterCause', 'filterSearch'];
    filters.forEach(filterId => {
        const element = document.getElementById(filterId);
        if (element) {
            element.addEventListener('change', applyFilters);
            if (filterId === 'filterSearch') {
                element.addEventListener('input', applyFilters);
            }
        }
    });
}

function initializeCompensationSlider() {
    const slider = document.getElementById('compensationSlider');
    const input = document.getElementById('compensationAmount');
    
    if (slider && input) {
        slider.addEventListener('input', function() {
            input.value = this.value;
            animateSliderFill(this);
        });
        
        input.addEventListener('input', function() {
            const value = Math.min(Math.max(this.value, 0), 500000);
            this.value = value;
            slider.value = value;
            animateSliderFill(slider);
        });
    }
}

function animateSliderFill(slider) {
    const percent = (slider.value / slider.max) * 100;
    slider.style.background = `linear-gradient(to right, #43e97b 0%, #43e97b ${percent}%, rgba(255, 255, 255, 0.1) ${percent}%, rgba(255, 255, 255, 0.1) 100%)`;
}

async function loadClaimsRealtime() {
    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');
    const claimsGrid = document.getElementById('claimsGrid');
    
    loadingState.style.display = 'block';
    emptyState.style.display = 'none';
    claimsGrid.innerHTML = '';
    
    try {
        await new Promise((resolve) => {
            if (window.firebaseServices && window.firebaseServices.isInitialized()) { resolve(); } else { window.addEventListener('firebaseReady', resolve); }
        });
        const { db } = window.firebaseServices;
        if (typeof unsubscribeClaims === 'function') unsubscribeClaims();
        const query = db.collection('claims').where('status', 'in', ['Field Verified', 'Forwarded to Revenue Officer', 'Forwarded to Treasury', 'Rejected by Revenue']);
        unsubscribeClaims = query.onSnapshot((snapshot) => {
            const claims = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                claims.push({
                    id: doc.id,
                    claimId: doc.id,
                    farmerName: data.farmerName || data.farmerEmail || 'Farmer',
                    farmerContact: data.farmerContact,
                    cropType: data.cropType,
                    lossCause: data.lossCause,
                    lossDate: data.lossDate,
                    damageExtent: data.damageExtent,
                    verifiedDamage: data.fieldReport && data.fieldReport.verifiedDamage,
                    fieldInspectionReport: data.fieldReport && data.fieldReport.notes,
                    status: data.status,
                    description: data.description,
                    estimatedCompensation: data.estimatedCompensation,
                    files: [...(data.images || []), ...(data.documents || [])]
                });
            });
            allClaims = claims;
            populateCropFilter();
            applyFilters();
            updateStats();
        }, (err) => console.error('Revenue officer listener error:', err));
    } catch (e) {
        console.error('Error setting up revenue listener:', e);
        allClaims = loadLocalClaims();
    }
    
    loadingState.style.display = 'none';
    populateCropFilter();
    applyFilters();
}

function loadLocalClaims() {
    const localClaims = JSON.parse(localStorage.getItem('farmerClaims') || '[]');
    return localClaims.filter(c => 
        c.status === 'Field Inspection Complete' || 
        c.status === 'Forwarded to Revenue Officer' ||
        c.status === 'Approved by Revenue' ||
        c.status === 'Rejected by Revenue'
    );
}

function populateCropFilter() {
    const cropFilter = document.getElementById('filterCrop');
    const crops = [...new Set(allClaims.map(c => c.cropType))].filter(Boolean);
    
    cropFilter.innerHTML = '<option value="">All Crops</option>';
    crops.forEach(crop => {
        const option = document.createElement('option');
        option.value = crop;
        option.textContent = crop;
        cropFilter.appendChild(option);
    });
}

function applyFilters() {
    const statusFilter = document.getElementById('filterStatus').value;
    const cropFilter = document.getElementById('filterCrop').value;
    const causeFilter = document.getElementById('filterCause').value;
    const searchFilter = document.getElementById('filterSearch').value.toLowerCase();
    
    filteredClaims = allClaims.filter(claim => {
        const matchesStatus = !statusFilter || claim.status === statusFilter;
        const matchesCrop = !cropFilter || claim.cropType === cropFilter;
        const matchesCause = !causeFilter || claim.lossCause === causeFilter;
        const matchesSearch = !searchFilter || 
            claim.farmerName.toLowerCase().includes(searchFilter) ||
            claim.claimId.toLowerCase().includes(searchFilter) ||
            (claim.farmerContact && claim.farmerContact.includes(searchFilter));
        
        return matchesStatus && matchesCrop && matchesCause && matchesSearch;
    });
    
    displayClaims();
    updateStats();
}

function resetFilters() {
    document.getElementById('filterStatus').value = 'Field Inspection Complete';
    document.getElementById('filterCrop').value = '';
    document.getElementById('filterCause').value = '';
    document.getElementById('filterSearch').value = '';
    applyFilters();
}

function displayClaims() {
    const claimsGrid = document.getElementById('claimsGrid');
    const emptyState = document.getElementById('emptyState');
    
    claimsGrid.innerHTML = '';
    
    if (filteredClaims.length === 0) {
        emptyState.style.display = 'block';
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
    
    const isPending = claim.status === 'Field Inspection Complete' || claim.status === 'Forwarded to Revenue Officer';
    
    const inspectionReport = claim.fieldInspectionReport ? `
        <div class="inspection-report">
            <div class="inspection-header">
                <span class="inspection-icon">🔍</span>
                <span class="inspection-title">Field Inspection Report</span>
            </div>
            <div class="inspection-content">
                <div class="inspection-detail">
                    <strong>Verified Damage:</strong> ${claim.verifiedDamage || claim.damageExtent}%
                </div>
                <div class="inspection-detail">
                    <strong>Notes:</strong> ${claim.fieldInspectionReport}
                </div>
            </div>
        </div>
    ` : '';
    
    const compensationBadge = claim.estimatedCompensation ? `
        <div class="compensation-badge">
            💰 ₹${formatCurrency(claim.estimatedCompensation)}
        </div>
    ` : '';
    
    card.innerHTML = `
        <div class="claim-header">
            <div class="claim-id">${claim.claimId}</div>
            <div class="claim-status ${statusClass}">${claim.status}</div>
        </div>
        
        ${compensationBadge}
        
        <div class="farmer-info">
            <div class="farmer-name">${claim.farmerName}</div>
            <div class="farmer-details">
                <div class="farmer-detail"><strong>Contact:</strong> ${claim.farmerContact || 'N/A'}</div>
                <div class="farmer-detail"><strong>Submitted:</strong> ${submittedDate}</div>
            </div>
        </div>
        
        <div class="crop-info" onclick="showClaimDetails('${claim.claimId}')">
            <div class="crop-header">
                <div class="crop-type">${claim.cropType}</div>
                <div class="damage-badge">${claim.verifiedDamage || claim.damageExtent}% Verified Loss</div>
            </div>
            <div class="crop-details">
                <div class="crop-detail">
                    <div class="crop-detail-label">Loss Cause</div>
                    <div class="crop-detail-value">${claim.lossCause}</div>
                </div>
                <div class="crop-detail">
                    <div class="crop-detail-label">Date of Loss</div>
                    <div class="crop-detail-value">${formattedDate}</div>
                </div>
            </div>
        </div>
        
        ${inspectionReport}
        
        <div class="action-buttons">
            <button class="action-btn btn-process" onclick="openProcessModal('${claim.claimId}')" ${!isPending ? 'disabled' : ''}>
                <span>💰 Process Claim</span>
            </button>
            <button class="action-btn btn-details" onclick="showClaimDetails('${claim.claimId}')">
                <span>👁 View Details</span>
            </button>
        </div>
    `;
    
    return card;
}

function getStatusClass(status) {
    const statusMap = {
        'Field Inspection Complete': 'status-pending',
        'Forwarded to Revenue Officer': 'status-pending',
        'Approved by Revenue': 'status-approved',
        'Rejected by Revenue': 'status-rejected',
        'Forwarded to Treasury': 'status-forwarded'
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
    const allClaimsForStats = JSON.parse(localStorage.getItem('farmerClaims') || '[]');
    
    const pending = allClaims.filter(c => 
        c.status === 'Field Inspection Complete' || 
        c.status === 'Forwarded to Revenue Officer'
    ).length;
    
    const approved = allClaimsForStats.filter(c => {
        const claimDate = new Date(c.timestamp || c.submittedOn).toDateString();
        return c.status === 'Approved by Revenue' && claimDate === today;
    }).length;
    
    const rejected = allClaimsForStats.filter(c => 
        c.status === 'Rejected by Revenue'
    ).length;
    
    const totalForwarded = allClaimsForStats
        .filter(c => c.status === 'Approved by Revenue' || c.status === 'Forwarded to Treasury')
        .reduce((sum, c) => sum + (parseFloat(c.estimatedCompensation) || 0), 0);
    
    document.getElementById('totalPending').textContent = pending;
    document.getElementById('totalApproved').textContent = approved;
    document.getElementById('totalRejected').textContent = rejected;
    document.getElementById('totalForwarded').textContent = '₹' + formatCurrency(totalForwarded);
    
    const total = allClaims.length || 1;
    animateProgressBar('pendingProgress', (pending / total) * 100);
    animateProgressBar('approvedProgress', (approved / total) * 100);
    animateProgressBar('rejectedProgress', (rejected / total) * 100);
    animateProgressBar('forwardedProgress', Math.min((totalForwarded / 1000000) * 100, 100));
}

function animateProgressBar(id, percent) {
    const bar = document.getElementById(id);
    if (bar) {
        bar.style.width = percent + '%';
    }
}

function switchView(view) {
    currentView = view;
    const buttons = document.querySelectorAll('.view-btn');
    buttons.forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-view') === view);
    });
    
    const grid = document.getElementById('claimsGrid');
    if (view === 'list') {
        grid.style.gridTemplateColumns = '1fr';
    } else {
        grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(380px, 1fr))';
    }
}

function openProcessModal(claimId) {
    const claim = allClaims.find(c => c.claimId === claimId);
    if (!claim) return;
    
    currentClaim = claim;
    
    const infoDiv = document.getElementById('processClaimInfo');
    infoDiv.innerHTML = `
        <div class="process-claim-header">
            <h3>Claim Information</h3>
            <div class="claim-id-badge">${claim.claimId}</div>
        </div>
        <div class="process-claim-details">
            <div class="detail-item"><strong>Farmer:</strong> ${claim.farmerName}</div>
            <div class="detail-item"><strong>Crop:</strong> ${claim.cropType}</div>
            <div class="detail-item"><strong>Verified Damage:</strong> ${claim.verifiedDamage || claim.damageExtent}%</div>
            <div class="detail-item"><strong>Loss Cause:</strong> ${claim.lossCause}</div>
            <div class="detail-item"><strong>Field Report:</strong> ${claim.fieldInspectionReport || 'N/A'}</div>
        </div>
    `;
    
    document.getElementById('compensationAmount').value = '';
    document.getElementById('compensationSlider').value = '0';
    document.getElementById('revenueRemarks').value = '';
    animateSliderFill(document.getElementById('compensationSlider'));
    
    document.getElementById('processModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeProcessModal() {
    document.getElementById('processModal').classList.remove('active');
    document.body.style.overflow = 'auto';
    currentClaim = null;
}

function openRejectConfirmation() {
    document.getElementById('processModal').classList.remove('active');
    document.getElementById('rejectModal').classList.add('active');
    document.getElementById('rejectionReason').value = '';
}

function closeRejectModal() {
    document.getElementById('rejectModal').classList.remove('active');
    document.getElementById('processModal').classList.add('active');
}

async function approveAndForward() {
    const amount = document.getElementById('compensationAmount').value;
    const remarks = document.getElementById('revenueRemarks').value.trim();
    
    if (!amount || parseFloat(amount) <= 0) {
        showError('compensationAmount', 'Please enter a valid compensation amount');
        return;
    }
    
    const btn = document.querySelector('.btn-approve-modal');
    btn.disabled = true;
    btn.classList.add('loading');
    
    try {
        const updateData = {
            claimId: currentClaim.claimId,
            status: 'Forwarded to Treasury',
            estimatedLoss: parseFloat(amount),
            estimatedCompensation: parseFloat(amount),
            revenueRemarks: remarks,
            revenueOfficer: JSON.parse(localStorage.getItem('officialData')).username,
            processedOn: new Date().toISOString()
        };
        
        const result = await updateClaimStatus(updateData);
        
        if (result.success) {
            alert('Claim approved and forwarded to Treasury successfully!');
            closeProcessModal();
            // live listener will refresh
        } else {
            alert(result.message || 'Failed to approve claim. Please try again.');
        }
    } catch (error) {
        console.error('Error approving claim:', error);
        alert('An error occurred. Please try again.');
    } finally {
        btn.disabled = false;
        btn.classList.remove('loading');
    }
}

async function confirmReject() {
    const reason = document.getElementById('rejectionReason').value.trim();
    
    if (!reason || reason.length < 10) {
        showError('rejectionReason', 'Please provide a detailed reason (at least 10 characters)');
        return;
    }
    
    const btn = document.querySelector('.btn-confirm-reject');
    btn.disabled = true;
    btn.classList.add('loading');
    
    try {
        const updateData = {
            claimId: currentClaim.claimId,
            status: 'Rejected by Revenue',
            rejectionReason: reason,
            revenueOfficer: JSON.parse(localStorage.getItem('officialData')).username,
            processedOn: new Date().toISOString()
        };
        
        const result = await updateClaimStatus(updateData);
        
        if (result.success) {
            alert('Claim rejected successfully.');
            closeRejectModal();
            closeProcessModal();
            // live listener will refresh
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
        await new Promise((resolve) => {
            if (window.firebaseServices && window.firebaseServices.isInitialized()) { resolve(); } else { window.addEventListener('firebaseReady', resolve); }
        });
        const { db } = window.firebaseServices;
        const claimRef = db.collection('claims').doc(updateData.claimId);
        const updates = {
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            statusHistory: firebase.firestore.FieldValue.arrayUnion({
                stage: 'Revenue Officer',
                status: updateData.status === 'Rejected by Revenue' ? 'Rejected by Revenue Officer' : 'Revenue Approved',
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            })
        };
        if (updateData.status === 'Forwarded to Treasury') {
            updates.status = 'Revenue Approved';
            updates.forwardedTo = 'Treasury';
            updates.estimatedCompensation = updateData.estimatedCompensation;
            updates.revenueRemarks = updateData.revenueRemarks || null;
            updates.revenueOfficer = updateData.revenueOfficer;
            updates.processedOn = firebase.firestore.FieldValue.serverTimestamp();
        } else if (updateData.status === 'Rejected by Revenue') {
            updates.status = 'Rejected by Revenue Officer';
            updates.rejectionReason = updateData.rejectionReason;
            updates.revenueOfficer = updateData.revenueOfficer;
            updates.processedOn = firebase.firestore.FieldValue.serverTimestamp();
        }
        await claimRef.update(updates);
        return { success: true };
    } catch (error) {
        console.error('Error updating claim in Firestore:', error);
        return { success: false, message: error.message };
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

function showClaimDetails(claimId) {
    const claim = allClaims.find(c => c.claimId === claimId);
    if (!claim) return;
    
    const modalBody = document.getElementById('detailsModalBody');
    
    const documentsHtml = claim.files && claim.files.length > 0 ? `
        <div class="details-section">
            <h4>Uploaded Documents</h4>
            <div class="documents-preview">
                ${claim.files.map(file => `
                    <div class="document-preview">
                        ${file.type && file.type.startsWith('image/') ? 
                            `<img src="${file.data}" alt="${file.name}" class="document-image">` : 
                            `<div class="document-file">📄 ${file.name}</div>`
                        }
                    </div>
                `).join('')}
            </div>
        </div>
    ` : '';
    
    modalBody.innerHTML = `
        <div class="details-header">
            <div class="details-id">${claim.claimId}</div>
            <div class="details-status ${getStatusClass(claim.status)}">${claim.status}</div>
        </div>
        
        <div class="details-section">
            <h4>Farmer Information</h4>
            <div class="details-grid">
                <div class="detail-item"><strong>Name:</strong> ${claim.farmerName}</div>
                <div class="detail-item"><strong>Contact:</strong> ${claim.farmerContact || 'N/A'}</div>
                <div class="detail-item"><strong>Submitted:</strong> ${formatDate(claim.submittedOn)}</div>
            </div>
        </div>
        
        <div class="details-section">
            <h4>Crop Loss Information</h4>
            <div class="details-grid">
                <div class="detail-item"><strong>Crop Type:</strong> ${claim.cropType}</div>
                <div class="detail-item"><strong>Loss Cause:</strong> ${claim.lossCause}</div>
                <div class="detail-item"><strong>Date of Loss:</strong> ${formatDate(claim.lossDate)}</div>
                <div class="detail-item"><strong>Damage Extent:</strong> ${claim.damageExtent}%</div>
                <div class="detail-item"><strong>Verified Damage:</strong> ${claim.verifiedDamage || claim.damageExtent}%</div>
            </div>
            ${claim.description ? `<div class="detail-description"><strong>Description:</strong><br>${claim.description}</div>` : ''}
        </div>
        
        ${claim.fieldInspectionReport ? `
        <div class="details-section">
            <h4>Field Inspection Report</h4>
            <div class="inspection-report-detail">
                ${claim.fieldInspectionReport}
            </div>
        </div>
        ` : ''}
        
        ${claim.estimatedCompensation ? `
        <div class="details-section">
            <h4>Revenue Assessment</h4>
            <div class="details-grid">
                <div class="detail-item"><strong>Compensation:</strong> ₹${formatCurrency(claim.estimatedCompensation)}</div>
                <div class="detail-item"><strong>Revenue Officer:</strong> ${claim.revenueOfficer || 'N/A'}</div>
                <div class="detail-item"><strong>Processed:</strong> ${formatDate(claim.processedOn)}</div>
            </div>
            ${claim.revenueRemarks ? `<div class="detail-description"><strong>Remarks:</strong><br>${claim.revenueRemarks}</div>` : ''}
        </div>
        ` : ''}
        
        ${documentsHtml}
    `;
    
    document.getElementById('detailsModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeDetailsModal() {
    document.getElementById('detailsModal').classList.remove('active');
    document.body.style.overflow = 'auto';
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
