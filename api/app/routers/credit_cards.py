import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.credit_card import CreditCard
from app.models.account import Account
from app.models.user import User
from app.schemas.credit_card import CreditCardCreate, CreditCardUpdate, CreditCardResponse
from app.services.credit_card import (
    get_closed_statement_period,
    get_open_billing_period,
    get_due_date,
    days_until_due,
)
from app.services.credit_line import compute_card_available_credit

router = APIRouter(prefix="/credit-cards", tags=["credit-cards"])


async def _get_institution(card: CreditCard, db: AsyncSession):
    """Derive institution from credit_line (if in-line) or from account (if standalone)."""
    if card.credit_line_id is not None:
        if card.credit_line and card.credit_line.institution:
            return card.credit_line.institution
        return None
    # Standalone: load account and its institution
    result = await db.execute(select(Account).where(Account.id == card.account_id))
    account = result.scalar_one_or_none()
    if account and account.institution:
        return account.institution
    return None


async def _enrich(card: CreditCard, db: AsyncSession) -> CreditCardResponse:
    closed = get_closed_statement_period(card.statement_day)
    open_ = get_open_billing_period(card.statement_day)
    due = get_due_date(card.statement_day, card.due_day)
    available = None
    if card.credit_line_id is None:
        available = await compute_card_available_credit(db, card)
    institution = await _get_institution(card, db)
    return CreditCardResponse.model_validate({
        **card.__dict__,
        "institution": institution,
        "closed_period": {k: str(v) for k, v in closed.items()},
        "open_period": {k: str(v) for k, v in open_.items()},
        "due_date": due,
        "days_until_due": days_until_due(due),
        "available_credit": available,
    })


@router.get("", response_model=list[CreditCardResponse])
async def list_credit_cards(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CreditCard).where(CreditCard.user_id == current_user.id)
    )
    return [await _enrich(c, db) for c in result.scalars().all()]


@router.post("", response_model=CreditCardResponse, status_code=201)
async def create_credit_card(
    data: CreditCardCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    card = CreditCard(**data.model_dump(), user_id=current_user.id)
    db.add(card)
    await db.commit()
    await db.refresh(card)
    return await _enrich(card, db)


@router.patch("/{card_id}", response_model=CreditCardResponse)
async def update_credit_card(
    card_id: uuid.UUID,
    data: CreditCardUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CreditCard).where(CreditCard.id == card_id, CreditCard.user_id == current_user.id)
    )
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(status_code=404, detail="Credit card not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(card, field, value)
    await db.commit()
    await db.refresh(card)
    return await _enrich(card, db)


@router.delete("/{card_id}", status_code=204)
async def delete_credit_card(
    card_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CreditCard).where(CreditCard.id == card_id, CreditCard.user_id == current_user.id)
    )
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(status_code=404, detail="Credit card not found")
    await db.delete(card)
    await db.commit()
