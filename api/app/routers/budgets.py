import uuid
from calendar import monthrange
from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func as sa_func
from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.budget import Budget
from app.models.transaction import Transaction, TransactionType
from app.models.user import User
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


@router.get("/status", response_model=list[BudgetStatusItem])
async def get_budget_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    today = date.today()
    month_start = today.replace(day=1)
    days_in_month = monthrange(today.year, today.month)[1]
    month_end = month_start.replace(day=days_in_month)

    budgets_result = await db.execute(
        select(Budget).where(Budget.user_id == current_user.id)
    )
    budgets = budgets_result.scalars().all()

    # Single aggregate query replaces the per-budget N+1 loop.
    # Group by (category_id, account_id) so both budget types can be resolved
    # from one result set.
    spending_result = await db.execute(
        select(
            Transaction.category_id,
            Transaction.account_id,
            sa_func.sum(Transaction.amount).label("spent"),
        )
        .where(
            Transaction.user_id == current_user.id,
            Transaction.type == TransactionType.expense,
            Transaction.date >= month_start,
            Transaction.date <= month_end,
        )
        .group_by(Transaction.category_id, Transaction.account_id)
    )
    # Build a flat map keyed by (category_id, account_id) str-or-None tuples → spent.
    spending_map: dict[tuple[str | None, str | None], Decimal] = {}
    for row in spending_result.all():
        cat_key = str(row.category_id) if row.category_id is not None else None
        acc_key = str(row.account_id) if row.account_id is not None else None
        spending_map[(cat_key, acc_key)] = Decimal(row.spent)

    items = []
    for budget in budgets:
        if budget.type == "category":
            cat_str = str(budget.category_id)
            spent = sum(
                (v for (cat, _), v in spending_map.items() if cat == cat_str),
                Decimal("0.00"),
            )
        else:
            acc_str = str(budget.account_id)
            spent = sum(
                (v for (_, acc), v in spending_map.items() if acc == acc_str),
                Decimal("0.00"),
            )

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
    for field, value in data.model_dump(exclude_unset=True).items():
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
