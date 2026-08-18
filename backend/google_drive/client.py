"""
Google Drive client — lists and downloads files from publicly shared folders.
Requires a Google Cloud API key with the Drive API enabled.
The folder must be shared as "Anyone with the link can view".
"""

from __future__ import annotations

import io
import re
from typing import Any

import requests

DRIVE_API_BASE = "https://www.googleapis.com/drive/v3"
PDF_MIME = "application/pdf"


class DriveError(Exception):
    """Raised for all Google Drive access errors."""


class DriveClient:
    def __init__(self, api_key: str = "", access_token: str = "") -> None:
        self.api_key = api_key
        self.access_token = access_token
        self._session = requests.Session()
        if access_token:
            self._session.headers.update({"Authorization": f"Bearer {access_token}"})
        elif api_key:
            self._session.params = {"key": api_key}  # type: ignore[assignment]

    # ── URL parsing ────────────────────────────────────────────────────────────

    @staticmethod
    def extract_folder_id(url: str) -> str | None:
        """
        Extract the folder ID from a Google Drive folder URL.
        Handles formats:
          https://drive.google.com/drive/folders/<ID>
          https://drive.google.com/drive/folders/<ID>?usp=sharing
          https://drive.google.com/open?id=<ID>
        """
        patterns = [
            r"/folders/([a-zA-Z0-9_-]{10,})",
            r"[?&]id=([a-zA-Z0-9_-]{10,})",
        ]
        for pattern in patterns:
            m = re.search(pattern, url)
            if m:
                return m.group(1)
        return None

    # ── Folder metadata ────────────────────────────────────────────────────────

    def get_folder_name(self, folder_id: str) -> str:
        """Return the display name of a Drive folder."""
        try:
            resp = self._session.get(
                f"{DRIVE_API_BASE}/files/{folder_id}",
                params={"fields": "name"},
                timeout=15,
            )
            resp.raise_for_status()
            return resp.json().get("name", "Google Drive Folder")
        except Exception:
            return "Google Drive Folder"

    # ── File listing ───────────────────────────────────────────────────────────

    def list_files(self, folder_id: str, mime_type: str = PDF_MIME) -> list[dict[str, Any]]:
        """
        List all files of the given MIME type inside a folder.
        Handles pagination automatically.
        """
        files: list[dict[str, Any]] = []
        page_token: str | None = None

        while True:
            params: dict[str, Any] = {
                "q": f"'{folder_id}' in parents and mimeType='{mime_type}' and trashed=false",
                "fields": "nextPageToken,files(id,name,mimeType,size,modifiedTime)",
                "pageSize": 100,
                "orderBy": "name",
            }
            if page_token:
                params["pageToken"] = page_token

            try:
                resp = self._session.get(f"{DRIVE_API_BASE}/files", params=params, timeout=30)
            except requests.RequestException as exc:
                raise DriveError(f"Network error listing files: {exc}") from exc

            if resp.status_code == 403:
                raise DriveError(
                    "Access denied. Make sure the folder is shared as "
                    "'Anyone with the link can view'."
                )
            if resp.status_code == 404:
                raise DriveError("Folder not found. Please check the URL.")
            if not resp.ok:
                raise DriveError(f"Drive API error {resp.status_code}: {resp.text[:200]}")

            data = resp.json()
            files.extend(data.get("files", []))
            page_token = data.get("nextPageToken")
            if not page_token:
                break

        return files

    # ── File download ──────────────────────────────────────────────────────────

    def download_file(self, file_id: str) -> bytes:
        """
        Download a file's raw bytes from Google Drive.
        Handles large-file confirmation for virus-scan bypass.
        """
        params: dict[str, Any] = {"alt": "media", "acknowledgeAbuse": "true"}

        try:
            resp = self._session.get(
                f"{DRIVE_API_BASE}/files/{file_id}",
                params=params,
                timeout=120,
                stream=True,
            )
        except requests.RequestException as exc:
            raise DriveError(f"Network error downloading file: {exc}") from exc

        # Google sometimes returns a confirmation page for large files
        content_type = resp.headers.get("Content-Type", "")
        if resp.status_code == 200 and "text/html" in content_type:
            # Re-request with explicit confirm
            params["confirm"] = "1"
            resp = self._session.get(
                f"{DRIVE_API_BASE}/files/{file_id}",
                params=params,
                timeout=120,
                stream=True,
            )

        if resp.status_code == 403:
            raise DriveError("Cannot download file — insufficient permissions.")
        if not resp.ok:
            raise DriveError(f"Download failed with status {resp.status_code}.")

        buf = io.BytesIO()
        for chunk in resp.iter_content(chunk_size=65536):
            buf.write(chunk)
        return buf.getvalue()
