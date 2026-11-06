import { initViewer, loadModel, toggleRotation, resetCamera, clearViewer } from './viewer.js?v=3';

// API Configuration
const API_BASE_URL = 'http://localhost:8000';

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Three.js Viewer
    initViewer('canvas-container');

    // UI Elements
    const uploadZone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('file-input');
    const browseBtn = document.getElementById('browse-btn');
    const previewArea = document.getElementById('preview-area');
    const imagePreview = document.getElementById('image-preview');
    const convertBtn = document.getElementById('convert-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    
    const statusArea = document.getElementById('status-area');
    const progressBar = document.getElementById('progress-bar');
    const statusText = document.getElementById('status-text');
    const statusDetail = document.getElementById('status-detail');
    
    const actionArea = document.getElementById('action-area');
    const downloadBtn = document.getElementById('download-btn');
    const newBtn = document.getElementById('new-btn');

    const themeToggleBtn = document.getElementById('theme-toggle');
    const toggleRotationBtn = document.getElementById('toggle-rotation-btn');
    const resetCameraBtn = document.getElementById('reset-camera-btn');

    let selectedFile = null;
    let pollInterval = null;
    let currentModelUrl = null;

    // Theme Toggle Logic
    themeToggleBtn.addEventListener('click', () => {
        const html = document.documentElement;
        const icon = themeToggleBtn.querySelector('i');
        
        if (html.getAttribute('data-theme') === 'dark') {
            html.setAttribute('data-theme', 'light');
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        } else {
            html.setAttribute('data-theme', 'dark');
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }
    });

    // Drag and Drop Events
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        uploadZone.addEventListener(eventName, () => {
            uploadZone.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        uploadZone.addEventListener(eventName, () => {
            uploadZone.classList.remove('dragover');
        }, false);
    });

    uploadZone.addEventListener('drop', (e) => {
        let dt = e.dataTransfer;
        let files = dt.files;
        handleFiles(files);
    }, false);

    browseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
    });

    uploadZone.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', function() {
        handleFiles(this.files);
    });

    function handleFiles(files) {
        if (files.length > 0) {
            const file = files[0];
            if (file.type.startsWith('image/')) {
                selectedFile = file;
                const reader = new FileReader();
                reader.onload = (e) => {
                    imagePreview.src = e.target.result;
                    uploadZone.style.display = 'none';
                    previewArea.style.display = 'flex';
                };
                reader.readAsDataURL(file);
            } else {
                alert('Please upload an image file (JPG or PNG).');
            }
        }
    }

    cancelBtn.addEventListener('click', resetUI);

    newBtn.addEventListener('click', () => {
        resetUI();
        clearViewer();
    });

    function resetUI() {
        selectedFile = null;
        currentModelUrl = null;
        imagePreview.src = '';
        
        previewArea.style.display = 'none';
        statusArea.style.display = 'none';
        actionArea.style.display = 'none';
        
        uploadZone.style.display = 'block';
        fileInput.value = '';
    }

    // API Integration
    convertBtn.addEventListener('click', async () => {
        if (!selectedFile) return;

        // UI Updates
        previewArea.style.display = 'none';
        statusArea.style.display = 'flex';
        progressBar.style.width = '10%';
        statusText.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Uploading...';
        statusDetail.innerText = 'Uploading image to server...';

        const formData = new FormData();
        formData.append('file', selectedFile);

        try {
            // 1. Upload Image
            const uploadResponse = await fetch(`${API_BASE_URL}/upload`, {
                method: 'POST',
                body: formData
            });

            if (!uploadResponse.ok) throw new Error('Upload failed');
            
            const uploadData = await uploadResponse.json();
            const imageId = uploadData.image_id;

            // 2. Start Processing
            statusText.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Processing...';
            statusDetail.innerText = 'Initiating AI generation...';
            progressBar.style.width = '20%';

            const processResponse = await fetch(`${API_BASE_URL}/process`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image_id: imageId })
            });

            if (!processResponse.ok) throw new Error('Failed to start processing');

            const processData = await processResponse.json();
            const taskId = processData.task_id;
            
            // 3. Poll Status
            pollStatus(taskId);

        } catch (error) {
            console.error('Error:', error);
            handleError('Failed to communicate with the server. Please ensure the backend is running.');
        }
    });

    function pollStatus(taskId) {
        pollInterval = setInterval(async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/get-model/${taskId}`);
                if (!response.ok) throw new Error('Failed to get status');
                
                const data = await response.json();
                
                // Progress is clamped between 20% and 90% during polling
                const displayProgress = 20 + (data.progress * 0.7);
                progressBar.style.width = `${displayProgress}%`;
                
                if (data.status === 'processing') {
                    statusDetail.innerText = 'AI model is generating 3D mesh...';
                } else if (data.status === 'completed') {
                    clearInterval(pollInterval);
                    progressBar.style.width = '100%';
                    statusText.innerHTML = '<i class="fa-solid fa-check"></i> Complete!';
                    statusDetail.innerText = 'Loading model into viewer...';
                    
                    currentModelUrl = `${API_BASE_URL}${data.model_url}`;
                    
                    // Load the model into Three.js
                    loadModel(currentModelUrl);
                    
                    // Update UI to show download options
                    setTimeout(() => {
                        statusArea.style.display = 'none';
                        actionArea.style.display = 'flex';
                    }, 1000);
                    
                } else if (data.status === 'failed') {
                    clearInterval(pollInterval);
                    handleError('Generation failed. Please try again.');
                }

            } catch (error) {
                console.error('Polling error:', error);
                clearInterval(pollInterval);
                handleError('Lost connection to server.');
            }
        }, 1000);
    }

    function handleError(message) {
        alert(message);
        resetUI();
    }

    // Download Logic
    downloadBtn.addEventListener('click', () => {
        if (!currentModelUrl) return;
        
        // Create an invisible link to trigger download
        const a = document.createElement('a');
        a.href = currentModelUrl;
        a.download = 'generated_model.glb';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    });

    // Viewer Controls Events
    toggleRotationBtn.addEventListener('click', () => {
        const isRotating = toggleRotation();
        const icon = toggleRotationBtn.querySelector('i');
        if (isRotating) {
            icon.style.opacity = '1';
        } else {
            icon.style.opacity = '0.4';
        }
    });

    resetCameraBtn.addEventListener('click', () => {
        resetCamera();
    });
});
