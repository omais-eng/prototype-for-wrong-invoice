import logging
import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.invoice import Invoice
from app.models.validation_log import ValidationLog
from app.schemas.invoice import ValidationResult, ValidationError, AIAnalysis
from app.services.erp_service import erp_service
from app.services.duplicate_detection import check_duplicates

logger = logging.getLogger(__name__)

# Error codes
DUPLICATE_INVOICE = "DUPLICATE_INVOICE"
PO_NOT_FOUND = "PO_NOT_FOUND"
PO_MISMATCH = "PO_MISMATCH"
VENDOR_MISMATCH = "VENDOR_MISMATCH"
PRICE_MISMATCH = "PRICE_MISMATCH"
QUANTITY_MISMATCH = "QUANTITY_MISMATCH"
CONTRACT_VIOLATION = "CONTRACT_VIOLATION"
PRICE_NOT_APPROVED = "PRICE_NOT_APPROVED"
MATH_ERROR = "MATH_ERROR"
MISSING_FIELD = "MISSING_FIELD"
VENDOR_INACTIVE = "VENDOR_INACTIVE"


def _make_error(code: str, message: str, field: Optional[str] = None, severity: str = "error", details: Optional[Dict] = None) -> Dict[str, Any]:
    return {
        "code": code,
        "message": message,
        "severity": severity,
        "field": field,
        "details": details or {},
    }


def _check_required_fields(invoice: Invoice) -> List[Dict[str, Any]]:
    errors = []
    if not invoice.invoice_number:
        errors.append(_make_error(MISSING_FIELD, "Invoice number is missing", field="invoice_number"))
    if not invoice.vendor_id:
        errors.append(_make_error(MISSING_FIELD, "Vendor ID is missing", field="vendor_id"))
    if not invoice.invoice_date:
        errors.append(_make_error(MISSING_FIELD, "Invoice date is missing", field="invoice_date"))
    if not invoice.total_amount or invoice.total_amount <= 0:
        errors.append(_make_error(MISSING_FIELD, "Total amount is missing or zero", field="total_amount"))
    if not invoice.line_items or len(invoice.line_items) == 0:
        errors.append(_make_error(MISSING_FIELD, "Invoice has no line items", field="line_items", severity="warning"))
    return errors


def _check_math(invoice: Invoice) -> List[Dict[str, Any]]:
    errors = []
    line_items = invoice.line_items or []

    if line_items:
        computed_line_total = 0.0
        for item in line_items:
            if isinstance(item, dict):
                qty = float(item.get("quantity", 0) or 0)
                unit_price = float(item.get("unit_price", 0) or 0)
                line_total = float(item.get("total", 0) or 0)
                expected_total = round(qty * unit_price, 2)
                if abs(expected_total - line_total) > 0.02:
                    errors.append(_make_error(
                        MATH_ERROR,
                        f"Line item '{item.get('description', 'unknown')}' total {line_total} does not match qty * unit_price = {expected_total}",
                        field="line_items",
                        details={"expected": expected_total, "actual": line_total},
                    ))
                computed_line_total += line_total

        subtotal = round(invoice.subtotal or 0.0, 2)
        computed_line_total = round(computed_line_total, 2)
        if abs(subtotal - computed_line_total) > 0.02:
            errors.append(_make_error(
                MATH_ERROR,
                f"Subtotal {subtotal} does not match sum of line items {computed_line_total}",
                field="subtotal",
                details={"expected": computed_line_total, "actual": subtotal},
            ))

    subtotal = round(invoice.subtotal or 0.0, 2)
    tax = round(invoice.tax_amount or 0.0, 2)
    total = round(invoice.total_amount or 0.0, 2)
    expected_total = round(subtotal + tax, 2)

    if abs(expected_total - total) > 0.02:
        errors.append(_make_error(
            MATH_ERROR,
            f"Total {total} does not equal subtotal {subtotal} + tax {tax} = {expected_total}",
            field="total_amount",
            details={"expected": expected_total, "actual": total},
        ))

    return errors


