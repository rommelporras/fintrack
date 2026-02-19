"""seed_system_categories

Revision ID: 8798cf11715f
Revises: 5e3d2d121f5a
Create Date: 2026-02-19 12:23:11.340381

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8798cf11715f'
down_revision: Union[str, Sequence[str], None] = '5e3d2d121f5a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CATEGORIES = [
    # Income
    ("Salary", "income", "💼", "#22c55e"),
    ("13th Month Pay", "income", "🎁", "#22c55e"),
    ("Bonus / Incentive", "income", "⭐", "#22c55e"),
    ("Overtime Pay", "income", "⏰", "#22c55e"),
    ("Freelance / Project", "income", "💻", "#16a34a"),
    ("Business Revenue", "income", "🏪", "#16a34a"),
    ("Consulting / Professional Fees", "income", "🤝", "#16a34a"),
    ("Rental Income", "income", "🏠", "#16a34a"),
    ("Interest Income", "income", "💰", "#16a34a"),
    ("Dividends", "income", "📈", "#16a34a"),
    ("Capital Gains", "income", "📊", "#16a34a"),
    ("SSS Benefit", "income", "🏛️", "#15803d"),
    ("PhilHealth Reimbursement", "income", "🏥", "#15803d"),
    ("Pag-IBIG Dividend", "income", "🏦", "#15803d"),
    ("Government Aid / Ayuda", "income", "🤲", "#15803d"),
    ("Remittance Received", "income", "✈️", "#15803d"),
    ("Gift / Cash Gift", "income", "🎀", "#15803d"),
    ("Tax Refund", "income", "📋", "#15803d"),
    ("Sale of Items", "income", "🛍️", "#15803d"),
    ("Refund / Cashback", "income", "↩️", "#15803d"),
    ("Other Income", "income", "➕", "#15803d"),
    # Expense — Food
    ("Groceries", "expense", "🛒", "#f97316"),
    ("Dining Out", "expense", "🍽️", "#f97316"),
    ("Food Delivery", "expense", "🛵", "#f97316"),
    ("Coffee & Drinks", "expense", "☕", "#f97316"),
    ("Snacks", "expense", "🍿", "#f97316"),
    # Expense — Housing & Utilities
    ("Rent / Amortization", "expense", "🏠", "#3b82f6"),
    ("Electricity", "expense", "⚡", "#3b82f6"),
    ("Water", "expense", "💧", "#3b82f6"),
    ("Internet / Broadband", "expense", "📡", "#3b82f6"),
    ("Mobile / Postpaid", "expense", "📱", "#3b82f6"),
    ("Gas / LPG", "expense", "🔥", "#3b82f6"),
    ("Home Supplies", "expense", "🧹", "#3b82f6"),
    ("Home Maintenance", "expense", "🔧", "#3b82f6"),
    ("Condo / HOA Dues", "expense", "🏢", "#3b82f6"),
    # Expense — Transportation
    ("Public Transit", "expense", "🚌", "#8b5cf6"),
    ("Ride-Hailing", "expense", "🚗", "#8b5cf6"),
    ("Fuel / Gas", "expense", "⛽", "#8b5cf6"),
    ("Toll Fees", "expense", "🛣️", "#8b5cf6"),
    ("Vehicle Maintenance", "expense", "🔩", "#8b5cf6"),
    ("Parking", "expense", "🅿️", "#8b5cf6"),
    # Expense — Healthcare
    ("Medicine / Pharmacy", "expense", "💊", "#ec4899"),
    ("Doctor / Clinic", "expense", "🏥", "#ec4899"),
    ("Hospital / Procedure", "expense", "🩺", "#ec4899"),
    ("Health Insurance / HMO", "expense", "🛡️", "#ec4899"),
    ("Gym / Fitness", "expense", "🏋️", "#ec4899"),
    ("Wellness / Self-Care", "expense", "💆", "#ec4899"),
    # Expense — Financial Obligations
    ("Credit Card Interest & Fees", "expense", "💳", "#ef4444"),
    ("Loan Interest", "expense", "🏦", "#ef4444"),
    ("SSS Contribution", "expense", "🏛️", "#ef4444"),
    ("PhilHealth Contribution", "expense", "🏥", "#ef4444"),
    ("Pag-IBIG Contribution", "expense", "🏦", "#ef4444"),
    ("Tax Payment", "expense", "📋", "#ef4444"),
    # Expense — Insurance
    ("Life Insurance Premium", "expense", "🛡️", "#64748b"),
    ("Non-Life Insurance", "expense", "🚘", "#64748b"),
    # Expense — Education
    ("Tuition / School Fees", "expense", "🎓", "#0ea5e9"),
    ("School Supplies", "expense", "📚", "#0ea5e9"),
    ("Training / Online Course", "expense", "💡", "#0ea5e9"),
    ("Dependent Allowance", "expense", "👨‍👩‍👧", "#0ea5e9"),
    # Expense — Subscriptions
    ("Streaming", "expense", "📺", "#a855f7"),
    ("Software / Cloud", "expense", "☁️", "#a855f7"),
    ("Gaming", "expense", "🎮", "#a855f7"),
    # Expense — Shopping
    ("Clothing & Apparel", "expense", "👗", "#f59e0b"),
    ("Gadgets & Electronics", "expense", "🖥️", "#f59e0b"),
    ("Online Shopping", "expense", "🛍️", "#f59e0b"),
    ("Personal Care / Beauty", "expense", "💄", "#f59e0b"),
    # Expense — Family & Social
    ("Family Support / Allowance", "expense", "👨‍👩‍👧", "#10b981"),
    ("Gift / Pasalubong", "expense", "🎁", "#10b981"),
    ("Celebrations", "expense", "🎉", "#10b981"),
    ("Charitable Giving", "expense", "🙏", "#10b981"),
    # Expense — Travel
    ("Accommodation", "expense", "🏨", "#06b6d4"),
    ("Airfare / Long-Distance", "expense", "✈️", "#06b6d4"),
    ("Tourist Activities", "expense", "🏖️", "#06b6d4"),
    # Expense — Misc
    ("Bank / Transaction Fees", "expense", "🏦", "#6b7280"),
    ("ATM Fees", "expense", "🏧", "#6b7280"),
    ("Government Fees", "expense", "🏛️", "#6b7280"),
    ("Pet Care", "expense", "🐾", "#6b7280"),
    ("Other / Miscellaneous", "expense", "📦", "#6b7280"),
    # Transfer
    ("Bank to Bank", "transfer", "🏦", "#94a3b8"),
    ("Bank to E-Wallet", "transfer", "📲", "#94a3b8"),
    ("E-Wallet to Bank", "transfer", "🏧", "#94a3b8"),
    ("ATM Withdrawal", "transfer", "🏧", "#94a3b8"),
    ("To Savings / Investment", "transfer", "💹", "#94a3b8"),
    ("GCash / Maya Send", "transfer", "📤", "#94a3b8"),
    ("Bank Transfer to Person", "transfer", "👤", "#94a3b8"),
    ("Remittance Sent", "transfer", "🌏", "#94a3b8"),
    ("Credit Card Payment", "transfer", "💳", "#94a3b8"),
    ("Loan Principal Payment", "transfer", "📉", "#94a3b8"),
]

def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text(
            "INSERT INTO categories (id, user_id, name, type, icon, color, is_system) "
            "VALUES (uuidv7(), NULL, :name, :type, :icon, :color, TRUE)"
        ),
        [
            {"name": name, "type": ctype, "icon": icon, "color": color}
            for name, ctype, icon, color in CATEGORIES
        ],
    )


def downgrade() -> None:
    op.execute("DELETE FROM categories WHERE is_system = TRUE")
