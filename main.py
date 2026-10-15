from contextlib import asynccontextmanager
from pathlib import Path
import logging
import re
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import uvicorn

from app.config import ROOT, PORT
from app.database import init_db
from app.scheduler import start_scheduler, stop_scheduler
from app.api.routes import router as api_router
from app.api.routes.chats import ensure_existing_project_chats, ws_router as chats_ws_router


class RedactSensitiveQuery(logging.Filter):
    _pattern = re.compile(r'([?&](?:token|password|secret|api_key)=)[^&\s"\']+', re.IGNORECASE)

    def filter(self, record: logging.LogRecord) -> bool:
        def redact(value):
            return self._pattern.sub(r'\1[redacted]', value) if isinstance(value, str) else value

        record.msg = redact(record.msg)
        if isinstance(record.args, tuple):
            record.args = tuple(redact(value) for value in record.args)
        elif isinstance(record.args, dict):
            record.args = {key: redact(value) for key, value in record.args.items()}
        return True


logging.getLogger("uvicorn.access").addFilter(RedactSensitiveQuery())


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await ensure_existing_project_chats()
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(
    title="AI Marketer Platform",
    version="1.0.0",
    description="Marketing workspace for Russian teams",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)
app.include_router(api_router)
app.include_router(chats_ws_router)

UPLOADS = ROOT / "uploads"
UPLOADS.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS)), name="uploads")


@app.get("/api/healthz")
async def healthz():
    return {"status": "ok", "service": "ai-marketer-platform"}


@app.get("/api")
async def api_root():
    return {"name": "AI Marketer Platform API", "docs": "/docs"}


DIST = ROOT / "frontend" / "dist"
if (DIST / "assets").exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")


@app.get("/manus-routes.json", include_in_schema=False)
async def routes_manifest():
    route_file = ROOT / "frontend" / "public" / "manus-routes.json"
    return FileResponse(route_file, media_type="application/json")


@app.get("/{path:path}", include_in_schema=False)
async def spa(path: str, request: Request):
    if path.startswith("api/"):
        return JSONResponse({"detail": "Not found"}, status_code=404)
    index = DIST / "index.html"
    if index.exists():
        return FileResponse(index)
    return JSONResponse({"detail": "Frontend is not built. Run start.bat."}, status_code=503)


if __name__ == "__main__":
    uvicorn.run("main:app", host=os.getenv("HOST", "0.0.0.0"), port=PORT, reload=False)
