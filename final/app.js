// Application State
let currentMode = 'image';
let detectionHistory = [];
let cameraStream = null;
let currentFacingMode = 'user'; // 'user' for front camera, 'environment' for back camera

// DOM Elements
const modeBtns = document.querySelectorAll('.mode-btn');
const uploadTitle = document.getElementById('uploadTitle');
const uploadFormats = document.getElementById('uploadFormats');
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const cameraContainer = document.getElementById('cameraContainer');
const activateCameraBtn = document.getElementById('activateCameraBtn');
const cameraVideo = document.getElementById('cameraVideo');
const captureBtn = document.getElementById('captureBtn');
const flipCameraBtn = document.getElementById('flipCameraBtn');
const stopCameraBtn = document.getElementById('stopCameraBtn');
const cameraError = document.getElementById('cameraError');
const errorMessage = document.getElementById('errorMessage');
const retryBtn = document.getElementById('retryBtn');
const cameraStatus = document.querySelector('.camera-status');

const noAnalysis = document.getElementById('noAnalysis');
const analyzingState = document.getElementById('analyzingState');
const resultsCard = document.getElementById('resultsCard');
const confidenceFill = document.getElementById('confidenceFill');
const confidenceLabel = document.getElementById('confidenceLabel');

const resultBadge = document.getElementById('resultBadge');
const confidenceValue = document.getElementById('confidenceValue');
const processingTime = document.getElementById('processingTime');
const frameCount = document.getElementById('frameCount');
const frameCountContainer = document.getElementById('frameCountContainer');

const featureAnalysis = document.getElementById('featureAnalysis');
const historyContainer = document.getElementById('historyContainer');

// Mode Configuration
const modeConfig = {
    image: {
        title: 'Upload Image for Analysis',
        formats: 'Supports: JPG, PNG, WEBP',
        accept: '.jpg,.jpeg,.png,.webp'
    },
    video: {
        title: 'Upload Video for Analysis',
        formats: 'Supports: MP4, AVI, MOV',
        accept: '.mp4,.avi,.mov'
    },
    camera: {
        title: 'Click for Live Camera',
        formats: 'Real-time deepfake detection',
        accept: null
    }
};

// Initialize App
function init() {
    setupModeButtons();
    setupFileUpload();
    setupCamera();
    updateMode('image');
}

// Setup Mode Selection Buttons
function setupModeButtons() {
    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.mode;
            modeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updateMode(mode);
        });
    });
}

// Update Mode
function updateMode(mode) {
    currentMode = mode;
    const config = modeConfig[mode];
    
    uploadTitle.textContent = config.title;
    uploadFormats.textContent = config.formats;
    
    // Stop any active camera stream
    stopCamera();
    
    // Reset UI
    if (mode === 'camera') {
        dropzone.style.display = 'none';
        activateCameraBtn.style.display = 'flex';
        cameraContainer.style.display = 'none';
    } else {
        dropzone.style.display = 'flex';
        activateCameraBtn.style.display = 'none';
        cameraContainer.style.display = 'none';
        fileInput.accept = config.accept;
    }
}

// Setup File Upload
function setupFileUpload() {
    // Click to upload
    dropzone.addEventListener('click', () => {
        if (currentMode !== 'camera') {
            fileInput.click();
        }
    });
    
    // File input change
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handleFileUpload(file);
        }
    });
    
    // Drag and drop
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('drag-over');
    });
    
    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('drag-over');
    });
    
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-over');
        
        const file = e.dataTransfer.files[0];
        if (file) {
            handleFileUpload(file);
        }
    });
}

// Handle File Upload
function handleFileUpload(file) {
    // Validate file type
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    
    if ((currentMode === 'image' && !isImage) || (currentMode === 'video' && !isVideo)) {
        alert('Please upload a valid file type for the selected mode.');
        return;
    }
    
    // Start analysis
    analyzeContent(currentMode, file.name);
}

