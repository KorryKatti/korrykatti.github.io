import os
import re
import tempfile
import asyncio
from typing import Tuple
from utils import truncate_output

# Single execution at a time
semaphore = asyncio.Semaphore(1)

# Maps Python import names -> Nix package names in ps scope
IMPORT_TO_PS = {
    "numpy":        "numpy",
    "np":           "numpy",
    "pandas":       "pandas",
    "pd":           "pandas",
    "matplotlib":   "matplotlib",
    "plt":          "matplotlib",
    "scipy":        "scipy",
    "sklearn":      "scikitlearn",
    "requests":     "requests",
    "bs4":          "beautifulsoup4",
    "beautifulsoup4": "beautifulsoup4",
    "PIL":          "pillow",
    "Pillow":       "pillow",
    "cv2":          "opencv4",
    "sympy":        "sympy",
    "flask":        "flask",
    "fastapi":      "fastapi",
    "sqlalchemy":   "sqlalchemy",
    "pydantic":     "pydantic",
    "httpx":        "httpx",
    "aiohttp":      "aiohttp",
    "toml":         "toml",
    "yaml":         "pyyaml",
    "dotenv":       "python-dotenv",
    "tabulate":     "tabulate",
    "tqdm":         "tqdm",
    "rich":         "rich",
    "click":        "click",
    "jsonschema":   "jsonschema",
    "dateutil":     "dateutil",
    "arrow":        "arrow",
    "cryptography": "cryptography",
    "paramiko":     "paramiko",
}

def parse_imports(code: str) -> set:
    """Extract and resolve package names for the detected Python imports."""
    names = set()
    for line in code.splitlines():
        line = line.strip()
        m = re.match(r'^import\s+([\w.]+)', line)
        if m:
            names.add(m.group(1).split('.')[0])
        m2 = re.match(r'^from\s+([\w.]+)\s+import', line)
        if m2:
            names.add(m2.group(1).split('.')[0])
            
    resolved = set()
    for n in names:
        if n in IMPORT_TO_PS:
            resolved.add(IMPORT_TO_PS[n])
    return resolved

def build_nix_shell(code: str) -> str:
    """Build a robust shell.nix file."""
    pkgs = parse_imports(code)
    ps_list = " ".join([f"ps.{p}" for p in sorted(pkgs)])
    
    nix_content = f"""
{{ pkgs ? import <nixpkgs> {{}} }}:
pkgs.mkShell {{
  buildInputs = [
    (pkgs.python3.withPackages (ps: [
      {ps_list}
    ]))
  ];
}}
"""
    return nix_content.strip()


async def run_code(code: str, language: str = "python") -> Tuple[str, str, int, str]:
    async with semaphore:
        with tempfile.TemporaryDirectory() as temp_dir:
            if language.lower() != "python":
                return "", "Unsupported language", 1, ""

            script_path = os.path.join(temp_dir, "script.py")
            shell_path  = os.path.join(temp_dir, "shell.nix")

            nix_content = build_nix_shell(code)

            with open(script_path, "w") as f:
                f.write(code)

            with open(shell_path, "w") as f:
                f.write(nix_content)

            process = await asyncio.create_subprocess_shell(
                f"timeout 60s nix-shell {shell_path} --run 'python3 {script_path}'",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=temp_dir
            )

            try:
                stdout_bytes, stderr_bytes = await process.communicate()
                exit_code = process.returncode
            except Exception as e:
                return "", str(e), 1, nix_content

            if exit_code == 124:
                stderr_bytes += b"\n[SYSTEM]: Execution timed out (60s)."

            stdout = truncate_output(stdout_bytes.decode("utf-8"))
            stderr = truncate_output(stderr_bytes.decode("utf-8"))

            return stdout, stderr, exit_code if exit_code is not None else -1, nix_content
