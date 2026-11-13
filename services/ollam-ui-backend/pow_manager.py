import hashlib
import time
import secrets
import uuid
from typing import Dict, Optional, Tuple

class PowManager:
    def __init__(self, expiry_seconds: int = 120, difficulty: int = 4):
        self.expiry_seconds = expiry_seconds
        self.difficulty = difficulty
        # challenges[id] = (salt, expiry_time, used)
        self.challenges: Dict[str, Tuple[str, float, bool]] = {}

    def generate_challenge(self) -> Dict:
        challenge_id = str(uuid.uuid4())
        salt = secrets.token_hex(16)
        expiry = time.time() + self.expiry_seconds
        
        self.challenges[challenge_id] = (salt, expiry, False)
        
        # Cleanup old challenges occasionally
        self._cleanup()
        
        return {
            "id": challenge_id,
            "salt": salt,
            "difficulty": self.difficulty,
            "expiry": int(expiry)
        }

    def verify_solution(self, challenge_id: str, nonce: str) -> bool:
        if challenge_id not in self.challenges:
            return False
        
        salt, expiry, used = self.challenges[challenge_id]
        
        if used:
            return False
        
        if time.time() > expiry:
            del self.challenges[challenge_id]
            return False
        
        # Mark as used immediately to avoid replay
        self.challenges[challenge_id] = (salt, expiry, True)
        
        # Verify hash
        data = f"{salt}{nonce}".encode()
        hash_result = hashlib.sha256(data).hexdigest()
        
        return hash_result.startswith("0" * self.difficulty)

    def _cleanup(self):
        now = time.time()
        expired = [cid for cid, (_, exp, _) in self.challenges.items() if now > exp]
        for cid in expired:
            del self.challenges[cid]

pow_manager = PowManager()
