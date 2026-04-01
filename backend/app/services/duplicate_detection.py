import hashlib
import logging
from datetime import timedelta
from typing import Optional, Tuple, Dict, Any, List

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.models.invoice import Invoice

logger = logging.getLogger(__name__)


def compute_invoice_hash(invoice_data: Dict[str, Any]) -> str:
    """Compute SHA256 hash from key invoice fields for exact duplicate detection."""
    parts = [
        str(invoice_data.get("invoice_number", "") or ""),
        str(invoice_data.get("vendor_id", "") or ""),
        str(invoice_data.get("total_amount", "") or ""),
        str(invoice_data.get("invoice_date", "") or ""),
    ]
    raw = "|".join(parts).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


async def exact_duplicate_check(
    db: AsyncSession, invoice_data: Dict[str, Any]
) -> Tuple[bool, Optional[Invoice]]:
    """Check for an exact duplicate by invoice_number + vendor_id."""
    invoice_number = invoice_data.get("invoice_number")
    vendor_id = invoice_data.get("vendor_id")
    exclude_id = invoice_data.get("id")

    if not invoice_number or not vendor_id:
        return False, None

    stmt = select(Invoice).where(
        and_(
            Invoice.invoice_number == invoice_number,
            Invoice.vendor_id == vendor_id,
        )
    )
    if exclude_id:
        stmt = stmt.where(Invoice.id != exclude_id)

    result = await db.execute(stmt)
    existing = result.scalars().first()
    if existing:
        return True, existing
    return False, None


async def fuzzy_duplicate_check(
    db: AsyncSession, invoice_data: Dict[str, Any]
) -> Tuple[bool, Optional[Invoice], float]:
    """Check for near-duplicate: same vendor, amount within 1%, date within 7 days."""
    vendor_id = invoice_data.get("vendor_id")
    total_amount = float(invoice_data.get("total_amount", 0) or 0)
    invoice_date = invoice_data.get("invoice_date")
    exclude_id = invoice_data.get("id")

    if not vendor_id or total_amount == 0:
        return False, None, 0.0

    stmt = select(Invoice).where(Invoice.vendor_id == vendor_id)
    if exclude_id:
        stmt = stmt.where(Invoice.id != exclude_id)

    result = await db.execute(stmt)
    candidates: List[Invoice] = result.scalars().all()

    for candidate in candidates:
        if candidate.total_amount and total_amount > 0:
            amount_diff_pct = abs(candidate.total_amount - total_amount) / total_amount
            if amount_diff_pct > 0.01:
                continue

            date_close = True
            if invoice_date and candidate.invoice_date:
                try:
                    from datetime import datetime
                    if isinstance(invoice_date, str):
                        candidate_dt = candidate.invoice_date
                        inv_dt = datetime.fromisoformat(invoice_date.replace("Z", "+00:00"))
                    else:
                        candidate_dt = candidate.invoice_date
                        inv_dt = invoice_date

                    if abs((inv_dt - candidate_dt).days) > 7:
                        date_close = False
                except Exception:
                    pass

            if date_close:
                confidence = 1.0 - amount_diff_pct
                return True, candidate, round(confidence, 4)

    return False, None, 0.0


async def semantic_duplicate_check(
    db: AsyncSession,
    invoice_data: Dict[str, Any],
    threshold: float = 0.95,
) -> Tuple[bool, Optional[Invoice]]:
    """Use sentence-transformers cosine similarity against stored embeddings."""
    try:
        from sentence_transformers import SentenceTransformer
        import numpy as np

        invoice_text = _build_invoice_text(invoice_data)
        model = SentenceTransformer("all-MiniLM-L6-v2")
        query_embedding = model.encode([invoice_text])[0]

        stmt = select(Invoice).where(Invoice.embedding.isnot(None))
        exclude_id = invoice_data.get("id")
        if exclude_id:
            stmt = stmt.where(Invoice.id != exclude_id)

        result = await db.execute(stmt)
        candidates: List[Invoice] = result.scalars().all()

        for candidate in candidates:
            if not candidate.embedding:
                continue
            stored = np.array(candidate.embedding, dtype=float)
            query = np.array(query_embedding, dtype=float)
            norm_s = np.linalg.norm(stored)
            norm_q = np.linalg.norm(query)
            if norm_s == 0 or norm_q == 0:
                continue
            similarity = float(np.dot(stored, query) / (norm_s * norm_q))
            if similarity >= threshold:
                return True, candidate

        return False, None
    except ImportError:
        logger.debug("sentence-transformers not available, skipping semantic check")
        return False, None
    except Exception as exc:
        logger.warning("Semantic duplicate check failed: %s", exc)
        return False, None


def _build_invoice_text(invoice_data: Dict[str, Any]) -> str:
    parts = [
        f"invoice {invoice_data.get('invoice_number', '')}",
        f"vendor {invoice_data.get('vendor_id', '')}",
        f"amount {invoice_data.get('total_amount', '')}",
        f"date {invoice_data.get('invoice_date', '')}",
    ]
    line_items = invoice_data.get("line_items") or []
    for item in line_items:
        if isinstance(item, dict):
            parts.append(str(item.get("description", "")))
    return " ".join(parts)


async def compute_and_store_embedding(invoice_data: Dict[str, Any]) -> Optional[List[float]]:
    """Compute embedding for an invoice for future duplicate detection."""
    try:
        from sentence_transformers import SentenceTransformer

        text = _build_invoice_text(invoice_data)
        model = SentenceTransformer("all-MiniLM-L6-v2")
        embedding = model.encode([text])[0]
        return embedding.tolist()
    except ImportError:
        return None
    except Exception as exc:
        logger.warning("Embedding computation failed: %s", exc)
        return None


async def check_duplicates(db: AsyncSession, invoice_data: Dict[str, Any]) -> Dict[str, Any]:
    """Run all duplicate checks and return a consolidated result."""
    # 1. Exact check
    is_exact, exact_match = await exact_duplicate_check(db, invoice_data)
    if is_exact and exact_match:
        return {
            "is_duplicate": True,
            "method": "exact",
            "matched_invoice_id": str(exact_match.id),
            "confidence": 1.0,
        }

    # 2. Fuzzy check
    is_fuzzy, fuzzy_match, confidence = await fuzzy_duplicate_check(db, invoice_data)
    if is_fuzzy and fuzzy_match:
        return {
            "is_duplicate": True,
            "method": "fuzzy",
            "matched_invoice_id": str(fuzzy_match.id),
            "confidence": confidence,
        }

    # 3. Semantic check
    is_semantic, semantic_match = await semantic_duplicate_check(db, invoice_data)
    if is_semantic and semantic_match:
        return {
            "is_duplicate": True,
            "method": "semantic",
            "matched_invoice_id": str(semantic_match.id),
            "confidence": 0.95,
        }

    return {
        "is_duplicate": False,
        "method": None,
        "matched_invoice_id": None,
        "confidence": 0.0,
    }
