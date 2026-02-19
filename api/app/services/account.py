import uuid
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, case, func
from app.models.transaction import Transaction, TransactionType


async def compute_current_balance(
    db: AsyncSession, account_id: uuid.UUID, opening_balance: Decimal
) -> Decimal:
    """
    current_balance = opening_balance
        + SUM(income transactions)
        + SUM(transfer-in transactions where to_account_id = account_id)
        - SUM(expense transactions)
        - SUM(transfer-out transactions where account_id = account_id)
        - SUM(fee_amount on all transactions from this account)
    """

    result = await db.execute(
        select(
            func.coalesce(
                func.sum(
                    case(
                        (Transaction.type == TransactionType.income, Transaction.amount),
                        else_=Decimal("0.00"),
                    )
                ),
                Decimal("0.00"),
            ).label("income"),
            func.coalesce(
                func.sum(
                    case(
                        (Transaction.type == TransactionType.expense, Transaction.amount),
                        else_=Decimal("0.00"),
                    )
                ),
                Decimal("0.00"),
            ).label("expense"),
            func.coalesce(
                func.sum(
                    case(
                        (Transaction.type == TransactionType.transfer, Transaction.amount),
                        else_=Decimal("0.00"),
                    )
                ),
                Decimal("0.00"),
            ).label("transfer_out"),
            func.coalesce(
                func.sum(func.coalesce(Transaction.fee_amount, Decimal("0.00"))),
                Decimal("0.00"),
            ).label("fees"),
        ).where(Transaction.account_id == account_id)
    )
    row = result.one()

    # Transfer-in: transactions where to_account_id = this account
    transfer_in_result = await db.execute(
        select(
            func.coalesce(func.sum(Transaction.amount), Decimal("0.00"))
        ).where(
            Transaction.to_account_id == account_id,
            Transaction.type == TransactionType.transfer,
        )
    )
    transfer_in = transfer_in_result.scalar() or Decimal("0.00")

    return (
        opening_balance
        + row.income
        + transfer_in
        - row.expense
        - row.transfer_out
        - row.fees
    )
