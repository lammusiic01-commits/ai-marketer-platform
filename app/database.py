from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.config import DATABASE_URL

engine_options = {"echo": False}
if DATABASE_URL.startswith("sqlite+"):
    engine_options["connect_args"] = {"check_same_thread": False}
engine = create_async_engine(DATABASE_URL, **engine_options)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

class Base(DeclarativeBase):
    """Declarative base shared by the SQLite and PostgreSQL schemas."""

async def init_db():
    from app import models
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def get_db():
    async with SessionLocal() as session:
        yield session
