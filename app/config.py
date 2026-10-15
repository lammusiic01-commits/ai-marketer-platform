from pathlib import Path
import os
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")
APP_URL = os.getenv("APP_URL", "http://localhost:8000").rstrip("/")
PORT = int(os.getenv("PORT", "8000"))
JWT_SECRET = os.getenv("JWT_SECRET", "local-development-secret-change-me")
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY", "")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "").strip()
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "apodex/apodex-1.1-mini:free").strip()
SMTP_HOST = os.getenv("SMTP_HOST", "").strip()
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "").strip()
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", "noreply@aimarketer.ru").strip()
_default_db_path = Path("/data/data.db") if Path("/data").is_dir() else ROOT / "data.db"
_database_url = os.getenv("DATABASE_URL", f"sqlite+aiosqlite:///{_default_db_path.as_posix()}").strip()
if _database_url.startswith("postgres://"):
    _database_url = "postgresql+asyncpg://" + _database_url[len("postgres://"):]
elif _database_url.startswith("postgresql://"):
    _database_url = "postgresql+asyncpg://" + _database_url[len("postgresql://"):]
DATABASE_URL = _database_url
