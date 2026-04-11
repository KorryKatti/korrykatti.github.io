import os
import tempfile
import asyncio
from typing import Tuple
from utils import truncate_output

# Single execution at a time for stability
semaphore = asyncio.Semaphore(1)

async def run_code(code: str, language: str = "python") -> Tuple[str, str, int, str]:
    """Execute Python code in a controlled (but not perfectly sandboxed) environment."""
    async with semaphore:
        with tempfile.TemporaryDirectory() as temp_dir:
            if language.lower() != "python":
                return "", "Unsupported language", 1, "N/A"

            script_path = os.path.join(temp_dir, "script.py")

            with open(script_path, "w") as f:
                f.write(code)

            # Scrub sensitive environment variables to prevent leakage to the sandbox
            # Only allow essential variables
            safe_env = {
                "PATH": os.environ.get("PATH", ""),
                "HOME": temp_dir,
                "LANG": os.environ.get("LANG", "en_US.UTF-8"),
                "PYTHONPATH": ".",
            }

            # Execute code directly using the python interpreter in the Alpine container
            process = await asyncio.create_subprocess_shell(
                f"timeout 60s python3 {script_path}",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=temp_dir,
                env=safe_env
            )

            try:
                stdout_bytes, stderr_bytes = await process.communicate()
                exit_code = process.returncode
            except Exception as e:
                return "", str(e), 1, "Alpine Sandbox"

            if exit_code == 124:
                stderr_bytes += b"\n[SYSTEM]: Execution timed out (60s)."

            stdout = truncate_output(stdout_bytes.decode("utf-8"))
            stderr = truncate_output(stderr_bytes.decode("utf-8"))

            return stdout, stderr, exit_code if exit_code is not None else -1, "Alpine (Standard Python)"
