from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from schemas import CodeRequest, CodeResponse
from executor import run_code
import uvicorn

app = FastAPI(title="Nix Code Executor")

origins = [
    "https://korrykatti.github.io",
    "http://korrykatti.github.io",
    "http://localhost:5173",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"status": "ok", "message": "Nix Code Executor API is running"}

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
