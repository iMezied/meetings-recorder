"""Meeting CRUD endpoints."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models import MeetingResponse, SummaryResponse, SentimentResponse, TranscriptResponse

router = APIRouter(prefix="/api", tags=["meetings"])


def _get_storage():
    from app.main import storage_service
    return storage_service


@router.get("/meetings", response_model=list[MeetingResponse])
async def list_meetings(
    source: Optional[str] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """List all meetings, optionally filtered by source or search query."""
    ssvc = _get_storage()
    meetings = await ssvc.list_meetings(db, source=source, search=search)
    return [MeetingResponse.model_validate(m) for m in meetings if m.status != "deleted"]


@router.get("/meetings/{meeting_id}", response_model=MeetingResponse)
async def get_meeting(meeting_id: str, db: AsyncSession = Depends(get_db)):
    """Get a single meeting by ID."""
    ssvc = _get_storage()
    meeting = await ssvc.get_meeting(db, meeting_id)
    if not meeting or meeting.status == "deleted":
        raise HTTPException(status_code=404, detail="Meeting not found")
    return MeetingResponse.model_validate(meeting)


@router.delete("/meetings/{meeting_id}")
async def delete_meeting(meeting_id: str, db: AsyncSession = Depends(get_db)):
    """Soft-delete a meeting."""
    ssvc = _get_storage()
    ok = await ssvc.delete_meeting(db, meeting_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return {"status": "deleted", "id": meeting_id}


@router.get("/meetings/{meeting_id}/transcript", response_model=TranscriptResponse)
async def get_transcript(meeting_id: str, db: AsyncSession = Depends(get_db)):
    """Get the transcript for a meeting."""
    ssvc = _get_storage()
    transcript = await ssvc.get_transcript(meeting_id, db)
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")
    return transcript


@router.get("/meetings/{meeting_id}/summary", response_model=SummaryResponse)
async def get_summary(meeting_id: str, db: AsyncSession = Depends(get_db)):
    """Get the summary for a meeting."""
    ssvc = _get_storage()
    summary = await ssvc.get_summary(meeting_id, db)
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found")
    return summary


@router.get("/meetings/{meeting_id}/sentiment", response_model=SentimentResponse)
async def get_sentiment(meeting_id: str, db: AsyncSession = Depends(get_db)):
    """Get the sentiment analysis for a meeting."""
    ssvc = _get_storage()
    sentiment = await ssvc.get_sentiment(meeting_id, db)
    if not sentiment:
        raise HTTPException(status_code=404, detail="Sentiment not found")
    return sentiment
