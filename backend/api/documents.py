"""
Documents API router — download PDFs from Drive and upload them to Gemini Files API.
This is the "ingestion" step that makes documents available for chat.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from chatbot.session import session_store
from config import Settings, get_settings
from gemini.client import GeminiClient, GeminiError
from google_drive.client import DriveClient, DriveError

router = APIRouter(prefix="/api/documents", tags=["documents"])


# ── Request / Response models ──────────────────────────────────────────────────

class SelectRequest(BaseModel):
    session_id: str
    file_ids: list[str]  # Google Drive file IDs
    access_token: str | None = None


class SelectResponse(BaseModel):
    success: bool
    selected_count: int
    selected_names: list[str]
    message: str


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/select", response_model=SelectResponse)
async def select_documents(
    req: SelectRequest,
    settings: Settings = Depends(get_settings),
) -> SelectResponse:
    """
    Download the selected PDFs from Drive and upload them to the Gemini Files API.
    Returns when all files are ready for chat.
    """
    session = session_store.get(req.session_id)
    if session is None:
        raise HTTPException(
            status_code=404,
            detail="Session not found. Please reconnect your Google Drive folder.",
        )

    if not req.file_ids:
        raise HTTPException(status_code=400, detail="Please select at least one document.")

    # Find the matching files from the session's available list
    id_set = set(req.file_ids)
    selected = [f for f in session.available_files if f["id"] in id_set]
    if not selected:
        raise HTTPException(
            status_code=400, detail="None of the selected file IDs were found in this folder."
        )

    if not settings.gemini_api_key:
        raise HTTPException(
            status_code=500, detail="GEMINI_API_KEY is not configured. Check your .env file."
        )

    access_token = req.access_token or session.access_token or ""
    drive = DriveClient(api_key=settings.google_drive_api_key, access_token=access_token)
    gemini = GeminiClient(settings.gemini_api_key, settings.gemini_model)

    # Clean up any previously uploaded Gemini files
    for uri in session.selected_files.values():
        gemini.delete_file(uri)
    session.selected_files = {}
    session.history = []

    uploaded_names: list[str] = []
    errors: list[str] = []

    for file_info in selected:
        filename = file_info["name"]
        file_id = file_info["id"]
        try:
            pdf_bytes = drive.download_file(file_id)
            uri = gemini.upload_pdf(filename, pdf_bytes)
            session.selected_files[filename] = uri
            uploaded_names.append(filename)
        except DriveError as exc:
            errors.append(f"{filename}: Download failed — {exc}")
        except GeminiError as exc:
            errors.append(f"{filename}: Upload to AI failed — {exc}")
        except Exception as exc:
            errors.append(f"{filename}: Unexpected error — {exc}")

    if not session.selected_files:
        raise HTTPException(
            status_code=500,
            detail="Failed to process any documents. Errors: " + "; ".join(errors),
        )

    msg = f"{len(uploaded_names)} document(s) ready for questions."
    if errors:
        msg += f" ({len(errors)} file(s) failed: {'; '.join(errors)})"

    return SelectResponse(
        success=True,
        selected_count=len(uploaded_names),
        selected_names=uploaded_names,
        message=msg,
    )