// Setup Camera
function setupCamera() {
    activateCameraBtn.addEventListener('click', startCamera);
    captureBtn.addEventListener('click', captureFrame);
    flipCameraBtn.addEventListener('click', flipCamera);
    stopCameraBtn.addEventListener('click', stopCameraAndReset);
    retryBtn.addEventListener('click', () => {
        cameraError.style.display = 'none';
        startCamera();
    });
}

// Start Camera
async function startCamera() {
    // Hide error if showing
    cameraError.style.display = 'none';
    
    // Check if getUserMedia is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showCameraError('Camera not supported in this browser. Please use a modern browser like Chrome, Firefox, or Safari.');
        return;
    }
    
    try {
        // Show loading state
        activateCameraBtn.innerHTML = '<span class="camera-icon">⏳</span><span>Requesting camera access...</span>';
        activateCameraBtn.disabled = true;
        
        const constraints = {
            video: {
                facingMode: currentFacingMode,
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        };
        
        cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // Set video source
        cameraVideo.srcObject = cameraStream;
        
        // Ensure video element is visible
        cameraVideo.style.display = 'block';
        
        // Wait for video to be ready and start playing
        await new Promise((resolve, reject) => {
            cameraVideo.onloadedmetadata = async () => {
                try {
                    await cameraVideo.play();
                    resolve();
                } catch (err) {
                    console.error('Error playing video:', err);
                    reject(err);
                }
            };
            
            // Timeout after 5 seconds
            setTimeout(() => reject(new Error('Video load timeout')), 5000);
        });
        
        // Hide activate button and show camera
        activateCameraBtn.style.display = 'none';
        activateCameraBtn.disabled = false;
        activateCameraBtn.innerHTML = '<span class="camera-icon">📷</span><span>Start Camera</span>';
        cameraContainer.style.display = 'flex';
        
        // Update status
        updateCameraStatus('Ready to capture');
        
    } catch (error) {
        console.error('Error accessing camera:', error);
        
        // Reset button
        activateCameraBtn.disabled = false;
        activateCameraBtn.innerHTML = '<span class="camera-icon">📷</span><span>Start Camera</span>';
        
        // Show appropriate error message
        let errorMsg = 'Unable to access camera. ';
        
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            errorMsg = 'Camera access denied. Please enable camera permissions in your browser settings.';
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            errorMsg = 'No camera found. Please connect a camera and try again.';
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
            errorMsg = 'Camera is already in use by another application. Please close other apps and try again.';
        } else if (error.name === 'OverconstrainedError') {
            errorMsg = 'Camera does not meet requirements. Trying with default settings...';
            // Retry with basic constraints
            setTimeout(() => startCameraBasic(), 1000);
            return;
        } else {
            errorMsg += error.message || 'Unknown error occurred.';
        }
        
        showCameraError(errorMsg);
    }
}

// Start Camera with Basic Constraints (fallback)
async function startCameraBasic() {
    try {
        const constraints = {
            video: true,
            audio: false
        };
        
        cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // Set video source
        cameraVideo.srcObject = cameraStream;
        cameraVideo.style.display = 'block';
        
        // Wait for video to be ready and start playing
        await new Promise((resolve, reject) => {
            cameraVideo.onloadedmetadata = async () => {
                try {
                    await cameraVideo.play();
                    resolve();
                } catch (err) {
                    console.error('Error playing video:', err);
                    reject(err);
                }
            };
            
            setTimeout(() => reject(new Error('Video load timeout')), 5000);
        });
        
        activateCameraBtn.style.display = 'none';
        cameraContainer.style.display = 'flex';
        cameraError.style.display = 'none';
        updateCameraStatus('Ready to capture');
        
    } catch (error) {
        showCameraError('Unable to start camera with any settings. Please check your camera permissions.');
    }
}

// Show Camera Error
function showCameraError(message) {
    errorMessage.textContent = message;
    cameraError.style.display = 'block';
    activateCameraBtn.style.display = 'none';
    cameraContainer.style.display = 'none';
}

