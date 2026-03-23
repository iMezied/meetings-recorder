"""Async SQLAlchemy setup with aiosqlite and WAL mode."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy import event, text

from app.config import settings
from app.db.models import Base

_db_url = f"sqlite+aiosqlite:///{settings.DB_PATH}"

engine = create_async_engine(
    _db_url,
    echo=False,
    connect_args={"check_same_thread": False},
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def _set_wal_mode(conn):
    """Enable WAL journal mode for better concurrent read/write."""
    await conn.execute(text("PRAGMA journal_mode=WAL"))
    await conn.execute(text("PRAGMA foreign_keys=ON"))


async def init_db() -> None:
    """Create all tables and the FTS5 virtual table."""
    async with engine.begin() as conn:
        await _set_wal_mode(conn)
        await conn.run_sync(Base.metadata.create_all)
        # Create FTS5 virtual table if it doesn't exist
        await conn.execute(
            text(
                "CREATE VIRTUAL TABLE IF NOT EXISTS transcript_fts "
                "USING fts5(meeting_id, text, content='', content_rowid='')"
            )
        )


async def get_db() -> AsyncSession:  # type: ignore[misc]
    """FastAPI dependency that yields an async session."""
    async with async_session_factory() as session:
        try:
            yield session
        finally:
            await session.close()
