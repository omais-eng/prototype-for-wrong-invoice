import uuid
import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from app.database import get_db
from app.models.vendor import Vendor
from app.schemas.vendor import VendorCreate, VendorUpdate, VendorResponse

router = APIRouter(prefix="/vendors", tags=["vendors"])
logger = logging.getLogger(__name__)


@router.post("", response_model=VendorResponse, status_code=status.HTTP_201_CREATED)
async def create_vendor(payload: VendorCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Vendor).where(Vendor.vendor_id == payload.vendor_id))
    if result.scalars().first():
        raise HTTPException(status_code=409, detail=f"Vendor with ID '{payload.vendor_id}' already exists")

    vendor = Vendor(
        id=uuid.uuid4(),
        vendor_id=payload.vendor_id,
        name=payload.name,
        email=payload.email,
        phone=payload.phone,
        address=payload.address,
        status=payload.status,
    )
    db.add(vendor)
    await db.flush()
    return vendor


@router.get("", response_model=List[VendorResponse])
async def list_vendors(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None, description="Search by name or vendor_id"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Vendor)
    if status:
        stmt = stmt.where(Vendor.status == status)
    if search:
        stmt = stmt.where(
            or_(
                Vendor.name.ilike(f"%{search}%"),
                Vendor.vendor_id.ilike(f"%{search}%"),
            )
        )
    stmt = stmt.order_by(Vendor.created_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{vendor_id}", response_model=VendorResponse)
async def get_vendor(vendor_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Vendor).where(Vendor.vendor_id == vendor_id))
    vendor = result.scalars().first()
    if not vendor:
        raise HTTPException(status_code=404, detail=f"Vendor '{vendor_id}' not found")
    return vendor


@router.put("/{vendor_id}", response_model=VendorResponse)
async def update_vendor(vendor_id: str, payload: VendorUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Vendor).where(Vendor.vendor_id == vendor_id))
    vendor = result.scalars().first()
    if not vendor:
        raise HTTPException(status_code=404, detail=f"Vendor '{vendor_id}' not found")

    update_data = payload.model_dump(exclude_none=True)
    for field, value in update_data.items():
        setattr(vendor, field, value)
    vendor.updated_at = datetime.utcnow()

    db.add(vendor)
    await db.flush()
    return vendor


@router.delete("/{vendor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vendor(vendor_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Vendor).where(Vendor.vendor_id == vendor_id))
    vendor = result.scalars().first()
    if not vendor:
        raise HTTPException(status_code=404, detail=f"Vendor '{vendor_id}' not found")
    await db.delete(vendor)
    await db.flush()
