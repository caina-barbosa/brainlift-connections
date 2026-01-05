import os
from collections.abc import AsyncGenerator
from datetime import datetime

from dotenv import load_dotenv
from sqlalchemy import Column, DateTime, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "")

# Convert postgres:// to postgresql+asyncpg:// for SQLAlchemy async
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

engine = create_async_engine(DATABASE_URL, echo=False) if DATABASE_URL else None
async_session = (
    async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False) if engine else None
)

Base = declarative_base()


class BrainLift(Base):
    __tablename__ = "brainlifts"

    id = Column(UUID(as_uuid=False), primary_key=True)
    user_id = Column(UUID(as_uuid=False), nullable=True)  # For future auth
    name = Column(String(255), nullable=False)
    url = Column(Text, nullable=False)
    raw_markdown = Column(Text, nullable=False, default="")
    sections = Column(JSONB, nullable=False, default={})
    connections = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


async def init_db():
    """Create tables if they don't exist."""
    if engine:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for getting async session."""
    if async_session is None:
        raise RuntimeError("Database not configured. Set DATABASE_URL environment variable.")
    async with async_session() as session:
        yield session
