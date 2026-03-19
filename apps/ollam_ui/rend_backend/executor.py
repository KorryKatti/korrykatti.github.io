import os
import subprocess
import tempfile
import asyncio
from typing import Tuple
from utils import truncate_output

# Single execution at a time
semaphore = asyncio.Semaphore(1)

NIX_TEMPLATE = """
{ pkgs ? import <nixpkgs> {} }:
pkgs.mkShell {
  buildInputs = [ pkgs.python3 ];
}
"""

async def run_code(code: str, language: str = "python") -> Tuple[str, str, int, str]:
    async with semaphore:
        with tempfile.TemporaryDirectory() as temp_dir:
            # We'll support Python only for Phase 1 as per spec
            if language.lower() != "python":
                return "", "Unsupported language", 1, ""

            script_path = os.path.join(temp_dir, "script.py")
            shell_path = os.path.join(temp_dir, "shell.nix")

            with open(script_path, "w") as f:
                f.write(code)
            
            with open(shell_path, "w") as f:
                f.write(NIX_TEMPLATE)

            # Use timeout 5s as per spec
            # nix-shell --run "python script.py"
            # Render doesn't have Docker spawning, so we just run subprocess.
            
            # Use timeout 30s (Nix-shell can be slow on first run/Render cold starts)
            process = await asyncio.create_subprocess_shell(
                f"timeout 30s nix-shell {shell_path} --run 'python3 {script_path}'",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=temp_dir
            )

            try:
                stdout_bytes, stderr_bytes = await process.communicate()
                exit_code = process.returncode
            except Exception as e:
                return "", str(e), 1, NIX_TEMPLATE

            stdout = truncate_output(stdout_bytes.decode("utf-8"))
            stderr = truncate_output(stderr_bytes.decode("utf-8"))

            return stdout, stderr, exit_code if exit_code is not None else -1, NIX_TEMPLATE
