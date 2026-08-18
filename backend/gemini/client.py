"""
Gemini client — uploads PDFs to the Gemini Files API and generates
chat responses using those files as context.

Uses the google-genai SDK (unified, replaces google-generativeai).
"""

from __future__ import annotations

import os
import tempfile
import time
from typing import Any

from google import genai
from google.genai import types

# ── System prompt ──────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """You are a helpful private document assistant.

STRICT RULES:
1. Answer questions using ONLY the content of the provided documents.
2. Do NOT invent, assume, or extrapolate information not present in the documents.
3. If the information cannot be found in the provided documents, respond with:
   "I could not find this information in the provided documents."
4. Be honest about uncertainty.

FORMATTING RULES:
- For comparisons between documents: use a Markdown table.
- For summaries: use bullet points with clear headings.
- For structured data extraction (dates, amounts, names): use a Markdown table.
- Be concise and clear.
- At the end of every answer, include a "**Sources:**" section listing the exact document name(s) you referenced.

Example source format:
**Sources:**
- Record_001.pdf
- Record_003.pdf"""


FALLBACK_MODELS = [
    "gemini-3.6-flash",
    "gemini-3.7-flash",
    "gemini-3.5-flash",
    "gemini-3.1-pro-preview",
]


class GeminiError(Exception):
    """Raised for Gemini API errors."""


class GeminiClient:
    def __init__(self, api_key: str, model: str = "gemini-3.6-flash") -> None:
        self.client = genai.Client(api_key=api_key)
        self.model = model

    # ── File upload ────────────────────────────────────────────────────────────

    def upload_pdf(self, filename: str, content: bytes) -> str:
        """
        Upload PDF bytes to the Gemini Files API.
        Returns the file URI (valid for 48 hours).
        """
        suffix = ".pdf"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        try:
            uploaded = self.client.files.upload(
                file=tmp_path,
                config=types.UploadFileConfig(
                    mime_type="application/pdf",
                    display_name=filename,
                ),
            )
            return uploaded.uri
        except Exception as exc:
            raise GeminiError(f"Failed to upload '{filename}' to Gemini: {exc}") from exc
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    def delete_file(self, file_uri: str) -> None:
        """
        Delete an uploaded file from the Gemini Files API.
        Silently ignores errors (file may have already expired).
        """
        try:
            name = file_uri.rstrip("/").split("/")[-1]
            self.client.files.delete(name=name)
        except Exception:
            pass

    # ── Chat ───────────────────────────────────────────────────────────────────

    def chat(
        self,
        history: list[dict[str, Any]],
        question: str,
        file_uris: dict[str, str],  # {filename: gemini_file_uri}
    ) -> tuple[str, list[str]]:
        """
        Generate a RAG response with model fallback support.
        """
        parts: list[Any] = []

        # Prepend recent conversation history as text context
        if history:
            recent = history[-10:]
            history_lines = []
            for msg in recent:
                role = "User" if msg["role"] == "user" else "Assistant"
                history_lines.append(f"{role}: {msg['content']}")
            history_text = "\n\n".join(history_lines)
            parts.append(
                types.Part.from_text(
                    text=f"[Previous conversation for context]\n{history_text}\n\n---\n\n"
                )
            )

        # Add file references
        for _filename, uri in file_uris.items():
            parts.append(
                types.Part.from_uri(file_uri=uri, mime_type="application/pdf")
            )

        # Add the user's question
        parts.append(types.Part.from_text(text=f"Question: {question}"))

        # Candidate models list with primary model first
        models_to_try = [self.model] + [m for m in FALLBACK_MODELS if m != self.model]

        last_error = None
        for model_name in models_to_try:
            # Retry up to 3 times with backoff for quota/server errors
            for attempt in range(3):
                try:
                    response = self.client.models.generate_content(
                        model=model_name,
                        contents=parts,
                        config=types.GenerateContentConfig(
                            system_instruction=SYSTEM_PROMPT,
                            temperature=0.05,
                            max_output_tokens=4096,
                        ),
                    )
                    answer = response.text or "I could not generate a response."
                    filenames = list(file_uris.keys())
                    sources = _extract_sources(answer, filenames)
                    return answer, sources
                except Exception as exc:
                    err_str = str(exc)
                    last_error = exc
                    # Retry on quota (429) or server unavailable (503) errors
                    if ("429" in err_str or "503" in err_str or "RESOURCE_EXHAUSTED" in err_str or "UNAVAILABLE" in err_str):
                        wait = 5 * (attempt + 1)  # 5s, 10s, 15s
                        time.sleep(wait)
                        continue
                    # For any other error, skip to next model
                    break

        raise GeminiError(f"Gemini API error: {last_error}") from last_error


# ── Source extraction helper ───────────────────────────────────────────────────

def _extract_sources(answer: str, filenames: list[str]) -> list[str]:
    """Find which filenames are explicitly mentioned in the answer."""
    answer_lower = answer.lower()
    mentioned = [
        f for f in filenames
        if f.lower() in answer_lower or f.lower().replace(".pdf", "") in answer_lower
    ]
    return mentioned if mentioned else filenames
