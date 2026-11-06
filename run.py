import os
import sys
import time
import socket
import subprocess
import webbrowser
import signal

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")

def get_python_executable():
    """Find the most appropriate Python executable."""
    # Check venv first if it has necessary dependencies
    venv_python = os.path.join(BACKEND_DIR, "venv", "Scripts", "python.exe")
    if os.path.isfile(venv_python):
        try:
            res = subprocess.run(
                [venv_python, "-c", "import fastapi, uvicorn; print('OK')"],
                capture_output=True,
                text=True,
                timeout=5
            )
            if res.returncode == 0 and "OK" in res.stdout:
                return venv_python
        except Exception:
            pass

    # Fall back to current Python executable
    return sys.executable

def is_port_in_use(port, host="127.0.0.1"):
    """Check if a network port is already in use."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex((host, port)) == 0

def wait_for_port(port, timeout=10, host="127.0.0.1"):
    """Wait until a port begins listening."""
    start_time = time.time()
    while time.time() - start_time < timeout:
        if is_port_in_use(port, host):
            return True
        time.sleep(0.3)
    return False

def terminate_process(proc, name="Process"):
    """Gracefully terminate a subprocess."""
    if proc and proc.poll() is None:
        try:
            proc.terminate()
            proc.wait(timeout=3)
        except Exception:
            try:
                proc.kill()
            except Exception:
                pass

def main():
    print("=" * 60)
    print("      DimensionShift - 2D to 3D Converter Starter")
    print("=" * 60)

    py_exe = get_python_executable()
    print(f"[+] Using Python: {py_exe}")

    # Check port conflicts
    if is_port_in_use(8000):
        print("[!] Warning: Port 8000 appears to already be in use.")
        print("    If an existing backend is running, you may need to stop it first.")
    if is_port_in_use(3000):
        print("[!] Warning: Port 3000 appears to already be in use.")
        print("    If an existing frontend is running, you may need to stop it first.")

    backend_proc = None
    frontend_proc = None

    def cleanup():
        print("\n[+] Shutting down servers...")
        terminate_process(backend_proc, "Backend")
        terminate_process(frontend_proc, "Frontend")
        print("[+] All services stopped.")

    try:
        # Start Backend Server
        print("[+] Starting FastAPI Backend (http://localhost:8000)...")
        backend_proc = subprocess.Popen(
            [py_exe, "main.py"],
            cwd=BACKEND_DIR
        )

        # Start Frontend Server
        print("[+] Starting Frontend Static Server (http://localhost:3000)...")
        frontend_proc = subprocess.Popen(
            [py_exe, "-m", "http.server", "3000"],
            cwd=FRONTEND_DIR
        )

        # Wait briefly for servers to start
        backend_ready = wait_for_port(8000, timeout=10)
        frontend_ready = wait_for_port(3000, timeout=10)

        print("-" * 60)
        if backend_ready and frontend_ready:
            print("[OK] Both Backend and Frontend are running!")
        else:
            print("[*] Servers started. Initializing...")

        frontend_url = "http://localhost:3000"
        backend_url = "http://localhost:8000"
        print(f"     * Frontend: {frontend_url}")
        print(f"     * Backend:  {backend_url}")
        print("-" * 60)

        # Open Web Browser
        print(f"[+] Opening {frontend_url} in your browser...")
        webbrowser.open(frontend_url)

        print("\nProject is running! Press Ctrl+C at any time to exit.\n")

        # Keep running and monitor processes
        while True:
            if backend_proc.poll() is not None:
                print(f"[!] Backend process exited unexpectedly with code {backend_proc.returncode}")
                break
            if frontend_proc.poll() is not None:
                print(f"[!] Frontend process exited unexpectedly with code {frontend_proc.returncode}")
                break
            time.sleep(1)

    except KeyboardInterrupt:
        pass
    finally:
        cleanup()

if __name__ == "__main__":
    main()

