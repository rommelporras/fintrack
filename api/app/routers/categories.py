import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.category import Category
from app.models.user import User
from app.schemas.category import CategoryCreate, CategoryResponse

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryResponse])
async def list_categories(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return system categories + user's custom categories."""
    result = await db.execute(
        select(Category).where(
            or_(Category.is_system == True, Category.user_id == current_user.id)
        ).order_by(Category.type, Category.name)
    )
    return result.scalars().all()


@router.post("", response_model=CategoryResponse, status_code=201)
async def create_category(
    data: CategoryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if data.type not in ("income", "expense", "transfer"):
        raise HTTPException(status_code=422, detail="type must be income, expense, or transfer")
    category = Category(**data.model_dump(), user_id=current_user.id, is_system=False)
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return category


@router.delete("/{category_id}", status_code=204)
async def delete_category(
    category_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Category).where(
            Category.id == category_id,
            Category.user_id == current_user.id,
            Category.is_system == False,
        )
    )
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found or is a system category")
    await db.delete(category)
    await db.commit()
