import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.institution import Institution
from app.models.account import Account
from app.models.credit_line import CreditLine
from app.models.user import User
from app.schemas.institution import InstitutionCreate, InstitutionUpdate, InstitutionResponse

router = APIRouter(prefix="/institutions", tags=["institutions"])


@router.get("", response_model=list[InstitutionResponse])
async def list_institutions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Institution).where(Institution.user_id == current_user.id)
    )
    return result.scalars().all()


@router.post("", response_model=InstitutionResponse, status_code=201)
async def create_institution(
    data: InstitutionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    institution = Institution(**data.model_dump(), user_id=current_user.id)
    db.add(institution)
    await db.commit()
    await db.refresh(institution)
    return institution


@router.patch("/{institution_id}", response_model=InstitutionResponse)
async def update_institution(
    institution_id: uuid.UUID,
    data: InstitutionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Institution).where(
            Institution.id == institution_id,
            Institution.user_id == current_user.id,
        )
    )
    institution = result.scalar_one_or_none()
    if not institution:
        raise HTTPException(status_code=404, detail="Institution not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(institution, field, value)
    await db.commit()
    await db.refresh(institution)
    return institution


@router.delete("/{institution_id}", status_code=204)
async def delete_institution(
    institution_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Institution).where(
            Institution.id == institution_id,
            Institution.user_id == current_user.id,
        )
    )
    institution = result.scalar_one_or_none()
    if not institution:
        raise HTTPException(status_code=404, detail="Institution not found")

    # Block delete if any accounts or credit lines reference it
    account_count = await db.scalar(
        select(func.count()).where(Account.institution_id == institution_id)
    )
    line_count = await db.scalar(
        select(func.count()).where(CreditLine.institution_id == institution_id)
    )
    if (account_count or 0) + (line_count or 0) > 0:
        raise HTTPException(
            status_code=409,
            detail="Institution is referenced by accounts or credit lines. Unlink them first.",
        )

    await db.delete(institution)
    await db.commit()
