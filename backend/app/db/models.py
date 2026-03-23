"""SQLAlchemy ORM models."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    String,
    Float,
    Text,
)
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class Meeting(Base):
    __tablename__ = "meetings"

    id: str = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    date: str = Column(String, nullable=False)
    source: str = Column(String, nullable=False, default="manual")
    duration: float | None = Column(Float, nullable=True)
    audio_path: str | None = Column(Text, nullable=True)
    transcript_path: str | None = Column(Text, nullable=True)
    summary_path: str | None = Column(Text, nullable=True)
    sentiment_path: str | None = Column(Text, nullable=True)
    status: str = Column(String, nullable=False, default="recorded")
    title: str | None = Column(String, nullable=True)
    created_at: str = Column(
        String,
        nullable=False,
        default=lambda: datetime.now(timezone.utc).isoformat(),
    )
    synced_at: str | None = Column(String, nullable=True)
    device_id: str | None = Column(String, nullable=True)

    def __repr__(self) -> str:
        return f"<Meeting id={self.id} source={self.source} status={self.status}>"
