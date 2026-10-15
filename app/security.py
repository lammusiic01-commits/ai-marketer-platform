from datetime import datetime, timedelta, timezone
import base64
import hashlib
import jwt
from cryptography.fernet import Fernet, InvalidToken
from passlib.context import CryptContext
from app.config import JWT_SECRET, ENCRYPTION_KEY

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
def hash_password(password: str) -> str:
    return pwd_context.hash(password)
def verify_password(password: str, hashed: str) -> bool:
    return pwd_context.verify(password, hashed)
def create_jwt(user_id: int, workspace_id: int) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode({"sub": str(user_id), "workspace_id": workspace_id, "iat": now, "exp": now + timedelta(days=30)}, JWT_SECRET, algorithm="HS256")
def decode_jwt(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
def _fernet():
    if not ENCRYPTION_KEY:
        raise RuntimeError("ENCRYPTION_KEY is not set")
    raw = ENCRYPTION_KEY.encode()
    try:
        return Fernet(raw)
    except (ValueError, TypeError):
        derived = base64.urlsafe_b64encode(hashlib.sha256(raw).digest())
        return Fernet(derived)
def encrypt(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode()
def decrypt(value: str) -> str:
    try:
        return _fernet().decrypt(value.encode()).decode()
    except InvalidToken as exc:
        raise ValueError("Credentials cannot be decrypted with the configured key") from exc
