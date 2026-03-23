"""Sync endpoints for multi-device synchronization."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models import SyncConfigureRequest, SyncStatus

router = APIRouter(prefix="/api", tags=["sync"])


def _get_sync():
    from app.main import sync_service
    return sync_service


@router.get("/sync/status", response_model=SyncStatus)
async def sync_status():
    """Get current sync status."""
    return _get_sync().get_status()


@router.post("/sync/push")
async def sync_push(db: AsyncSession = Depends(get_db)):
    """Push local meetings to sync directory."""
    svc = _get_sync()
    try:
        count = await svc.push(db)
        return {"status": "ok", "pushed": count}
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/sync/pull")
async def sync_pull(db: AsyncSession = Depends(get_db)):
    """Pull meetings from sync directory."""
    svc = _get_sync()
    try:
        count = await svc.pull(db)
        return {"status": "ok", "pulled": count}
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/sync/configure")
async def sync_configure(req: SyncConfigureRequest):
    """Configure sync settings."""
    svc = _get_sync()
    try:
        svc.configure(method=req.method, path=req.path, sync_audio=req.sync_audio)
        return {"status": "configured"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
