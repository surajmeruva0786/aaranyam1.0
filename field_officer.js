const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwxoKNA1ZyN4jaRJchiZo1ctcrZQ_F4WY1CSf4MlVfrLm3Ahp71Lf3oTWj_3THceUPW/exec';

let allClaims = [];
let filteredClaims = [];
let unsubscribeClaims = null;
let currentView = 'grid';
let currentClaim = null;
let uploadedPhotos = [];

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
        if (data.role !== 'field_officer') {
            alert('Access Denied: This dashboard is only for field officers.');
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
                if (info && (info.role !== 'field_officer' && info.role !== 'all')) {
                    alert('Access Denied: Role mismatch.');
                    window.location.href = 'official_login.html';
                    return;
                }
            } catch (e) {
                console.error('Role verification failed:', e);
            }
        })();
        
        document.getElementById('officialName').textContent = `Welcome back, ${data.username}!`;
        
        const loginTime = new Date(data.loginTime);
        document.getElementById('loginTime').textContent = loginTime.toLocaleTimeString();
        
        initializeFilters();
        initializePhotoUpload();
        initializeDamageSlider();
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

function initializePhotoUpload() {
    const photoInput = document.getElementById('inspectionPhotos');
    if (photoInput) {
        photoInput.addEventListener('change', handlePhotoUpload);
    }
}

function initializeDamageSlider() {
    const damageSlider = document.getElementById('verifiedDamage');
    const damageValue = document.getElementById('verifiedDamageValue');
    
    if (damageSlider && damageValue) {
        damageSlider.addEventListener('input', function() {
            damageValue.textContent = this.value + '%';
        });
    }
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
            if (window.firebaseServices && window.firebaseServices.isInitialized()) {
                resolve();
            } else {
                window.addEventListener('firebaseReady', resolve);
            }
        });

        const { db } = window.firebaseServices;
        if (typeof unsubscribeClaims === 'function') unsubscribeClaims();
        const query = db.collection('claims').where('status', 'in', ['Verified', 'Forwarded to Field Officer', 'forwarded by verifier']);
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
            allClaims = claims;
            populateCropFilter();
            applyFilters();
            updateStats();
        }, (err) => console.error('Field officer listener error:', err));
    } catch (e) {
        console.error('Error setting up field officer listener:', e);
        allClaims = loadLocalClaims();
    }
    
    loadingState.style.display = 'none';
    populateCropFilter();
    applyFilters();
}

