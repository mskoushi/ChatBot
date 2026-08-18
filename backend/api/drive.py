"""
Drive API router — folder connection and file listing.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from chatbot.session import session_store
from config import Settings, get_settings
from google_drive.client import DriveClient, DriveError

router = APIRouter(prefix="/api/drive", tags=["drive"])


# ── Request / Response models ──────────────────────────────────────────────────

class ConnectRequest(BaseModel):
    folder_url: str
    session_id: str | None = None
    access_token: str | None = None


class FileInfo(BaseModel):
    id: str
    name: str
    mimeType: str
    size: str | None = None
    modifiedTime: str | None = None


class ConnectResponse(BaseModel):
    session_id: str
    folder_id: str
    folder_name: str
    files: list[FileInfo]
    total_files: int


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/connect", response_model=ConnectResponse)
async def connect_folder(
    req: ConnectRequest,
    settings: Settings = Depends(get_settings),
) -> ConnectResponse:
    """
    Validate a Google Drive folder URL, list its PDF files,
    and return (or create) a session.
    """
    folder_id = DriveClient.extract_folder_id(req.folder_url)
    if not folder_id:
        raise HTTPException(
            status_code=400,
            detail="Invalid Google Drive folder URL. Please paste a valid folder link "
                   "(e.g. https://drive.google.com/drive/folders/...).",
        )

    access_token = req.access_token or ""
    if not access_token and not settings.google_drive_api_key:
        raise HTTPException(
            status_code=500,
            detail="Neither Google OAuth Access Token nor GOOGLE_DRIVE_API_KEY is configured.",
        )

    drive = DriveClient(api_key=settings.google_drive_api_key, access_token=access_token)

    try:
        folder_name = drive.get_folder_name(folder_id)
        files: list[dict[str, Any]] = drive.list_files(folder_id)
    except DriveError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error accessing Google Drive: {exc}",
        ) from exc

    if not files:
        raise HTTPException(
            status_code=404,
            detail=(
                "No PDF files were found in this folder. "
                "Make sure the folder contains PDF documents and is shared as "
                "'Anyone with the link can view' or authorize with Google."
            ),
        )

    # Reuse existing session or create a new one
    session = None
    if req.session_id:
        session = session_store.get(req.session_id)

    if session is None:
        session = session_store.create()

    # Reset session state for the new folder
    session.folder_id = folder_id
    session.folder_name = folder_name
    session.access_token = access_token
    session.available_files = files
    session.selected_files = {}
    session.history = []

    return ConnectResponse(
        session_id=session.session_id,
        folder_id=folder_id,
        folder_name=folder_name,
        files=[FileInfo(**f) for f in files],
        total_files=len(files),
    )
