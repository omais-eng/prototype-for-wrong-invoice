from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime
from uuid import UUID


class PurchaseOrderBase(BaseModel):
    po_number: str
    vendor_id: str
    status: str = "open"
    total_amount: float = 0.0
    currency: str = "USD"
    line_items: Optional[List[Any]] = None
    due_date: Optional[datetime] = None


class PurchaseOrderCreate(PurchaseOrderBase):
    pass


class PurchaseOrderUpdate(BaseModel):
    status: Optional[str] = None
    total_amount: Optional[float] = None
    currency: Optional[str] = None
    line_items: Optional[List[Any]] = None
    due_date: Optional[datetime] = None


class PurchaseOrderResponse(PurchaseOrderBase):
    id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}