function loadLocalClaims() {
    const localClaims = JSON.parse(localStorage.getItem('farmerClaims') || '[]');
    // Only show claims approved by verifier that haven't been inspected yet
    return localClaims.filter(c => 
        c.status === 'Approved' || 
        c.status === 'Forwarded to Field Officer' ||
        c.status === 'forwarded by verifier'
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
    
    const inspectionStatus = claim.fieldInspectionReport ? 
        '<div class="inspection-badge">✓ Inspected</div>' : 
        '<div class="inspection-badge pending">⏳ Pending Inspection</div>';
    
    const documentsHtml = generateDocumentsHtml(claim);
    
    const isPending = claim.status === 'Approved' || claim.status === 'Forwarded to Field Officer' || claim.status === 'forwarded by verifier';
    
    card.innerHTML = `
        <div class="claim-header">
            <div class="claim-id-wrapper">
                <div class="claim-id-label">Claim ID</div>
                <div class="claim-id">${claim.claimId}</div>
            </div>
            <div class="claim-status ${statusClass}">${claim.status}</div>
        </div>
        
        ${inspectionStatus}
        
        <div class="farmer-info">
            <div class="farmer-avatar">👨‍🌾</div>
            <div class="farmer-content">
                <div class="farmer-name">${claim.farmerName}</div>
                <div class="farmer-details">
                    <div class="farmer-detail">
                        <span class="detail-icon">📞</span>
                        <span>${claim.farmerContact || 'N/A'}</span>
                    </div>
                    <div class="farmer-detail">
                        <span class="detail-icon">📅</span>
                        <span>${submittedDate}</span>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="crop-info" onclick="showClaimDetails('${claim.claimId}')">
            <div class="crop-header">
                <div class="crop-type">
                    <span class="crop-icon">🌾</span>
                    <span>${claim.cropType}</span>
                </div>
                <div class="damage-badge">
                    <span class="damage-percent">${claim.damageExtent}%</span>
                    <span class="damage-label">Loss</span>
                </div>
            </div>
            <div class="crop-details">
                <div class="crop-detail">
                    <div class="crop-detail-icon">⚠️</div>
                    <div class="crop-detail-content">
                        <div class="crop-detail-label">Loss Cause</div>
                        <div class="crop-detail-value">${claim.lossCause}</div>
                    </div>
                </div>
                <div class="crop-detail">
                    <div class="crop-detail-icon">📆</div>
                    <div class="crop-detail-content">
                        <div class="crop-detail-label">Date of Loss</div>
                        <div class="crop-detail-value">${formattedDate}</div>
                    </div>
                </div>
            </div>
        </div>
        
        ${documentsHtml}
        
        <div class="action-buttons">
            <button class="action-btn btn-inspect" onclick="openInspectionModal('${claim.claimId}')" ${!isPending ? 'disabled' : ''}>
                <span class="btn-icon">🔍</span>
                <span>Inspect</span>
            </button>
            <button class="action-btn btn-reject" onclick="openRejectModal('${claim.claimId}')" ${!isPending ? 'disabled' : ''}>
                <span class="btn-icon">✗</span>
                <span>Reject</span>
            </button>
            <button class="action-btn btn-details" onclick="showClaimDetails('${claim.claimId}')">
                <span class="btn-icon">👁</span>
                <span>Details</span>
            </button>
        </div>
    `;
    
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
        'rejected': 'status-rejected',
        'Forwarded to Field Officer': 'status-forwarded',
        'forwarded by verifier': 'status-forwarded',
        'Field Inspection Complete': 'status-inspected',
        'Forwarded to Revenue Officer': 'status-forwarded',
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
    const allClaimsForStats = JSON.parse(localStorage.getItem('farmerClaims') || '[]');
    
    const pending = allClaims.length;
    const today = new Date().toDateString();
    const inspected = allClaimsForStats.filter(c => {
        const claimDate = new Date(c.inspectionDate || c.timestamp).toDateString();
        return c.status === 'Field Inspection Complete' && claimDate === today;
    }).length;
    const forwarded = allClaimsForStats.filter(c => c.status === 'Forwarded to Revenue Officer').length;
    const rejected = allClaimsForStats.filter(c => c.status === 'Rejected' && c.rejectedBy === 'Field Officer').length;
    
    document.getElementById('totalPending').textContent = pending;
    document.getElementById('totalInspected').textContent = inspected;
    document.getElementById('totalForwarded').textContent = forwarded;
    document.getElementById('totalRejected').textContent = rejected;
}

function resetFilters() {
    document.getElementById('filterStatus').value = 'Approved';
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
        claimsGrid.classList.add('claims-list');
    } else {
        claimsGrid.classList.remove('claims-list');
    }
}

