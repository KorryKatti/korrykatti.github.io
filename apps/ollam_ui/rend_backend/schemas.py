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

class CodeResponse(BaseModel):
    stdout: str
    stderr: str
    exit_code: int
    nix: str

