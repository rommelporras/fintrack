from pydantic import BaseModel


class NetWorthTypeBreakdown(BaseModel):
    type: str
    total: str


class NetWorthResponse(BaseModel):
    total: str
    by_type: list[NetWorthTypeBreakdown]
