import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

_RISK_WEIGHTS = {
    "DUPLICATE_INVOICE": 40,
    "PO_NOT_FOUND": 25,
    "PO_MISMATCH": 20,
    "VENDOR_MISMATCH": 30,
    "PRICE_MISMATCH": 20,
    "QUANTITY_MISMATCH": 15,
    "CONTRACT_VIOLATION": 25,
    "PRICE_NOT_APPROVED": 20,
    "MATH_ERROR": 35,
    "MISSING_FIELD": 15,
    "VENDOR_INACTIVE": 30,
}

_SUGGESTIONS = {
    "DUPLICATE_INVOICE": "Contact the vendor to confirm if this is a resubmission. If duplicate, reject and notify vendor.",
    "PO_NOT_FOUND": "Verify the PO number with the purchasing department. Request the vendor to provide the correct PO.",
    "PO_MISMATCH": "Request a revised invoice from the vendor matching the PO details exactly.",
    "VENDOR_MISMATCH": "Verify vendor identity. The vendor on the invoice does not match the PO.",
    "PRICE_MISMATCH": "Request price clarification from the vendor. Prices may have changed since the PO was raised.",
    "QUANTITY_MISMATCH": "Request a revised invoice with the correct quantities matching the approved PO.",
    "CONTRACT_VIOLATION": "The invoice falls outside the contract validity period. Contact legal/procurement.",
    "PRICE_NOT_APPROVED": "The unit price exceeds the approved contract rate. Reject and request correction.",
    "MATH_ERROR": "The invoice contains arithmetic errors. Reject and request a corrected invoice.",
    "MISSING_FIELD": "Request the vendor to resubmit with all required fields populated.",
    "VENDOR_INACTIVE": "The vendor account is inactive. Escalate to procurement to reactivate or use correct vendor.",
}


def _compute_risk_score(errors: List[Dict[str, Any]]) -> int:
    score = 0
    for error in errors:
        code = error.get("code", "")
        score += _RISK_WEIGHTS.get(code, 10)
    return min(score, 100)


def _build_mock_analysis(invoice_data: Dict[str, Any], errors: List[Dict[str, Any]]) -> Dict[str, Any]:
    risk_score = _compute_risk_score(errors)
    error_count = len(errors)

    if error_count == 0:
        summary = (
            f"Invoice {invoice_data.get('invoice_number', 'N/A')} from "
            f"{invoice_data.get('vendor_name') or invoice_data.get('vendor_id', 'unknown vendor')} "
            f"passed all validation checks. Total amount: "
            f"{invoice_data.get('currency', 'USD')} {invoice_data.get('total_amount', 0):.2f}. "
            "No issues detected. Recommended for approval."
        )
        recommended_action = "APPROVE"
    else:
        summary = (
            f"Invoice {invoice_data.get('invoice_number', 'N/A')} from "
            f"{invoice_data.get('vendor_name') or invoice_data.get('vendor_id', 'unknown vendor')} "
            f"failed validation with {error_count} error(s). "
            f"Risk score: {risk_score}/100. "
            f"Total amount: {invoice_data.get('currency', 'USD')} {invoice_data.get('total_amount', 0):.2f}. "
            "Review required before processing."
        )
        if risk_score >= 70:
            recommended_action = "REJECT"
        elif risk_score >= 30:
            recommended_action = "REQUEST_CLARIFICATION"
        else:
            recommended_action = "REVIEW"

    error_explanations = []
    for error in errors:
        code = error.get("code", "UNKNOWN")
        error_explanations.append({
            "code": code,
            "explanation": error.get("message", ""),
            "suggestion": _SUGGESTIONS.get(code, "Review and resolve this issue before approving."),
        })

    vendor_email_draft = _build_rejection_email_template(invoice_data, errors)

    return {
        "summary": summary,
        "error_explanations": error_explanations,
        "risk_score": risk_score,
        "recommended_action": recommended_action,
        "vendor_email_draft": vendor_email_draft,
    }


def _build_rejection_email_template(invoice_data: Dict[str, Any], errors: List[Dict[str, Any]]) -> str:
    invoice_number = invoice_data.get("invoice_number", "N/A")
    vendor_name = invoice_data.get("vendor_name") or invoice_data.get("vendor_id", "Vendor")
    total_amount = invoice_data.get("total_amount", 0)
    currency = invoice_data.get("currency", "USD")

    if not errors:
        return ""

    error_lines = "\n".join(
        f"  - [{e.get('code', 'ERROR')}] {e.get('message', '')}"
        for e in errors
    )

    return (
        f"Dear {vendor_name},\n\n"
        f"Thank you for submitting Invoice #{invoice_number} for {currency} {total_amount:.2f}. "
        f"After reviewing your invoice, our automated validation system has identified the following issues "
        f"that prevent us from processing it at this time:\n\n"
        f"{error_lines}\n\n"
        f"Please review the above issues and resubmit a corrected invoice at your earliest convenience. "
        f"If you have any questions or believe there is an error in our assessment, "
        f"please contact our accounts payable team.\n\n"
        f"We apologize for any inconvenience and look forward to resolving this matter promptly.\n\n"
        f"Regards,\n"
        f"Accounts Payable Team\n"
        f"AI Invoice Resolution Platform"
    )


