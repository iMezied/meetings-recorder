"""Audio recording service using sounddevice + soundfile."""

from __future__ import annotations

import logging
import math
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Callable, Optional

import numpy as np
import sounddevice as sd
import soundfile as sf

from app.config import settings

logger = logging.getLogger(__name__)

SAMPLE_RATE = 16_000
CHANNELS = 1
BLOCK_SIZE = 1024


class AudioService:
    """Manages microphone recording to WAV files."""

    def __init__(self) -> None:
        self._is_recording = False
        self._start_time: float = 0.0
        self._stream: Optional[sd.InputStream] = None
        self._thread: Optional[threading.Thread] = None
        self._lock = threading.Lock()
        self._buffer: list[np.ndarray] = []
        self._current_level: float = 0.0
        self._output_path: Optional[Path] = None
        self._source: str = "manual"
        self._on_level: Optional[Callable[[float], None]] = None

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def start_recording(
        self,
        device_id: Optional[int] = None,
        source: str = "manual",
        on_level: Optional[Callable[[float], None]] = None,
    ) -> str:
        """Begin recording. Returns the target file path."""
        with self._lock:
            if self._is_recording:
                raise RuntimeError("Already recording")

            self._source = source
            self._on_level = on_level
            self._buffer.clear()
            self._current_level = 0.0

            # Build output path
            now = datetime.now()
            day_dir = settings.RECORDINGS_DIR / now.strftime("%Y-%m-%d")
            meeting_dir = day_dir / f"{source}-{now.strftime('%H%M%S')}"
            meeting_dir.mkdir(parents=True, exist_ok=True)
            self._output_path = meeting_dir / "audio.wav"

            dev = device_id
            if dev is None and settings.persistent.audio_device:
                try:
                    dev = int(settings.persistent.audio_device)
                except (ValueError, TypeError):
                    dev = None
            try:
                self._stream = sd.InputStream(
                    samplerate=SAMPLE_RATE,
                    channels=CHANNELS,
                    dtype="float32",
                    blocksize=BLOCK_SIZE,
                    device=dev,
                    callback=self._audio_callback,
                )
                self._stream.start()
            except Exception as exc:
                logger.error("Failed to open audio stream: %s", exc)
                raise RuntimeError(f"Cannot open audio device: {exc}") from exc

            self._is_recording = True
            self._start_time = time.monotonic()
            logger.info("Recording started -> %s", self._output_path)
            return str(self._output_path)

    def stop_recording(self) -> str:
        """Stop recording, flush buffer to WAV, return path."""
        with self._lock:
            if not self._is_recording:
                raise RuntimeError("Not recording")

            self._is_recording = False
            if self._stream is not None:
                self._stream.stop()
                self._stream.close()
                self._stream = None

            # Write WAV
            if self._buffer and self._output_path:
                audio_data = np.concatenate(self._buffer, axis=0)
                sf.write(
                    str(self._output_path),
                    audio_data,
                    SAMPLE_RATE,
                    subtype="PCM_16",
                )
                logger.info(
                    "Recording saved: %s (%.1fs)",
                    self._output_path,
                    len(audio_data) / SAMPLE_RATE,
                )

            path = str(self._output_path) if self._output_path else ""
            self._buffer.clear()
            return path

    def get_level(self) -> float:
        """Return current RMS audio level (0.0 – 1.0)."""
        return self._current_level

    def get_duration(self) -> float:
        """Return elapsed recording duration in seconds."""
        if not self._is_recording:
            return 0.0
        return time.monotonic() - self._start_time

    @property
    def is_recording(self) -> bool:
        return self._is_recording

    @property
    def source(self) -> str:
        return self._source

    @staticmethod
    def list_devices() -> list[dict]:
        """Return list of available input audio devices."""
        devices = sd.query_devices()
        default_input = sd.default.device[0]
        result: list[dict] = []
        for idx, dev in enumerate(devices):
            if dev["max_input_channels"] > 0:
                result.append(
                    {
                        "id": str(idx),
                        "name": dev["name"],
                        "is_default": idx == default_input,
                    }
                )
        return result

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _audio_callback(
        self, indata: np.ndarray, frames: int, time_info, status
    ) -> None:
        if status:
            logger.warning("Audio callback status: %s", status)
        if not self._is_recording:
            return
        self._buffer.append(indata.copy())
        # RMS level
        rms = float(np.sqrt(np.mean(indata ** 2)))
        self._current_level = min(rms * 5.0, 1.0)  # scale up for UI
        if self._on_level:
            try:
                self._on_level(self._current_level)
            except Exception:
                pass
