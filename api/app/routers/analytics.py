from decimal import Decimal
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.transaction import Transaction, TransactionType
from app.models.category import Category
from app.models.user import User

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/spending-by-category")
async def spending_by_category(
    year: int = Query(...),
    month: int = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(
            Category.id,
            Category.name,
            Category.color,
            func.sum(Transaction.amount).label("total"),
        )
        .join(Transaction, Transaction.category_id == Category.id)
        .where(
            Transaction.user_id == current_user.id,
            Transaction.type == TransactionType.expense,
            func.extract("year", Transaction.date) == year,
            func.extract("month", Transaction.date) == month,
        )
        .group_by(Category.id, Category.name, Category.color)
        .order_by(desc("total"))
    )
    rows = result.all()
    return [
        {
            "category_id": str(row.id),
            "category_name": row.name,
            "color": row.color,
            "total": str(Decimal(str(row.total)).quantize(Decimal("0.01"))),
        }
        for row in rows
    ]
