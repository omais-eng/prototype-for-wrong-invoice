from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict
from datetime import datetime
from uuid import UUID


class LineItem(BaseModel):
    description: str
    quantity: float
    unit_price: float
    total: float

    model_config = {"from_attributes": True}


class InvoiceBase(BaseModel):
    invoice_number: str
    vendor_id: str
    vendor_name: Optional[str] = None
    vendor_email: Optional[str] = None
    invoice_date: Optional[datetime] = None
    po_number: Optional[str] = None
    contract_number: Optional[str] = None
    line_items: Optional[List[LineItem]] = Field(default_factory=list)
    subtotal: float = 0.0
    tax_amount: float = 0.0
    total_amount: float = 0.0
    currency: str = "USD"


class InvoiceCreate(InvoiceBase):
    email_subject: Optional[str] = None
    email_from: Optional[str] = None
    file_path: Optional[str] = None
    raw_text: Optional[str] = None


class ValidationError(BaseModel):
    code: str
    message: str
    severity: str = "error"  # error / warning
    field: Optional[str] = None
    details: Optional[Dict[str, Any]] = None


class AIAnalysis(BaseModel):
    summary: str = ""
    error_explanations: List[Dict[str, Any]] = Field(default_factory=list)
    risk_score: int = 0
    recommended_action: str = ""
    vendor_email_draft: str = ""


class InvoiceResponse(BaseModel):
    id: UUID
    invoice_number: str
    vendor_id: str
    vendor_name: Optional[str] = None
    vendor_email: Optional[str] = None
    invoice_date: Optional[datetime] = None
    received_date: datetime
    po_number: Optional[str] = None
    contract_number: Optional[str] = None
    line_items: Optional[List[Any]] = None
    subtotal: float
    tax_amount: float
    total_amount: float
    currency: str
    status: str
    validation_status: str
    validation_errors: Optional[List[Any]] = None
    ai_analysis: Optional[Dict[str, Any]] = None
    file_path: Optional[str] = None
    email_subject: Optional[str] = None
    email_from: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class InvoiceUpdate(BaseModel):
    status: Optional[str] = None
    rejection_reason: Optional[str] = None
    clarification_note: Optional[str] = None


class ValidationResult(BaseModel):
    invoice_id: UUID
    passed: bool
    errors: List[ValidationError] = Field(default_factory=list)
    warnings: List[ValidationError] = Field(default_factory=list)
    checks_run: List[str] = Field(default_factory=list)
    ai_analysis: Optional[AIAnalysis] = None
