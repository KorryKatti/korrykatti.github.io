from pydantic import BaseModel
from typing import Optional

class SearchRequest(BaseModel):
    query: str
    max_results: Optional[int] = 5
    safe_search: Optional[str] = "moderate"

class SearchResult(BaseModel):
    title: str
    url: str
    content: str

class SearchResponse(BaseModel):
    results: list[SearchResult]

class CodeRequest(BaseModel):
    language: str
    code: str
    pow_id: Optional[str] = None
    pow_nonce: Optional[str] = None
    user_prompt: Optional[str] = ""
    ai_text: Optional[str] = ""
    model: Optional[str] = ""

class CodeResponse(BaseModel):
    stdout: str
    stderr: str
    exit_code: int
    nix: str

class PowChallenge(BaseModel):
    id: str
    salt: str
    difficulty: int
    expiry: int

class ReviewRequest(BaseModel):
    review: int  # 1 for thumbs up, 0 for thumbs down

