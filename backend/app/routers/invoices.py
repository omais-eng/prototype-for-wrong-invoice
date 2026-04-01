import os
import uuid
import logging
from datetime import datetime, date
from typing import Optional, List, Any

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.database import get_db
from app.models.invoice import Invoice
from app.schemas.invoice import InvoiceResponse, InvoiceUpdate, ValidationResult
from app.services.document_service import process_invoice_file
from app.services.duplicate_detection import compute_and_store_embedding
from app.services.validation_service import validate_invoice
from app.services.erp_service import erp_service
from app.services.notification_service import process_validation_result

router = APIRouter(prefix="/invoices", tags=["invoices"])
logger = logging.getLogger(__name__)

UPLOAD_DIR = "/tmp/airp_uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/upload", response_model=dict, status_code=status.HTTP_201_CREATED)
async def upload_invoice(
    file: UploadFile = File(...),
    vendor_id: Optional[str] = Query(None, description="Vendor ID if known"),
    db: AsyncSession = Depends(get_db),
):
    """Upload an invoice file (PDF, image, Excel), process it, validate it, and return the result."""
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    # Save file to disk
    file_ext = os.path.splitext(file.filename or "invoice")[1] or ".pdf"
    file_id = str(uuid.uuid4())
    file_path = os.path.join(UPLOAD_DIR, f"{file_id}{file_ext}")
    with open(file_path, "wb") as f:
        f.write(file_bytes)

    # Extract and parse
    try:
        parsed = await process_invoice_file(file_bytes, file.filename or "invoice.pdf")
    except Exception as exc:
        logger.error("Document processing failed: %s", exc)
        parsed = {}

    raw_text = parsed.get("raw_text", "")
    invoice_number = parsed.get("invoice_number") or f"INV-{file_id[:8].upper()}"
    resolved_vendor_id = vendor_id or parsed.get("vendor_id") or "UNKNOWN"

    # Parse invoice date
    invoice_date = None
    raw_date = parsed.get("invoice_date")
    if raw_date:
        try:
            if isinstance(raw_date, str):
                for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%B %d, %Y", "%b %d, %Y"):
                    try:
                        invoice_date = datetime.strptime(raw_date, fmt)
                        break
                    except ValueError:
                        continue
            else:
                invoice_date = raw_date
        except Exception:
            pass

    # Build line items
    raw_line_items = parsed.get("line_items") or []
    line_items = []
    for item in raw_line_items:
        if isinstance(item, dict):
            line_items.append({
                "description": item.get("description", ""),
                "quantity": float(item.get("quantity", 1) or 1),
                "unit_price": float(item.get("unit_price", 0) or 0),
                "total": float(item.get("total", 0) or 0),
            })

    subtotal = float(parsed.get("subtotal", 0) or 0)
    tax_amount = float(parsed.get("tax_amount", 0) or 0)
    total_amount = float(parsed.get("total_amount", 0) or 0)

    # Compute embedding
    embedding = await compute_and_store_embedding({
        "invoice_number": invoice_number,
        "vendor_id": resolved_vendor_id,
        "total_amount": total_amount,
        "invoice_date": invoice_date,
        "line_items": line_items,
    })

    invoice = Invoice(
        id=uuid.uuid4(),
        invoice_number=invoice_number,
        vendor_id=resolved_vendor_id,
        vendor_name=parsed.get("vendor_name"),
        vendor_email=parsed.get("vendor_email"),
        invoice_date=invoice_date,
        received_date=datetime.utcnow(),
        po_number=parsed.get("po_number"),
        contract_number=parsed.get("contract_number"),
        line_items=line_items,
        subtotal=subtotal,
        tax_amount=tax_amount,
        total_amount=total_amount,
        currency=parsed.get("currency", "USD"),
        status="received",
        validation_status="pending",
        validation_errors=[],
        raw_text=raw_text,
        file_path=file_path,
        embedding=embedding,
    )
    db.add(invoice)
    await db.flush()

    # Validate
    try:
        validation_result = await validate_invoice(db, invoice.id)
    except Exception as exc:
        logger.error("Validation failed for invoice %s: %s", invoice.id, exc)
        validation_result = None

    # Send notifications
    try:
        await process_validation_result(db, invoice)
    except Exception as exc:
        logger.warning("Notification failed for invoice %s: %s", invoice.id, exc)

    return {
        "invoice_id": str(invoice.id),
        "invoice_number": invoice.invoice_number,
        "status": invoice.status,
        "validation_status": invoice.validation_status,
        "validation_errors": invoice.validation_errors or [],
        "ai_analysis": invoice.ai_analysis or {},
        "total_amount": invoice.total_amount,
        "currency": invoice.currency,
    }