async def _analyze_with_claude(invoice_data: Dict[str, Any], errors: List[Dict[str, Any]]) -> Dict[str, Any]:
    from app.config import settings

    import anthropic
    import json

    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    errors_text = json.dumps(errors, indent=2) if errors else "No errors found."

    prompt = f"""You are an accounts payable analyst reviewing an invoice validation result.

Invoice details:
- Invoice Number: {invoice_data.get('invoice_number', 'N/A')}
- Vendor: {invoice_data.get('vendor_name') or invoice_data.get('vendor_id', 'Unknown')}
- Total Amount: {invoice_data.get('currency', 'USD')} {invoice_data.get('total_amount', 0)}

Validation errors found:
{errors_text}

Provide your analysis as a JSON object with this exact structure:
{{
  "summary": "2-3 sentence executive summary of the invoice status and key issues",
  "error_explanations": [
    {{
      "code": "ERROR_CODE",
      "explanation": "Plain English explanation of what this error means",
      "suggestion": "Specific action to resolve this"
    }}
  ],
  "risk_score": <integer 0-100 where 0=no risk, 100=highest risk>,
  "recommended_action": "<APPROVE|REQUEST_CLARIFICATION|REJECT>",
  "vendor_email_draft": "Professional email to the vendor explaining the issues and requesting corrections"
}}

Respond with ONLY the JSON object."""

    message = await client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )
    import re
    content = message.content[0].text.strip()
    content = re.sub(r"^```(?:json)?\s*", "", content)
    content = re.sub(r"\s*```$", "", content)
    return json.loads(content)


async def analyze_invoice(invoice_data: Dict[str, Any], validation_errors: List[Dict[str, Any]]) -> Dict[str, Any]:
    from app.config import settings

    if settings.ANTHROPIC_API_KEY:
        try:
            return await _analyze_with_claude(invoice_data, validation_errors)
        except Exception as exc:
            logger.warning("Claude AI analysis failed, using template response: %s", exc)

    return _build_mock_analysis(invoice_data, validation_errors)


async def generate_vendor_rejection_email(invoice_data: Dict[str, Any], errors: List[Dict[str, Any]]) -> str:
    from app.config import settings

    if settings.ANTHROPIC_API_KEY:
        try:
            result = await _analyze_with_claude(invoice_data, errors)
            return result.get("vendor_email_draft", "")
        except Exception as exc:
            logger.warning("Claude email generation failed: %s", exc)

    return _build_rejection_email_template(invoice_data, errors)


async def generate_manager_summary(invoice_data: Dict[str, Any]) -> str:
    from app.config import settings

    if settings.ANTHROPIC_API_KEY:
        try:
            import anthropic

            client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
            prompt = (
                f"Write a concise 3-5 sentence manager summary for approving this invoice:\n"
                f"Invoice: {invoice_data.get('invoice_number')}\n"
                f"Vendor: {invoice_data.get('vendor_name') or invoice_data.get('vendor_id')}\n"
                f"Amount: {invoice_data.get('currency', 'USD')} {invoice_data.get('total_amount', 0)}\n"
                f"Status: {invoice_data.get('status', 'valid')}\n"
                f"Include a recommendation on whether to approve."
            )
            message = await client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=512,
                messages=[{"role": "user", "content": prompt}],
            )
            return message.content[0].text.strip()
        except Exception as exc:
            logger.warning("Claude summary generation failed: %s", exc)

    return (
        f"Invoice {invoice_data.get('invoice_number', 'N/A')} from "
        f"{invoice_data.get('vendor_name') or invoice_data.get('vendor_id', 'vendor')} "
        f"for {invoice_data.get('currency', 'USD')} {invoice_data.get('total_amount', 0):.2f} "
        f"has passed all validation checks and is ready for approval. "
        f"Please review and approve at your earliest convenience."
    )


class AIService:
    async def analyze_invoice(self, invoice_data: Dict[str, Any], validation_errors: List[Dict[str, Any]]) -> Dict[str, Any]:
        return await analyze_invoice(invoice_data, validation_errors)

    async def generate_vendor_rejection_email(self, invoice_data: Dict[str, Any], errors: List[Dict[str, Any]]) -> str:
        return await generate_vendor_rejection_email(invoice_data, errors)

    async def generate_manager_summary(self, invoice_data: Dict[str, Any]) -> str:
        return await generate_manager_summary(invoice_data)


ai_service = AIService()
