import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import NullPool, text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    create_async_engine,
    async_sessionmaker,
)
from app.main import app
from app.core.database import Base, get_db
from app.core.config import settings

TEST_DATABASE_URL = settings.test_database_url or settings.database_url.replace(
    "/finance_db", "/finance_test"
)


@pytest_asyncio.fixture(scope="session")
async def setup_test_database():
    """Create all tables once per test session (only when DB is needed)."""
    engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()
    yield
    engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def db(setup_test_database) -> AsyncSession:
    """Per-test async session. Truncates all tables after each test for isolation."""
    engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
    session = async_sessionmaker(engine, expire_on_commit=False)()
    yield session
    await session.close()
    async with engine.begin() as conn:
        tables = list(reversed(Base.metadata.sorted_tables))
        for table in tables:
            await conn.execute(text(f"TRUNCATE TABLE {table.name} CASCADE"))
    await engine.dispose()


@pytest_asyncio.fixture
async def client(db: AsyncSession):
    """HTTP client with DB dependency overridden to use test session."""
    async def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://localhost") as c:
        yield c
    app.dependency_overrides.clear()
