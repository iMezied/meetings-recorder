"""LLM analysis endpoints (summary + sentiment via Ollama)."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models import OllamaStatus

router = APIRouter(prefix="/api", tags=["analysis"])


def _get_services():
    from app.main import ollama_service, storage_service
    return ollama_service, storage_service


@router.post("/analyze/{meeting_id}")
async def analyze_meeting(
    meeting_id: str,
    model: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Generate summary and sentiment analysis for a meeting."""
    osvc, ssvc = _get_services()

    meeting = await ssvc.get_meeting(db, meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    transcript = await ssvc.get_transcript(meeting_id, db)
    if not transcript:
        raise HTTPException(status_code=400, detail="No transcript available. Transcribe first.")

    # Build plain text from segments
    lines: list[str] = []
    for seg in transcript.segments:
        speaker = seg.speaker or "Speaker"
        lines.append(f"[{speaker}] {seg.text}")
    transcript_text = "\n".join(lines)

    try:
        summary = await osvc.generate_summary(transcript_text, model=model)
        await ssvc.save_summary(db, meeting_id, summary)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Summary generation failed: {exc}")

    try:
        sentiment = await osvc.analyze_sentiment(transcript_text, model=model)
        await ssvc.save_sentiment(db, meeting_id, sentiment)
    except Exception as exc:
        # Sentiment is optional; don't fail the whole request
        sentiment = None

    result = {"summary": summary.model_dump()}
    if sentiment:
        result["sentiment"] = sentiment.model_dump()
    return result


@router.get("/ollama/status", response_model=OllamaStatus)
async def ollama_status():
    """Check Ollama availability and list models."""
    osvc, _ = _get_services()
    available, models = await osvc.check_status()
    return OllamaStatus(available=available, models=models)
