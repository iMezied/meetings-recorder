"""FastAPI application entry point."""

from __future__ import annotations

import asyncio
import json
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

from app.config import settings
from app.db.database import init_db, async_session_factory
from app.models import AudioDevice, HealthResponse, SettingsModel
from app.services.audio_service import AudioService
from app.services.detector_service import DetectorService
from app.services.ollama_service import OllamaService
from app.services.storage_service import StorageService
from app.services.sync_service import SyncService
from app.services.transcription_service import TranscriptionService

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Global service instances
# ---------------------------------------------------------------------------

event_bus: asyncio.Queue = asyncio.Queue(maxsize=256)

audio_service = AudioService()
detector_service = DetectorService()
transcription_service = TranscriptionService()
ollama_service = OllamaService()
storage_service = StorageService()
sync_service = SyncService(storage=storage_service)


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    logger.info("Starting Meeting Recorder backend ...")
    logger.info("APP_DIR: %s", settings.APP_DIR)
    logger.info("DEVICE_ID: %s", settings.DEVICE_ID)

    # Initialise database
    await init_db()

    # Wire up detector callbacks
    def on_meeting_detected(source: str):
        try:
            event_bus.put_nowait({
                "event": "meeting:detected",
                "data": {"source": source},
            })
        except asyncio.QueueFull:
            pass

        # Auto-record if enabled
        if settings.persistent.auto_record and not audio_service.is_recording:
            try:
                audio_service.start_recording(source=source)
                event_bus.put_nowait({
                    "event": "recording:started",
                    "data": {"source": source},
                })
            except Exception:
                logger.exception("Auto-record failed")

    def on_meeting_ended():
        try:
            event_bus.put_nowait({"event": "meeting:ended", "data": {}})
        except asyncio.QueueFull:
            pass

        # Auto-stop recording
        if audio_service.is_recording:
            try:
                path = audio_service.stop_recording()
                event_bus.put_nowait({
                    "event": "recording:stopped",
                    "data": {"path": path},
                })
            except Exception:
                logger.exception("Auto-stop failed")

    detector_service.set_callbacks(
        on_detected=on_meeting_detected,
        on_ended=on_meeting_ended,
    )

    # Start background monitoring
    await detector_service.start_monitoring()

    # Start sync if enabled
    if settings.persistent.sync_enabled:
        await sync_service.start_auto_sync(async_session_factory)

    # Start periodic level broadcasting
    level_task = asyncio.create_task(_broadcast_levels())

    logger.info("Backend ready.")
    yield

    # Shutdown
    level_task.cancel()
    await detector_service.stop_monitoring()
    await sync_service.stop_auto_sync()
    if audio_service.is_recording:
        audio_service.stop_recording()
    logger.info("Backend shut down.")


async def _broadcast_levels():
    """Periodically push audio levels to the event bus while recording."""
    while True:
        try:
            if audio_service.is_recording:
                try:
                    event_bus.put_nowait({
                        "event": "recording:level",
                        "data": {
                            "level": round(audio_service.get_level(), 3),
                            "duration": round(audio_service.get_duration(), 1),
                        },
                    })
                except asyncio.QueueFull:
                    pass
            await asyncio.sleep(0.25)
        except asyncio.CancelledError:
            break
        except Exception:
            await asyncio.sleep(1)


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Meeting Recorder",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
from app.routers import recording, transcription, analysis, meetings, sync  # noqa: E402

app.include_router(recording.router)
app.include_router(transcription.router)
app.include_router(analysis.router)
app.include_router(meetings.router)
app.include_router(sync.router)


# ---------------------------------------------------------------------------
# Top-level endpoints
# ---------------------------------------------------------------------------

@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse()


@app.get("/api/events")
async def events_sse():
    """Global SSE endpoint for all push events."""

    async def generate():
        while True:
            try:
                msg = await asyncio.wait_for(event_bus.get(), timeout=30)
                if isinstance(msg, dict):
                    yield {
                        "event": msg.get("event", "message"),
                        "data": json.dumps(msg.get("data", {})),
                    }
            except asyncio.TimeoutError:
                # Send keepalive
                yield {"event": "ping", "data": ""}

    return EventSourceResponse(generate())


@app.get("/api/settings")
async def get_settings():
    data = settings.persistent.to_dict()
    data["storage_location"] = str(settings.APP_DIR)
    return SettingsModel(**data).model_dump(by_alias=True)


@app.put("/api/settings")
async def update_settings(body: SettingsModel):
    # Convert camelCase input to snake_case for storage
    updates = body.model_dump(exclude_unset=True, by_alias=False)
    updated = settings.update_persistent_settings(updates)
    data = updated.to_dict()
    data["storage_location"] = str(settings.APP_DIR)
    return SettingsModel(**data).model_dump(by_alias=True)


@app.get("/api/audio/devices")
async def list_audio_devices():
    devices = audio_service.list_devices()
    return [AudioDevice(**d).model_dump(by_alias=True) for d in devices]


# ---------------------------------------------------------------------------
# Detector / Monitoring
# ---------------------------------------------------------------------------

@app.post("/api/detector/start")
async def start_monitoring():
    await detector_service.start_monitoring()
    return {"message": "Monitoring started"}


@app.post("/api/detector/stop")
async def stop_monitoring():
    await detector_service.stop_monitoring()
    return {"message": "Monitoring stopped"}


@app.get("/api/detector/status")
async def get_detector_status():
    from app.models import DetectorStatus
    return DetectorStatus(
        is_monitoring=detector_service.is_monitoring,
        detected_meeting=detector_service.detected_meeting,
        meeting_source=detector_service.meeting_source,
    )


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def run():
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=8765,
        reload=False,
        log_level="info",
    )


if __name__ == "__main__":
    run()
