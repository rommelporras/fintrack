import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.statement import Statement
from app.models.credit_card import CreditCard
from app.models.user import User
from app.schemas.statement import StatementCreate, StatementUpdate, StatementResponse

router = APIRouter(prefix="/statements", tags=["statements"])


async def _get_user_statement(
    statement_id: uuid.UUID, user: User, db: AsyncSession
) -> Statement:
    """Fetch a statement that belongs to the current user (via credit card)."""
    result = await db.execute(
        select(Statement)
        .join(CreditCard, Statement.credit_card_id == CreditCard.id)
        .where(Statement.id == statement_id, CreditCard.user_id == user.id)
    )
    stmt = result.scalar_one_or_none()
    if not stmt:
        raise HTTPException(status_code=404, detail="Statement not found")
    return stmt


@router.get("", response_model=list[StatementResponse])
async def list_statements(
    credit_card_id: uuid.UUID | None = Query(None),
    is_paid: bool | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(Statement)
        .join(CreditCard, Statement.credit_card_id == CreditCard.id)
        .where(CreditCard.user_id == current_user.id)
        .order_by(Statement.due_date.desc())
    )
    if credit_card_id is not None:
        q = q.where(Statement.credit_card_id == credit_card_id)
    if is_paid is not None:
        q = q.where(Statement.is_paid == is_paid)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("", response_model=StatementResponse, status_code=201)
async def create_statement(
    data: StatementCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify credit card ownership
    cc_result = await db.execute(
        select(CreditCard).where(
            CreditCard.id == data.credit_card_id,
            CreditCard.user_id == current_user.id,
        )
    )
    if not cc_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Credit card not found")

    stmt = Statement(**data.model_dump())
    db.add(stmt)
    await db.commit()
    await db.refresh(stmt)
    return stmt


@router.get("/{statement_id}", response_model=StatementResponse)
async def get_statement(
    statement_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _get_user_statement(statement_id, current_user, db)


@router.patch("/{statement_id}", response_model=StatementResponse)
async def update_statement(
    statement_id: uuid.UUID,
    data: StatementUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = await _get_user_statement(statement_id, current_user, db)
    update_data = data.model_dump(exclude_none=True)

    # Set paid_at when marking paid, clear it when unmarking
    if update_data.get("is_paid") is True and not stmt.is_paid:
        update_data["paid_at"] = datetime.now(timezone.utc)
    elif update_data.get("is_paid") is False and stmt.is_paid:
        update_data["paid_at"] = None

    for field, value in update_data.items():
        setattr(stmt, field, value)
    await db.commit()
    await db.refresh(stmt)
    return stmt
