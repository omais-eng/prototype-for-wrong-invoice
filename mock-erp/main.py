"""
Mock ERP API — FastAPI service simulating an ERP system for invoice validation testing.
Runs on port 8001.
"""

import json
import os
import random
import string
import sys
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

load_dotenv()

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")

# ---------------------------------------------------------------------------
# In-memory stores
# ---------------------------------------------------------------------------

_vendors: dict[str, dict] = {}           # keyed by vendor_id
_purchase_orders: dict[str, dict] = {}   # keyed by po_number
_contracts: dict[str, dict] = {}         # keyed by vendor_id
_invoices: dict[str, dict] = {}          # keyed by invoice_number


# ---------------------------------------------------------------------------
# Data loading / seeding
# ---------------------------------------------------------------------------

def _load_json(filename: str) -> list[dict]:
    path = os.path.join(DATA_DIR, filename)
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return []


def _seed_data() -> dict:
    """Import and run the seed generator, returning all datasets."""
    # Make sure the data package is importable
    if DATA_DIR not in sys.path:
        sys.path.insert(0, os.path.dirname(DATA_DIR))
    from data.seed_data import generate_all  # type: ignore
    return generate_all(DATA_DIR)


def load_all_data() -> None:
    """Load data from JSON files; generate them first if missing."""
    required = ["vendors.json", "purchase_orders.json", "contracts.json", "historical_invoices.json"]
    missing = [f for f in required if not os.path.exists(os.path.join(DATA_DIR, f))]

    if missing:
        print(f"[startup] Seed files missing ({missing}), generating...")
        seeded = _seed_data()
        vendors_raw = seeded["vendors"]
        pos_raw = seeded["purchase_orders"]
        contracts_raw = seeded["contracts"]
        invoices_raw = seeded["historical_invoices"]
    else:
        vendors_raw = _load_json("vendors.json")
        pos_raw = _load_json("purchase_orders.json")
        contracts_raw = _load_json("contracts.json")
        invoices_raw = _load_json("historical_invoices.json")

    for v in vendors_raw:
        _vendors[v["vendor_id"]] = v

    for po in pos_raw:
        _purchase_orders[po["po_number"]] = po

    for c in contracts_raw:
        _contracts[c["vendor_id"]] = c

    for inv in invoices_raw:
        _invoices[inv["invoice_number"]] = inv

    print(
        f"[startup] Loaded {len(_vendors)} vendors, "
        f"{len(_purchase_orders)} purchase orders, "
        f"{len(_contracts)} contracts, "
        f"{len(_invoices)} invoices."
    )


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    load_all_data()
    yield


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Mock ERP API",
    description="Simulated ERP system for AI Invoice Resolution Platform prototype testing.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class InvoiceLineItem(BaseModel):
    line_number: int
    description: str
    category: str
    quantity: float
    unit: str
    unit_price: float
    line_total: float


class InvoiceCreate(BaseModel):
    invoice_number: str = Field(..., examples=["INV-2025-00101"])
    vendor_id: str = Field(..., examples=["VND-001"])
    vendor_name: str
    po_number: Optional[str] = None
    contract_id: Optional[str] = None
    invoice_date: str = Field(..., examples=["2025-01-15"])
    due_date: str
    category: str
    line_items: list[InvoiceLineItem]
    subtotal: float
    tax_rate: float = 0.0
    tax_amount: float = 0.0
    total_amount: float
    currency: str = "USD"
    notes: Optional[str] = ""
    submitted_by: Optional[str] = ""


class InvoiceCreateResponse(BaseModel):
    success: bool
    erp_ref: str
    invoice_number: str
    message: str


# ---------------------------------------------------------------------------
# Utility
# ---------------------------------------------------------------------------

def _erp_ref() -> str:
    chars = string.ascii_uppercase + string.digits
    suffix = "".join(random.choices(chars, k=8))
    return f"ERP-{suffix}"


def _paginate(items: list, skip: int, limit: int) -> list:
    return items[skip: skip + limit]


# ---------------------------------------------------------------------------
# Vendor endpoints
# ---------------------------------------------------------------------------

@app.get("/vendors", summary="List all vendors", tags=["Vendors"])
def list_vendors(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=500, description="Max records to return"),
    status: Optional[str] = Query(None, description="Filter by status (active/inactive)"),
) -> dict[str, Any]:
    vendors = list(_vendors.values())
    if status:
        vendors = [v for v in vendors if v.get("status") == status]
    total = len(vendors)
    vendors = _paginate(vendors, skip, limit)
    return {"total": total, "skip": skip, "limit": limit, "data": vendors}


@app.get("/vendors/{vendor_id}", summary="Get vendor by ID", tags=["Vendors"])
def get_vendor(vendor_id: str) -> dict:
    vendor = _vendors.get(vendor_id)
    if not vendor:
        raise HTTPException(status_code=404, detail=f"Vendor '{vendor_id}' not found.")
    return vendor


# ---------------------------------------------------------------------------
# Purchase Order endpoints
# ---------------------------------------------------------------------------