@router.get("", response_model=List[InvoiceResponse])
async def list_invoices(
    status: Optional[str] = Query(None),
    vendor_id: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """List invoices with optional filters."""
    stmt = select(Invoice)

    filters = []
    if status:
        filters.append(Invoice.status == status)
    if vendor_id:
        filters.append(Invoice.vendor_id == vendor_id)
    if date_from:
        filters.append(Invoice.received_date >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        filters.append(Invoice.received_date <= datetime.combine(date_to, datetime.max.time()))

    if filters:
        stmt = stmt.where(and_(*filters))

    stmt = stmt.order_by(Invoice.created_at.desc())
    stmt = stmt.offset((page - 1) * limit).limit(limit)

    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/stats/summary", response_model=dict)
async def invoice_stats_summary(db: AsyncSession = Depends(get_db)):
    """Dashboard stats: total, valid, invalid, duplicate, pending_approval."""
    total_result = await db.execute(select(func.count(Invoice.id)))
    total = total_result.scalar() or 0

    async def count_by_status(s: str) -> int:
        r = await db.execute(select(func.count(Invoice.id)).where(Invoice.status == s))
        return r.scalar() or 0

    valid = await count_by_status("valid")
    invalid = await count_by_status("invalid")
    duplicate = await count_by_status("duplicate")
    approved = await count_by_status("approved")
    rejected = await count_by_status("rejected")
    received = await count_by_status("received")
    processing = await count_by_status("processing")
    paid = await count_by_status("paid")

    pending_approval = valid  # valid invoices are awaiting manager approval

    return {
        "total": total,
        "valid": valid,
        "invalid": invalid,
        "duplicate": duplicate,
        "approved": approved,
        "rejected": rejected,
        "received": received,
        "processing": processing,
        "paid": paid,
        "pending_approval": pending_approval,
    }


@router.get("/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(invoice_id: str, db: AsyncSession = Depends(get_db)):
    """Get invoice detail by ID."""
    try:
        inv_uuid = uuid.UUID(invoice_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid invoice ID format")

    result = await db.execute(select(Invoice).where(Invoice.id == inv_uuid))
    invoice = result.scalars().first()
    if not invoice:
        raise HTTPException(status_code=404, detail=f"Invoice {invoice_id} not found")
    return invoice


@router.put("/{invoice_id}/approve", response_model=dict)
async def approve_invoice(invoice_id: str, db: AsyncSession = Depends(get_db)):
    """Manager approves invoice and pushes it to the ERP system."""
    try:
        inv_uuid = uuid.UUID(invoice_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid invoice ID format")

    result = await db.execute(select(Invoice).where(Invoice.id == inv_uuid))
    invoice = result.scalars().first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if invoice.status not in ("valid", "invalid", "received"):
        raise HTTPException(
            status_code=400,
            detail=f"Invoice cannot be approved from status '{invoice.status}'",
        )

    invoice.status = "approved"
    invoice.updated_at = datetime.utcnow()
    db.add(invoice)
    await db.flush()

    # Push to ERP
    erp_payload = {
        "invoice_id": str(invoice.id),
        "invoice_number": invoice.invoice_number,
        "vendor_id": invoice.vendor_id,
        "vendor_name": invoice.vendor_name,
        "total_amount": invoice.total_amount,
        "currency": invoice.currency,
        "invoice_date": invoice.invoice_date.isoformat() if invoice.invoice_date else None,
        "po_number": invoice.po_number,
        "line_items": invoice.line_items or [],
        "approved_at": datetime.utcnow().isoformat(),
    }
    erp_response = await erp_service.post_approved_invoice(erp_payload)

    return {
        "invoice_id": str(invoice.id),
        "status": invoice.status,
        "erp_response": erp_response,
        "message": "Invoice approved and submitted to ERP",
    }


@router.put("/{invoice_id}/reject", response_model=dict)
async def reject_invoice(invoice_id: str, update: InvoiceUpdate, db: AsyncSession = Depends(get_db)):
    """Manager rejects the invoice with a reason."""
    try:
        inv_uuid = uuid.UUID(invoice_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid invoice ID format")

    result = await db.execute(select(Invoice).where(Invoice.id == inv_uuid))
    invoice = result.scalars().first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    invoice.status = "rejected"
    invoice.updated_at = datetime.utcnow()

    if update.rejection_reason:
        existing_analysis = invoice.ai_analysis or {}
        existing_analysis["rejection_reason"] = update.rejection_reason
        invoice.ai_analysis = existing_analysis

    db.add(invoice)
    await db.flush()

    # Notify vendor
    if invoice.vendor_email:
        from app.services import email_service
        errors = invoice.validation_errors or []
        if update.rejection_reason:
            errors = [{"code": "MANUAL_REJECTION", "message": update.rejection_reason, "severity": "error"}] + errors
        await email_service.send_vendor_rejection(
            vendor_email=invoice.vendor_email,
            vendor_name=invoice.vendor_name or invoice.vendor_id or "Vendor",
            invoice_number=invoice.invoice_number or "N/A",
            errors=errors,
            ai_email_body="",
        )

    return {
        "invoice_id": str(invoice.id),
        "status": invoice.status,
        "rejection_reason": update.rejection_reason,
        "message": "Invoice rejected",
    }


@router.put("/{invoice_id}/request-clarification", response_model=dict)
async def request_clarification(invoice_id: str, update: InvoiceUpdate, db: AsyncSession = Depends(get_db)):
    """Manager requests clarification from the vendor."""
    try:
        inv_uuid = uuid.UUID(invoice_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid invoice ID format")

    result = await db.execute(select(Invoice).where(Invoice.id == inv_uuid))
    invoice = result.scalars().first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    existing_analysis = invoice.ai_analysis or {}
    existing_analysis["clarification_note"] = update.clarification_note or "Please provide additional information."
    invoice.ai_analysis = existing_analysis
    invoice.updated_at = datetime.utcnow()
    db.add(invoice)
    await db.flush()

    # Send clarification request to vendor
    if invoice.vendor_email:
        from app.services import email_service

        note = update.clarification_note or "Please provide additional information regarding your invoice."
        await email_service._send_email(
            to=invoice.vendor_email,
            subject=f"Clarification Required for Invoice #{invoice.invoice_number}",
            body=(
                f"Dear {invoice.vendor_name or 'Vendor'},\n\n"
                f"We require clarification for invoice #{invoice.invoice_number}:\n\n"
                f"{note}\n\n"
                f"Please respond at your earliest convenience.\n\nRegards,\nAccounts Payable"
            ),
        )

    return {
        "invoice_id": str(invoice.id),
        "clarification_note": update.clarification_note,
        "message": "Clarification request sent to vendor",
    }


@router.post("/{invoice_id}/revalidate", response_model=ValidationResult)
async def revalidate_invoice(invoice_id: str, db: AsyncSession = Depends(get_db)):
    """Re-run the full validation pipeline on an existing invoice."""
    try:
        inv_uuid = uuid.UUID(invoice_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid invoice ID format")

    result = await db.execute(select(Invoice).where(Invoice.id == inv_uuid))
    invoice = result.scalars().first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    try:
        validation_result = await validate_invoice(db, inv_uuid)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Validation failed: {exc}")

    await process_validation_result(db, invoice)
    return validation_result
