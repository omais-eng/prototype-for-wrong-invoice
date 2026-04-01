import io
import json
import logging
import re
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


def _safe_float(val: Any, default: float = 0.0) -> float:
    try:
        return float(str(val).replace(",", "").replace("$", "").strip())
    except (ValueError, TypeError):
        return default


def _regex_extract_invoice(text: str) -> Dict[str, Any]:
    """Best-effort regex extraction from invoice text."""
    result: Dict[str, Any] = {
        "invoice_number": None,
        "vendor_name": None,
        "vendor_email": None,
        "invoice_date": None,
        "po_number": None,
        "line_items": [],
        "subtotal": 0.0,
        "tax_amount": 0.0,
        "total_amount": 0.0,
        "currency": "USD",
    }

    # Invoice number
    m = re.search(r"(?:invoice\s*(?:number|no\.?|#)?)\s*[:\-]?\s*([A-Z0-9\-]+)", text, re.IGNORECASE)
    if m:
        result["invoice_number"] = m.group(1).strip()

    # PO number
    m = re.search(r"(?:purchase\s*order|p\.?o\.?)\s*(?:number|no\.?|#)?\s*[:\-]?\s*([A-Z0-9\-]+)", text, re.IGNORECASE)
    if m:
        result["po_number"] = m.group(1).strip()

    # Vendor email
    m = re.search(r"[\w.\-+]+@[\w.\-]+\.[a-zA-Z]{2,}", text)
    if m:
        result["vendor_email"] = m.group(0)

    # Invoice date
    m = re.search(r"(?:invoice\s*date|date)\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\w+\s+\d{1,2},?\s+\d{4})", text, re.IGNORECASE)
    if m:
        result["invoice_date"] = m.group(1).strip()

    # Currency
    if "$" in text or "USD" in text.upper():
        result["currency"] = "USD"
    elif "EUR" in text.upper() or "€" in text:
        result["currency"] = "EUR"
    elif "GBP" in text.upper() or "£" in text:
        result["currency"] = "GBP"

    # Totals
    m = re.search(r"subtotal\s*[:\-]?\s*\$?([\d,]+\.?\d*)", text, re.IGNORECASE)
    if m:
        result["subtotal"] = _safe_float(m.group(1))

    m = re.search(r"tax\s*[:\-]?\s*\$?([\d,]+\.?\d*)", text, re.IGNORECASE)
    if m:
        result["tax_amount"] = _safe_float(m.group(1))

    m = re.search(r"total\s*(?:amount|due)?\s*[:\-]?\s*\$?([\d,]+\.?\d*)", text, re.IGNORECASE)
    if m:
        result["total_amount"] = _safe_float(m.group(1))

    return result


async def extract_from_pdf(file_bytes: bytes) -> Dict[str, Any]:
    try:
        from pdf2image import convert_from_bytes
        import pytesseract

        images = convert_from_bytes(file_bytes, dpi=200)
        pages_text = []
        for img in images:
            page_text = pytesseract.image_to_string(img)
            pages_text.append(page_text)
        raw_text = "\n\n".join(pages_text)
        return {"raw_text": raw_text, "page_count": len(images)}
    except ImportError as exc:
        logger.warning("pdf2image/pytesseract not available: %s", exc)
        return {"raw_text": "", "page_count": 0}
    except Exception as exc:
        logger.error("PDF extraction failed: %s", exc)
        return {"raw_text": "", "page_count": 0}


async def extract_from_image(file_bytes: bytes) -> Dict[str, Any]:
    try:
        import pytesseract
        from PIL import Image

        image = Image.open(io.BytesIO(file_bytes))
        raw_text = pytesseract.image_to_string(image)
        return {"raw_text": raw_text}
    except ImportError as exc:
        logger.warning("pytesseract/Pillow not available: %s", exc)
        return {"raw_text": ""}
    except Exception as exc:
        logger.error("Image extraction failed: %s", exc)
        return {"raw_text": ""}


async def extract_from_excel(file_bytes: bytes) -> Dict[str, Any]:
    try:
        import pandas as pd

        df_dict = pd.read_excel(io.BytesIO(file_bytes), sheet_name=None)
        text_parts = []
        for sheet_name, df in df_dict.items():
            text_parts.append(f"Sheet: {sheet_name}")
            text_parts.append(df.to_string(index=False))
        raw_text = "\n\n".join(text_parts)
        return {"raw_text": raw_text}
    except ImportError as exc:
        logger.warning("pandas/openpyxl not available: %s", exc)
        return {"raw_text": ""}
    except Exception as exc:
        logger.error("Excel extraction failed: %s", exc)
        return {"raw_text": ""}


async def parse_invoice_with_llm(raw_text: str, file_type: str = "pdf") -> Dict[str, Any]:
    from app.config import settings

    if settings.ANTHROPIC_API_KEY:
        try:
            import anthropic

            client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
            prompt = f"""You are an invoice data extraction assistant. Extract structured invoice information from the following invoice text.

Return ONLY a valid JSON object with these fields (use null for missing fields):
{{
  "invoice_number": string or null,
  "vendor_name": string or null,
  "vendor_email": string or null,
  "invoice_date": string (ISO 8601 date) or null,
  "po_number": string or null,
  "line_items": [
    {{
      "description": string,
      "quantity": number,
      "unit_price": number,
      "total": number
    }}
  ],
  "subtotal": number,
  "tax_amount": number,
  "total_amount": number,
  "currency": string (3-letter ISO code, default "USD")
}}

Invoice text:
---
{raw_text[:6000]}
---

Respond with ONLY the JSON object, no explanation."""

            message = await client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=2048,
                messages=[{"role": "user", "content": prompt}],
            )
            content = message.content[0].text.strip()
            # Strip markdown code fences if present
            content = re.sub(r"^```(?:json)?\s*", "", content)
            content = re.sub(r"\s*```$", "", content)
            parsed = json.loads(content)
            return parsed
        except Exception as exc:
            logger.warning("LLM extraction failed, falling back to regex: %s", exc)

    return _regex_extract_invoice(raw_text)


async def process_invoice_file(file_bytes: bytes, filename: str) -> Dict[str, Any]:
    filename_lower = filename.lower()

    if filename_lower.endswith(".pdf"):
        extraction = await extract_from_pdf(file_bytes)
        file_type = "pdf"
    elif filename_lower.endswith((".xlsx", ".xls", ".csv")):
        extraction = await extract_from_excel(file_bytes)
        file_type = "excel"
    elif filename_lower.endswith((".png", ".jpg", ".jpeg", ".tiff", ".bmp", ".gif")):
        extraction = await extract_from_image(file_bytes)
        file_type = "image"
    else:
        # Try PDF first, then image
        try:
            extraction = await extract_from_pdf(file_bytes)
            file_type = "pdf"
            if not extraction.get("raw_text"):
                extraction = await extract_from_image(file_bytes)
                file_type = "image"
        except Exception:
            extraction = await extract_from_image(file_bytes)
            file_type = "image"

    raw_text = extraction.get("raw_text", "")
    structured = await parse_invoice_with_llm(raw_text, file_type)
    structured["raw_text"] = raw_text
    structured["file_type"] = file_type
    return structured
