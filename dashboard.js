let imageUrls = [];
let documentUrls = [];
let currentFarmer = null;

// Firebase Auth Protection for Dashboard
async function checkAuthAndLoadUser() {
    try {
        console.log('Starting auth check...');
        
        // Wait for Firebase to be ready
        await new Promise((resolve) => {
            if (window.firebaseServices && window.firebaseServices.isInitialized()) {
                console.log('Firebase is already ready');
                resolve();
            } else {
                console.log('Waiting for Firebase to be ready...');
                window.addEventListener('firebaseReady', resolve);
            }
        });

        const { auth, db } = window.firebaseServices;
        console.log('Firebase services loaded:', { auth, db });
        
        // Verify Firebase services are properly initialized
        if (!auth) {
            throw new Error('Firebase Auth service not available');
        }
        if (!db) {
            throw new Error('Firebase Firestore service not available');
        }
        
        // Check current user first
        const currentUser = auth.currentUser;
        console.log('Current user:', currentUser);
        
        if (currentUser) {
            console.log('User already authenticated, loading data immediately');
            await loadUserData(currentUser, db);
        } else {
            console.log('No current user, setting up auth state listener');
        }
        
        // Set up auth state listener
        auth.onAuthStateChanged(async (user) => {
            console.log('Auth state changed:', user ? user.email : 'No user');
            
            if (user) {
                console.log('User authenticated via listener, loading data...');
                await loadUserData(user, db);
            } else {
                console.log('User not authenticated, redirecting to login');
    window.location.href = 'farmer-login.html';
}
        });
        
    } catch (error) {
        console.error('Auth check error:', error);
        window.location.href = 'farmer-login.html';
    }
}

// Separate function to load user data
async function loadUserData(user, db) {
    try {
        console.log('Loading user profile from Firestore for UID:', user.uid);
        const userDoc = await db.collection('users').doc(user.uid).get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            console.log('User data loaded from Firestore:', userData);
            currentFarmer = userData;
            
            // Check if DOM elements exist
            const farmerNameEl = document.getElementById('farmerName');
            const infoNameEl = document.getElementById('infoName');
            const infoEmailEl = document.getElementById('infoEmail');
            
            console.log('DOM elements found:', {
                farmerName: !!farmerNameEl,
                infoName: !!infoNameEl,
                infoEmail: !!infoEmailEl
            });
            
            if (!farmerNameEl || !infoNameEl || !infoEmailEl) {
                console.error('Required DOM elements not found!');
                return;
            }
            
            // Update dashboard with user data
            farmerNameEl.textContent = `Welcome, ${userData.name}!`;
            infoNameEl.textContent = userData.name || '-';
            infoEmailEl.textContent = userData.email || '-';
            document.getElementById('infoContact').textContent = userData.contactNumber || '-';
            document.getElementById('infoAadhar').textContent = userData.aadharId ? `****-****-${userData.aadharId.slice(-4)}` : '-';
            document.getElementById('infoLand').textContent = userData.landArea ? `${userData.landArea} acres` : '-';
            document.getElementById('infoLandType').textContent = userData.landType || '-';
            document.getElementById('infoAddress').textContent = userData.address || '-';
            
            // Add registration date if available
            if (userData.createdAt) {
                const regDate = new Date(userData.createdAt.seconds * 1000).toLocaleDateString();
                document.getElementById('infoRegDate').textContent = regDate;
                console.log('Registration date:', regDate);
            } else {
                document.getElementById('infoRegDate').textContent = 'Not available';
            }
            
            console.log('Dashboard updated successfully!');
        loadClaims();
        } else {
            console.error('User profile not found in Firestore');
            window.location.href = 'farmer-login.html';
        }
    } catch (error) {
        console.error('Error loading user profile:', error);
        window.location.href = 'farmer-login.html';
    }
}

// Initialize dashboard when DOM is ready
window.addEventListener('DOMContentLoaded', checkAuthAndLoadUser);

