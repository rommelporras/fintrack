import uuid
from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, extract
from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.budget import Budget
from app.models.user import User
from app.models.transaction import Transaction, TransactionType
from app.schemas.budget import BudgetCreate, BudgetUpdate, BudgetResponse, BudgetStatusItem

router = APIRouter(prefix="/budgets", tags=["budgets"])


@router.get("", response_model=list[BudgetResponse])
async def list_budgets(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Budget)
        .where(Budget.user_id == current_user.id)
        .order_by(Budget.created_at.asc())
    )
    return result.scalars().all()


@router.post("", response_model=BudgetResponse, status_code=201)
async def create_budget(
    data: BudgetCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    budget = Budget(**data.model_dump(), user_id=current_user.id)
    db.add(budget)
    await db.commit()
    await db.refresh(budget)
    return budget


async def _get_month_spending(
    db: AsyncSession,
    user_id: uuid.UUID,
    budget: Budget,
    month_start: date,
) -> Decimal:
    q = select(func.coalesce(func.sum(Transaction.amount), Decimal(0))).where(
        Transaction.user_id == user_id,
        Transaction.type == TransactionType.expense,
        Transaction.date >= month_start,
        extract("month", Transaction.date) == month_start.month,
        extract("year", Transaction.date) == month_start.year,
    )
    if budget.type == "category" and budget.category_id:
        q = q.where(Transaction.category_id == budget.category_id)
    elif budget.type == "account" and budget.account_id:
        q = q.where(Transaction.account_id == budget.account_id)
    result = await db.execute(q)
    value = result.scalar()
    return Decimal(value).quantize(Decimal("0.01")) if value is not None else Decimal("0.00")


@router.get("/status", response_model=list[BudgetStatusItem])
async def get_budget_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    today = date.today()
    month_start = today.replace(day=1)

    budgets_result = await db.execute(
        select(Budget).where(Budget.user_id == current_user.id)
    )
    budgets = budgets_result.scalars().all()

    items = []
    for budget in budgets:
        spent = await _get_month_spending(db, current_user.id, budget, month_start)
        percent = float(spent / budget.amount * 100) if budget.amount > 0 else 0.0

        if percent >= 100:
            status = "exceeded"
        elif percent >= 80:
            status = "warning"
        else:
            status = "ok"

        items.append(BudgetStatusItem(
            budget=BudgetResponse.model_validate(budget),
            spent=spent,
            percent=percent,
            status=status,
        ))
    return items


@router.patch("/{budget_id}", response_model=BudgetResponse)
async def update_budget(
    budget_id: uuid.UUID,
    data: BudgetUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Budget).where(
            Budget.id == budget_id, Budget.user_id == current_user.id
        )
    )
    budget = result.scalar_one_or_none()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(budget, field, value)
    await db.commit()
    await db.refresh(budget)
    return budget


@router.delete("/{budget_id}", status_code=204)
async def delete_budget(
    budget_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Budget).where(
            Budget.id == budget_id, Budget.user_id == current_user.id
        )
    )
    budget = result.scalar_one_or_none()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    await db.delete(budget)
    await db.commit()
