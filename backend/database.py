import os
import ssl
from collections.abc import AsyncGenerator
from datetime import datetime
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from dotenv import load_dotenv
from sqlalchemy import Column, DateTime, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "")

# Convert postgres:// to postgresql+asyncpg:// for SQLAlchemy async
# Also handle sslmode parameter which asyncpg doesn't accept in URL
connect_args: dict = {}

if DATABASE_URL:
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
    elif DATABASE_URL.startswith("postgresql://"):
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

    # Parse URL and remove sslmode from query params (asyncpg doesn't accept it)
    parsed = urlparse(DATABASE_URL)
    query_params = parse_qs(parsed.query)

    if "sslmode" in query_params:
        del query_params["sslmode"]
        # Reconstruct URL without sslmode
        new_query = urlencode(query_params, doseq=True)
        DATABASE_URL = urlunparse(parsed._replace(query=new_query))
        # Use SSL for Neon connections
        connect_args["ssl"] = ssl.create_default_context()

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    connect_args=connect_args,
    pool_pre_ping=True,  # Check if connection is alive before using
    pool_recycle=300,    # Recycle connections every 5 minutes (Neon closes idle ones)
) if DATABASE_URL else None
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
