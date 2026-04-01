"""
Seed the AIRP PostgreSQL database with realistic test data.
Requires the backend to be running (tables created on startup).

Usage:
    pip install faker asyncpg sqlalchemy
    python scripts/seed_database.py
"""

import asyncio
import json
import random
import uuid
from datetime import datetime, timedelta

from faker import Faker
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

fake = Faker()
random.seed(42)

DATABASE_URL = "postgresql+asyncpg://airp:airp_pass@localhost:5432/airp_db"

# ── Helpers ────────────────────────────────────────────────────────────────────

def rand_date(days_back=365):
    return datetime.utcnow() - timedelta(days=random.randint(0, days_back))

def rand_po():
    return f"PO-2024-{random.randint(1, 50):04d}"

def rand_vendor_id():
    return f"VND-{random.randint(1, 20):03d}"

STATUSES = ["received", "processing", "valid", "invalid", "duplicate", "approved", "rejected", "paid"]
ERRORS = [
    {"code": "PO_MISMATCH", "message": "Invoice PO number does not match any open purchase order"},
    {"code": "PRICE_MISMATCH", "message": "Unit price exceeds contracted rate by more than 2%"},
    {"code": "QUANTITY_MISMATCH", "message": "Quantity billed does not match PO line item quantity"},
    {"code": "DUPLICATE_INVOICE", "message": "An invoice with the same number was already submitted"},
    {"code": "CONTRACT_VIOLATION", "message": "Total amount exceeds approved contract value"},
    {"code": "MISSING_FIELD", "message": "Required field 'PO number' is missing"},
    {"code": "MATH_ERROR", "message": "Line item totals do not sum to invoice subtotal"},
    {"code": "VENDOR_INACTIVE", "message": "Vendor account is currently inactive"},
]

def make_line_items(n=3):
    items = []
    for _ in range(n):
        qty = random.randint(1, 20)
        price = round(random.uniform(50, 500), 2)
        items.append({
            "description": fake.bs().title(),
            "quantity": qty,
            "unit_price": price,
            "total": round(qty * price, 2),
        })
    return items


async def seed():
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Import models after engine is set up
        from app.models.vendor import Vendor
        from app.models.purchase_order import PurchaseOrder
        from app.models.contract import Contract
        from app.models.invoice import Invoice

        # ── Vendors ────────────────────────────────────────────────────────────
        print("Seeding vendors...")
        vendors = []
        for i in range(1, 21):
            v = Vendor(
                id=uuid.uuid4(),
                vendor_id=f"VND-{i:03d}",
                name=fake.company(),
                email=fake.company_email(),
                phone=fake.phone_number(),
                address=fake.address().replace("\n", ", "),
                status="active" if i <= 18 else "inactive",
                created_at=rand_date(730),
                updated_at=rand_date(30),
            )
            vendors.append(v)
            session.add(v)
        await session.commit()
        print(f"  ✓ {len(vendors)} vendors")

        # ── Purchase Orders ────────────────────────────────────────────────────
        print("Seeding purchase orders...")
        pos = []
        for i in range(1, 51):
            vendor = random.choice(vendors)
            items = make_line_items(random.randint(1, 5))
            total = round(sum(it["total"] for it in items), 2)
            po = PurchaseOrder(
                id=uuid.uuid4(),
                po_number=f"PO-2024-{i:04d}",
                vendor_id=vendor.vendor_id,
                status="open" if i <= 40 else "closed",
                total_amount=total,
                currency="USD",
                line_items=items,
                created_at=rand_date(365),
                due_date=datetime.utcnow() + timedelta(days=random.randint(15, 90)),
            )
            pos.append(po)
            session.add(po)
        await session.commit()
        print(f"  ✓ {len(pos)} purchase orders")

        # ── Contracts ──────────────────────────────────────────────────────────
        print("Seeding contracts...")
        for i, vendor in enumerate(vendors):
            rates = {
                "consulting": round(random.uniform(130, 170), 2),
                "development": round(random.uniform(180, 220), 2),
                "support": round(random.uniform(65, 85), 2),
                "maintenance": round(random.uniform(80, 100), 2),
            }
            c = Contract(
                id=uuid.uuid4(),
                contract_number=f"CTR-2024-{i+1:03d}",
                vendor_id=vendor.vendor_id,
                start_date=datetime(2024, 1, 1),
                end_date=datetime(2025, 12, 31),
                approved_rates=rates,
                total_value=round(random.uniform(50000, 500000), 2),
                currency="USD",
                status="active" if vendor.status == "active" else "expired",
            )
            session.add(c)
        await session.commit()
        print("  ✓ 20 contracts")

        # ── Invoices ───────────────────────────────────────────────────────────
        print("Seeding invoices...")
        inv_count = 0
        for i in range(1, 201):
            vendor = random.choice(vendors)
            items = make_line_items(random.randint(1, 4))
            subtotal = round(sum(it["total"] for it in items), 2)
            tax = round(subtotal * 0.08, 2)
            total = round(subtotal + tax, 2)

            # 10% invalid, 5% duplicate, rest valid/approved/paid
            roll = random.random()
            if roll < 0.10:
                status = "invalid"
                v_status = "failed"
                errors = random.sample(ERRORS, k=random.randint(1, 3))
            elif roll < 0.15:
                status = "duplicate"
                v_status = "failed"
                errors = [{"code": "DUPLICATE_INVOICE", "message": "Already submitted"}]
            elif roll < 0.25:
                status = "valid"
                v_status = "passed"
                errors = []
            elif roll < 0.50:
                status = "approved"
                v_status = "passed"
                errors = []
            else:
                status = "paid"
                v_status = "passed"
                errors = []

            po = random.choice(pos)
            inv = Invoice(
                id=uuid.uuid4(),
                invoice_number=f"INV-{2024}-{i:05d}",
                vendor_id=vendor.vendor_id,
                vendor_name=vendor.name,
                vendor_email=vendor.email,
                invoice_date=rand_date(180),
                received_date=rand_date(90),
                po_number=po.po_number,
                line_items=items,
                subtotal=subtotal,
                tax_amount=tax,
                total_amount=total,
                currency="USD",
                status=status,
                validation_status=v_status,
                validation_errors=errors,
                ai_analysis={
                    "summary": "AI analysis placeholder",
                    "risk_score": random.randint(0, 100) if errors else random.randint(0, 20),
                    "recommended_action": "reject" if errors else "approve",
                },
                raw_text="",
                file_path="",
                email_subject=f"Invoice {i} from {vendor.name}",
                email_from=vendor.email,
                embedding=[],
                created_at=rand_date(90),
                updated_at=rand_date(10),
            )
            session.add(inv)
            inv_count += 1

        await session.commit()
        print(f"  ✓ {inv_count} invoices")

    await engine.dispose()
    print("\nDatabase seeded successfully.")


if __name__ == "__main__":
    import sys, os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
    asyncio.run(seed())
