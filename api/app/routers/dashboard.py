from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case
from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.account import Account, AccountType
from app.models.transaction import Transaction, TransactionType
from app.models.user import User
from app.schemas.dashboard import NetWorthResponse
from app.services.account import compute_current_balance

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary")
async def summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    today = date.today()
    month_start = today.replace(day=1)

    result = await db.execute(
        select(
            func.coalesce(
                func.sum(
                    case(
                        (Transaction.type == TransactionType.income, Transaction.amount),
                        else_=0,
                    )
                ),
                0,
            ).label("total_income"),
            func.coalesce(
                func.sum(
                    case(
                        (Transaction.type == TransactionType.expense, Transaction.amount),
                        else_=0,
                    )
                ),
                0,
            ).label("total_expenses"),
        ).where(
            Transaction.user_id == current_user.id,
            Transaction.date >= month_start,
            Transaction.date <= today,
        )
    )
    row = result.one()
    return {
        "month": today.strftime("%B %Y"),
        "total_income": row.total_income,
        "total_expenses": row.total_expenses,
        "net": row.total_income - row.total_expenses,
    }


@router.get("/net-worth", response_model=NetWorthResponse)
async def net_worth(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Account).where(
            Account.user_id == current_user.id,
            Account.is_active == True,
            Account.type != AccountType.credit_card,
        )
    )
    accounts = result.scalars().all()

    by_type: dict[str, Decimal] = {}
    for account in accounts:
        balance = await compute_current_balance(db, account.id, account.opening_balance)
        acc_type = account.type.value
        by_type[acc_type] = by_type.get(acc_type, Decimal("0")) + balance

    grand_total = sum(by_type.values(), Decimal("0"))
    return {
        "total": str(grand_total.quantize(Decimal("0.01"))),
        "by_type": [
            {"type": t, "total": str(v.quantize(Decimal("0.01")))}
            for t, v in sorted(by_type.items())
        ],
    }
