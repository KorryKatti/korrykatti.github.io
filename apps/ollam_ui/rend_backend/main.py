from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from schemas import CodeRequest, CodeResponse
from executor import run_code
import uvicorn

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
            <title>Nix Code Executor API</title>
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
                <h1>🗺️ Nix Execution Service</h1>
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

@app.post("/run", response_model=CodeResponse)
async def execute_code(request: CodeRequest):
    if request.language.lower() != "python":
        raise HTTPException(status_code=400, detail="Only Python is supported in Phase 1.")
    
    stdout, stderr, exit_code, nix_config = await run_code(request.code, request.language)
    
    return CodeResponse(
        stdout=stdout,
        stderr=stderr,
        exit_code=exit_code,
        nix=nix_config
    )

if __name__ == "__main__":
    # Render default port 10000
    uvicorn.run(app, host="0.0.0.0", port=10000)
