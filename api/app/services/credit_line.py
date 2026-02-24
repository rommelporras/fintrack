import uuid
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.credit_line import CreditLine
from app.models.credit_card import CreditCard
from app.models.account import Account
from app.services.account import compute_balances_bulk


async def compute_line_available_credit(
    db: AsyncSession,
    credit_line: CreditLine,
) -> Decimal | None:
    """
    If available_override is set, return it directly.
    Otherwise: total_limit + sum(current_balance for all linked accounts).
    Credit card accounts carry negative balances (debt), so adding them reduces availability.
    Returns None if total_limit is not set.
    """
    if credit_line.available_override is not None:
        return credit_line.available_override
    if credit_line.total_limit is None:
        return None

    cards = credit_line.cards  # loaded via selectin
    if not cards:
        return credit_line.total_limit

    account_ids = [c.account_id for c in cards]
    result = await db.execute(select(Account).where(Account.id.in_(account_ids)))
    accounts = result.scalars().all()

    balances = await compute_balances_bulk(db, list(accounts))
    total_balance = sum(balances.values(), Decimal("0.00"))
    return credit_line.total_limit + total_balance


async def compute_card_available_credit(
    db: AsyncSession,
    card: CreditCard,
) -> Decimal | None:
    """
    For standalone cards only (credit_line_id is None).
    If available_override is set, return it directly.
    Otherwise: credit_limit + current_account_balance.
    Returns None if credit_limit is not set.
    """
    if card.available_override is not None:
        return card.available_override
    if card.credit_limit is None:
        return None

    result = await db.execute(select(Account).where(Account.id == card.account_id))
    account = result.scalar_one_or_none()
    if account is None:
        return None

    balances = await compute_balances_bulk(db, [account])
    balance = balances.get(account.id, Decimal("0.00"))
    return card.credit_limit + balance
