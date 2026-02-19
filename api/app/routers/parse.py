# api/app/routers/parse.py
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.parse import ParsedTransaction, BulkParseResponse
from app.services.parser import parse_text, parse_bulk

router = APIRouter(prefix="/parse", tags=["parse"])


class PasteRequest(BaseModel):
    text: str


@router.post("/paste", response_model=ParsedTransaction)
async def parse_paste(
    body: PasteRequest,
    current_user: User = Depends(get_current_user),
):
    return parse_text(body.text)


@router.post("/bulk", response_model=BulkParseResponse)
async def parse_bulk_endpoint(
    body: PasteRequest,
    current_user: User = Depends(get_current_user),
):
    return parse_bulk(body.text)
