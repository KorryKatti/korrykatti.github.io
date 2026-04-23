from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from dotenv import load_dotenv
from pydantic import BaseModel
from typing import Optional
import os

# Load environment variables from .env file
# ignore_warnings=True skips parsing errors (e.g., large JSON env vars)
try:
    load_dotenv(ignore_warnings=True)
except TypeError:
    # Older python-dotenv versions don't support ignore_warnings
    load_dotenv()
from schemas import (
    CodeRequest, CodeResponse, SearchRequest, SearchResponse, SearchResult, 
    PowChallenge, ReviewRequest, CodeModeSessionResponse, CodeModeInteractRequest, 
    CodeModePackageResponse, CodeModeShellRequest, CodeModeShellResponse
)
from executor import run_code
from pow_manager import pow_manager
from database import append_log_row, update_last_review
from code_mode import code_manager, BASE_DIR
from fastapi.responses import FileResponse
import time
import uvicorn
try:
    from duckduckgo_search import DDGS
except ImportError:
    try:
        from ddgs import DDGS
    except ImportError:
        DDGS = None

app = FastAPI(title="Nix Code Executor")

origins = [
    "https://korrykatti.github.io",
    "http://korrykatti.github.io",
    "http://localhost:5173",
    "http://localhost:3000",
    "*",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/", response_class=HTMLResponse)
async def root():
    return """
    <html>
        <head>
            <title>Alpine Code Executor API</title>
            <style>
                body { font-family: sans-serif; text-align: center; padding: 50px; background: #f0f2f5; }
                .container { display: inline-block; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                h1 { color: #2d3748; }
                p { color: #4a5568; }
                .status { padding: 8px 16px; border-radius: 20px; background: #c6f6d5; color: #22543d; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🗺️ Alpine Execution Service</h1>
                <p>Hello! The API is running and ready for Ollama.</p>
                <div style="margin-top: 20px;">
                    <span class="status">⚡ Status: Operational</span>
                </div>
            </div>
        </body>
    </html>
    """

@app.get("/ping")
async def ping():
    return {"status": "pong"}

def _run_ddgs_search(query: str, max_results: int, safesearch: str):
    """Run DDGS search with one retry on HTTP/2 protocol errors."""
    import time
    last_err = None
    for attempt in range(2):
        try:
            with DDGS() as ddgs:
                # DDGS.text() requires query as positional argument
                return list(ddgs.text(
                    query,
                    max_results=max_results,
                    safesearch=safesearch
                ))
        except Exception as e:
            last_err = e
            err_str = str(e)
            # HTTP/2 HPACK table size error from primp — retry once
            if "LocalProtocolError" in err_str or "header block" in err_str:
                if attempt == 0:
                    time.sleep(0.5)
                    continue
            break
    raise last_err

@app.post("/search", response_model=SearchResponse)
async def search(request: SearchRequest):
    if DDGS is None:
        print("DuckDuckGo Search package not installed. Skipping search.")
        return SearchResponse(results=[])
    try:
        results = _run_ddgs_search(
            query=request.query,
            max_results=request.max_results or 5,
            safesearch=request.safe_search or "moderate"
        )
        search_results = []
        for r in results:
            search_results.append(SearchResult(
                title=r.get("title", "Untitled"),
                url=r.get("href", ""),
                content=r.get("body", "")[:1000]
            ))
        return SearchResponse(results=search_results)
    except Exception as e:
        print(f"Search API Error: {str(e)}")
        return SearchResponse(results=[])


@app.get("/challenge", response_model=PowChallenge)
async def get_challenge():
    return pow_manager.generate_challenge()


@app.post("/run", response_model=CodeResponse)
async def execute_code(request: CodeRequest):
    if request.language.lower() != "python":
        raise HTTPException(status_code=400, detail="Only Python is supported in Phase 1.")

    # PoW verification
    if not request.pow_id or not request.pow_nonce:
        raise HTTPException(status_code=403, detail="PoW challenge required")

    if not pow_manager.verify_solution(request.pow_id, request.pow_nonce):
        raise HTTPException(status_code=403, detail="Invalid or expired PoW solution")

    stdout, stderr, exit_code, nix_config = await run_code(request.code, request.language)

    # Log to Google Sheets (only for code interpreter mode)
    try:
        append_log_row(
            user_prompt=request.user_prompt or "",
            ai_text=request.ai_text or "",
            ai_code=request.code,
            model=request.model or "unknown",
            code_output=f"{stdout}\n{stderr}".strip(),
            status=exit_code,
            review=0  # Default, can be updated later via frontend feedback
        )
    except Exception as e:
        print(f"Google Sheets logging error (non-critical): {e}")

    return CodeResponse(
        stdout=stdout,
        stderr=stderr,
        exit_code=exit_code,
        nix=nix_config
    )

@app.post("/review")
async def submit_review(request: ReviewRequest):
    """Submit thumbs up/down review for the last code execution."""
    try:
        success = update_last_review(request.review)
        if success:
            return {"status": "success"}
        return {"status": "error", "message": "Failed to update review"}
    except Exception as e:
        print(f"Review submission error: {e}")
        return {"status": "error", "message": str(e)}

# --- Code Mode Endpoints ---

@app.post("/code-mode/init", response_model=CodeModeSessionResponse)
async def init_code_mode():
    session_id = code_manager.create_session()
    return CodeModeSessionResponse(session_id=session_id)

@app.post("/code-mode/interact")
async def interact_code_mode(request: CodeModeInteractRequest):
    code_manager.save_version(request.session_id, request.files)
    # Cleanup happens on every interaction to keep disk usage low
    code_manager.cleanup()
    return {"status": "success", "message": "Version saved"}

@app.post("/code-mode/shell", response_model=CodeModeShellResponse)
async def shell_code_mode(request: CodeModeShellRequest):
    result = await code_manager.execute_command(request.session_id, request.command)
    return CodeModeShellResponse(**result)

@app.post("/code-mode/package", response_model=CodeModePackageResponse)
async def package_code_mode(session_id: str):
    zip_name = code_manager.package_project(session_id)
    if not zip_name:
        raise HTTPException(status_code=404, detail="Session not found")
    
    expires_at = time.time() + 600
    return CodeModePackageResponse(
        download_url=f"/code-mode/download/{zip_name}",
        expires_at=expires_at
    )

@app.get("/code-mode/download/{zip_name}")
async def download_code_mode(zip_name: str):
    zip_path = BASE_DIR / zip_name
    if not zip_path.exists():
        raise HTTPException(status_code=404, detail="File expired or not found")
    
    return FileResponse(
        path=zip_path,
        filename=zip_name,
        media_type="application/zip"
    )

if __name__ == "__main__":
    # Render default port 10000
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", 10000))
    uvicorn.run(app, host=host, port=port)