function openInspectionModal(claimId) {
    currentClaim = allClaims.find(c => c.claimId === claimId);
    if (!currentClaim) return;
    
    const modal = document.getElementById('inspectionModal');
    const claimInfo = document.getElementById('inspectionClaimInfo');
    const originalDamage = document.getElementById('originalDamage');
    const damageSlider = document.getElementById('verifiedDamage');
    
    claimInfo.innerHTML = `
        <div class="inspection-claim-header">
            <h3>${currentClaim.farmerName}</h3>
            <div class="claim-id-badge">${currentClaim.claimId}</div>
        </div>
        <div class="inspection-claim-details">
            <div class="detail-item">
                <strong>Crop:</strong> ${currentClaim.cropType}
            </div>
            <div class="detail-item">
                <strong>Loss Cause:</strong> ${currentClaim.lossCause}
            </div>
            <div class="detail-item">
                <strong>Reported Damage:</strong> ${currentClaim.damageExtent}%
            </div>
        </div>
    `;
    
    originalDamage.textContent = currentClaim.damageExtent;
    damageSlider.value = currentClaim.damageExtent;
    document.getElementById('verifiedDamageValue').textContent = currentClaim.damageExtent + '%';
    
    document.getElementById('inspectionNotes').value = '';
    document.getElementById('inspectionRecommendation').value = 'approve';
    uploadedPhotos = [];
    document.getElementById('photoPreview').innerHTML = '';
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeInspectionModal() {
    const modal = document.getElementById('inspectionModal');
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
    currentClaim = null;
}

function handlePhotoUpload(e) {
    const files = Array.from(e.target.files);
    const photoPreview = document.getElementById('photoPreview');
    
    files.forEach(file => {
        if (file.size > 5 * 1024 * 1024) {
            alert(`File ${file.name} is too large. Maximum size is 5MB.`);
            return;
        }

        const reader = new FileReader();
        reader.onload = function(event) {
            const photoData = {
                name: file.name,
                type: file.type,
                size: file.size,
                data: event.target.result
            };
            
            uploadedPhotos.push(photoData);
            displayPhotoPreview(photoData, uploadedPhotos.length - 1);
        };
        
        reader.readAsDataURL(file);
    });
    
    e.target.value = '';
}

function displayPhotoPreview(photo, index) {
    const photoPreview = document.getElementById('photoPreview');
    
    const previewItem = document.createElement('div');
    previewItem.className = 'photo-preview-item';
    previewItem.style.animation = 'photoFadeIn 0.4s ease';
    
    previewItem.innerHTML = `
        <img src="${photo.data}" alt="${photo.name}">
        <button class="photo-remove" onclick="removePhoto(${index})">&times;</button>
        <div class="photo-name">${photo.name}</div>
    `;
    
    photoPreview.appendChild(previewItem);
}

function removePhoto(index) {
    uploadedPhotos.splice(index, 1);
    const photoPreview = document.getElementById('photoPreview');
    photoPreview.innerHTML = '';
    uploadedPhotos.forEach((photo, idx) => {
        displayPhotoPreview(photo, idx);
    });
}

const inspectionForm = document.getElementById('inspectionForm');
if (inspectionForm) {
    inspectionForm.addEventListener('submit', handleInspectionSubmit);
}

async function handleInspectionSubmit(e) {
    e.preventDefault();
    
    const notes = document.getElementById('inspectionNotes').value.trim();
    const verifiedDamage = document.getElementById('verifiedDamage').value;
    const recommendation = document.getElementById('inspectionRecommendation').value;
    
    if (!notes || notes.length < 20) {
        showError('inspectionNotes', 'Please provide detailed inspection notes (minimum 20 characters)');
        return;
    }
    
    const submitBtn = document.getElementById('submitInspectionBtn');
    submitBtn.disabled = true;
    submitBtn.classList.add('loading');
    
    try {
        const officialData = JSON.parse(localStorage.getItem('officialData'));
        
        const inspectionReport = {
            claimId: currentClaim.claimId,
            inspectionNotes: notes,
            originalDamage: currentClaim.damageExtent,
            verifiedDamage: verifiedDamage,
            recommendation: recommendation,
            inspectionPhotos: uploadedPhotos,
            inspectorName: officialData.username,
            inspectionDate: new Date().toISOString(),
            timestamp: new Date().toISOString()
        };
        
        let newStatus;
        if (recommendation === 'reject') {
            newStatus = 'Rejected';
        } else {
            newStatus = 'Forwarded to Revenue Officer';
        }
        
        const result = await updateClaimWithInspection(currentClaim.claimId, inspectionReport, newStatus);
        
        if (result.success) {
            showSuccessNotification('Inspection report submitted successfully!');
            closeInspectionModal();
            // live listener will refresh
        } else {
            alert(result.message || 'Failed to submit inspection report');
        }
    } catch (error) {
        console.error('Error submitting inspection:', error);
        alert('An error occurred. Please try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');
    }
}

async function updateClaimWithInspection(claimId, inspectionReport, newStatus) {
    try {
        await new Promise((resolve) => {
            if (window.firebaseServices && window.firebaseServices.isInitialized()) { resolve(); } else { window.addEventListener('firebaseReady', resolve); }
        });
        const { db } = window.firebaseServices;
        const claimRef = db.collection('claims').doc(claimId);
        await claimRef.update({
            fieldReport: {
                notes: inspectionReport.inspectionNotes,
                photoURLs: (inspectionReport.inspectionPhotos || []).map(p => p.data),
                originalDamage: inspectionReport.originalDamage,
                verifiedDamage: inspectionReport.verifiedDamage,
                inspectorName: inspectionReport.inspectorName,
                inspectionDate: new Date().toISOString()
            },
            status: newStatus === 'Rejected' ? 'Rejected' : 'Field Verified',
            forwardedTo: newStatus === 'Rejected' ? null : 'Revenue Officer',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            statusHistory: firebase.firestore.FieldValue.arrayUnion({
                stage: 'Field Officer',
                status: newStatus === 'Rejected' ? 'Rejected' : 'Field Verified',
                timestamp: new Date().toISOString()
            })
        });
        return { success: true };
    } catch (error) {
        console.error('Error updating claim in Firestore:', error);
        return { success: false, message: error.message };
    }
}

function updateLocalClaim(claimId, inspectionReport, newStatus) {
    const claims = JSON.parse(localStorage.getItem('farmerClaims') || '[]');
    const claimIndex = claims.findIndex(c => c.claimId === claimId);
    
    if (claimIndex !== -1) {
        claims[claimIndex].fieldInspectionReport = inspectionReport.inspectionNotes;
        claims[claimIndex].verifiedDamage = inspectionReport.verifiedDamage;
        claims[claimIndex].inspectionPhotos = inspectionReport.inspectionPhotos;
        claims[claimIndex].inspectorName = inspectionReport.inspectorName;
        claims[claimIndex].inspectionDate = inspectionReport.inspectionDate;
        claims[claimIndex].fieldInspectionDate = inspectionReport.inspectionDate;
        claims[claimIndex].status = newStatus;
        localStorage.setItem('farmerClaims', JSON.stringify(claims));
    }
}

function openRejectModal(claimId) {
    currentClaim = allClaims.find(c => c.claimId === claimId);
    if (!currentClaim) return;
    
    const modal = document.getElementById('rejectModal');
    const summary = document.getElementById('rejectClaimSummary');
    
    summary.innerHTML = `
        <div class="summary-item"><strong>Claim ID:</strong> ${currentClaim.claimId}</div>
        <div class="summary-item"><strong>Farmer:</strong> ${currentClaim.farmerName}</div>
        <div class="summary-item"><strong>Crop:</strong> ${currentClaim.cropType}</div>
    `;
    
    document.getElementById('rejectionReason').value = '';
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeRejectModal() {
    const modal = document.getElementById('rejectModal');
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
    currentClaim = null;
}

async function confirmReject() {
    const reason = document.getElementById('rejectionReason').value.trim();
    
    if (!reason || reason.length < 10) {
        showError('rejectionReason', 'Please provide a detailed rejection reason (minimum 10 characters)');
        return;
    }
    
    const confirmBtn = document.getElementById('confirmRejectBtn');
    confirmBtn.disabled = true;
    confirmBtn.classList.add('loading');
    
    try {
        const officialData = JSON.parse(localStorage.getItem('officialData'));
        
        const rejectionData = {
            claimId: currentClaim.claimId,
            rejectionReason: reason,
            rejectedBy: 'Field Officer',
            rejectorName: officialData.username,
            rejectionDate: new Date().toISOString()
        };
        
        const result = await updateClaimWithInspection(currentClaim.claimId, rejectionData, 'Rejected');
        
        if (result.success) {
            showSuccessNotification('Claim rejected successfully');
            closeRejectModal();
            // live listener will refresh
        } else {
            alert(result.message || 'Failed to reject claim');
        }
    } catch (error) {
        console.error('Error rejecting claim:', error);
        alert('An error occurred. Please try again.');
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.classList.remove('loading');
    }
}

function showClaimDetails(claimId) {
    const claim = allClaims.find(c => c.claimId === claimId);
    if (!claim) return;
    
    const modal = document.getElementById('detailsModal');
    const modalBody = document.getElementById('detailsModalBody');
    
    const documentsHtml = claim.files && claim.files.length > 0 ? 
        `<div class="details-section">
            <h4>Submitted Documents</h4>
            <div class="details-documents">
                ${claim.files.map(f => `
                    <div class="detail-document">
                        ${f.type && f.type.startsWith('image/') ? 
                            `<img src="${f.data}" alt="${f.name}">` : 
                            `<div class="doc-icon">📄</div>`
                        }
                        <div class="doc-name">${f.name}</div>
                    </div>
                `).join('')}
            </div>
        </div>` : '';
    
    const inspectionHtml = claim.fieldInspectionReport ? 
        `<div class="details-section inspection-section">
            <h4>Field Inspection Report</h4>
            <div class="inspection-details">
                <p><strong>Inspector:</strong> ${claim.fieldInspectionReport.inspectorName}</p>
                <p><strong>Date:</strong> ${formatDate(claim.fieldInspectionReport.inspectionDate)}</p>
                <p><strong>Notes:</strong> ${claim.fieldInspectionReport.inspectionNotes}</p>
                <p><strong>Verified Damage:</strong> ${claim.fieldInspectionReport.verifiedDamage}%</p>
            </div>
        </div>` : '';
    
    modalBody.innerHTML = `
        <div class="claim-details-content">
            <div class="details-section">
                <h4>Farmer Information</h4>
                <p><strong>Name:</strong> ${claim.farmerName}</p>
                <p><strong>Contact:</strong> ${claim.farmerContact}</p>
                <p><strong>Claim ID:</strong> ${claim.claimId}</p>
            </div>
            
            <div class="details-section">
                <h4>Crop Loss Details</h4>
                <p><strong>Crop Type:</strong> ${claim.cropType}</p>
                <p><strong>Loss Cause:</strong> ${claim.lossCause}</p>
                <p><strong>Date of Loss:</strong> ${formatDate(claim.lossDate)}</p>
                <p><strong>Damage Extent:</strong> ${claim.damageExtent}%</p>
                <p><strong>Description:</strong> ${claim.description || 'N/A'}</p>
            </div>
            
            ${documentsHtml}
            ${inspectionHtml}
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

function showError(fieldId, message) {
    const errorElement = document.getElementById(`${fieldId}Error`);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.classList.add('show');
        
        setTimeout(() => {
            errorElement.classList.remove('show');
        }, 5000);
    }
}

function showSuccessNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'success-notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function toggleQuickStats() {
    alert('Quick stats feature - Shows summary of today\'s inspections');
}
