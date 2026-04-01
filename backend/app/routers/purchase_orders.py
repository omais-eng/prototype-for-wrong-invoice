import uuid
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.purchase_order import PurchaseOrder
from app.schemas.purchase_order import PurchaseOrderCreate, PurchaseOrderUpdate, PurchaseOrderResponse

router = APIRouter(prefix="/purchase-orders", tags=["purchase-orders"])
logger = logging.getLogger(__name__)


@router.post("", response_model=PurchaseOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_purchase_order(payload: PurchaseOrderCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PurchaseOrder).where(PurchaseOrder.po_number == payload.po_number))
    if result.scalars().first():
        raise HTTPException(status_code=409, detail=f"Purchase order '{payload.po_number}' already exists")

    po = PurchaseOrder(
        id=uuid.uuid4(),
        po_number=payload.po_number,
        vendor_id=payload.vendor_id,
        status=payload.status,
        total_amount=payload.total_amount,
        currency=payload.currency,
        line_items=payload.line_items or [],
        due_date=payload.due_date,
    )
    db.add(po)
    await db.flush()
    return po


@router.get("", response_model=List[PurchaseOrderResponse])
async def list_purchase_orders(
    vendor_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(PurchaseOrder)
    if vendor_id:
        stmt = stmt.where(PurchaseOrder.vendor_id == vendor_id)
    if status:
        stmt = stmt.where(PurchaseOrder.status == status)
    stmt = stmt.order_by(PurchaseOrder.created_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{po_number}", response_model=PurchaseOrderResponse)
async def get_purchase_order(po_number: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PurchaseOrder).where(PurchaseOrder.po_number == po_number))
    po = result.scalars().first()
    if not po:
        raise HTTPException(status_code=404, detail=f"Purchase order '{po_number}' not found")
    return po


@router.put("/{po_number}", response_model=PurchaseOrderResponse)
async def update_purchase_order(po_number: str, payload: PurchaseOrderUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PurchaseOrder).where(PurchaseOrder.po_number == po_number))
    po = result.scalars().first()
    if not po:
        raise HTTPException(status_code=404, detail=f"Purchase order '{po_number}' not found")

    update_data = payload.model_dump(exclude_none=True)
    for field, value in update_data.items():
        setattr(po, field, value)

    db.add(po)
    await db.flush()
    return po


@router.delete("/{po_number}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_purchase_order(po_number: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PurchaseOrder).where(PurchaseOrder.po_number == po_number))
    po = result.scalars().first()
    if not po:
        raise HTTPException(status_code=404, detail=f"Purchase order '{po_number}' not found")
    await db.delete(po)
    await db.flush()
