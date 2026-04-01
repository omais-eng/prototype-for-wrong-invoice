import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Float, Text
from sqlalchemy.dialects.postgresql import UUID, JSON

from app.database import Base


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_number = Column(String, nullable=False, index=True)
    vendor_id = Column(String, nullable=False, index=True)
    vendor_name = Column(String, nullable=True)
    vendor_email = Column(String, nullable=True)
    invoice_date = Column(DateTime, nullable=True)
    received_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    po_number = Column(String, nullable=True, index=True)
    contract_number = Column(String, nullable=True)
    line_items = Column(JSON, nullable=True, default=list)
    subtotal = Column(Float, nullable=False, default=0.0)
    tax_amount = Column(Float, nullable=False, default=0.0)
    total_amount = Column(Float, nullable=False, default=0.0)
    currency = Column(String, nullable=False, default="USD")

    # Status lifecycle: received -> processing -> valid/invalid/duplicate -> approved/rejected/paid
    status = Column(String, nullable=False, default="received", index=True)

    # Validation
    validation_status = Column(String, nullable=False, default="pending")  # pending / passed / failed
    validation_errors = Column(JSON, nullable=True, default=list)
    ai_analysis = Column(JSON, nullable=True, default=dict)

    raw_text = Column(Text, nullable=True)
    file_path = Column(String, nullable=True)
    email_subject = Column(String, nullable=True)
    email_from = Column(String, nullable=True)

    # For duplicate detection
    embedding = Column(JSON, nullable=True, default=list)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
