import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Float
from sqlalchemy.dialects.postgresql import UUID, JSON

from app.database import Base


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    po_number = Column(String, unique=True, nullable=False, index=True)
    vendor_id = Column(String, nullable=False, index=True)
    status = Column(String, nullable=False, default="open")  # open / closed / cancelled
    total_amount = Column(Float, nullable=False, default=0.0)
    currency = Column(String, nullable=False, default="USD")
    line_items = Column(JSON, nullable=True, default=list)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    due_date = Column(DateTime, nullable=True)
