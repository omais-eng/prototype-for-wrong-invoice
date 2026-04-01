import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSON

from app.database import Base


class ValidationLog(Base):
    __tablename__ = "validation_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    check_type = Column(String, nullable=False)  # DUPLICATE_CHECK, PO_MATCH, CONTRACT_VALIDATION, etc.
    status = Column(String, nullable=False)  # PASSED / FAILED / WARNING
    message = Column(String, nullable=True)
    details = Column(JSON, nullable=True, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
