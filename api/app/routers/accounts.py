import uuid
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.account import Account
from app.models.user import User
from app.schemas.account import AccountCreate, AccountUpdate, AccountResponse
from app.services.account import compute_current_balance, compute_balances_bulk

router = APIRouter(prefix="/accounts", tags=["accounts"])


async def _to_response(db: AsyncSession, account: Account) -> AccountResponse:
    balance = await compute_current_balance(db, account.id, account.opening_balance)
    return AccountResponse.model_validate({
        **account.__dict__,
        "current_balance": balance,
        "institution": account.institution,
    })


@router.get("", response_model=list[AccountResponse])
async def list_accounts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Account).where(Account.user_id == current_user.id, Account.is_active == True)
    )
    accounts = result.scalars().all()
    balances = await compute_balances_bulk(db, accounts)
    return [
        AccountResponse.model_validate({
            **a.__dict__,
            "current_balance": balances[a.id],
            "institution": a.institution,
        })
        for a in accounts
    ]


@router.post("", response_model=AccountResponse, status_code=201)
async def create_account(
    data: AccountCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    account = Account(**data.model_dump(), user_id=current_user.id)
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return AccountResponse.model_validate(
        {**account.__dict__, "current_balance": account.opening_balance, "institution": account.institution}
    )


@router.get("/{account_id}", response_model=AccountResponse)
async def get_account(
    account_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Account).where(Account.id == account_id, Account.user_id == current_user.id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return await _to_response(db, account)


@router.patch("/{account_id}", response_model=AccountResponse)
async def update_account(
    account_id: uuid.UUID,
    data: AccountUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Account).where(Account.id == account_id, Account.user_id == current_user.id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(account, field, value)
    await db.commit()
    await db.refresh(account)
    return await _to_response(db, account)


@router.delete("/{account_id}", status_code=204)
async def delete_account(
    account_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Account).where(Account.id == account_id, Account.user_id == current_user.id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    await db.delete(account)
    await db.commit()
