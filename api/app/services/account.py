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


async def compute_balances_bulk(
    db: AsyncSession, accounts: list
) -> dict[uuid.UUID, Decimal]:
    """Compute current balance for many accounts in 2 queries instead of 2*N."""
    if not accounts:
        return {}

    account_ids = [a.id for a in accounts]
    opening = {a.id: a.opening_balance for a in accounts}

    # Outgoing aggregation: income, expense, transfer-out, fees per account
    outgoing_result = await db.execute(
        select(
            Transaction.account_id,
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
        )
        .where(Transaction.account_id.in_(account_ids))
        .group_by(Transaction.account_id)
    )
    outgoing_map: dict[uuid.UUID, tuple] = {}
    for row in outgoing_result:
        outgoing_map[row.account_id] = (row.income, row.expense, row.transfer_out, row.fees)

    # Transfer-in aggregation
    transfer_in_result = await db.execute(
        select(
            Transaction.to_account_id,
            func.coalesce(func.sum(Transaction.amount), Decimal("0.00")).label("transfer_in"),
        )
        .where(
            Transaction.to_account_id.in_(account_ids),
            Transaction.type == TransactionType.transfer,
        )
        .group_by(Transaction.to_account_id)
    )
    transfer_in_map: dict[uuid.UUID, Decimal] = {}
    for row in transfer_in_result:
        transfer_in_map[row.to_account_id] = row.transfer_in

    # Compute final balances
    result: dict[uuid.UUID, Decimal] = {}
    for acc_id in account_ids:
        income, expense, transfer_out, fees = outgoing_map.get(
            acc_id, (Decimal("0.00"), Decimal("0.00"), Decimal("0.00"), Decimal("0.00"))
        )
        transfer_in = transfer_in_map.get(acc_id, Decimal("0.00"))
        result[acc_id] = opening[acc_id] + income + transfer_in - expense - transfer_out - fees
    return result
