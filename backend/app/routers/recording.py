"""Recording endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models import RecordingStatus

router = APIRouter(prefix="/api", tags=["recording"])


def _get_audio_service():
    from app.main import audio_service
    return audio_service


@router.post("/recording/start")
async def start_recording(device_id: int | None = None, source: str = "manual"):
    """Start audio recording."""
    svc = _get_audio_service()
    try:
        path = svc.start_recording(device_id=device_id, source=source)
        return {"status": "recording", "path": path}
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/recording/stop")
async def stop_recording():
    """Stop audio recording and return the file path."""
    svc = _get_audio_service()
    try:
        path = svc.stop_recording()
        return {"status": "stopped", "path": path}
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/recording/status", response_model=RecordingStatus)
async def recording_status():
    """Get current recording status."""
    svc = _get_audio_service()
    return RecordingStatus(
        is_recording=svc.is_recording,
        duration=svc.get_duration(),
        level=svc.get_level(),
        source=svc.source if svc.is_recording else None,
    )
