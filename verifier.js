const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwxoKNA1ZyN4jaRJchiZo1ctcrZQ_F4WY1CSf4MlVfrLm3Ahp71Lf3oTWj_3THceUPW/exec';

let allClaims = [];
let unsubscribeClaims = null;
let filteredClaims = [];
let currentView = 'grid';
let currentAction = null;
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
        if (data.role !== 'verifier') {
            alert('Access Denied: This dashboard is only for verifiers.');
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
                // Only enforce when a Firestore record exists; if missing, allow fallback credentials
                if (info && (info.role !== 'verifier' && info.role !== 'all')) {
                    alert('Access Denied: Role mismatch.');
                    window.location.href = 'official_login.html';
                    return;
                }
            } catch (e) {
                console.error('Role verification failed:', e);
            }
        })();
        
        document.getElementById('verifierName').textContent = `Welcome back, ${data.username}!`;
        
        initializeFilters();
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

async function loadClaimsRealtime() {
    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');
    const claimsGrid = document.getElementById('claimsGrid');
    
    loadingState.style.display = 'block';
    emptyState.style.display = 'none';
    claimsGrid.innerHTML = '';
    
    try {
        // Wait until Firebase is ready
        await new Promise((resolve) => {
            if (window.firebaseServices && window.firebaseServices.isInitialized()) {
                resolve();
            } else {
                window.addEventListener('firebaseReady', resolve);
            }
        });

        const { db } = window.firebaseServices;

        if (typeof unsubscribeClaims === 'function') unsubscribeClaims();
        const query = db.collection('claims').where('status', 'in', ['submitted', 'Submitted', 'Pending', 'Verified', 'Approved', 'rejected', 'Rejected', 'forwarded by verifier', 'Forwarded to Field Officer']);
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
                    status: data.status,
                    description: data.description,
                    files: [...(data.images || []), ...(data.documents || [])]
                });
            });
            // Sort newest first using Firestore server timestamp if available
            allClaims = claims.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            populateCropFilter();
            applyFilters();
        }, (err) => {
            console.error('Verifier listener error:', err);
            // Fallback to local/mock claims so the UI remains usable without Firestore permissions
            try {
                allClaims = loadLocalClaims();
                populateCropFilter();
                applyFilters();
                loadingState.style.display = 'none';
            } catch (e) {
                console.error('Fallback load error:', e);
                loadingState.style.display = 'none';
            }
        });
    } catch (error) {
        console.error('Error setting up verifier listener:', error);
    } finally {
        loadingState.style.display = 'none';
        populateCropFilter();
        applyFilters();
    }
}

function loadLocalClaims() {
    const localClaims = JSON.parse(localStorage.getItem('farmerClaims') || '[]');
    console.log('Using local claims as fallback');
    return localClaims;
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
    
    const documentsHtml = generateDocumentsHtml(claim);
    const descriptionHtml = generateDescriptionHtml(claim);
    
    card.innerHTML = `
        <div class="claim-header">
            <div class="claim-id">${claim.claimId}</div>
            <div class="claim-status ${statusClass}">${claim.status}</div>
        </div>
        
        <div class="farmer-info">
            <div class="farmer-name">${claim.farmerName}</div>
            <div class="farmer-details">
                <div class="farmer-detail"><strong>Contact:</strong> ${claim.farmerContact || 'N/A'}</div>
                <div class="farmer-detail"><strong>Submitted:</strong> ${submittedDate}</div>
            </div>
        </div>
        
        <div class="crop-info">
            <div class="crop-header">
                <div class="crop-type">${claim.cropType}</div>
                <div class="damage-badge">${claim.damageExtent}% Loss</div>
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
        
        ${documentsHtml}
        
        ${descriptionHtml}
        
        <div class="action-buttons">
            <button class="action-btn btn-reject" onclick="openActionModal('reject', '${claim.claimId}')" ${claim.status !== 'submitted' && claim.status !== 'Submitted' ? 'disabled' : ''}>
                <span>✗ Reject</span>
            </button>
            <button class="action-btn btn-forward" onclick="openActionModal('forward', '${claim.claimId}')" ${claim.status !== 'submitted' && claim.status !== 'Submitted' ? 'disabled' : ''}>
                <span>→ Forward</span>
            </button>
        </div>
    `;
    
    card.querySelector('.crop-info').addEventListener('click', (e) => {
        if (!e.target.closest('.action-btn')) {
            showClaimDetails(claim);
        }
    });
    
    return card;
}

