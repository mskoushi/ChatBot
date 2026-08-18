"""
Chat API router — send messages and receive AI-generated answers.
Manages conversation history per session.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from chatbot.session import session_store
from citations.extractor import extract_sources
from config import Settings, get_settings
from gemini.client import GeminiClient, GeminiError

router = APIRouter(prefix="/api/chat", tags=["chat"])

# Keep at most this many history messages (rolling window)
MAX_HISTORY = 40  # 20 user + 20 assistant turns


# ── Request / Response models ──────────────────────────────────────────────────

class MessageRequest(BaseModel):
    session_id: str
    message: str


class HistoryItem(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class MessageResponse(BaseModel):
    answer: str
    sources: list[str]
    history: list[HistoryItem]


class ClearRequest(BaseModel):
    session_id: str


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/message", response_model=MessageResponse)
async def send_message(
    req: MessageRequest,
    settings: Settings = Depends(get_settings),
) -> MessageResponse:
    """Send a user message and get an AI-generated answer based on selected documents."""
    session = session_store.get(req.session_id)
    if session is None:
        raise HTTPException(
            status_code=404,
            detail="Session not found. Please reconnect your Google Drive folder.",
        )

    if not session.selected_files:
        raise HTTPException(
            status_code=400,
            detail="No documents are loaded. Please go back and select documents first.",
        )

    message = req.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    if not settings.gemini_api_key:
        raise HTTPException(
            status_code=500, detail="GEMINI_API_KEY is not configured."
        )

    gemini = GeminiClient(settings.gemini_api_key, settings.gemini_model)

    try:
        answer, _raw_sources = gemini.chat(
            history=session.history,
            question=message,
            file_uris=session.selected_files,
        )
    except GeminiError as exc:
        err = str(exc)
        if "api_key" in err.lower() or "invalid" in err.lower() or "permission" in err.lower():
            raise HTTPException(
                status_code=401,
                detail="Invalid API key. Please check the GEMINI_API_KEY in your .env file.",
            ) from exc
        if "quota" in err.lower() or "rate" in err.lower() or "429" in err:
            raise HTTPException(
                status_code=429,
                detail="Request limit reached. Please wait a moment and try again.",
            ) from exc
        raise HTTPException(status_code=500, detail=f"AI service error: {err}") from exc

    # Extract source citations from the answer
    sources = extract_sources(answer, list(session.selected_files.keys()))

    # Update history (rolling window)
    session.history.append({"role": "user", "content": message})
    session.history.append({"role": "assistant", "content": answer})
    if len(session.history) > MAX_HISTORY:
        session.history = session.history[-MAX_HISTORY:]

    return MessageResponse(
        answer=answer,
        sources=sources,
        history=[HistoryItem(**m) for m in session.history],
    )


@router.delete("/session")
async def clear_session(
    req: ClearRequest,
    settings: Settings = Depends(get_settings),
) -> dict:
    """Clear conversation history and delete uploaded Gemini files for a session."""
    session = session_store.delete(req.session_id)
    if session:
        try:
            gemini = GeminiClient(settings.gemini_api_key, settings.gemini_model)
            for uri in session.selected_files.values():
                gemini.delete_file(uri)
        except Exception:
            pass  # Best-effort cleanup

    return {"success": True, "message": "Session cleared."}


@router.get("/history/{session_id}")
async def get_history(session_id: str) -> dict:
    """Return the conversation history for a session (for page refresh recovery)."""
    session = session_store.get(session_id)
    if session is None:
        return {"history": [], "selected_files": []}
    return {
        "history": session.history,
        "selected_files": list(session.selected_files.keys()),
        "folder_name": session.folder_name,
    }