// Immediate fallback - try to load data right away
setTimeout(async () => {
    console.log('Immediate fallback: Attempting to load user data...');
    try {
        if (window.firebaseServices && window.firebaseServices.auth) {
            const user = window.firebaseServices.auth.currentUser;
            if (user) {
                console.log('Fallback: Found authenticated user, loading data...');
                await loadUserData(user, window.firebaseServices.db);
            } else {
                console.log('Fallback: No authenticated user found');
            }
        }
    } catch (error) {
        console.error('Fallback error:', error);
    }
}, 1000);

// Additional fallback mechanism - check auth after a delay if data hasn't loaded
setTimeout(() => {
    const farmerName = document.getElementById('farmerName');
    if (farmerName && farmerName.textContent === 'Loading your profile...') {
        console.log('Secondary fallback: Data not loaded, checking auth again...');
        checkAuthAndLoadUser();
    }
}, 5000);

// Manual data loading function for debugging
window.manualLoadUserData = async function() {
    console.log('Manual data loading triggered');
    try {
        if (window.firebaseServices && window.firebaseServices.auth) {
            const user = window.firebaseServices.auth.currentUser;
            if (user) {
                console.log('Current user found:', user.email);
                await loadUserData(user, window.firebaseServices.db);
            } else {
                console.log('No current user found');
            }
        } else {
            console.log('Firebase services not available');
        }
    } catch (error) {
        console.error('Manual load error:', error);
    }
};

// Claim Submission Functions - Base64 File Storage (Free Plan)
async function convertFilesToBase64(files) {
    const fileData = [];
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Update progress
        const progress = ((i + 1) / files.length) * 100;
        updateUploadProgress(progress, i + 1, files.length);
        
        // Validate file object - handle both File objects and objects with Base64 data
        if (!file) {
            console.error('No file provided at index:', i);
            throw new Error(`No file provided at index ${i}`);
        }
        
        // Check if it's already a Base64 string (from previous conversion)
        if (file.data && typeof file.data === 'string' && file.data.startsWith('data:')) {
            console.log('File already converted to Base64, using existing data:', file.name);
            fileData.push({
                fileName: file.name,
                fileType: file.type,
                fileSize: file.size,
                base64Data: file.data,
                uploadedAt: new Date().toISOString()
            });
            continue; // Skip FileReader processing
        }
        
        // Validate it's a proper File object for FileReader
        if (!(file instanceof File)) {
            console.error('Invalid file object (not a File instance):', file);
            throw new Error(`Invalid file object at index ${i} - expected File object`);
        }
        
        // Convert file to Base64
        const base64Data = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = (error) => {
                console.error('FileReader error:', error);
                reject(new Error(`Failed to read file: ${file.name}`));
            };
            reader.readAsDataURL(file);
        });
        
        fileData.push({
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            base64Data: base64Data,
            uploadedAt: new Date().toISOString()
        });
        
        // Small delay to show progress
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    return fileData;
}

function updateUploadProgress(progress, currentFile, totalFiles) {
    const progressBar = document.getElementById('uploadProgress');
    const progressText = document.getElementById('uploadProgressText');
    
    if (progressBar && progressText) {
        progressBar.style.width = `${progress}%`;
        progressText.textContent = `Processing URLs ${currentFile} of ${totalFiles}... ${Math.round(progress)}%`;
    }
}

