"""Pydantic models for request/response schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """Base model that serializes snake_case fields as camelCase in JSON."""
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


# ---------------------------------------------------------------------------
# Meetings
# ---------------------------------------------------------------------------

class MeetingCreate(BaseModel):
    source: str = "manual"  # zoom | google_meet | teams | manual
    title: Optional[str] = None
    audio_path: Optional[str] = None


class MeetingUpdate(BaseModel):
    title: Optional[str] = None
    status: Optional[str] = None


class MeetingResponse(CamelModel):
    id: str
    date: str
    source: str
    duration: Optional[float] = None
    audio_path: Optional[str] = None
    transcript_path: Optional[str] = None
    summary_path: Optional[str] = None
    sentiment_path: Optional[str] = None
    status: str
    title: Optional[str] = None
    created_at: str
    synced_at: Optional[str] = None
    device_id: Optional[str] = None


# ---------------------------------------------------------------------------
# Transcription
# ---------------------------------------------------------------------------

class TranscriptSegment(BaseModel):
    start: float
    end: float
    text: str
    speaker: Optional[str] = None


class TranscriptResponse(BaseModel):
    segments: list[TranscriptSegment] = []
    language: Optional[str] = None
    duration: Optional[float] = None


# ---------------------------------------------------------------------------
# Analysis – Summary
# ---------------------------------------------------------------------------

class ActionItem(BaseModel):
    task: str
    assignee: Optional[str] = None
    deadline: Optional[str] = None


class SummaryResponse(BaseModel):
    title: str = ""
    overview: str = ""
    keyPoints: list[str] = []
    actionItems: list[ActionItem] = []
    decisions: list[str] = []
    openQuestions: list[str] = []


# ---------------------------------------------------------------------------
# Analysis – Sentiment
# ---------------------------------------------------------------------------

class SpeakerSentiment(BaseModel):
    name: str
    sentiment: str = ""
    engagement: str = ""
    toneDescriptors: list[str] = []
    style: str = ""
    contributions: list[str] = []


class SentimentResponse(BaseModel):
    speakers: list[SpeakerSentiment] = []
    overallMeetingTone: str = ""
    dynamicsSummary: str = ""


# ---------------------------------------------------------------------------
# Recording / Detector
# ---------------------------------------------------------------------------

class RecordingStatus(CamelModel):
    is_recording: bool = False
    duration: float = 0.0
    level: float = 0.0
    source: Optional[str] = None


class DetectorStatus(CamelModel):
    is_monitoring: bool = False
    detected_meeting: bool = False
    meeting_source: Optional[str] = None


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class ModelInfo(BaseModel):
    name: str
    size: str
    description: str
    downloaded: bool = False


class ModelDownloadRequest(BaseModel):
    name: str


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------

class SettingsModel(CamelModel):
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
    sync_provider: Optional[str] = None
    sync_path: Optional[str] = None
    storage_location: str = ""


# ---------------------------------------------------------------------------
# Sync
# ---------------------------------------------------------------------------

class SyncStatus(CamelModel):
    enabled: bool = False
    provider: Optional[str] = None
    last_sync: Optional[str] = None
    pending_changes: int = 0


class SyncConfigureRequest(BaseModel):
    method: Optional[str] = None
    path: Optional[str] = None
    sync_audio: bool = True


# ---------------------------------------------------------------------------
# Audio devices
# ---------------------------------------------------------------------------

class AudioDevice(CamelModel):
    id: str
    name: str
    is_default: bool = False


# ---------------------------------------------------------------------------
# Misc / Events
# ---------------------------------------------------------------------------

class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "0.1.0"


class OllamaStatus(BaseModel):
    available: bool = False
    models: list[str] = []
