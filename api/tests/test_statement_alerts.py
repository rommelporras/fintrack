import pytest
import uuid
from datetime import date, timedelta
from unittest.mock import patch
from sqlalchemy import NullPool
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import select
from app.models.notification import Notification, NotificationType
from app.models.statement import Statement
from app.models.credit_card import CreditCard
from app.models.account import Account
from app.models.user import User
from app.tasks.notifications import _async_check_statements

# Mirror the same TEST_DATABASE_URL resolution used in conftest.py
from app.core.config import settings as _settings

TEST_DATABASE_URL = _settings.test_database_url or _settings.database_url.replace(
    "/finance_db", "/finance_test"
)


@pytest.fixture(autouse=True)
def patch_async_session_local():
    """Redirect AsyncSessionLocal inside _async_check_statements to the test DB."""
    test_engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
    test_session_factory = async_sessionmaker(test_engine, expire_on_commit=False)
    with patch("app.core.database.AsyncSessionLocal", test_session_factory):
        yield


@pytest.fixture
async def user_and_card(db: AsyncSession):
    """Create a user, account, and credit card for statement tests."""
    import bcrypt

    pw_hash = bcrypt.hashpw(b"password123", bcrypt.gensalt()).decode()
    user = User(email="stmtalert@test.com", name="Alert User", password_hash=pw_hash)
    db.add(user)
    await db.flush()

    account = Account(
        user_id=user.id,
        name="BDO CC Account",
        type="credit_card",
        currency="PHP",
    )
    db.add(account)
    await db.flush()

    cc = CreditCard(
        user_id=user.id,
        account_id=account.id,

        last_four="5678",
        statement_day=1,
        due_day=21,
    )
    db.add(cc)
    await db.commit()
    await db.refresh(user)
    await db.refresh(cc)
    return user, cc


async def _create_statement(
    db: AsyncSession, credit_card_id: uuid.UUID,
    due_date: date, is_paid: bool = False,
    total_amount: str = "5000.00",
) -> Statement:
    stmt = Statement(
        credit_card_id=credit_card_id,
        period_start=due_date - timedelta(days=30),
        period_end=due_date - timedelta(days=1),
        due_date=due_date,
        total_amount=total_amount,
        is_paid=is_paid,
    )
    db.add(stmt)
    await db.commit()
    await db.refresh(stmt)
    return stmt


async def test_statement_due_in_7_days_fires_notification(db: AsyncSession, user_and_card):
    user, cc = user_and_card
    due = date.today() + timedelta(days=7)
    await _create_statement(db, cc.id, due_date=due)

    await _async_check_statements()

    result = await db.execute(
        select(Notification).where(Notification.user_id == user.id)
    )
    notifs = result.scalars().all()
    assert len(notifs) == 1
    assert notifs[0].type == NotificationType.statement_due
    assert notifs[0].metadata_["days"] == 7


async def test_statement_due_in_1_day_fires_notification(db: AsyncSession, user_and_card):
    user, cc = user_and_card
    due = date.today() + timedelta(days=1)
    await _create_statement(db, cc.id, due_date=due)

    await _async_check_statements()

    result = await db.execute(
        select(Notification).where(Notification.user_id == user.id)
    )
    notifs = result.scalars().all()
    assert len(notifs) == 1
    assert notifs[0].metadata_["days"] == 1


async def test_statement_due_in_8_days_no_notification(db: AsyncSession, user_and_card):
    user, cc = user_and_card
    due = date.today() + timedelta(days=8)
    await _create_statement(db, cc.id, due_date=due)

    await _async_check_statements()

    result = await db.execute(
        select(Notification).where(Notification.user_id == user.id)
    )
    notifs = result.scalars().all()
    assert len(notifs) == 0


async def test_paid_statement_no_notification(db: AsyncSession, user_and_card):
    user, cc = user_and_card
    due = date.today() + timedelta(days=7)
    await _create_statement(db, cc.id, due_date=due, is_paid=True)

    await _async_check_statements()

    result = await db.execute(
        select(Notification).where(Notification.user_id == user.id)
    )
    notifs = result.scalars().all()
    assert len(notifs) == 0


async def test_no_duplicate_notification_on_double_run(db: AsyncSession, user_and_card):
    user, cc = user_and_card
    due = date.today() + timedelta(days=7)
    await _create_statement(db, cc.id, due_date=due)

    await _async_check_statements()
    await _async_check_statements()  # second run same day

    result = await db.execute(
        select(Notification).where(Notification.user_id == user.id)
    )
    notifs = result.scalars().all()
    assert len(notifs) == 1  # only one, no duplicate
