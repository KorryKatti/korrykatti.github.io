def truncate_output(text: str, max_chars: int = 5000) -> str:
    if len(text) > max_chars:
        return text[:max_chars] + "\n... (output truncated)"
    return text
