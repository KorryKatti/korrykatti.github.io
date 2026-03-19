import os
import re
import tempfile
import asyncio
from typing import Tuple
from utils import truncate_output

# Single execution at a time
semaphore = asyncio.Semaphore(1)

# Maps Python import names -> Nix package attribute paths
IMPORT_TO_NIX = {
    "numpy":        "python3Packages.numpy",
    "np":           "python3Packages.numpy",
    "pandas":       "python3Packages.pandas",
    "pd":           "python3Packages.pandas",
    "matplotlib":   "python3Packages.matplotlib",
    "plt":          "python3Packages.matplotlib",
    "scipy":        "python3Packages.scipy",
    "sklearn":      "python3Packages.scikitlearn",
    "requests":     "python3Packages.requests",
    "bs4":          "python3Packages.beautifulsoup4",
    "beautifulsoup4": "python3Packages.beautifulsoup4",
    "PIL":          "python3Packages.pillow",
    "Pillow":       "python3Packages.pillow",
    "cv2":          "python3Packages.opencv4",
    "sympy":        "python3Packages.sympy",
    "flask":        "python3Packages.flask",
    "fastapi":      "python3Packages.fastapi",
    "sqlalchemy":   "python3Packages.sqlalchemy",
    "pydantic":     "python3Packages.pydantic",
    "httpx":        "python3Packages.httpx",
    "aiohttp":      "python3Packages.aiohttp",
    "toml":         "python3Packages.toml",
    "yaml":         "python3Packages.pyyaml",
    "dotenv":       "python3Packages.python-dotenv",
    "tabulate":     "python3Packages.tabulate",
    "tqdm":         "python3Packages.tqdm",
    "rich":         "python3Packages.rich",
    "click":        "python3Packages.click",
    "jsonschema":   "python3Packages.jsonschema",
    "dateutil":     "python3Packages.dateutil",
    "arrow":        "python3Packages.arrow",
    "cryptography": "python3Packages.cryptography",
    "paramiko":     "python3Packages.paramiko",
}

def parse_imports(code: str) -> set:
    """Extract all top-level import names from the code."""
    names = set()
    for line in code.splitlines():
        line = line.strip()
        # import X, import X as Y
        m = re.match(r'^import\s+([\w.]+)', line)
        if m:
            names.add(m.group(1).split('.')[0])
        # from X import ...
        m2 = re.match(r'^from\s+([\w.]+)\s+import', line)
        if m2:
            names.add(m2.group(1).split('.')[0])
    return names

def build_nix_shell(code: str) -> str:
    """Build a shell.nix that includes all detected Python package dependencies."""
    detected = parse_imports(code)
    nix_pkgs = set()
    for name in detected:
        if name in IMPORT_TO_NIX:
            nix_pkgs.add(IMPORT_TO_NIX[name])

    extra = " ".join(sorted(nix_pkgs))
    nix_content = f"""
{{ pkgs ? import <nixpkgs> {{}} }}:
pkgs.mkShell {{
  buildInputs = [
    pkgs.python3
    {extra}
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

            # Timeout 60s — Nix cold starts on Render free tier can be slow
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
                stderr_bytes += b"\n[SYSTEM]: Execution timed out (60s). Try a more efficient algorithm."

            stdout = truncate_output(stdout_bytes.decode("utf-8"))
            stderr = truncate_output(stderr_bytes.decode("utf-8"))

            return stdout, stderr, exit_code if exit_code is not None else -1, nix_content
