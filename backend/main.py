import os
import uuid
import time
import asyncio
import shutil
import sys
from fastapi import FastAPI, UploadFile, File, HTTPException, Body
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

import numpy as np
from PIL import Image

# Add TripoSR to path
sys.path.append(os.path.join(os.path.dirname(__file__), "TripoSR"))

load_dotenv()

app = FastAPI(title="DimensionShift 3D API (Local TripoSR)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
MODEL_DIR = "models"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(MODEL_DIR, exist_ok=True)

app.mount("/models", StaticFiles(directory=MODEL_DIR), name="models")

tasks = {}
images = {}

# Lazy loaded TripoSR components
triposr_model = None
rembg_session = None

def load_ai_model():
    global triposr_model, rembg_session
    if triposr_model is None:
        print("Loading TripoSR Model (this may take a minute or download weights)...")
        import torch
        import rembg
        from tsr.system import TSR
        
        device = "cuda:0" if torch.cuda.is_available() else "cpu"
        triposr_model = TSR.from_pretrained(
            "stabilityai/TripoSR",
            config_name="config.yaml",
            weight_name="model.ckpt",
        )
        triposr_model.renderer.set_chunk_size(8192)
        triposr_model.to(device)
        rembg_session = rembg.new_session()
        print("TripoSR Model Loaded!")

async def generate_3d_model(task_id: str, image_id: str):
    try:
        tasks[task_id]["status"] = "processing"
        tasks[task_id]["progress"] = 10
        
        # We must load the model inside a thread or async safely if it's blocking,
        # but loading synchronously once is fine for this demo.
        load_ai_model()
        
        tasks[task_id]["progress"] = 30
        
        image_path = images[image_id]["filepath"]
        
        # Process image using thread to not block the event loop
        def run_inference():
            import torch
            from tsr.utils import remove_background, resize_foreground
            
            image = Image.open(image_path)
            if image.mode == "RGBA":
                image = image.convert("RGB")
                
            # Remove background
            image = remove_background(image, rembg_session)
            image = resize_foreground(image, 0.85)
            
            # Convert to numpy format expected by TripoSR
            image = np.array(image).astype(np.float32) / 255.0
            image = image[:, :, :3] * image[:, :, 3:4] + (1 - image[:, :, 3:4]) * 0.5
            image = Image.fromarray((image * 255.0).astype(np.uint8))
            
            device = "cuda:0" if torch.cuda.is_available() else "cpu"
            
            with torch.no_grad():
                scene_codes = triposr_model([image], device=device)
                meshes = triposr_model.extract_mesh(scene_codes, has_vertex_color=True, resolution=256)
                
            return meshes[0]

        mesh = await asyncio.to_thread(run_inference)
        tasks[task_id]["progress"] = 80
        
        output_filename = f"{task_id}.glb"
        output_filepath = os.path.join(MODEL_DIR, output_filename)
        
        # Export to GLB
        await asyncio.to_thread(mesh.export, output_filepath)
        
        tasks[task_id]["status"] = "completed"
        tasks[task_id]["progress"] = 100
        tasks[task_id]["model_url"] = f"/models/{output_filename}"
        
    except Exception as e:
        print(f"Error during generation: {e}")
        tasks[task_id]["status"] = "failed"
        tasks[task_id]["progress"] = 0

@app.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Invalid file type.")

    image_id = str(uuid.uuid4())
    file_extension = os.path.splitext(file.filename)[1]
    saved_filepath = os.path.join(UPLOAD_DIR, f"{image_id}{file_extension}")
    
    with open(saved_filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    images[image_id] = {"filepath": saved_filepath}
    return JSONResponse(content={"image_id": image_id, "message": "Image uploaded successfully."})

@app.post("/process")
async def process_image(payload: dict = Body(...)):
    image_id = payload.get("image_id")
    if not image_id or image_id not in images:
        raise HTTPException(status_code=404, detail="Image ID not found.")

    task_id = str(uuid.uuid4())
    tasks[task_id] = {
        "status": "pending",
        "progress": 0,
        "model_url": None
    }
    
    asyncio.create_task(generate_3d_model(task_id, image_id))
    return JSONResponse(content={"task_id": task_id, "message": "Processing started."})

@app.get("/get-model/{task_id}")
async def get_model(task_id: str):
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    return JSONResponse(content=tasks[task_id])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
