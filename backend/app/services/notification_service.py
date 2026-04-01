import logging
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.invoice import Invoice
from app.services import email_service
from app.services.ai_service import ai_service

logger = logging.getLogger(__name__)

MANAGER_EMAIL = "ap-manager@airp.local"


async def process_validation_result(db: AsyncSession, invoice: Invoice) -> None:
    """Dispatch notifications based on the invoice validation status."""
    status = (invoice.status or "").lower()

    if status == "duplicate":
        await notify_duplicate(db, invoice)
    elif status == "invalid":
        await notify_invalid(db, invoice)
    elif status == "valid":
        await notify_manager_for_approval(db, invoice)
    else:
        logger.debug("No notification action for invoice %s with status '%s'", invoice.id, status)


async def notify_duplicate(db: AsyncSession, invoice: Invoice) -> None:
    """Notify the vendor that their invoice was identified as a duplicate."""
    if not invoice.vendor_email:
        logger.warning("Cannot notify duplicate for invoice %s: no vendor email", invoice.id)
        return

    try:
        await email_service.send_vendor_duplicate_notice(
            vendor_email=invoice.vendor_email,
            invoice_number=invoice.invoice_number or "N/A",
        )
        logger.info("Duplicate notice sent for invoice %s to %s", invoice.id, invoice.vendor_email)
    except Exception as exc:
        logger.error("Failed to send duplicate notice for invoice %s: %s", invoice.id, exc)


async def notify_invalid(db: AsyncSession, invoice: Invoice) -> None:
    """Send a rejection email to the vendor explaining all validation errors."""
    if not invoice.vendor_email:
        logger.warning("Cannot notify invalid for invoice %s: no vendor email", invoice.id)
        return

    errors = invoice.validation_errors or []
    invoice_data = {
        "invoice_number": invoice.invoice_number,
        "vendor_id": invoice.vendor_id,
        "vendor_name": invoice.vendor_name,
        "total_amount": invoice.total_amount,
        "currency": invoice.currency,
    }

    try:
        ai_email = await ai_service.generate_vendor_rejection_email(invoice_data, errors)
        await email_service.send_vendor_rejection(
            vendor_email=invoice.vendor_email,
            vendor_name=invoice.vendor_name or invoice.vendor_id or "Vendor",
            invoice_number=invoice.invoice_number or "N/A",
            errors=errors,
            ai_email_body=ai_email,
        )
        logger.info("Rejection email sent for invoice %s to %s", invoice.id, invoice.vendor_email)
    except Exception as exc:
        logger.error("Failed to send rejection email for invoice %s: %s", invoice.id, exc)


async def notify_manager_for_approval(db: AsyncSession, invoice: Invoice) -> None:
    """Send manager notification for a valid invoice awaiting approval."""
    invoice_data = {
        "invoice_number": invoice.invoice_number,
        "vendor_id": invoice.vendor_id,
        "vendor_name": invoice.vendor_name,
        "total_amount": invoice.total_amount,
        "currency": invoice.currency,
        "status": invoice.status,
    }

    try:
        summary = await ai_service.generate_manager_summary(invoice_data)
        await email_service.send_manager_notification(
            manager_email=MANAGER_EMAIL,
            invoice_data=invoice_data,
            summary=summary,
        )
        logger.info("Manager notified for invoice %s", invoice.id)
    except Exception as exc:
        logger.error("Failed to notify manager for invoice %s: %s", invoice.id, exc)
