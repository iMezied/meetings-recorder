"""Storage service – CRUD for meetings and associated artefacts."""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from sqlalchemy import select, text, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models import Meeting
from app.models import (
    MeetingResponse,
    SummaryResponse,
    SentimentResponse,
    TranscriptResponse,
)

logger = logging.getLogger(__name__)


class StorageService:
    """Manages meeting records and their associated files."""

    # ------------------------------------------------------------------
    # Meetings CRUD
    # ------------------------------------------------------------------

    async def create_meeting(
        self, db: AsyncSession, *, source: str = "manual", title: Optional[str] = None,
        audio_path: Optional[str] = None, duration: Optional[float] = None,
    ) -> Meeting:
        now = datetime.now(timezone.utc)
        meeting = Meeting(
            date=now.strftime("%Y-%m-%d"),
            source=source,
            duration=duration,
            audio_path=audio_path,
            status="recorded",
            title=title,
            created_at=now.isoformat(),
            device_id=settings.DEVICE_ID,
        )
        db.add(meeting)
        await db.commit()
        await db.refresh(meeting)
        logger.info("Created meeting %s", meeting.id)
        return meeting

    async def get_meeting(self, db: AsyncSession, meeting_id: str) -> Optional[Meeting]:
        result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
        return result.scalar_one_or_none()

    async def list_meetings(
        self,
        db: AsyncSession,
        source: Optional[str] = None,
        search: Optional[str] = None,
    ) -> list[Meeting]:
        stmt = select(Meeting).order_by(Meeting.created_at.desc())
        if source:
            stmt = stmt.where(Meeting.source == source)
        if search:
            # Use FTS if available, fallback to title LIKE
            fts_ids = await self._fts_search(db, search)
            if fts_ids:
                stmt = stmt.where(Meeting.id.in_(fts_ids))
            else:
                stmt = stmt.where(Meeting.title.ilike(f"%{search}%"))
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def delete_meeting(self, db: AsyncSession, meeting_id: str) -> bool:
        """Soft delete by setting status to 'deleted'."""
        meeting = await self.get_meeting(db, meeting_id)
        if not meeting:
            return False
        meeting.status = "deleted"
        await db.commit()
        logger.info("Soft-deleted meeting %s", meeting_id)
        return True

    async def update_meeting(
        self, db: AsyncSession, meeting_id: str, **kwargs
    ) -> Optional[Meeting]:
        meeting = await self.get_meeting(db, meeting_id)
        if not meeting:
            return None
        for key, value in kwargs.items():
            if hasattr(meeting, key) and value is not None:
                setattr(meeting, key, value)
        await db.commit()
        await db.refresh(meeting)
        return meeting

    # ------------------------------------------------------------------
    # Transcript
    # ------------------------------------------------------------------

    async def save_transcript(
        self, db: AsyncSession, meeting_id: str, transcript: TranscriptResponse
    ) -> str:
        meeting = await self.get_meeting(db, meeting_id)
        if not meeting:
            raise ValueError(f"Meeting {meeting_id} not found")

        # Determine path next to audio file
        if meeting.audio_path:
            base_dir = Path(meeting.audio_path).parent
        else:
            base_dir = settings.RECORDINGS_DIR / meeting.date / f"meeting-{meeting_id}"
            base_dir.mkdir(parents=True, exist_ok=True)

        path = base_dir / "transcript.json"
        path.write_text(transcript.model_dump_json(indent=2))

        meeting.transcript_path = str(path)
        meeting.status = "transcribed"
        if transcript.duration:
            meeting.duration = transcript.duration
        await db.commit()

        # Index in FTS
        full_text = " ".join(seg.text for seg in transcript.segments)
        await self._fts_insert(db, meeting_id, full_text)

        return str(path)

    async def get_transcript(self, meeting_id: str, db: AsyncSession) -> Optional[TranscriptResponse]:
        meeting = await self.get_meeting(db, meeting_id)
        if not meeting or not meeting.transcript_path:
            return None
        path = Path(meeting.transcript_path)
        if not path.exists():
            return None
        data = json.loads(path.read_text())
        return TranscriptResponse(**data)

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------

    async def save_summary(
        self, db: AsyncSession, meeting_id: str, summary: SummaryResponse
    ) -> str:
        meeting = await self.get_meeting(db, meeting_id)
        if not meeting:
            raise ValueError(f"Meeting {meeting_id} not found")

        if meeting.audio_path:
            base_dir = Path(meeting.audio_path).parent
        else:
            base_dir = settings.RECORDINGS_DIR / meeting.date / f"meeting-{meeting_id}"
            base_dir.mkdir(parents=True, exist_ok=True)

        path = base_dir / "summary.json"
        path.write_text(summary.model_dump_json(indent=2))

        meeting.summary_path = str(path)
        if summary.title:
            meeting.title = summary.title
        meeting.status = "analyzed"
        await db.commit()
        return str(path)

    async def get_summary(self, meeting_id: str, db: AsyncSession) -> Optional[SummaryResponse]:
        meeting = await self.get_meeting(db, meeting_id)
        if not meeting or not meeting.summary_path:
            return None
        path = Path(meeting.summary_path)
        if not path.exists():
            return None
        data = json.loads(path.read_text())
        return SummaryResponse(**data)

    # ------------------------------------------------------------------
    # Sentiment
    # ------------------------------------------------------------------

    async def save_sentiment(
        self, db: AsyncSession, meeting_id: str, sentiment: SentimentResponse
    ) -> str:
        meeting = await self.get_meeting(db, meeting_id)
        if not meeting:
            raise ValueError(f"Meeting {meeting_id} not found")

        if meeting.audio_path:
            base_dir = Path(meeting.audio_path).parent
        else:
            base_dir = settings.RECORDINGS_DIR / meeting.date / f"meeting-{meeting_id}"
            base_dir.mkdir(parents=True, exist_ok=True)

        path = base_dir / "sentiment.json"
        path.write_text(sentiment.model_dump_json(indent=2))

        meeting.sentiment_path = str(path)
        await db.commit()
        return str(path)

    async def get_sentiment(self, meeting_id: str, db: AsyncSession) -> Optional[SentimentResponse]:
        meeting = await self.get_meeting(db, meeting_id)
        if not meeting or not meeting.sentiment_path:
            return None
        path = Path(meeting.sentiment_path)
        if not path.exists():
            return None
        data = json.loads(path.read_text())
        return SentimentResponse(**data)

    # ------------------------------------------------------------------
    # FTS helpers
    # ------------------------------------------------------------------

    async def _fts_insert(self, db: AsyncSession, meeting_id: str, full_text: str) -> None:
        try:
            await db.execute(
                text("INSERT INTO transcript_fts(meeting_id, text) VALUES (:mid, :txt)"),
                {"mid": str(meeting_id), "txt": full_text},
            )
            await db.commit()
        except Exception:
            logger.exception("FTS insert failed")

    async def _fts_search(self, db: AsyncSession, query: str) -> list[str]:
        try:
            result = await db.execute(
                text(
                    "SELECT meeting_id FROM transcript_fts WHERE transcript_fts MATCH :q"
                ),
                {"q": query},
            )
            return [str(row[0]) for row in result.fetchall()]
        except Exception:
            logger.debug("FTS search failed, falling back")
            return []

    async def search_transcripts(self, db: AsyncSession, query: str) -> list[dict]:
        """Search transcripts using FTS5 and return matching meeting info."""
        try:
            result = await db.execute(
                text(
                    "SELECT meeting_id, snippet(transcript_fts, 1, '<b>', '</b>', '...', 30) "
                    "FROM transcript_fts WHERE transcript_fts MATCH :q"
                ),
                {"q": query},
            )
            rows = result.fetchall()
            results = []
            for row in rows:
                meeting = await self.get_meeting(db, str(row[0]))
                if meeting and meeting.status != "deleted":
                    results.append(
                        {
                            "meeting_id": str(row[0]),
                            "snippet": row[1],
                            "title": meeting.title,
                            "date": meeting.date,
                        }
                    )
            return results
        except Exception:
            logger.exception("FTS search failed")
            return []

    # ------------------------------------------------------------------
    # Stats
    # ------------------------------------------------------------------

    async def get_storage_stats(self, db: AsyncSession) -> dict:
        """Return total storage used and meeting count."""
        result = await db.execute(
            select(Meeting).where(Meeting.status != "deleted")
        )
        meetings = result.scalars().all()
        total_size = 0
        for m in meetings:
            if m.audio_path and Path(m.audio_path).exists():
                total_size += Path(m.audio_path).stat().st_size
            if m.transcript_path and Path(m.transcript_path).exists():
                total_size += Path(m.transcript_path).stat().st_size
            if m.summary_path and Path(m.summary_path).exists():
                total_size += Path(m.summary_path).stat().st_size
            if m.sentiment_path and Path(m.sentiment_path).exists():
                total_size += Path(m.sentiment_path).stat().st_size
        return {
            "total_size_bytes": total_size,
            "total_size_mb": round(total_size / (1024 * 1024), 2),
            "meeting_count": len(meetings),
        }
