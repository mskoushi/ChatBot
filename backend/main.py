"""
Private Document Chatbot V1 — FastAPI application entry point.

The backend serves the frontend as static files so a single `uvicorn` command
starts the complete application. No separate frontend server needed.

Run:
    uvicorn main:app --reload --port 8000
Then open: http://localhost:8000
"""

from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from api.chat import router as chat_router
from api.documents import router as documents_router
from api.drive import router as drive_router

# ── Application ────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Private Document Chatbot API",
    description="V1 — Query scanned PDFs from Google Drive using Gemini AI.",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# ── CORS ───────────────────────────────────────────────────────────────────────
# Allow localhost for development; the frontend is served by this same server
# in production so CORS is not strictly needed, but kept for flexibility.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── API Routers ────────────────────────────────────────────────────────────────
app.include_router(drive_router)
app.include_router(documents_router)
app.include_router(chat_router)


@app.get("/api/health", tags=["meta"])
async def health() -> dict:
    """Liveness probe."""
    return {"status": "ok", "version": "1.0.0"}


# ── Frontend static files ──────────────────────────────────────────────────────
# The frontend/ directory lives next to backend/ in the project root.
_here = os.path.dirname(os.path.abspath(__file__))
_frontend_dir = os.path.normpath(os.path.join(_here, "..", "frontend"))

if os.path.isdir(_frontend_dir):
    # Mount css/js sub-directories as static
    for sub in ("css", "js", "assets"):
        sub_path = os.path.join(_frontend_dir, sub)
        if os.path.isdir(sub_path):
            app.mount(f"/{sub}", StaticFiles(directory=sub_path), name=sub)

    @app.get("/", include_in_schema=False)
    async def serve_index() -> FileResponse:
        return FileResponse(os.path.join(_frontend_dir, "index.html"))

    @app.get("/{path:path}", include_in_schema=False)
    async def serve_static(path: str) -> FileResponse:
        full = os.path.join(_frontend_dir, path)
        if os.path.isfile(full):
            return FileResponse(full)
        # SPA fallback
        return FileResponse(os.path.join(_frontend_dir, "index.html"))
