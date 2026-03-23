"""Meeting detection service – polls running processes and browser tabs."""

from __future__ import annotations

import asyncio
import logging
import platform
import subprocess
from typing import Callable, Optional

import psutil

logger = logging.getLogger(__name__)

# Process-name patterns per meeting source
_ZOOM_NAMES = {"zoom.us", "CptHost"}
_TEAMS_NAMES = {"Microsoft Teams", "MSTeams", "Teams"}


class DetectorService:
    """Monitors the system for active video-conference meetings."""

    def __init__(self) -> None:
        self._is_monitoring = False
        self._task: Optional[asyncio.Task] = None
        self._detected_meeting = False
        self._meeting_source: Optional[str] = None
        self._consecutive_absent = 0
        self._debounce_threshold = 2  # polls with no meeting before ending
        self._on_detected: Optional[Callable[[str], None]] = None
        self._on_ended: Optional[Callable[[], None]] = None

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def set_callbacks(
        self,
        on_detected: Optional[Callable[[str], None]] = None,
        on_ended: Optional[Callable[[], None]] = None,
    ) -> None:
        self._on_detected = on_detected
        self._on_ended = on_ended

    async def start_monitoring(self) -> None:
        if self._is_monitoring:
            return
        self._is_monitoring = True
        self._task = asyncio.create_task(self._poll_loop())
        logger.info("Meeting detector started")

    async def stop_monitoring(self) -> None:
        self._is_monitoring = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        logger.info("Meeting detector stopped")

    @property
    def is_monitoring(self) -> bool:
        return self._is_monitoring

    @property
    def detected_meeting(self) -> bool:
        return self._detected_meeting

    @property
    def meeting_source(self) -> Optional[str]:
        return self._meeting_source

    # ------------------------------------------------------------------
    # Polling loop
    # ------------------------------------------------------------------

    async def _poll_loop(self) -> None:
        while self._is_monitoring:
            try:
                source = await asyncio.get_event_loop().run_in_executor(
                    None, self._detect
                )
                if source:
                    self._consecutive_absent = 0
                    if not self._detected_meeting:
                        self._detected_meeting = True
                        self._meeting_source = source
                        logger.info("Meeting detected: %s", source)
                        if self._on_detected:
                            self._on_detected(source)
                else:
                    if self._detected_meeting:
                        self._consecutive_absent += 1
                        if self._consecutive_absent >= self._debounce_threshold:
                            logger.info("Meeting ended (was %s)", self._meeting_source)
                            self._detected_meeting = False
                            prev_source = self._meeting_source
                            self._meeting_source = None
                            if self._on_ended:
                                self._on_ended()
            except Exception:
                logger.exception("Detector poll error")

            await asyncio.sleep(3)

    # ------------------------------------------------------------------
    # Detection helpers (run in thread)
    # ------------------------------------------------------------------

    def _detect(self) -> Optional[str]:
        """Return the detected meeting source, or None."""
        if self._check_zoom():
            return "zoom"
        if self._check_teams():
            return "teams"
        if self._check_google_meet():
            return "google_meet"
        return None

    def _check_zoom(self) -> bool:
        try:
            for proc in psutil.process_iter(["name"]):
                if proc.info["name"] in _ZOOM_NAMES:
                    return True
        except (psutil.Error, KeyError):
            pass
        return False

    def _check_teams(self) -> bool:
        try:
            for proc in psutil.process_iter(["name"]):
                if proc.info["name"] in _TEAMS_NAMES:
                    return True
        except (psutil.Error, KeyError):
            pass
        return False

    def _check_google_meet(self) -> bool:
        """Use AppleScript to check for meet.google.com in browser tabs."""
        if platform.system() != "Darwin":
            return False

        browsers = [
            ("Google Chrome", 'tell application "Google Chrome" to get URL of active tab of first window'),
            ("Safari", 'tell application "Safari" to get URL of current tab of first window'),
            ("Arc", 'tell application "Arc" to get URL of active tab of first window'),
        ]

        for browser_name, script in browsers:
            if not self._is_process_running(browser_name):
                continue
            try:
                result = subprocess.run(
                    ["osascript", "-e", script],
                    capture_output=True,
                    text=True,
                    timeout=3,
                )
                if result.returncode == 0 and "meet.google.com" in result.stdout:
                    return True
            except (subprocess.TimeoutExpired, Exception):
                continue
        return False

    @staticmethod
    def _is_process_running(name: str) -> bool:
        try:
            for proc in psutil.process_iter(["name"]):
                if proc.info["name"] and name.lower() in proc.info["name"].lower():
                    return True
        except (psutil.Error, KeyError):
            pass
        return False
