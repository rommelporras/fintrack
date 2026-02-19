from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case
from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.transaction import Transaction, TransactionType
from app.models.user import User

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
