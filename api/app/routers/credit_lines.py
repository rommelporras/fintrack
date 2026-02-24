import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.credit_line import CreditLine
from app.models.credit_card import CreditCard
from app.models.user import User
from app.schemas.credit_line import (
    CreditLineCreate,
    CreditLineUpdate,
    CreditLineResponse,
    CreditCardInLine,
)
from app.services.credit_line import compute_line_available_credit
from app.services.credit_card import (
    get_closed_statement_period,
    get_open_billing_period,
    get_due_date,
    days_until_due,
)

router = APIRouter(prefix="/credit-lines", tags=["credit-lines"])


def _card_to_summary(card: CreditCard) -> CreditCardInLine:
    closed = get_closed_statement_period(card.statement_day)
    open_ = get_open_billing_period(card.statement_day)
    due = get_due_date(card.statement_day, card.due_day)
    return CreditCardInLine.model_validate({
        **card.__dict__,
        "closed_period": {k: str(v) for k, v in closed.items()},
        "open_period": {k: str(v) for k, v in open_.items()},
        "due_date": due,
        "days_until_due": days_until_due(due),
    })


async def _enrich(db: AsyncSession, line: CreditLine) -> CreditLineResponse:
    available = await compute_line_available_credit(db, line)
    return CreditLineResponse.model_validate({
        **line.__dict__,
        "available_credit": available,
        "cards": [_card_to_summary(c) for c in line.cards],
    })


@router.get("", response_model=list[CreditLineResponse])
async def list_credit_lines(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CreditLine).where(CreditLine.user_id == current_user.id)
    )
    lines = result.scalars().all()
    return [await _enrich(db, line) for line in lines]


@router.post("", response_model=CreditLineResponse, status_code=201)
async def create_credit_line(
    data: CreditLineCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    line = CreditLine(**data.model_dump(), user_id=current_user.id)
    db.add(line)
    await db.commit()
    await db.refresh(line)
    return await _enrich(db, line)


@router.patch("/{line_id}", response_model=CreditLineResponse)
async def update_credit_line(
    line_id: uuid.UUID,
    data: CreditLineUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CreditLine).where(
            CreditLine.id == line_id,
            CreditLine.user_id == current_user.id,
        )
    )
    line = result.scalar_one_or_none()
    if not line:
        raise HTTPException(status_code=404, detail="Credit line not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(line, field, value)
    await db.commit()
    await db.refresh(line)
    return await _enrich(db, line)


@router.delete("/{line_id}", status_code=204)
async def delete_credit_line(
    line_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CreditLine).where(
            CreditLine.id == line_id,
            CreditLine.user_id == current_user.id,
        )
    )
    line = result.scalar_one_or_none()
    if not line:
        raise HTTPException(status_code=404, detail="Credit line not found")
    # Detach cards: set credit_line_id = NULL on all linked cards
    cards_result = await db.execute(
        select(CreditCard).where(CreditCard.credit_line_id == line_id)
    )
    for card in cards_result.scalars().all():
        card.credit_line_id = None
    await db.delete(line)
    await db.commit()
