"""
One-time Notion CSV import script.
Run: cd /home/wsl/personal/fintrack && uv run --project api python scripts/import_notion.py
"""
import asyncio
import csv
import re
import sys
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "api"))

from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.transaction import Transaction, TransactionType, TransactionSource
from app.models.category import Category
from app.models.account import Account, AccountType
from app.models.user import User


def parse_amount(raw: str) -> Decimal | None:
    if not raw or not raw.strip():
        return None
    cleaned = raw.strip().replace("₱", "").replace(",", "").strip()
    try:
        v = Decimal(cleaned)
        return v if v > 0 else None
    except InvalidOperation:
        return None


def parse_date(raw: str):
    if not raw or not raw.strip():
        return None
    try:
        return datetime.strptime(raw.strip().strip('"'), "%B %d, %Y").date()
    except ValueError:
        return None


def extract_category_name(raw: str) -> str:
    match = re.match(r'^"?([^(]+?)\s*\(https?://', raw.strip())
    return match.group(1).strip() if match else raw.strip().strip('"').strip()


CSV_TO_SYSTEM_CATEGORY = {
    "Food & Drinks": "Dining Out",
    "Groceries": "Groceries",
    "Transport": "Public Transit",
    "Housing": "Rent / Amortization",
    "Entertainment": "Other / Miscellaneous",
    "Subscriptions": "Streaming",
    "Credit Cards and Loans": "Credit Card Interest & Fees",
    "Laguna Waters": "Water",
}


async def main():
    data_dir = Path(__file__).parent.parent / "data"
    csv_files = list(data_dir.glob("Expenses *_all.csv"))
    if not csv_files:
        print("No Expenses *_all.csv found in data/")
        sys.exit(1)

    csv_path = csv_files[0]
    print(f"Importing from: {csv_path}")

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).limit(1))
        user = result.scalar_one_or_none()
        if not user:
            print("No users found. Register first via the API.")
            sys.exit(1)

        acct_result = await db.execute(
            select(Account).where(Account.user_id == user.id, Account.name == "Imported (Cash)")
        )
        account = acct_result.scalar_one_or_none()
        if not account:
            account = Account(
                user_id=user.id, name="Imported (Cash)", type=AccountType.cash
            )
            db.add(account)
            await db.flush()

        imported = skipped = 0

        with open(csv_path, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                amount = parse_amount(row.get("Amount", ""))
                txn_date = parse_date(row.get("Date", ""))
                if not amount or not txn_date:
                    skipped += 1
                    continue

                cat_name = CSV_TO_SYSTEM_CATEGORY.get(
                    extract_category_name(row.get("Category", "")),
                    "Other / Miscellaneous"
                )
                cat = (await db.execute(
                    select(Category).where(Category.name == cat_name)
                )).scalar_one_or_none()

                db.add(Transaction(
                    user_id=user.id,
                    account_id=account.id,
                    category_id=cat.id if cat else None,
                    amount=amount,
                    description=row.get("Expense", "").strip().strip('"'),
                    type=TransactionType.expense,
                    date=txn_date,
                    source=TransactionSource.csv_import,
                    created_by=user.id,
                ))
                imported += 1

        await db.commit()
        print(f"Done. Imported: {imported}, Skipped: {skipped}")


if __name__ == "__main__":
    asyncio.run(main())
