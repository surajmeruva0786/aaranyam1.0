// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCUKj4HvHtw_hclzgkzbDKSmD7KSQvhvRs",
    authDomain: "aaranyam-agriclaim.firebaseapp.com",
    projectId: "aaranyam-agriclaim",
    storageBucket: "aaranyam-agriclaim.firebasestorage.app",
    messagingSenderId: "227815560553",
    appId: "1:227815560553:web:364f10aca788cc8db599f8",
    measurementId: "G-CWSWKJ7YZL"
  };
  
// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase services (free plan - no storage)
const auth = firebase.auth();
const db = firebase.firestore();
// const storage = firebase.storage(); // Not available on free plan

// Firebase initialization status
let firebaseInitialized = false;

// Initialize Firebase with loading animation
async function initializeFirebase() {
    try {
        // Show loading animation
        showFirebaseLoading();
        
        // Wait for Firebase to be ready
        await new Promise((resolve) => {
            const checkFirebase = () => {
                if (firebase.apps.length > 0) {
                    resolve();
                } else {
                    setTimeout(checkFirebase, 100);
                }
            };
            checkFirebase();
        });
        
        // Additional initialization delay for smooth animation
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        firebaseInitialized = true;
        hideFirebaseLoading();
        
        console.log('Firebase initialized successfully');
        console.log('Firebase services available:', {
            auth: auth,
            db: db,
            isInitialized: firebaseInitialized
        });
        
        // Dispatch custom event for other scripts to listen
        window.dispatchEvent(new CustomEvent('firebaseReady'));
        showConnectedIndicator();
        
    } catch (error) {
        console.error('Firebase initialization failed:', error);
        hideFirebaseLoading();
        showFirebaseError();
    }
}

// Show Firebase loading animation
function showFirebaseLoading() {
    // Create loading overlay
    const loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'firebase-loading-overlay';
    loadingOverlay.innerHTML = `
        <div class="firebase-loading-container">
            <div class="firebase-loading-spinner">
                <div class="spinner-ring"></div>
                <div class="spinner-ring"></div>
                <div class="spinner-ring"></div>
            </div>
            <div class="firebase-loading-text">
                <h3>Initializing AgriClaim</h3>
                <p>Setting up secure connection...</p>
            </div>
            <div class="firebase-loading-progress">
                <div class="progress-bar"></div>
            </div>
        </div>
    `;
    
    document.body.appendChild(loadingOverlay);
    
    // Add CSS for loading animation
    const style = document.createElement('style');
    style.textContent = `
        #firebase-loading-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        .firebase-loading-container {
            text-align: center;
            color: white;
            max-width: 400px;
            padding: 2rem;
        }
        
        .firebase-loading-spinner {
            position: relative;
            width: 80px;
            height: 80px;
            margin: 0 auto 2rem;
        }
        
        .spinner-ring {
            position: absolute;
            width: 100%;
            height: 100%;
            border: 3px solid transparent;
            border-top: 3px solid #43e97b;
            border-radius: 50%;
            animation: spin 1.5s linear infinite;
        }
        
        .spinner-ring:nth-child(2) {
            width: 60px;
            height: 60px;
            top: 10px;
            left: 10px;
            border-top-color: #38f9d7;
            animation-duration: 1.2s;
            animation-direction: reverse;
        }
        
        .spinner-ring:nth-child(3) {
            width: 40px;
            height: 40px;
            top: 20px;
            left: 20px;
            border-top-color: #4facfe;
            animation-duration: 0.8s;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .firebase-loading-text h3 {
            font-size: 1.5rem;
            margin: 0 0 0.5rem 0;
            font-weight: 600;
            background: linear-gradient(45deg, #43e97b, #38f9d7);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        .firebase-loading-text p {
            font-size: 1rem;
            margin: 0 0 2rem 0;
            opacity: 0.9;
        }
        
        .firebase-loading-progress {
            width: 100%;
            height: 4px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 2px;
            overflow: hidden;
        }
        
        .progress-bar {
            height: 100%;
            background: linear-gradient(90deg, #43e97b, #38f9d7, #4facfe);
            border-radius: 2px;
            animation: progress 2s ease-in-out infinite;
        }
        
        @keyframes progress {
            0% { width: 0%; }
            50% { width: 70%; }
            100% { width: 100%; }
        }
        
        .firebase-loading-container {
            animation: fadeInUp 0.6s ease-out;
        }
        
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
    `;
    document.head.appendChild(style);
}

// Hide Firebase loading animation
function hideFirebaseLoading() {
    const overlay = document.getElementById('firebase-loading-overlay');
    if (overlay) {
        overlay.style.animation = 'fadeOut 0.5s ease-out forwards';
        setTimeout(() => {
            overlay.remove();
        }, 500);
    }
}

// Show Firebase error
function showFirebaseError() {
    const errorDiv = document.createElement('div');
    errorDiv.innerHTML = `
        <div style="
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff4757;
            color: white;
            padding: 1rem;
            border-radius: 8px;
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        ">
            <strong>Connection Error:</strong> Failed to initialize Firebase. Please refresh the page.
        </div>
    `;
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

// Connected indicator
function showConnectedIndicator() {
    const existing = document.getElementById('firebase-connected-indicator');
    if (existing) return;
    const el = document.createElement('div');
    el.id = 'firebase-connected-indicator';
    el.innerHTML = `
        <div class="connected-indicator">
            <div class="pulse"></div>
            <span>Connected</span>
        </div>
    `;
    const style = document.createElement('style');
    style.textContent = `
        .connected-indicator { position: fixed; bottom: 16px; right: 16px; z-index: 9999; background: rgba(15,23,42,0.85); color: #e2e8f0; padding: 8px 12px; border-radius: 999px; display: flex; gap: 8px; align-items: center; box-shadow: 0 8px 24px rgba(0,0,0,0.25); backdrop-filter: blur(6px); font-size: 12px; }
        .connected-indicator .pulse { width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 0 0 rgba(16,185,129,0.7); animation: pulseGlow 1.8s infinite; }
        @keyframes pulseGlow { 0% { box-shadow: 0 0 0 0 rgba(16,185,129,0.7); } 70% { box-shadow: 0 0 0 12px rgba(16,185,129,0); } 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); } }
    `;
    document.head.appendChild(style);
    document.body.appendChild(el);
}

// Add fadeOut animation to CSS
const fadeOutStyle = document.createElement('style');
fadeOutStyle.textContent = `
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
`;
document.head.appendChild(fadeOutStyle);

// Initialize Firebase when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeFirebase);
} else {
    initializeFirebase();
}

// Export Firebase services for use in other scripts
window.firebaseServices = {
    auth: auth,
    db: db,
    // storage: storage, // Not available on free plan
    isInitialized: () => firebaseInitialized
};