// Update Camera Status
function updateCameraStatus(status) {
    if (cameraStatus) {
        cameraStatus.textContent = status;
    }
}

// Stop Camera
function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
        cameraVideo.srcObject = null;
    }
}

// Stop Camera and Reset UI
function stopCameraAndReset() {
    stopCamera();
    cameraContainer.style.display = 'none';
    activateCameraBtn.style.display = 'flex';
    cameraError.style.display = 'none';
}

// Flip Camera
async function flipCamera() {
    currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    updateCameraStatus('Switching camera...');
    stopCamera();
    await startCamera();
}

// Capture Frame
function captureFrame() {
    // Check if camera is ready
    if (!cameraStream) {
        showCameraError('Camera stream not available.');
        return;
    }
    
    // Verify video is actually playing
    if (cameraVideo.readyState < 2 || !cameraVideo.videoWidth || !cameraVideo.videoHeight) {
        showCameraError('Camera not ready. Please wait for the video feed to load.');
        return;
    }
    
    // Update status
    updateCameraStatus('Capturing frame...');
    
    // Flash effect
    const videoWrapper = document.querySelector('.video-wrapper');
    if (videoWrapper) {
        videoWrapper.style.transition = 'opacity 0.1s';
        videoWrapper.style.opacity = '0.5';
        setTimeout(() => {
            videoWrapper.style.opacity = '1';
        }, 100);
    }
    
    // Create canvas to capture frame
    const canvas = document.createElement('canvas');
    canvas.width = cameraVideo.videoWidth;
    canvas.height = cameraVideo.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(cameraVideo, 0, 0);
    
    // Get image data for analysis
    const imageData = canvas.toDataURL('image/jpeg');
    
    // Start analysis
    updateCameraStatus('Analyzing...');
    analyzeContent('camera', 'Camera Capture', imageData);
}

// Analyze Content (Simulated AI Detection)
function analyzeContent(type, fileName, imageData = null) {
    // Hide all states
    noAnalysis.style.display = 'none';
    analyzingState.style.display = 'flex';
    resultsCard.style.display = 'none';
    featureAnalysis.style.display = 'none';
    
    // Simulate confidence progress
    let progress = 0;
    const progressInterval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress > 95) progress = 95;
        
        confidenceFill.style.width = progress + '%';
        confidenceLabel.textContent = `Analyzing... ${Math.round(progress)}% confidence`;
    }, 150);
    
    // Simulate analysis time (2-3 seconds)
    const analysisTime = 2000 + Math.random() * 1000;
    
    setTimeout(() => {
        clearInterval(progressInterval);
        
        // Generate realistic results
        const results = generateResults(type);
        displayResults(results, type, fileName);
        
        // Add to history
        addToHistory(type, results);
        
        // Update camera status if in camera mode
        if (type === 'camera' && cameraStream) {
            updateCameraStatus('Ready to capture');
        }
    }, analysisTime);
}

// Generate Simulated Results
function generateResults(type) {
    // 65% chance of being real, 35% chance of being fake (more varied)
    const isReal = Math.random() > 0.35;
    
    // Generate realistic confidence (75-99%)
    const confidence = 75 + Math.random() * 24;
    
    // Generate processing time based on type
    const procTime = type === 'camera' ? (0.8 + Math.random() * 0.7) : (0.5 + Math.random() * 2);
    
    // Generate frame count (1 for camera and image, more for video)
    const frames = (type === 'image' || type === 'camera') ? 1 : Math.floor(15 + Math.random() * 105);
    
    // Generate feature analysis scores
    const features = {
        facial: Math.floor(40 + Math.random() * 55),
        blending: Math.floor(45 + Math.random() * 50),
        temporal: Math.floor(50 + Math.random() * 45),
        attention: Math.floor(55 + Math.random() * 40),
        texture: Math.floor(40 + Math.random() * 55),
        compression: Math.floor(45 + Math.random() * 50)
    };
    
    return {
        isReal,
        confidence: confidence.toFixed(1),
        processingTime: procTime.toFixed(2),
        frames,
        features
    };
}