@app.get("/purchase-orders", summary="List all purchase orders", tags=["Purchase Orders"])
def list_purchase_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    vendor_id: Optional[str] = Query(None, description="Filter by vendor_id"),
    status: Optional[str] = Query(None, description="Filter by status (open/closed)"),
) -> dict[str, Any]:
    pos = list(_purchase_orders.values())
    if vendor_id:
        pos = [po for po in pos if po.get("vendor_id") == vendor_id]
    if status:
        pos = [po for po in pos if po.get("status") == status]
    total = len(pos)
    pos = _paginate(pos, skip, limit)
    return {"total": total, "skip": skip, "limit": limit, "data": pos}


@app.get("/purchase-orders/{po_number}", summary="Get purchase order by PO number", tags=["Purchase Orders"])
def get_purchase_order(po_number: str) -> dict:
    po = _purchase_orders.get(po_number)
    if not po:
        raise HTTPException(status_code=404, detail=f"Purchase order '{po_number}' not found.")
    return po


# ---------------------------------------------------------------------------
# Contract endpoints
# ---------------------------------------------------------------------------

@app.get("/contracts", summary="List all contracts", tags=["Contracts"])
def list_contracts(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    status: Optional[str] = Query(None, description="Filter by status (active/expired)"),
) -> dict[str, Any]:
    contracts = list(_contracts.values())
    if status:
        contracts = [c for c in contracts if c.get("status") == status]
    total = len(contracts)
    contracts = _paginate(contracts, skip, limit)
    return {"total": total, "skip": skip, "limit": limit, "data": contracts}


@app.get("/contracts/{vendor_id}", summary="Get contract for a vendor", tags=["Contracts"])
def get_contract(vendor_id: str) -> dict:
    contract = _contracts.get(vendor_id)
    if not contract:
        raise HTTPException(
            status_code=404,
            detail=f"No contract found for vendor '{vendor_id}'.",
        )
    return contract


# ---------------------------------------------------------------------------
# Invoice endpoints
# ---------------------------------------------------------------------------

@app.get("/invoices", summary="List historical invoices", tags=["Invoices"])
def list_invoices(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    vendor_id: Optional[str] = Query(None, description="Filter by vendor_id"),
    status: Optional[str] = Query(None, description="Filter by status (paid/rejected)"),
    po_number: Optional[str] = Query(None, description="Filter by PO number"),
) -> dict[str, Any]:
    invoices = list(_invoices.values())
    if vendor_id:
        invoices = [inv for inv in invoices if inv.get("vendor_id") == vendor_id]
    if status:
        invoices = [inv for inv in invoices if inv.get("status") == status]
    if po_number:
        invoices = [inv for inv in invoices if inv.get("po_number") == po_number]
    total = len(invoices)
    invoices = _paginate(invoices, skip, limit)
    return {"total": total, "skip": skip, "limit": limit, "data": invoices}


@app.get("/invoices/{invoice_number}", summary="Get a specific historical invoice", tags=["Invoices"])
def get_invoice(invoice_number: str) -> dict:
    invoice = _invoices.get(invoice_number)
    if not invoice:
        raise HTTPException(
            status_code=404,
            detail=f"Invoice '{invoice_number}' not found.",
        )
    return invoice


@app.post("/invoices", summary="Add an approved invoice to the ERP", tags=["Invoices"])
def create_invoice(payload: InvoiceCreate) -> InvoiceCreateResponse:
    """
    Accepts a validated/approved invoice and persists it into the mock ERP.
    Returns a generated ERP reference number.
    """
    inv_num = payload.invoice_number

    if inv_num in _invoices:
        raise HTTPException(
            status_code=409,
            detail=f"Invoice '{inv_num}' already exists in ERP. Possible duplicate submission.",
        )

    # Validate vendor exists
    if payload.vendor_id not in _vendors:
        raise HTTPException(
            status_code=422,
            detail=f"Vendor '{payload.vendor_id}' is not registered in ERP.",
        )

    # Validate PO if provided
    if payload.po_number and payload.po_number not in _purchase_orders:
        raise HTTPException(
            status_code=422,
            detail=f"Purchase order '{payload.po_number}' not found in ERP.",
        )

    erp_ref = _erp_ref()
    record = payload.model_dump()
    record["status"] = "paid"
    record["erp_ref"] = erp_ref
    record["created_at"] = datetime.utcnow().isoformat() + "Z"
    record["rejection_reasons"] = []

    _invoices[inv_num] = record

    return InvoiceCreateResponse(
        success=True,
        erp_ref=erp_ref,
        invoice_number=inv_num,
        message=f"Invoice {inv_num} successfully recorded in ERP with reference {erp_ref}.",
    )


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health", summary="Health check", tags=["System"])
def health() -> dict:
    return {
        "status": "ok",
        "service": "mock-erp",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "stats": {
            "vendors": len(_vendors),
            "purchase_orders": len(_purchase_orders),
            "contracts": len(_contracts),
            "invoices": len(_invoices),
        },
    }


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
