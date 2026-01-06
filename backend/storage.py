"""
PostgreSQL storage for BrainLifts using SQLAlchemy async
"""

from datetime import datetime
from typing import Any

from sqlalchemy import delete as sql_delete
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import BrainLift


async def save_brainlift(
    session: AsyncSession,
    brainlift_id: str,
    name: str,
    url: str,
    sections: dict[str, Any],
    raw_markdown: str = "",
    parsing_status: str = "normal",
    fallback_sections: list[str] | None = None,
    parsing_diagnostics: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Save a new brainlift or update existing one"""
    result = await session.execute(
        select(BrainLift).where(BrainLift.id == brainlift_id)
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.name = name
        existing.url = url
        existing.sections = sections
        existing.raw_markdown = raw_markdown
        existing.parsing_status = parsing_status
        existing.fallback_sections = fallback_sections or []
        existing.parsing_diagnostics = parsing_diagnostics
        existing.updated_at = datetime.utcnow()
    else:
        existing = BrainLift(
            id=brainlift_id,
            name=name,
            url=url,
            sections=sections,
            raw_markdown=raw_markdown,
            connections=None,
            parsing_status=parsing_status,
            fallback_sections=fallback_sections or [],
            parsing_diagnostics=parsing_diagnostics,
        )
        session.add(existing)

    await session.commit()
    await session.refresh(existing)

    return _to_dict(existing)


async def get_brainlift(
    session: AsyncSession, brainlift_id: str
) -> dict[str, Any] | None:
    """Get a brainlift by ID"""
    result = await session.execute(
        select(BrainLift).where(BrainLift.id == brainlift_id)
    )
    brainlift = result.scalar_one_or_none()
    return _to_dict(brainlift) if brainlift else None


async def list_brainlifts(session: AsyncSession) -> list[dict[str, str]]:
    """List all brainlifts (summary only)"""
    result = await session.execute(
        select(BrainLift).order_by(BrainLift.created_at.desc())
    )
    brainlifts = result.scalars().all()

    return [
        {
            "id": str(bl.id),
            "name": bl.name,
            "created_at": bl.created_at.isoformat() if bl.created_at else None,
        }
        for bl in brainlifts
    ]


async def save_connections(
    session: AsyncSession, brainlift_id: str, connections: dict[str, Any]
) -> bool:
    """Save connection analysis results for a brainlift"""
    result = await session.execute(
        select(BrainLift).where(BrainLift.id == brainlift_id)
    )
    brainlift = result.scalar_one_or_none()

    if not brainlift:
        return False

    brainlift.connections = connections
    brainlift.updated_at = datetime.utcnow()

    await session.commit()
    return True


async def get_connections(
    session: AsyncSession, brainlift_id: str
) -> dict[str, Any] | None:
    """Get connections for a brainlift"""
    brainlift = await get_brainlift(session, brainlift_id)
    if brainlift:
        return brainlift.get("connections")
    return None


async def delete_brainlift(session: AsyncSession, brainlift_id: str) -> bool:
    """Delete a brainlift"""
    result = await session.execute(
        select(BrainLift).where(BrainLift.id == brainlift_id)
    )
    brainlift = result.scalar_one_or_none()

    if not brainlift:
        return False

    await session.execute(sql_delete(BrainLift).where(BrainLift.id == brainlift_id))
    await session.commit()
    return True


def _to_dict(brainlift: BrainLift) -> dict[str, Any]:
    """Convert BrainLift model to dictionary"""
    return {
        "id": str(brainlift.id),
        "name": brainlift.name,
        "url": brainlift.url,
        "raw_markdown": brainlift.raw_markdown,
        "sections": brainlift.sections,
        "connections": brainlift.connections,
        "parsing_status": brainlift.parsing_status or "normal",
        "fallback_sections": brainlift.fallback_sections or [],
        "parsing_diagnostics": brainlift.parsing_diagnostics,
        "created_at": brainlift.created_at.isoformat()
        if brainlift.created_at
        else None,
        "updated_at": brainlift.updated_at.isoformat()
        if brainlift.updated_at
        else None,
    }