function generateDocumentsHtml(claim) {
    if (!claim.files || claim.files.length === 0) {
        return '<div class="documents-section"><div class="documents-header">📎 No documents uploaded</div></div>';
    }
    
    const thumbnails = claim.files.slice(0, 4).map(file => createDocumentThumbnail(file)).join('');
    const extraCount = claim.files.length > 4 ? `<div class="document-thumbnail doc-file">+${claim.files.length - 4}</div>` : '';
    
    return `
        <div class="documents-section">
            <div class="documents-header">📎 Documents (${claim.files.length})</div>
            <div class="documents-grid">
                ${thumbnails}
                ${extraCount}
            </div>
        </div>
    `;
}

function generateDescriptionHtml(claim) {
    if (!claim.description) {
        return '';
    }
    
    return `
        <div style="margin: 16px 0; padding: 12px; background: rgba(255, 255, 255, 0.03); border-radius: 12px; font-size: 13px; color: rgba(255, 255, 255, 0.7); line-height: 1.5;">
            ${claim.description}
        </div>
    `;
}

function createDocumentThumbnail(file) {
    if (file.type && file.type.startsWith('image/')) {
        return `<div class="document-thumbnail"><img src="${file.data}" alt="${file.name}"></div>`;
    } else {
        return `<div class="document-thumbnail doc-file">📄</div>`;
    }
}

function getStatusClass(status) {
    const statusMap = {
        'Pending': 'status-pending',
        'Approved': 'status-approved',
        'Rejected': 'status-rejected',
        'Forwarded to Field Officer': 'status-forwarded',
        'forwarded by verifier': 'status-forwarded',
        'Forwarded': 'status-forwarded',
        'rejected': 'status-rejected',
        'submitted': 'status-submitted'
    };
    return statusMap[status] || 'status-pending';
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function updateStats() {
    const pending = allClaims.filter(c => c.status === 'Pending' || c.status === 'submitted' || c.status === 'Submitted').length;
    const approved = allClaims.filter(c => c.status === 'Approved').length;
    const rejected = allClaims.filter(c => c.status === 'Rejected' || c.status === 'rejected').length;
    const forwarded = allClaims.filter(c => c.status === 'Forwarded to Field Officer' || c.status === 'Forwarded' || c.status === 'forwarded by verifier').length;
    
    document.getElementById('totalPending').textContent = pending;
    document.getElementById('totalApproved').textContent = approved;
    document.getElementById('totalRejected').textContent = rejected;
    document.getElementById('totalForwarded').textContent = forwarded;
}

function resetFilters() {
    document.getElementById('filterStatus').value = '';
    document.getElementById('filterCrop').value = '';
    document.getElementById('filterCause').value = '';
    document.getElementById('filterSearch').value = '';
    applyFilters();
}

function switchView(view) {
    currentView = view;
    const buttons = document.querySelectorAll('.view-btn');
    buttons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-view') === view) {
            btn.classList.add('active');
        }
    });
    
    const claimsGrid = document.getElementById('claimsGrid');
    if (view === 'list') {
        claimsGrid.style.gridTemplateColumns = '1fr';
    } else {
        claimsGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(380px, 1fr))';
    }
}