// Display Results
function displayResults(results, type, fileName) {
    // Hide analyzing state
    analyzingState.style.display = 'none';
    
    // Show results card
    resultsCard.style.display = 'block';
    resultsCard.className = 'results-card ' + (results.isReal ? 'real' : 'fake');
    
    // Update result badge
    resultBadge.textContent = results.isReal ? '✅ Real' : '❌ Deepfake';
    
    // Update confidence
    confidenceValue.textContent = results.confidence + '%';
    
    // Update processing time
    processingTime.textContent = `${results.processingTime} seconds`;
    
    // Update frame count
    if (type === 'image' || type === 'camera') {
        frameCountContainer.style.display = 'flex';
        frameCount.textContent = type === 'camera' ? '1 frame analyzed' : '1 frame';
    } else {
        frameCountContainer.style.display = 'flex';
        frameCount.textContent = `${results.frames} frames`;
    }
    
    // Show feature analysis
    featureAnalysis.style.display = 'block';
    
    // Animate feature bars
    setTimeout(() => {
        animateFeatureBars(results.features);
    }, 300);
}

// Animate Feature Bars
function animateFeatureBars(features) {
    document.getElementById('facialFill').style.width = features.facial + '%';
    document.getElementById('facialValue').textContent = features.facial + '%';
    
    document.getElementById('blendingFill').style.width = features.blending + '%';
    document.getElementById('blendingValue').textContent = features.blending + '%';
    
    document.getElementById('temporalFill').style.width = features.temporal + '%';
    document.getElementById('temporalValue').textContent = features.temporal + '%';
    
    document.getElementById('attentionFill').style.width = features.attention + '%';
    document.getElementById('attentionValue').textContent = features.attention + '%';
    
    document.getElementById('textureFill').style.width = features.texture + '%';
    document.getElementById('textureValue').textContent = features.texture + '%';
    
    document.getElementById('compressionFill').style.width = features.compression + '%';
    document.getElementById('compressionValue').textContent = features.compression + '%';
}

// Add to History
function addToHistory(type, results) {
    const timestamp = new Date().toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
    
    const historyItem = {
        timestamp,
        type: type === 'camera' ? 'Live' : (type.charAt(0).toUpperCase() + type.slice(1)),
        result: results.isReal ? 'Real' : 'Fake',
        confidence: results.confidence
    };
    
    // Add to beginning of array
    detectionHistory.unshift(historyItem);
    
    // Keep only last 5
    if (detectionHistory.length > 5) {
        detectionHistory = detectionHistory.slice(0, 5);
    }
    
    // Update history display
    updateHistoryDisplay();
}

// Update History Display
function updateHistoryDisplay() {
    if (detectionHistory.length === 0) {
        historyContainer.innerHTML = '<p class="no-history">No detections yet</p>';
        return;
    }
    
    historyContainer.innerHTML = '';
    
    detectionHistory.forEach(item => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        
        const typeIcon = {
            'Image': '🖼️',
            'Video': '🎥',
            'Camera': '📷',
            'Live': '📷'
        }[item.type];
        
        historyItem.innerHTML = `
            <div class="history-timestamp">${item.timestamp}</div>
            <div class="history-type">${typeIcon} ${item.type}</div>
            <div class="history-result ${item.result.toLowerCase()}">${item.result}</div>
            <div class="history-confidence">${item.confidence}%</div>
        `;
        
        historyContainer.appendChild(historyItem);
    });
}

// Initialize app immediately when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Use setTimeout to ensure non-blocking initialization
        setTimeout(init, 0);
    });
} else {
    // DOM already loaded, initialize immediately
    setTimeout(init, 0);
}

// Prevent any external connections or service workers
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(registration => registration.unregister());
    });
}