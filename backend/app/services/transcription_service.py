"""Transcription service using faster-whisper + pyannote diarization."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Callable, Optional

from app.config import settings
from app.models import TranscriptResponse, TranscriptSegment

logger = logging.getLogger(__name__)

# Model catalogue with approximate sizes
WHISPER_MODELS: dict[str, dict] = {
    "tiny": {"size": "75 MB", "description": "Fastest, lowest accuracy"},
    "base": {"size": "142 MB", "description": "Fast, basic accuracy"},
    "small": {"size": "466 MB", "description": "Balanced speed and accuracy"},
    "medium": {"size": "1.5 GB", "description": "Good accuracy, moderate speed"},
    "large-v3": {"size": "3.1 GB", "description": "Best accuracy, slow"},
}


class TranscriptionService:
    """Wraps faster-whisper transcription and pyannote speaker diarization."""

    def __init__(self) -> None:
        self._whisper_model = None
        self._whisper_model_name: Optional[str] = None
        self._diarization_pipeline = None
        self._download_progress: dict[str, float] = {}

    # ------------------------------------------------------------------
    # Transcription
    # ------------------------------------------------------------------

    async def transcribe(
        self,
        audio_path: str,
        model_name: Optional[str] = None,
        language: Optional[str] = None,
        on_progress: Optional[Callable[[str, float], None]] = None,
    ) -> TranscriptResponse:
        """Transcribe audio file, optionally with speaker diarization.

        Steps:
        1. faster-whisper transcription
        2. pyannote speaker diarization (if HF token is available)
        3. Merge segments by timestamp overlap
        """
        import asyncio

        model_name = model_name or settings.DEFAULT_WHISPER_MODEL
        # Auto-select large-v3 for Arabic
        if language and language.startswith("ar"):
            model_name = "large-v3"

        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            self._transcribe_sync,
            audio_path,
            model_name,
            language,
            on_progress,
        )

    def _transcribe_sync(
        self,
        audio_path: str,
        model_name: str,
        language: Optional[str],
        on_progress: Optional[Callable[[str, float], None]],
    ) -> TranscriptResponse:
        from faster_whisper import WhisperModel

        if on_progress:
            on_progress("loading_model", 0.0)

        # Load / cache model
        if self._whisper_model is None or self._whisper_model_name != model_name:
            self._whisper_model = WhisperModel(
                model_name,
                device="cpu",
                compute_type="int8",
                download_root=str(settings.MODELS_DIR),
            )
            self._whisper_model_name = model_name

        if on_progress:
            on_progress("transcribing", 0.1)

        # Step 1: Transcription
        whisper_kwargs: dict = {"beam_size": 5, "vad_filter": True}
        if language:
            whisper_kwargs["language"] = language

        segments_iter, info = self._whisper_model.transcribe(
            audio_path, **whisper_kwargs
        )
        whisper_segments: list[dict] = []
        for seg in segments_iter:
            whisper_segments.append(
                {"start": seg.start, "end": seg.end, "text": seg.text.strip()}
            )

        detected_lang = info.language
        duration = info.duration

        if on_progress:
            on_progress("transcribing", 0.6)

        # Step 2: Speaker diarization (optional)
        hf_token = settings.persistent.huggingface_token
        speaker_map: dict[tuple[float, float], str] = {}

        if hf_token:
            try:
                if on_progress:
                    on_progress("diarizing", 0.65)
                speaker_map = self._diarize(audio_path, hf_token)
            except Exception:
                logger.exception("Diarization failed, continuing without speakers")

        if on_progress:
            on_progress("merging", 0.9)

        # Step 3: Merge
        result_segments: list[TranscriptSegment] = []
        for ws in whisper_segments:
            speaker = self._match_speaker(ws["start"], ws["end"], speaker_map)
            result_segments.append(
                TranscriptSegment(
                    start=round(ws["start"], 2),
                    end=round(ws["end"], 2),
                    text=ws["text"],
                    speaker=speaker,
                )
            )

        if on_progress:
            on_progress("done", 1.0)

        return TranscriptResponse(
            segments=result_segments,
            language=detected_lang,
            duration=duration,
        )

    # ------------------------------------------------------------------
    # Diarization
    # ------------------------------------------------------------------

    def _diarize(
        self, audio_path: str, hf_token: str
    ) -> dict[tuple[float, float], str]:
        from pyannote.audio import Pipeline as PyannotePipeline

        if self._diarization_pipeline is None:
            self._diarization_pipeline = PyannotePipeline.from_pretrained(
                "pyannote/speaker-diarization-3.1",
                use_auth_token=hf_token,
            )

        diarization = self._diarization_pipeline(audio_path)
        speaker_map: dict[tuple[float, float], str] = {}
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            speaker_map[(turn.start, turn.end)] = speaker
        return speaker_map

    @staticmethod
    def _match_speaker(
        start: float,
        end: float,
        speaker_map: dict[tuple[float, float], str],
    ) -> Optional[str]:
        """Find the speaker with the greatest overlap for a given segment."""
        if not speaker_map:
            return None
        best_speaker = None
        best_overlap = 0.0
        for (s_start, s_end), speaker in speaker_map.items():
            overlap_start = max(start, s_start)
            overlap_end = min(end, s_end)
            overlap = max(0.0, overlap_end - overlap_start)
            if overlap > best_overlap:
                best_overlap = overlap
                best_speaker = speaker
        return best_speaker

    # ------------------------------------------------------------------
    # Model management
    # ------------------------------------------------------------------

    def list_models(self) -> list[dict]:
        """Return available models with their download status."""
        models_dir = settings.MODELS_DIR
        result = []
        for name, info in WHISPER_MODELS.items():
            # faster-whisper stores models in subdirectories
            downloaded = (models_dir / f"models--Systran--faster-whisper-{name}").exists()
            result.append(
                {
                    "name": name,
                    "size": info["size"],
                    "description": info["description"],
                    "downloaded": downloaded,
                }
            )
        return result

    async def download_model(
        self,
        name: str,
        on_progress: Optional[Callable[[float], None]] = None,
    ) -> None:
        """Download a whisper model (runs in executor)."""
        import asyncio

        if name not in WHISPER_MODELS:
            raise ValueError(f"Unknown model: {name}")

        self._download_progress[name] = 0.0

        def _do_download():
            from faster_whisper import WhisperModel

            self._download_progress[name] = 0.1
            if on_progress:
                on_progress(0.1)
            WhisperModel(
                name,
                device="cpu",
                compute_type="int8",
                download_root=str(settings.MODELS_DIR),
            )
            self._download_progress[name] = 1.0
            if on_progress:
                on_progress(1.0)

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _do_download)

    def get_download_progress(self, name: str) -> float:
        return self._download_progress.get(name, 0.0)
