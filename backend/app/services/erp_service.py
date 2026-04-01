import logging
from typing import Optional, Dict, Any, List
import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class ERPService:
    def __init__(self):
        self.base_url = settings.MOCK_ERP_URL
        self.timeout = 10.0

    async def _get(self, path: str) -> Optional[Dict[str, Any]]:
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(f"{self.base_url}{path}")
                if response.status_code == 200:
                    return response.json()
                if response.status_code == 404:
                    return None
                logger.warning("ERP GET %s returned %s", path, response.status_code)
                return None
        except httpx.ConnectError:
            logger.warning("ERP service unreachable at %s%s", self.base_url, path)
            return None
        except Exception as exc:
            logger.error("ERP GET %s failed: %s", path, exc)
            return None

    async def _post(self, path: str, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(f"{self.base_url}{path}", json=payload)
                if response.status_code in (200, 201):
                    return response.json()
                logger.warning("ERP POST %s returned %s: %s", path, response.status_code, response.text)
                return None
        except httpx.ConnectError:
            logger.warning("ERP service unreachable at %s%s", self.base_url, path)
            return None
        except Exception as exc:
            logger.error("ERP POST %s failed: %s", path, exc)
            return None

    async def get_vendor(self, vendor_id: str) -> Optional[Dict[str, Any]]:
        return await self._get(f"/vendors/{vendor_id}")

    async def get_purchase_order(self, po_number: str) -> Optional[Dict[str, Any]]:
        return await self._get(f"/purchase-orders/{po_number}")

    async def get_contract(self, vendor_id: str) -> Optional[Dict[str, Any]]:
        return await self._get(f"/contracts/{vendor_id}")

    async def get_historical_invoices(self, vendor_id: str) -> List[Dict[str, Any]]:
        result = await self._get(f"/invoices/history/{vendor_id}")
        if result is None:
            return []
        if isinstance(result, list):
            return result
        return result.get("invoices", [])

    async def post_approved_invoice(self, invoice_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        return await self._post("/invoices/approved", invoice_data)


erp_service = ERPService()
