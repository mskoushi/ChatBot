"""
Session management for the chatbot.

Stores conversation history and document state per user session.
Sessions are held in memory — they reset when the server restarts (V1 is fine with this).
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


@dataclass
class ConversationSession:
    session_id: str

    # Google Drive info
    folder_id: str = ""
    folder_name: str = ""
    access_token: str = ""

    # Available files from Drive: list of {id, name, mimeType, size, modifiedTime}
    available_files: list[dict[str, Any]] = field(default_factory=list)

    # Selected files uploaded to Gemini Files API: {filename: gemini_file_uri}
    selected_files: dict[str, str] = field(default_factory=dict)

    # Conversation history: [{"role": "user"|"assistant", "content": "..."}]
    history: list[dict[str, Any]] = field(default_factory=list)

    created_at: datetime = field(default_factory=_utcnow)
    last_active: datetime = field(default_factory=_utcnow)

    def touch(self) -> None:
        self.last_active = _utcnow()


class SessionStore:
    """In-memory session registry with TTL-based expiry."""

    def __init__(self, ttl_hours: int = 24) -> None:
        self._sessions: dict[str, ConversationSession] = {}
        self._ttl = timedelta(hours=ttl_hours)

    def create(self) -> ConversationSession:
        session = ConversationSession(session_id=str(uuid.uuid4()))
        self._sessions[session.session_id] = session
        return session

    def get(self, session_id: str) -> ConversationSession | None:
        session = self._sessions.get(session_id)
        if session is None:
            return None
        if _utcnow() - session.last_active > self._ttl:
            del self._sessions[session_id]
            return None
        session.touch()
        return session

    def delete(self, session_id: str) -> ConversationSession | None:
        return self._sessions.pop(session_id, None)

    def cleanup_expired(self) -> int:
        """Remove expired sessions. Returns number of sessions removed."""
        now = _utcnow()
        expired = [
            sid for sid, s in self._sessions.items()
            if now - s.last_active > self._ttl
        ]
        for sid in expired:
            del self._sessions[sid]
        return len(expired)


# Singleton store used by all API routes
session_store = SessionStore()