def _check_po_match(invoice: Invoice, po_data: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
    errors = []

    if not invoice.po_number:
        return errors

    if not po_data:
        errors.append(_make_error(PO_NOT_FOUND, f"Purchase order '{invoice.po_number}' not found in ERP", field="po_number"))
        return errors

    # Vendor match
    if po_data.get("vendor_id") and invoice.vendor_id:
        if str(po_data["vendor_id"]).strip() != str(invoice.vendor_id).strip():
            errors.append(_make_error(
                VENDOR_MISMATCH,
                f"Vendor on invoice ({invoice.vendor_id}) does not match PO vendor ({po_data['vendor_id']})",
                field="vendor_id",
                details={"invoice_vendor": invoice.vendor_id, "po_vendor": po_data["vendor_id"]},
            ))

    # Amount match within 2% tolerance
    po_total = float(po_data.get("total_amount", 0) or 0)
    inv_total = float(invoice.total_amount or 0)
    if po_total > 0 and inv_total > 0:
        diff_pct = abs(po_total - inv_total) / po_total
        if diff_pct > 0.02:
            errors.append(_make_error(
                PO_MISMATCH,
                f"Invoice total {inv_total} differs from PO total {po_total} by {round(diff_pct * 100, 2)}%",
                field="total_amount",
                severity="error",
                details={"invoice_total": inv_total, "po_total": po_total, "diff_pct": round(diff_pct * 100, 2)},
            ))

    # Line items match
    po_line_items = po_data.get("line_items") or []
    inv_line_items = invoice.line_items or []
    if po_line_items and inv_line_items:
        po_qtys: Dict[str, float] = {}
        for item in po_line_items:
            if isinstance(item, dict):
                desc = str(item.get("description", "")).lower().strip()
                po_qtys[desc] = float(item.get("quantity", 0) or 0)

        for item in inv_line_items:
            if isinstance(item, dict):
                desc = str(item.get("description", "")).lower().strip()
                inv_qty = float(item.get("quantity", 0) or 0)
                if desc in po_qtys:
                    po_qty = po_qtys[desc]
                    if po_qty > 0 and abs(inv_qty - po_qty) / po_qty > 0.01:
                        errors.append(_make_error(
                            QUANTITY_MISMATCH,
                            f"Quantity mismatch for '{item.get('description')}': invoice {inv_qty} vs PO {po_qty}",
                            field="line_items",
                            details={"description": item.get("description"), "invoice_qty": inv_qty, "po_qty": po_qty},
                        ))

    # PO status
    po_status = po_data.get("status", "").lower()
    if po_status in ("closed", "cancelled"):
        errors.append(_make_error(
            PO_MISMATCH,
            f"Purchase order '{invoice.po_number}' is {po_status} and cannot accept new invoices",
            field="po_number",
            details={"po_status": po_status},
        ))

    return errors


def _check_contract_compliance(invoice: Invoice, contract_data: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
    errors = []

    if not contract_data:
        return errors

    approved_rates: Dict[str, Any] = contract_data.get("approved_rates") or {}

    # Check contract validity period
    start_date = contract_data.get("start_date")
    end_date = contract_data.get("end_date")
    if invoice.invoice_date and start_date and end_date:
        try:
            inv_date = invoice.invoice_date if isinstance(invoice.invoice_date, datetime) else datetime.fromisoformat(str(invoice.invoice_date))
            start = datetime.fromisoformat(str(start_date)) if not isinstance(start_date, datetime) else start_date
            end = datetime.fromisoformat(str(end_date)) if not isinstance(end_date, datetime) else end_date
            if inv_date < start or inv_date > end:
                errors.append(_make_error(
                    CONTRACT_VIOLATION,
                    f"Invoice date {inv_date.date()} falls outside contract period {start.date()} to {end.date()}",
                    field="invoice_date",
                ))
        except Exception as exc:
            logger.debug("Could not compare dates: %s", exc)

    # Check line item rates against approved rates
    if approved_rates and invoice.line_items:
        for item in invoice.line_items:
            if not isinstance(item, dict):
                continue
            desc = str(item.get("description", "")).lower().strip()
            unit_price = float(item.get("unit_price", 0) or 0)

            for rate_key, approved_price in approved_rates.items():
                if rate_key.lower() in desc or desc in rate_key.lower():
                    approved = float(approved_price or 0)
                    if approved > 0 and unit_price > 0:
                        diff_pct = abs(unit_price - approved) / approved
                        if diff_pct > 0.01:
                            errors.append(_make_error(
                                PRICE_NOT_APPROVED,
                                f"Unit price {unit_price} for '{item.get('description')}' is not approved; contract rate is {approved}",
                                field="line_items",
                                details={
                                    "description": item.get("description"),
                                    "invoice_price": unit_price,
                                    "approved_price": approved,
                                    "diff_pct": round(diff_pct * 100, 2),
                                },
                            ))
                    break

    return errors


def _check_vendor(invoice: Invoice, vendor_data: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
    errors = []
    if not vendor_data:
        return errors
    status = str(vendor_data.get("status", "active")).lower()
    if status == "inactive":
        errors.append(_make_error(
            VENDOR_INACTIVE,
            f"Vendor '{invoice.vendor_id}' is inactive in the ERP system",
            field="vendor_id",
            details={"vendor_status": status},
        ))
    return errors


async def _log_check(db: AsyncSession, invoice_id: Any, check_type: str, status: str, message: str, details: Dict) -> None:
    log = ValidationLog(
        id=uuid.uuid4(),
        invoice_id=invoice_id,
        check_type=check_type,
        status=status,
        message=message,
        details=details,
    )
    db.add(log)


async def run_all_checks(db: AsyncSession, invoice: Invoice) -> Dict[str, Any]:
    """Run all validation checks and return a consolidated dict of errors and warnings."""
    all_errors: List[Dict[str, Any]] = []
    all_warnings: List[Dict[str, Any]] = []
    checks_run: List[str] = []

    invoice_dict = {
        "id": invoice.id,
        "invoice_number": invoice.invoice_number,
        "vendor_id": invoice.vendor_id,
        "vendor_name": invoice.vendor_name,
        "total_amount": invoice.total_amount,
        "invoice_date": invoice.invoice_date,
        "line_items": invoice.line_items or [],
    }

    # 1. Required fields
    checks_run.append("REQUIRED_FIELDS")
    field_errors = _check_required_fields(invoice)
    for e in field_errors:
        if e["severity"] == "error":
            all_errors.append(e)
        else:
            all_warnings.append(e)
    status = "FAILED" if any(e["severity"] == "error" for e in field_errors) else "PASSED"
    await _log_check(db, invoice.id, "REQUIRED_FIELDS", status, f"{len(field_errors)} issues found", {"errors": field_errors})

    # 2. Math check
    checks_run.append("MATH_CHECK")
    math_errors = _check_math(invoice)
    all_errors.extend(math_errors)
    await _log_check(db, invoice.id, "MATH_CHECK", "FAILED" if math_errors else "PASSED",
                     f"{len(math_errors)} math errors", {"errors": math_errors})

    # 3. Duplicate check
    checks_run.append("DUPLICATE_CHECK")
    dup_result = await check_duplicates(db, invoice_dict)
    if dup_result["is_duplicate"]:
        all_errors.append(_make_error(
            DUPLICATE_INVOICE,
            f"Duplicate invoice detected via {dup_result['method']} match "
            f"(confidence: {dup_result['confidence']:.0%}). "
            f"Matched invoice ID: {dup_result['matched_invoice_id']}",
            details=dup_result,
        ))
        await _log_check(db, invoice.id, "DUPLICATE_CHECK", "FAILED", "Duplicate detected", dup_result)
    else:
        await _log_check(db, invoice.id, "DUPLICATE_CHECK", "PASSED", "No duplicate found", {})

    # 4. Vendor check
    checks_run.append("VENDOR_CHECK")
    vendor_data = await erp_service.get_vendor(invoice.vendor_id)
    vendor_errors = _check_vendor(invoice, vendor_data)
    all_errors.extend(vendor_errors)
    await _log_check(db, invoice.id, "VENDOR_CHECK", "FAILED" if vendor_errors else "PASSED",
                     f"{len(vendor_errors)} vendor issues", {"errors": vendor_errors})

    # 5. PO match
    if invoice.po_number:
        checks_run.append("PO_MATCH")
        po_data = await erp_service.get_purchase_order(invoice.po_number)
        po_errors = _check_po_match(invoice, po_data)
        all_errors.extend(po_errors)
        await _log_check(db, invoice.id, "PO_MATCH", "FAILED" if po_errors else "PASSED",
                         f"{len(po_errors)} PO issues", {"errors": po_errors})

    # 6. Contract compliance
    checks_run.append("CONTRACT_VALIDATION")
    contract_data = await erp_service.get_contract(invoice.vendor_id)
    contract_errors = _check_contract_compliance(invoice, contract_data)
    all_errors.extend(contract_errors)
    await _log_check(db, invoice.id, "CONTRACT_VALIDATION", "FAILED" if contract_errors else "PASSED",
                     f"{len(contract_errors)} contract issues", {"errors": contract_errors})

    return {
        "errors": all_errors,
        "warnings": all_warnings,
        "checks_run": checks_run,
        "passed": len(all_errors) == 0,
    }


async def validate_invoice(db: AsyncSession, invoice_id: Any) -> ValidationResult:
    """Main entry point: validate an invoice by ID and persist the result."""
    stmt = select(Invoice).where(Invoice.id == invoice_id)
    result = await db.execute(stmt)
    invoice = result.scalars().first()

    if not invoice:
        raise ValueError(f"Invoice {invoice_id} not found")

    invoice.status = "processing"
    invoice.validation_status = "pending"
    db.add(invoice)
    await db.flush()

    check_result = await run_all_checks(db, invoice)

    errors = check_result["errors"]
    warnings = check_result["warnings"]
    passed = check_result["passed"]

    invoice.validation_errors = errors + warnings
    invoice.validation_status = "passed" if passed else "failed"

    # Determine duplicate vs. invalid
    dup_codes = [e["code"] for e in errors if e["code"] == DUPLICATE_INVOICE]
    if dup_codes:
        invoice.status = "duplicate"
    elif not passed:
        invoice.status = "invalid"
    else:
        invoice.status = "valid"

    db.add(invoice)
    await db.flush()

    # AI analysis
    from app.services.ai_service import ai_service

    ai_result = await ai_service.analyze_invoice(
        invoice_data={
            "invoice_number": invoice.invoice_number,
            "vendor_id": invoice.vendor_id,
            "vendor_name": invoice.vendor_name,
            "total_amount": invoice.total_amount,
            "currency": invoice.currency,
        },
        validation_errors=errors,
    )
    invoice.ai_analysis = ai_result
    db.add(invoice)

    return ValidationResult(
        invoice_id=invoice.id,
        passed=passed,
        errors=[ValidationError(**e) for e in errors],
        warnings=[ValidationError(**e) for e in warnings],
        checks_run=check_result["checks_run"],
        ai_analysis=AIAnalysis(**ai_result) if ai_result else None,
    )
