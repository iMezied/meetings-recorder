"""Transcription and model management endpoints."""

from __future__ import annotations

import asyncio
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sse_starlette.sse import EventSourceResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models import ModelDownloadRequest, ModelInfo

router = APIRouter(prefix="/api", tags=["transcription"])


def _get_services():
    from app.main import transcription_service, storage_service, event_bus
    return transcription_service, storage_service, event_bus


@router.post("/transcribe/{meeting_id}")
async def transcribe_meeting(
    meeting_id: str,
    model: Optional[str] = None,
    language: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Transcribe a meeting's audio file."""
    tsvc, ssvc, bus = _get_services()

    meeting = await ssvc.get_meeting(db, meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    if not meeting.audio_path:
        raise HTTPException(status_code=400, detail="No audio file for this meeting")

    def on_progress(stage: str, pct: float):
        try:
            bus.put_nowait({
                "event": "transcription:progress",
                "data": {
                    "meeting_id": meeting_id,
                    "stage": stage,
                    "progress": round(pct, 2),
                },
            })
        except asyncio.QueueFull:
            pass

    try:
        transcript = await tsvc.transcribe(
            meeting.audio_path,
            model_name=model,
            language=language,
            on_progress=on_progress,
        )
        await ssvc.save_transcript(db, meeting_id, transcript)
        return transcript.model_dump()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/models", response_model=list[ModelInfo])
async def list_models():
    """List available whisper models."""
    tsvc, _, _ = _get_services()
    models = tsvc.list_models()
    return [ModelInfo(**m) for m in models]


@router.post("/models/download")
async def download_model(req: ModelDownloadRequest):
    """Start downloading a whisper model."""
    tsvc, _, bus = _get_services()

    async def _download():
        def on_progress(pct: float):
            try:
                bus.put_nowait({
                    "event": "model:download:progress",
                    "data": {"model": req.name, "progress": round(pct, 2)},
                })
            except asyncio.QueueFull:
                pass

        try:
            await tsvc.download_model(req.name, on_progress=on_progress)
            try:
                bus.put_nowait({
                    "event": "model:download:complete",
                    "data": {"model": req.name},
                })
            except asyncio.QueueFull:
                pass
        except Exception as exc:
            try:
                bus.put_nowait({
                    "event": "model:download:error",
                    "data": {"model": req.name, "error": str(exc)},
                })
            except asyncio.QueueFull:
                pass

    asyncio.create_task(_download())
    return {"status": "downloading", "model": req.name}


@router.get("/models/download/progress")
async def model_download_progress_sse():
    """SSE endpoint streaming model download progress."""
    _, _, bus = _get_services()

    async def generate():
        while True:
            try:
                msg = await asyncio.wait_for(bus.get(), timeout=30)
                if isinstance(msg, dict) and msg.get("event", "").startswith("model:download"):
                    import json
                    yield {
                        "event": msg["event"],
                        "data": json.dumps(msg.get("data", {})),
                    }
            except asyncio.TimeoutError:
                yield {"event": "ping", "data": ""}

    return EventSourceResponse(generate())
