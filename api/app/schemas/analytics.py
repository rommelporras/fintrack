from pydantic import BaseModel


class CategorySpendingItem(BaseModel):
    category_id: str
    category_name: str
    color: str | None
    total: str


class StatementPeriodItem(BaseModel):
    period: str
    total: str


class CardHistoryItem(BaseModel):
    card_label: str
    statements: list[StatementPeriodItem]