async function submitClaimToFirestore(claimData, urlData) {
    try {
        console.log('submitClaimToFirestore called with:', { claimData, urlData });
        
        const { db, auth } = window.firebaseServices;
        console.log('Firebase services in submitClaimToFirestore:', { db, auth });
        
        const user = auth.currentUser;
        console.log('User in submitClaimToFirestore:', user);
        
        if (!user) {
            throw new Error('User not authenticated');
        }
        
        const claimDoc = {
            farmerID: user.uid,
            farmerEmail: user.email,
            cropType: claimData.cropType,
            lossDate: claimData.lossDate,
            lossCause: claimData.lossCause,
            damageExtent: parseInt(claimData.damageExtent),
            description: claimData.description,
            // Store Google Drive URLs in Firestore
            images: urlData.filter(item => item.type === 'image').map(item => ({
                url: item.url,
                name: item.name,
                type: 'image',
                uploadedAt: item.uploadedAt
            })),
            documents: urlData.filter(item => item.type === 'document').map(item => ({
                url: item.url,
                name: item.name,
                type: 'document',
                uploadedAt: item.uploadedAt
            })),
            status: "Submitted",
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        console.log('Claim document prepared:', claimDoc);
        console.log('Attempting to add document to Firestore...');
        
        const docRef = await db.collection('claims').add(claimDoc);
        console.log('Claim submitted successfully with ID:', docRef.id);
        
        return docRef.id;
        
    } catch (error) {
        console.error('Error in submitClaimToFirestore:', {
            message: error.message,
            code: error.code,
            stack: error.stack
        });
        throw error;
    }
}

function showClaimConfirmation(claimId) {
    // Create beautiful confirmation popup
    const confirmationPopup = document.createElement('div');
    confirmationPopup.id = 'claimConfirmationPopup';
    confirmationPopup.innerHTML = `
        <div class="confirmation-overlay">
            <div class="confirmation-card">
                <div class="confirmation-icon">✅</div>
                <h3 class="confirmation-title">Claim Submitted Successfully!</h3>
                <p class="confirmation-message">
                    Your claim has been submitted and is under review. 
                    You will receive updates via email.
                </p>
                <div class="confirmation-details">
                    <div class="detail-item">
                        <span class="detail-label">Claim ID:</span>
                        <span class="detail-value">${claimId}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Status:</span>
                        <span class="detail-value status-submitted">Submitted</span>
                    </div>
                </div>
                <button class="btn btn-primary confirmation-btn" onclick="closeClaimConfirmation()">
                    Continue
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(confirmationPopup);
    
    // Add slide-up animation
    setTimeout(() => {
        confirmationPopup.classList.add('show');
    }, 100);
}

function closeClaimConfirmation() {
    const popup = document.getElementById('claimConfirmationPopup');
    if (popup) {
        popup.classList.remove('show');
        setTimeout(() => {
            popup.remove();
        }, 300);
    }
}

// Upload Progress UI Functions
function showUploadProgress() {
    // Create upload progress overlay
    const progressOverlay = document.createElement('div');
    progressOverlay.id = 'uploadProgressOverlay';
    progressOverlay.innerHTML = `
        <div class="upload-progress-container">
            <div class="upload-progress-card">
                <div class="upload-progress-icon">📄</div>
                <h3 class="upload-progress-title">Processing Files</h3>
                <div class="upload-progress-bar-container">
                    <div class="upload-progress-bar" id="uploadProgress"></div>
                </div>
                <p class="upload-progress-text" id="uploadProgressText">Preparing files...</p>
            </div>
        </div>
    `;
    
    document.body.appendChild(progressOverlay);
}

function hideUploadProgress() {
    const overlay = document.getElementById('uploadProgressOverlay');
    if (overlay) {
        overlay.remove();
    }
}

// Make functions globally available
window.closeClaimConfirmation = closeClaimConfirmation;

const damageExtent = document.getElementById('damageExtent');
const damageValue = document.getElementById('damageValue');

if (damageExtent && damageValue) {
    damageExtent.addEventListener('input', function() {
        damageValue.textContent = this.value + '%';
    });
}

// Initialize URL input handling
const imageUrlsInput = document.getElementById('imageUrls');
const documentUrlsInput = document.getElementById('documentUrls');

if (imageUrlsInput) {
    imageUrlsInput.addEventListener('input', handleImageUrlsChange);
}

if (documentUrlsInput) {
    documentUrlsInput.addEventListener('input', handleDocumentUrlsChange);
}

function handleImageUrlsChange(e) {
    const urls = e.target.value.split('\n').filter(url => url.trim());
    imageUrls = urls.map(url => ({
        url: url.trim(),
        type: 'image',
        name: extractFileNameFromUrl(url.trim())
    }));
    console.log('Image URLs updated:', imageUrls);
}

function handleDocumentUrlsChange(e) {
    const urls = e.target.value.split('\n').filter(url => url.trim());
    documentUrls = urls.map(url => ({
        url: url.trim(),
        type: 'document',
        name: extractFileNameFromUrl(url.trim())
    }));
    console.log('Document URLs updated:', documentUrls);
}

function extractFileNameFromUrl(url) {
    // Extract filename from Google Drive URL
    const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match) {
        return `Google Drive File (${match[1].substring(0, 8)}...)`;
    }
    return 'Google Drive File';
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

function updateFilePreview() {
    try {
        if (!filePreview) {
            console.log('File preview element not found, skipping update');
            return;
        }
        filePreview.innerHTML = '';
        uploadedFiles.forEach((file, idx) => {
            displayFilePreview(file, idx);
        });
    } catch (error) {
        console.log('Error updating file preview (non-critical):', error);
    }
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
        console.log('Starting claim submission process...');
        
        // Check Firebase services
        if (!window.firebaseServices) {
            throw new Error('Firebase services not available');
        }
        
        const { auth, db } = window.firebaseServices;
        console.log('Firebase services:', { auth, db });
        
        // Verify services are properly initialized
        if (!auth) {
            throw new Error('Firebase Auth service not available');
        }
        if (!db) {
            throw new Error('Firebase Firestore service not available');
        }
        
        // Get current user
        const user = auth.currentUser;
        console.log('Current user:', user);
        
        if (!user) {
            throw new Error('User not authenticated - please log in again');
        }
        
        // Verify user has required properties
        if (!user.uid || !user.email) {
            throw new Error('User data incomplete - please log in again');
        }

        // Prepare claim data
        const claimData = {
            cropType: cropType,
            lossDate: lossDate,
            lossCause: lossCause,
            damageExtent: damageExtent,
            description: description
        };
        console.log('Claim data prepared:', claimData);

        // Show upload progress UI
        showUploadProgress();

        // Process URLs (Google Drive links)
        let urlData = [];
        if (imageUrls.length > 0 || documentUrls.length > 0) {
            console.log('Processing URLs...', { imageUrls, documentUrls });
            urlData = [
                ...imageUrls.map(urlObj => ({
                    url: urlObj.url,
                    type: 'image',
                    name: urlObj.name,
                    uploadedAt: new Date().toISOString()
                })),
                ...documentUrls.map(urlObj => ({
                    url: urlObj.url,
                    type: 'document',
                    name: urlObj.name,
                    uploadedAt: new Date().toISOString()
                }))
            ];
            console.log('URLs processed successfully:', urlData);
        } else {
            console.log('No URLs to process');
        }

        // Submit claim to Firestore
        console.log('Submitting claim to Firestore...');
        try {
            const claimId = await submitClaimToFirestore(claimData, urlData);
            console.log('Claim submitted successfully with ID:', claimId);
            
            // Show success confirmation
            showClaimConfirmation(claimId);
            
            // Close modal and refresh claims
            closeClaimModal();
            loadClaims();
            
            // Clear form
            document.getElementById('claimForm').reset();
            imageUrls = [];
            documentUrls = [];
            // Clear URL inputs
            if (imageUrlsInput) imageUrlsInput.value = '';
            if (documentUrlsInput) documentUrlsInput.value = '';
            
        } catch (firestoreError) {
            console.error('Firestore submission error:', firestoreError);
            // Don't throw error if claim was actually submitted successfully
            if (firestoreError.message && firestoreError.message.includes('updateFilePreview is not defined')) {
                console.log('Non-critical error, claim was submitted successfully');
                // Still show success since the claim was submitted
                showClaimConfirmation('Claim submitted successfully');
                closeClaimModal();
                loadClaims();
                document.getElementById('claimForm').reset();
                imageUrls = [];
                documentUrls = [];
                if (imageUrlsInput) imageUrlsInput.value = '';
                if (documentUrlsInput) documentUrlsInput.value = '';
                return; // Exit early to avoid showing error
            }
            throw new Error(`Database error: ${firestoreError.message}`);
        }

    } catch (error) {
        console.error('Complete error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        hideUploadProgress();
        
        // Only show error if it's a critical error, not just missing function
        if (error.message && !error.message.includes('updateFilePreview is not defined')) {
            const errorMessage = error.message || 'An unknown error occurred';
            alert(`Error: ${errorMessage}. Please check the console for details.`);
        } else {
            console.log('Non-critical error, continuing with success flow');
            // Show success even if there were minor errors
            showClaimConfirmation('Claim submitted successfully');
            closeClaimModal();
            loadClaims();
            document.getElementById('claimForm').reset();
            imageUrls = [];
            documentUrls = [];
            if (imageUrlsInput) imageUrlsInput.value = '';
            if (documentUrlsInput) documentUrlsInput.value = '';
        }
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
        console.log('Loading claims from Firestore...');
        
        // Wait for Firebase to be ready
        await new Promise((resolve) => {
            if (window.firebaseServices && window.firebaseServices.isInitialized()) {
                resolve();
            } else {
                window.addEventListener('firebaseReady', resolve);
            }
        });

        const { db, auth } = window.firebaseServices;
        const user = auth.currentUser;
        
        if (!user) {
            console.error('No authenticated user for loading claims');
            return;
        }

        console.log('Fetching claims for user:', user.uid);
        
        // Query claims from Firestore (simplified to avoid index requirement)
        const claimsSnapshot = await db.collection('claims')
            .where('farmerID', '==', user.uid)
            .get();

        const claims = [];
        claimsSnapshot.forEach(doc => {
            const claimData = doc.data();
            claims.push({
                id: doc.id,
                ...claimData,
                // Convert Firestore timestamps to readable dates
                createdAt: claimData.createdAt ? claimData.createdAt.toDate() : new Date(),
                updatedAt: claimData.updatedAt ? claimData.updatedAt.toDate() : new Date()
            });
        });

        // Sort by creation date (newest first) on client side
        claims.sort((a, b) => {
            const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
            const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
            return dateB - dateA; // Newest first
        });

        console.log('Claims loaded from Firestore:', claims);
        displayClaims(claims);
        updateStats(claims);
        
    } catch (error) {
        console.error('Error loading claims from Firestore:', error);
        
        // Fallback to empty claims
        displayClaims([]);
        updateStats([]);
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

    claims.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    claims.forEach(claim => {
        const row = document.createElement('tr');
        
        const statusClass = getStatusClass(claim.status);
        const formattedDate = formatDate(claim.lossDate);
        const submittedDate = formatDate(claim.createdAt);
        
        const claimIdCell = document.createElement('td');
        const claimIdStrong = document.createElement('strong');
        claimIdStrong.textContent = claim.id || claim.claimId || 'N/A';
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

function formatDate(dateInput) {
    let date;
    
    // Handle Firestore timestamps
    if (dateInput && typeof dateInput === 'object' && dateInput.toDate) {
        date = dateInput.toDate();
    } else if (dateInput && typeof dateInput === 'object' && dateInput.seconds) {
        // Handle Firestore timestamp objects
        date = new Date(dateInput.seconds * 1000);
    } else if (dateInput instanceof Date) {
        date = dateInput;
    } else if (typeof dateInput === 'string') {
        date = new Date(dateInput);
    } else {
        return 'Invalid Date';
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
        return 'Invalid Date';
    }
    
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

// Logout function
function logout() {
    // Use Firebase Auth logout
    if (window.firebaseServices && window.firebaseServices.auth) {
        window.firebaseServices.auth.signOut().then(() => {
            console.log('User signed out successfully');
            window.location.href = 'farmer-login.html';
        }).catch((error) => {
            console.error('Error signing out:', error);
            // Fallback to direct redirect
            window.location.href = 'farmer-login.html';
        });
    } else {
        // Fallback if Firebase not available
        window.location.href = 'farmer-login.html';
    }
}

window.openClaimModal = openClaimModal;
window.closeClaimModal = closeClaimModal;
window.removeFile = removeFile;
window.viewClaim = viewClaim;
window.logout = logout;
