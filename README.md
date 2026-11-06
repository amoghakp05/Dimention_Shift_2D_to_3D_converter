# DimensionShift - 2D to 3D Converter

A modern, high-quality 2D image to 3D model converter built with Vanilla JS, Three.js, and FastAPI.

## Project Structure
- `backend/`: FastAPI Python backend for handling image uploads and simulating 3D generation.
- `frontend/`: Vanilla HTML, JS, CSS frontend using Three.js for a premium 3D viewing experience.

## Prerequisites
- Python 3.8+
- Modern Web Browser (Chrome, Firefox, Safari, Edge)

## Setup and Running Locally

### Quick Start (One-Click)

Simply open/double-click **`start.bat`** (or **`run.bat`**) in the root folder, or run:
```bash
python run.py
```
This starter script will automatically:
- Start the FastAPI backend server on `http://localhost:8000`
- Serve the frontend application on `http://localhost:3000`
- Open your default web browser directly to `http://localhost:3000`
- Cleanly stop both servers when you press `Ctrl+C`

---

### Manual Setup (Optional)

#### 1. Start the Backend Server

Open a terminal and navigate to the `backend` directory:
```bash
cd backend
```

Create a virtual environment (optional but recommended):
```bash
python -m venv venv
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate
```

Install dependencies:
```bash
pip install -r requirements.txt
```

Start the FastAPI server:
```bash
python main.py
```
The backend will run on `http://localhost:8000`

### 2. Serve the Frontend

Open a new terminal and navigate to the `frontend` directory:
```bash
cd frontend
```

Start a simple static file server (using Python's built-in `http.server`):
```bash
python -m http.server 3000
```

Open your browser and navigate to: `http://localhost:3000`

## How it Works
1. Upload an image via the drag-and-drop interface.
2. The frontend sends the image to the FastAPI backend.
3. The backend simulates processing the image (in a real-world scenario, it would call an AI API like Meshy or Tripo).
4. After processing, the backend returns a sample `.glb` 3D model.
5. The frontend loads the 3D model using Three.js, applying a cinematic blue metallic material and rendering it against a pure black background.
6. The viewer supports auto-rotation, zooming, and panning.
