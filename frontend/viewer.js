import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let scene, camera, renderer, controls, currentModel;
let isAutoRotating = true;

export function initViewer(containerId) {
    const container = document.getElementById(containerId);
    
    // Scene
    scene = new THREE.Scene();
    
    // The background will be transparent to allow the CSS viewer-bg to show through
    // which supports the dark/light mode toggle smoothly.
    
    // Camera
    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 0, 5);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    
    // Enable Shadows for Realism
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = isAutoRotating;
    controls.autoRotateSpeed = 5.0;

    // Advanced Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4); 
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    keyLight.position.set(5, 8, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.bias = -0.0001;
    scene.add(keyLight);
    
    const fillLight = new THREE.DirectionalLight(0x60a5fa, 1.5); // Soft blue fill
    fillLight.position.set(-5, 0, -5);
    scene.add(fillLight);

    const backLight = new THREE.DirectionalLight(0xffffff, 1.0);
    backLight.position.set(0, -5, -5);
    scene.add(backLight);

    // Window Resize handling
    window.addEventListener('resize', () => {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });

    // Animation Loop
    function animate() {
        requestAnimationFrame(animate);
        if (currentModel && isAutoRotating) {
            // Explicitly rotate the model around its local Z axis 
            // (which acts as global Y since it is rotated 90 deg on X)
            currentModel.rotation.z -= 0.02;
        }
        controls.update();
        renderer.render(scene, camera);
    }
    animate();
}

export function loadModel(modelUrl) {
    if (currentModel) {
        scene.remove(currentModel);
    }

    const loader = new GLTFLoader();
    
    loader.load(
        modelUrl,
        (gltf) => {
            currentModel = gltf.scene;

            currentModel.traverse((child) => {
                if (child.isMesh) {
                    // Completely replace the material to guarantee solid blue color
                    child.material = new THREE.MeshStandardMaterial({
                        color: 0x3b82f6, // Solid Blue
                        metalness: 0.3,
                        roughness: 0.4,
                        vertexColors: false
                    });
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            // Stand the model upright (from landscape to portrait)
            currentModel.rotation.x = -Math.PI / 2;

            // Update the matrix after rotation to get an accurate bounding box
            currentModel.updateMatrixWorld(true);

            // Center the model properly
            const box = new THREE.Box3().setFromObject(currentModel);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            
            // Adjust position to origin
            currentModel.position.x -= center.x;
            currentModel.position.y -= center.y;
            currentModel.position.z -= center.z;

            scene.add(currentModel);

            // Robust Camera Calculation
            const maxDim = Math.max(size.x, size.y, size.z) || 1; // Fallback to 1 if size is 0
            const fov = camera.fov * (Math.PI / 180);
            let cameraZ = Math.abs(maxDim / 2 * Math.tan(fov * 2));
            cameraZ *= 2.5; 
            
            // Ensure cameraZ is valid
            if (!isFinite(cameraZ) || isNaN(cameraZ)) {
                cameraZ = 5;
            }

            camera.position.set(0, 0, cameraZ);
            camera.lookAt(0, 0, 0);
            controls.target.set(0, 0, 0);
            controls.update();
            
            // UI Updates
            document.getElementById('canvas-container').style.opacity = 1;
            document.getElementById('viewer-empty-state').style.display = 'none';
            document.getElementById('viewer-controls').style.display = 'flex';
        },
        undefined,
        (error) => {
            console.error('Error loading model:', error);
            alert("Failed to load the 3D model into the viewer.");
        }
    );
}

export function clearViewer() {
    if (currentModel) {
        scene.remove(currentModel);
        currentModel = null;
    }
    document.getElementById('canvas-container').style.opacity = 0;
    document.getElementById('viewer-empty-state').style.display = 'flex';
    document.getElementById('viewer-controls').style.display = 'none';
    
    // Reset camera
    camera.position.set(0, 0, 5);
    controls.target.set(0, 0, 0);
    controls.update();
}

export function toggleRotation() {
    isAutoRotating = !isAutoRotating;
    controls.autoRotate = isAutoRotating;
    return isAutoRotating;
}

export function resetCamera() {
    if (currentModel) {
        const box = new THREE.Box3().setFromObject(currentModel);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const fov = camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 * Math.tan(fov * 2));
        cameraZ *= 2.5;
        
        if (!isFinite(cameraZ) || isNaN(cameraZ)) {
            cameraZ = 5;
        }
        
        controls.reset();
        camera.position.set(0, 0, cameraZ);
        controls.target.set(0, 0, 0);
    } else {
        controls.reset();
        camera.position.set(0, 0, 5);
    }
}
