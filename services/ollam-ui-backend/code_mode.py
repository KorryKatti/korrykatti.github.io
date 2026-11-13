import os
import shutil
import zipfile
import time
import uuid
import asyncio
import resource
from typing import Dict, List, Optional
from pathlib import Path

BASE_DIR = Path("/tmp/ollama_sessions")
BASE_DIR.mkdir(parents=True, exist_ok=True)

class CodeModeManager:
    def __init__(self):
        self.sessions: Dict[str, dict] = {}

    def get_session_path(self, session_id: str) -> Path:
        return BASE_DIR / session_id

    def create_session(self) -> str:
        session_id = str(uuid.uuid4())
        session_path = self.get_session_path(session_id)
        session_path.mkdir(parents=True, exist_ok=True)
        self.sessions[session_id] = {
            "created_at": time.time(),
            "last_active": time.time(),
            "versions": []
        }
        return session_id

    def save_version(self, session_id: str, files: Dict[str, str]):
        """Saves current file state as a version."""
        if session_id not in self.sessions:
            return
        
        session_path = self.get_session_path(session_id)
        version_id = len(self.sessions[session_id]["versions"])
        
        # Simple versioning: Write files to the workspace
        for rel_path, content in files.items():
            file_path = session_path / rel_path
            file_path.parent.mkdir(parents=True, exist_ok=True)
            with open(file_path, "w") as f:
                f.write(content)
        
        self.sessions[session_id]["versions"].append({
            "id": version_id,
            "timestamp": time.time(),
            "files": list(files.keys())
        })
        self.sessions[session_id]["last_active"] = time.time()

    async def execute_command(self, session_id: str, command: str) -> dict:
        """Executes a shell command within the session workspace."""
        if session_id not in self.sessions:
            return {"stdout": "", "stderr": "Session not found", "exit_code": 1}
        
        # Security Filter
        blocklist = ["rm -rf /", ":(){ :|:& };:", "/dev/sd", "dd if="]
        if any(b in command for b in blocklist):
            return {"stdout": "", "stderr": "Command blocked for safety.", "exit_code": 1}

        session_path = self.get_session_path(session_id)
        self.sessions[session_id]["last_active"] = time.time()
        
        def set_limits():
            # Increase to 1GB (soft) / 2GB (hard) for Node.js/npm support
            # Values in bytes
            resource.setrlimit(resource.RLIMIT_AS, (1024 * 1024 * 1024, 2048 * 1024 * 1024))
            # Limit CPU time to 120s
            resource.setrlimit(resource.RLIMIT_CPU, (120, 120))

        try:
            process = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=str(session_path),
                preexec_fn=set_limits
            )
            
            try:
                stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=30.0)
                return {
                    "stdout": stdout.decode(),
                    "stderr": stderr.decode(),
                    "exit_code": process.returncode
                }
            except asyncio.TimeoutError:
                process.kill()
                return {"stdout": "", "stderr": "Command timed out (30s)", "exit_code": -1}
        except Exception as e:
            return {"stdout": "", "stderr": str(e), "exit_code": 1}

    def package_project(self, session_id: str) -> Optional[str]:
        """Creates a ZIP of the session workspace."""
        if session_id not in self.sessions:
            return None
        
        session_path = self.get_session_path(session_id)
        zip_name = f"project_{session_id}.zip"
        zip_path = BASE_DIR / zip_name
        
        # Exclusions
        exclude_dirs = {'.git', 'node_modules', 'venv', '__pycache__', '.env'}
        
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(session_path):
                # Filter dirs
                dirs[:] = [d for d in dirs if d not in exclude_dirs]
                
                for file in files:
                    file_path = Path(root) / file
                    arcname = file_path.relative_to(session_path)
                    zipf.write(file_path, arcname)
                    
        self.sessions[session_id]["zip_path"] = str(zip_path)
        self.sessions[session_id]["zip_created_at"] = time.time()
        return zip_name

    def cleanup(self):
        """Deletes sessions and ZIPs older than 10 mins."""
        now = time.time()
        expiry = 600 # 10 minutes
        
        to_delete = []
        for sid, data in self.sessions.items():
            # If ZIP exists, check ZIP age
            if "zip_created_at" in data:
                if now - data["zip_created_at"] > expiry:
                    to_delete.append(sid)
            # Or if session is idle too long
            elif now - data["last_active"] > expiry:
                to_delete.append(sid)
                
        for sid in to_delete:
            session_path = self.get_session_path(sid)
            if session_path.exists():
                shutil.rmtree(session_path)
            
            zip_path = self.sessions[sid].get("zip_path")
            if zip_path and os.path.exists(zip_path):
                os.remove(zip_path)
                
            del self.sessions[sid]

code_manager = CodeModeManager()