function openActionModal(action, claimId) {
    currentAction = action;
    currentClaim = allClaims.find(c => c.claimId === claimId);
    
    if (!currentClaim) return;
    
    const modal = document.getElementById('actionModal');
    const title = document.getElementById('modalTitle');
    const icon = document.getElementById('confirmationIcon');
    const message = document.getElementById('confirmationMessage');
    const summary = document.getElementById('claimSummary');
    const remarksGroup = document.getElementById('remarksGroup');
    
    const actionConfig = {
        'reject': {
            title: 'Reject Claim',
            icon: '✗',
            iconBg: 'rgba(255, 87, 87, 0.1)',
            iconBorder: 'rgba(255, 87, 87, 0.3)',
            message: 'Are you sure you want to reject this claim? Please provide a reason for rejection.',
            showRemarks: true
        },
        'forward': {
            title: 'Forward to Field Officer',
            icon: '→',
            iconBg: 'rgba(102, 126, 234, 0.1)',
            iconBorder: 'rgba(102, 126, 234, 0.3)',
            message: 'Forward this claim to a field officer for on-site inspection? The field officer will verify the damage extent.',
            showRemarks: true
        }
    };
    
    const config = actionConfig[action];
    title.textContent = config.title;
    icon.textContent = config.icon;
    icon.style.background = config.iconBg;
    icon.style.borderColor = config.iconBorder;
    message.textContent = config.message;
    
    summary.innerHTML = `
        <div class="claim-summary-item">
            <span class="claim-summary-label">Claim ID:</span>
            <span class="claim-summary-value">${currentClaim.claimId}</span>
        </div>
        <div class="claim-summary-item">
            <span class="claim-summary-label">Farmer:</span>
            <span class="claim-summary-value">${currentClaim.farmerName}</span>
        </div>
        <div class="claim-summary-item">
            <span class="claim-summary-label">Crop Type:</span>
            <span class="claim-summary-value">${currentClaim.cropType}</span>
        </div>
        <div class="claim-summary-item">
            <span class="claim-summary-label">Damage Extent:</span>
            <span class="claim-summary-value">${currentClaim.damageExtent}%</span>
        </div>
        <div class="claim-summary-item">
            <span class="claim-summary-label">Loss Cause:</span>
            <span class="claim-summary-value">${currentClaim.lossCause}</span>
        </div>
    `;
    
    remarksGroup.style.display = config.showRemarks ? 'block' : 'none';
    document.getElementById('actionRemarks').value = '';
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeActionModal() {
    const modal = document.getElementById('actionModal');
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
    currentAction = null;
    currentClaim = null;
}

async function confirmAction() {
    if (!currentAction || !currentClaim) return;
    
    const confirmBtn = document.getElementById('confirmActionBtn');
    const remarks = document.getElementById('actionRemarks').value;
    
    confirmBtn.disabled = true;
    confirmBtn.classList.add('loading');
    
    const newStatus = {
        'reject': 'rejected',
        'forward': 'forwarded by verifier'
    }[currentAction];
    
    try {
        const result = await updateClaimStatus(currentClaim.claimId, newStatus, remarks);
        
        if (result.success) {
            const claimIndex = allClaims.findIndex(c => c.claimId === currentClaim.claimId);
            if (claimIndex !== -1) {
                allClaims[claimIndex].status = newStatus;
                if (remarks) {
                    allClaims[claimIndex].verifierRemarks = remarks;
                }
                allClaims[claimIndex].verifiedOn = new Date().toISOString();
            }
            
            closeActionModal();
            applyFilters();
            
            showSuccessNotification(`Claim ${currentAction}d successfully!`);
        } else {
            alert(result.message || 'Failed to update claim. Please try again.');
        }
    } catch (error) {
        console.error('Error updating claim:', error);
        alert('An error occurred. Please try again.');
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.classList.remove('loading');
    }
}

async function updateClaimStatus(claimId, newStatus, remarks) {
    try {
        await new Promise((resolve) => {
            if (window.firebaseServices && window.firebaseServices.isInitialized()) {
                resolve();
            } else {
                window.addEventListener('firebaseReady', resolve);
            }
        });

        const { db } = window.firebaseServices;
        const claimRef = db.collection('claims').doc(claimId);
        
        // Use new Date() instead of serverTimestamp() inside arrayUnion to avoid Firestore error
        await claimRef.update({
            status: newStatus,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            verifierRemarks: remarks || null,
            statusHistory: firebase.firestore.FieldValue.arrayUnion({
                stage: 'Verifier',
                status: newStatus,
                timestamp: new Date().toISOString()
            })
        });
        return { success: true };
    } catch (error) {
        console.error('Error updating claim in Firestore:', error);
        return { success: false, message: error.message };
    }
}

function updateClaimLocally(claimId, newStatus, remarks) {
    const localClaims = JSON.parse(localStorage.getItem('farmerClaims') || '[]');
    const claimIndex = localClaims.findIndex(c => c.claimId === claimId);
    
    if (claimIndex !== -1) {
        localClaims[claimIndex].status = newStatus;
        if (remarks) {
            localClaims[claimIndex].verifierRemarks = remarks;
        }
        localClaims[claimIndex].verifiedOn = new Date().toISOString();
        localStorage.setItem('farmerClaims', JSON.stringify(localClaims));
        console.log('Claim updated locally');
    }
}

function showClaimDetails(claim) {
    const modal = document.getElementById('detailsModal');
    const body = document.getElementById('detailsModalBody');
    
    const formattedDate = formatDate(claim.lossDate);
    const submittedDate = formatDate(claim.submittedOn);
    const verifiedDate = claim.verifiedOn ? formatDate(claim.verifiedOn) : 'Not yet verified';
    
    body.innerHTML = `
        <div style="display: grid; gap: 24px;">
            <div>
                <h3 style="color: white; margin-bottom: 16px; font-size: 18px;">Claim Information</h3>
                <div style="display: grid; gap: 12px; background: rgba(255, 255, 255, 0.05); padding: 20px; border-radius: 16px;">
                    <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
                        <span style="color: rgba(255, 255, 255, 0.6);">Claim ID:</span>
                        <span style="color: white; font-weight: 600;">${claim.claimId}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
                        <span style="color: rgba(255, 255, 255, 0.6);">Status:</span>
                        <span class="claim-status ${getStatusClass(claim.status)}">${claim.status}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
                        <span style="color: rgba(255, 255, 255, 0.6);">Submitted On:</span>
                        <span style="color: white; font-weight: 600;">${submittedDate}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                        <span style="color: rgba(255, 255, 255, 0.6);">Verified On:</span>
                        <span style="color: white; font-weight: 600;">${verifiedDate}</span>
                    </div>
                </div>
            </div>
            
            <div>
                <h3 style="color: white; margin-bottom: 16px; font-size: 18px;">Farmer Details</h3>
                <div style="display: grid; gap: 12px; background: rgba(255, 255, 255, 0.05); padding: 20px; border-radius: 16px;">
                    <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
                        <span style="color: rgba(255, 255, 255, 0.6);">Name:</span>
                        <span style="color: white; font-weight: 600;">${claim.farmerName}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                        <span style="color: rgba(255, 255, 255, 0.6);">Contact:</span>
                        <span style="color: white; font-weight: 600;">${claim.farmerContact || 'N/A'}</span>
                    </div>
                </div>
            </div>
            
            <div>
                <h3 style="color: white; margin-bottom: 16px; font-size: 18px;">Crop Loss Details</h3>
                <div style="display: grid; gap: 12px; background: rgba(255, 255, 255, 0.05); padding: 20px; border-radius: 16px;">
                    <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
                        <span style="color: rgba(255, 255, 255, 0.6);">Crop Type:</span>
                        <span style="color: white; font-weight: 600;">${claim.cropType}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
                        <span style="color: rgba(255, 255, 255, 0.6);">Loss Cause:</span>
                        <span style="color: white; font-weight: 600;">${claim.lossCause}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
                        <span style="color: rgba(255, 255, 255, 0.6);">Date of Loss:</span>
                        <span style="color: white; font-weight: 600;">${formattedDate}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                        <span style="color: rgba(255, 255, 255, 0.6);">Damage Extent:</span>
                        <span style="color: white; font-weight: 600;">${claim.damageExtent}%</span>
                    </div>
                </div>
            </div>
            
            ${claim.description ? `
            <div>
                <h3 style="color: white; margin-bottom: 16px; font-size: 18px;">Description</h3>
                <div style="background: rgba(255, 255, 255, 0.05); padding: 20px; border-radius: 16px; color: rgba(255, 255, 255, 0.8); line-height: 1.6;">
                    ${claim.description}
                </div>
            </div>
            ` : ''}
            
            ${claim.verifierRemarks ? `
            <div>
                <h3 style="color: white; margin-bottom: 16px; font-size: 18px;">Verifier Remarks</h3>
                <div style="background: rgba(102, 126, 234, 0.1); padding: 20px; border-radius: 16px; color: rgba(255, 255, 255, 0.8); line-height: 1.6; border: 1px solid rgba(102, 126, 234, 0.3);">
                    ${claim.verifierRemarks}
                </div>
            </div>
            ` : ''}
            
            ${claim.files && claim.files.length > 0 ? `
            <div>
                <h3 style="color: white; margin-bottom: 16px; font-size: 18px;">Uploaded Documents</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 12px;">
                    ${claim.files.map(file => {
                        if (file.type && file.type.startsWith('image/')) {
                            return `<div style="aspect-ratio: 1; border-radius: 12px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.1); cursor: pointer;"><img src="${file.data}" alt="${file.name}" style="width: 100%; height: 100%; object-fit: cover;"></div>`;
                        } else {
                            return `<div style="aspect-ratio: 1; border-radius: 12px; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.1); display: flex; align-items: center; justify-content: center; font-size: 40px;">📄</div>`;
                        }
                    }).join('')}
                </div>
            </div>
            ` : ''}
        </div>
    `;
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeDetailsModal() {
    const modal = document.getElementById('detailsModal');
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
}

function showSuccessNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 30px;
        background: linear-gradient(135deg, #43e97b, #38d16a);
        color: white;
        padding: 20px 30px;
        border-radius: 16px;
        box-shadow: 0 10px 40px rgba(67, 233, 123, 0.4);
        z-index: 10000;
        font-weight: 600;
        animation: slideInRight 0.5s ease;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.5s ease';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 500);
    }, 3000);
}

const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            opacity: 0;
            transform: translateX(100px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    
    @keyframes slideOutRight {
        from {
            opacity: 1;
            transform: translateX(0);
        }
        to {
            opacity: 0;
            transform: translateX(100px);
        }
    }
`;
document.head.appendChild(style);
