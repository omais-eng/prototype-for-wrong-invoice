import logging
from collections import defaultdict
from typing import List, Dict, Any

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc

from app.database import get_db
from app.models.invoice import Invoice
from app.models.validation_log import ValidationLog

router = APIRouter(prefix="/dashboard", tags=["dashboard"])
logger = logging.getLogger(__name__)


@router.get("/stats", response_model=Dict[str, Any])
async def dashboard_stats(db: AsyncSession = Depends(get_db)):
    """Aggregate invoice statistics for the dashboard."""
    # Total count
    total_result = await db.execute(select(func.count(Invoice.id)))
    total = total_result.scalar() or 0

    # Count per status
    status_result = await db.execute(
        select(Invoice.status, func.count(Invoice.id))
        .group_by(Invoice.status)
    )
    status_counts: Dict[str, int] = {row[0]: row[1] for row in status_result.all()}

    # Total value processed
    value_result = await db.execute(
        select(func.coalesce(func.sum(Invoice.total_amount), 0.0))
        .where(Invoice.status.in_(["approved", "paid"]))
    )
    total_value_approved = float(value_result.scalar() or 0.0)

    # Total pending value
    pending_value_result = await db.execute(
        select(func.coalesce(func.sum(Invoice.total_amount), 0.0))
        .where(Invoice.status == "valid")
    )
    total_value_pending = float(pending_value_result.scalar() or 0.0)

    # Validation pass rate
    passed_result = await db.execute(
        select(func.count(Invoice.id)).where(Invoice.validation_status == "passed")
    )
    passed = passed_result.scalar() or 0
    pass_rate = round((passed / total * 100), 1) if total > 0 else 0.0

    return {
        "total_invoices": total,
        "by_status": status_counts,
        "pending_approval": status_counts.get("valid", 0),
        "invalid": status_counts.get("invalid", 0),
        "duplicate": status_counts.get("duplicate", 0),
        "approved": status_counts.get("approved", 0),
        "rejected": status_counts.get("rejected", 0),
        "paid": status_counts.get("paid", 0),
        "total_value_approved": total_value_approved,
        "total_value_pending_approval": total_value_pending,
        "validation_pass_rate_pct": pass_rate,
    }


@router.get("/recent-activity", response_model=List[Dict[str, Any]])
async def recent_activity(db: AsyncSession = Depends(get_db)):
    """Last 20 invoice events ordered by most recent."""
    stmt = (
        select(Invoice)
        .order_by(desc(Invoice.updated_at))
        .limit(20)
    )
    result = await db.execute(stmt)
    invoices = result.scalars().all()

    activity = []
    for inv in invoices:
        activity.append({
            "invoice_id": str(inv.id),
            "invoice_number": inv.invoice_number,
            "vendor_id": inv.vendor_id,
            "vendor_name": inv.vendor_name,
            "status": inv.status,
            "total_amount": inv.total_amount,
            "currency": inv.currency,
            "validation_status": inv.validation_status,
            "received_date": inv.received_date.isoformat() if inv.received_date else None,
            "updated_at": inv.updated_at.isoformat() if inv.updated_at else None,
        })

    return activity


@router.get("/error-breakdown", response_model=Dict[str, Any])
async def error_breakdown(db: AsyncSession = Depends(get_db)):
    """Count of each error type across all invoices with failed validation."""
    stmt = select(Invoice).where(Invoice.validation_errors.isnot(None))
    result = await db.execute(stmt)
    invoices = result.scalars().all()

    code_counts: Dict[str, int] = defaultdict(int)
    total_errors = 0

    for inv in invoices:
        errors = inv.validation_errors or []
        for error in errors:
            if isinstance(error, dict):
                code = error.get("code", "UNKNOWN")
                code_counts[code] += 1
                total_errors += 1

    # Also aggregate from validation_logs
    log_stmt = (
        select(ValidationLog.check_type, func.count(ValidationLog.id))
        .where(ValidationLog.status == "FAILED")
        .group_by(ValidationLog.check_type)
    )
    log_result = await db.execute(log_stmt)
    check_type_counts: Dict[str, int] = {row[0]: row[1] for row in log_result.all()}

    sorted_errors = sorted(code_counts.items(), key=lambda x: x[1], reverse=True)

    return {
        "total_errors": total_errors,
        "by_error_code": dict(sorted_errors),
        "by_check_type": check_type_counts,
        "top_errors": [
            {"code": code, "count": count, "percentage": round(count / total_errors * 100, 1)}
            for code, count in sorted_errors[:10]
        ] if total_errors > 0 else [],
    }
