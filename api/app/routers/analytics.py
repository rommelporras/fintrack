from collections import defaultdict
from decimal import Decimal
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.transaction import Transaction, TransactionType
from app.models.category import Category
from app.models.user import User
from app.models.credit_card import CreditCard
from app.models.statement import Statement

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


@router.get("/statement-history")
async def statement_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cards_result = await db.execute(
        select(CreditCard)
        .where(CreditCard.user_id == current_user.id)
        .order_by(CreditCard.created_at)
    )
    cards = cards_result.scalars().all()

    if not cards:
        return []

    card_ids = [card.id for card in cards]

    # Single query for all statements — ownership guaranteed by card_ids source
    # plus explicit user join as defence-in-depth
    all_stmts_result = await db.execute(
        select(Statement)
        .join(CreditCard, CreditCard.id == Statement.credit_card_id)
        .where(
            Statement.credit_card_id.in_(card_ids),
            CreditCard.user_id == current_user.id,
        )
        .order_by(Statement.credit_card_id, Statement.period_end.desc())
    )
    all_stmts = all_stmts_result.scalars().all()

    # Group by card_id, keep first 6 (most recent), then reverse to chronological
    stmts_by_card: dict = defaultdict(list)
    for s in all_stmts:
        stmts_by_card[s.credit_card_id].append(s)

    data = []
    for card in cards:
        stmts = list(reversed(stmts_by_card[card.id][:6]))
        data.append({
            "card_label": f"{card.bank_name} \u2022\u2022\u2022\u2022 {card.last_four}",
            "statements": [
                {
                    "period": s.period_end.strftime("%b %Y"),
                    "total": str(
                        Decimal(str(s.total_amount or 0)).quantize(Decimal("0.01"))
                    ),
                }
                for s in stmts
            ],
        })
    return data
