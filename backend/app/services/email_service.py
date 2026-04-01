import email
import imaplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import List, Dict, Any, Optional

from app.config import settings

logger = logging.getLogger(__name__)


def _is_smtp_configured() -> bool:
    return bool(settings.SMTP_USER and settings.SMTP_PASS and settings.SMTP_HOST)


def _is_imap_configured() -> bool:
    return bool(settings.IMAP_HOST and settings.IMAP_USER and settings.IMAP_PASS)


async def send_vendor_rejection(
    vendor_email: str,
    vendor_name: str,
    invoice_number: str,
    errors: List[Dict[str, Any]],
    ai_email_body: str,
) -> bool:
    subject = f"Invoice #{invoice_number} - Action Required: Validation Issues Detected"

    if ai_email_body:
        body = ai_email_body
    else:
        error_lines = "\n".join(f"  - [{e.get('code', 'ERROR')}] {e.get('message', '')}" for e in errors)
        body = (
            f"Dear {vendor_name},\n\n"
            f"Your invoice #{invoice_number} could not be processed due to the following issues:\n\n"
            f"{error_lines}\n\n"
            f"Please resubmit a corrected invoice.\n\nRegards,\nAccounts Payable"
        )

    if not _is_smtp_configured():
        logger.info(
            "[MOCK EMAIL] To: %s | Subject: %s\n%s",
            vendor_email, subject, body,
        )
        return True

    return await _send_email(to=vendor_email, subject=subject, body=body)


async def send_manager_notification(
    manager_email: str,
    invoice_data: Dict[str, Any],
    summary: str,
) -> bool:
    invoice_number = invoice_data.get("invoice_number", "N/A")
    subject = f"Invoice #{invoice_number} Requires Your Approval"
    body = (
        f"A validated invoice requires your approval.\n\n"
        f"Invoice Number: {invoice_number}\n"
        f"Vendor: {invoice_data.get('vendor_name') or invoice_data.get('vendor_id', 'Unknown')}\n"
        f"Amount: {invoice_data.get('currency', 'USD')} {invoice_data.get('total_amount', 0):.2f}\n\n"
        f"Summary:\n{summary}\n\n"
        f"Please log in to the AIRP system to approve or reject this invoice."
    )

    if not _is_smtp_configured():
        logger.info(
            "[MOCK EMAIL] To: %s | Subject: %s\n%s",
            manager_email, subject, body,
        )
        return True

    return await _send_email(to=manager_email, subject=subject, body=body)


async def send_vendor_duplicate_notice(
    vendor_email: str,
    invoice_number: str,
) -> bool:
    subject = f"Duplicate Invoice Detected: #{invoice_number}"
    body = (
        f"Dear Vendor,\n\n"
        f"We have detected that invoice #{invoice_number} appears to be a duplicate of a previously "
        f"submitted invoice. This invoice will not be processed to avoid double payment.\n\n"
        f"If you believe this is an error, please contact our accounts payable team with your "
        f"original invoice reference.\n\n"
        f"Regards,\nAccounts Payable Team"
    )

    if not _is_smtp_configured():
        logger.info(
            "[MOCK EMAIL] To: %s | Subject: %s\n%s",
            vendor_email, subject, body,
        )
        return True

    return await _send_email(to=vendor_email, subject=subject, body=body)


async def _send_email(to: str, subject: str, body: str) -> bool:
    try:
        import aiosmtplib

        message = MIMEMultipart("alternative")
        message["From"] = settings.EMAIL_FROM
        message["To"] = to
        message["Subject"] = subject
        message.attach(MIMEText(body, "plain"))

        await aiosmtplib.send(
            message,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASS,
            start_tls=True,
        )
        logger.info("Email sent to %s: %s", to, subject)
        return True
    except Exception as exc:
        logger.error("Failed to send email to %s: %s", to, exc)
        return False


def poll_email_inbox() -> List[Dict[str, Any]]:
    """Connect via IMAP and fetch unread emails with attachments."""
    if not _is_imap_configured():
        logger.debug("IMAP not configured, returning empty inbox")
        return []

    messages = []
    try:
        mail = imaplib.IMAP4_SSL(settings.IMAP_HOST)
        mail.login(settings.IMAP_USER, settings.IMAP_PASS)
        mail.select("INBOX")

        _, search_data = mail.search(None, "UNSEEN")
        email_ids = search_data[0].split()

        for email_id in email_ids[-50:]:  # cap at 50 most recent
            _, msg_data = mail.fetch(email_id, "(RFC822)")
            raw_email = msg_data[0][1]
            msg = email.message_from_bytes(raw_email)

            subject = msg.get("Subject", "")
            from_addr = msg.get("From", "")
            body_text = ""
            attachments = []

            for part in msg.walk():
                content_type = part.get_content_type()
                disposition = str(part.get("Content-Disposition", ""))

                if content_type == "text/plain" and "attachment" not in disposition:
                    try:
                        body_text = part.get_payload(decode=True).decode("utf-8", errors="replace")
                    except Exception:
                        pass
                elif "attachment" in disposition or part.get_filename():
                    filename = part.get_filename()
                    if filename:
                        content = part.get_payload(decode=True)
                        if content:
                            attachments.append({
                                "filename": filename,
                                "content": content,
                            })

            messages.append({
                "subject": subject,
                "from": from_addr,
                "body": body_text,
                "attachments": attachments,
            })

        mail.logout()
    except imaplib.IMAP4.error as exc:
        logger.error("IMAP login/fetch error: %s", exc)
    except Exception as exc:
        logger.error("Unexpected IMAP error: %s", exc)

    return messages
