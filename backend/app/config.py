"""Application configuration with persistent settings stored in APP_DIR."""

from __future__ import annotations

import json
import os
import uuid
from dataclasses import dataclass, field, fields, asdict
from pathlib import Path
from typing import Optional


_APP_DIR = Path.home() / "Library" / "Application Support" / "MeetingRecorder"


@dataclass
class PersistentSettings:
    """User-editable settings persisted to settings.json."""

    launch_at_login: bool = False
    auto_record: bool = False
    auto_transcribe: bool = False
    auto_analyze: bool = False
    language: Optional[str] = None
    audio_device: Optional[str] = None
    whisper_model: str = "large-v3"
    huggingface_token: Optional[str] = None
    ollama_model: str = "qwen2.5"
    sync_enabled: bool = False
    sync_provider: Optional[str] = None  # "icloud" | "folder" | None
    sync_path: Optional[str] = None
    storage_location: str = ""

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "PersistentSettings":
        valid_keys = {f.name for f in fields(cls)}
        filtered = {k: v for k, v in data.items() if k in valid_keys}
        return cls(**filtered)


@dataclass
class Settings:
    """Global application settings."""

    APP_DIR: Path = _APP_DIR
    DB_PATH: Path = field(default_factory=lambda: _APP_DIR / "meetings.db")
    RECORDINGS_DIR: Path = field(default_factory=lambda: _APP_DIR / "recordings")
    MODELS_DIR: Path = field(default_factory=lambda: _APP_DIR / "models")
    SYNC_DIR: Optional[Path] = None
    DEFAULT_WHISPER_MODEL: str = "large-v3"
    DEFAULT_LLM_MODEL: str = "qwen2.5"
    OLLAMA_URL: str = "http://localhost:11434"
    DEVICE_ID: str = ""
    persistent: PersistentSettings = field(default_factory=PersistentSettings)

    def __post_init__(self) -> None:
        self._ensure_dirs()
        self.DEVICE_ID = self._load_or_create_device_id()
        self.persistent = self._load_persistent_settings()

    # ------------------------------------------------------------------
    # Directory / file helpers
    # ------------------------------------------------------------------

    def _ensure_dirs(self) -> None:
        for d in (self.APP_DIR, self.RECORDINGS_DIR, self.MODELS_DIR):
            d.mkdir(parents=True, exist_ok=True)

    def _device_json_path(self) -> Path:
        return self.APP_DIR / "device.json"

    def _settings_json_path(self) -> Path:
        return self.APP_DIR / "settings.json"

    # ------------------------------------------------------------------
    # Device ID
    # ------------------------------------------------------------------

    def _load_or_create_device_id(self) -> str:
        path = self._device_json_path()
        if path.exists():
            try:
                data = json.loads(path.read_text())
                return data["device_id"]
            except (json.JSONDecodeError, KeyError):
                pass
        device_id = str(uuid.uuid4())
        path.write_text(json.dumps({"device_id": device_id}, indent=2))
        return device_id

    # ------------------------------------------------------------------
    # Persistent settings
    # ------------------------------------------------------------------

    def _load_persistent_settings(self) -> PersistentSettings:
        path = self._settings_json_path()
        if path.exists():
            try:
                data = json.loads(path.read_text())
                return PersistentSettings.from_dict(data)
            except (json.JSONDecodeError, TypeError):
                pass
        return PersistentSettings()

    def save_persistent_settings(self) -> None:
        path = self._settings_json_path()
        path.write_text(json.dumps(self.persistent.to_dict(), indent=2))

    def update_persistent_settings(self, updates: dict) -> PersistentSettings:
        current = self.persistent.to_dict()
        current.update({k: v for k, v in updates.items() if k in current})
        self.persistent = PersistentSettings.from_dict(current)
        self.save_persistent_settings()
        # If sync path changed, update SYNC_DIR
        if self.persistent.sync_path:
            self.SYNC_DIR = Path(self.persistent.sync_path)
        return self.persistent


# Singleton ----------------------------------------------------------------

settings = Settings()
