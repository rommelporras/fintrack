import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.recurring_transaction import RecurringTransaction
from app.models.user import User
from app.schemas.recurring_transaction import (
    RecurringTransactionCreate,
    RecurringTransactionResponse,
    RecurringTransactionUpdate,
)

router = APIRouter(prefix="/recurring-transactions", tags=["recurring-transactions"])


@router.get("", response_model=list[RecurringTransactionResponse])
async def list_recurring(
    active: bool | None = Query(default=None),
    limit: int = Query(default=50, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(RecurringTransaction).where(
        RecurringTransaction.user_id == current_user.id
    )
    if active is not None:
        stmt = stmt.where(RecurringTransaction.is_active == active)
    stmt = stmt.order_by(RecurringTransaction.next_due_date).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post(
    "",
    response_model=RecurringTransactionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_recurring(
    data: RecurringTransactionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rec = RecurringTransaction(
        user_id=current_user.id,
        account_id=data.account_id,
        category_id=data.category_id,
        amount=data.amount,
        description=data.description,
        type=data.type,
        sub_type=data.sub_type,
        frequency=data.frequency,
        start_date=data.start_date,
        end_date=data.end_date,
        next_due_date=data.start_date,
    )
    db.add(rec)
    await db.commit()
    await db.refresh(rec)
    return rec


@router.patch("/{recurring_id}", response_model=RecurringTransactionResponse)
async def update_recurring(
    recurring_id: uuid.UUID,
    data: RecurringTransactionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(RecurringTransaction).where(
            RecurringTransaction.id == recurring_id,
            RecurringTransaction.user_id == current_user.id,
        )
    )
    rec = result.scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="Recurring transaction not found")
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(rec, key, value)
    await db.commit()
    await db.refresh(rec)
    return rec


@router.delete("/{recurring_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recurring(
    recurring_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(RecurringTransaction).where(
            RecurringTransaction.id == recurring_id,
            RecurringTransaction.user_id == current_user.id,
        )
    )
    rec = result.scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="Recurring transaction not found")
    await db.delete(rec)
    await db.commit()
