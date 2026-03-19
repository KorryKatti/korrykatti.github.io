from pydantic import BaseModel
from typing import Optional

class CodeRequest(BaseModel):
    language: str
    code: str

class CodeResponse(BaseModel):
    stdout: str
    stderr: str
    exit_code: int
    nix: str
