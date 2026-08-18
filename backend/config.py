"""
Central configuration — loads from .env via pydantic-settings.
Never access os.environ directly; always import settings from here.
"""

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Gemini / Google AI Studio
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"

    # Google Drive (API key with Drive API enabled)
    google_drive_api_key: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )


@lru_cache()
def get_settings() -> Settings:
    """Cached settings singleton — reads .env once on first call."""
    return Settings()
