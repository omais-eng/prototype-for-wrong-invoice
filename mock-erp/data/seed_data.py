"""
Seed data generator for Mock ERP API.
Generates realistic vendors, purchase orders, contracts, and historical invoices.
Run directly: python data/seed_data.py
"""

import json
import random
import os
from datetime import datetime, timedelta
from faker import Faker

fake = Faker()
random.seed(42)
Faker.seed(42)

DATA_DIR = os.path.dirname(os.path.abspath(__file__))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _date_str(d: datetime) -> str:
    return d.strftime("%Y-%m-%d")


def _random_past_date(days_back: int = 730) -> datetime:
    return datetime.now() - timedelta(days=random.randint(1, days_back))


def _random_future_date(days_ahead: int = 365) -> datetime:
    return datetime.now() + timedelta(days=random.randint(30, days_ahead))


SERVICE_CATEGORIES = ["consulting", "development", "support", "maintenance", "training", "logistics"]

LINE_ITEM_DESCRIPTIONS = {
    "consulting": [
        "Strategic consulting — Q{q} {year}",
        "Business analysis services",
        "Process improvement consulting",
        "Regulatory advisory services",
        "IT consulting — Phase {phase}",
    ],
    "development": [
        "Software development — Sprint {sprint}",
        "Custom module development",
        "API integration development",
        "UI/UX development services",
        "Database design & development",
    ],
    "support": [
        "Tier-1 help desk support",
        "On-site technical support",
        "24/7 system monitoring",
        "SLA-based support package",
        "Remote support services",
    ],
    "maintenance": [
        "Annual maintenance contract",
        "Preventive maintenance — {month}",
        "Hardware maintenance services",
        "Software patch management",
        "Infrastructure maintenance",
    ],
    "training": [
        "End-user training — {dept} dept",
        "Administrator training program",
        "Compliance training sessions",
        "Onboarding training package",
        "Advanced skills workshop",
    ],
    "logistics": [
        "Freight & shipping — {month}",
        "Warehouse management services",
        "Last-mile delivery services",
        "Cold-chain logistics",
        "Supply chain coordination",
    ],
}


def _fill_template(template: str) -> str:
    return template.format(
        q=random.randint(1, 4),
        year=random.randint(2023, 2025),
        phase=random.randint(1, 5),
        sprint=random.randint(1, 20),
        month=fake.month_name(),
        dept=fake.job().split()[0],
    )


# ---------------------------------------------------------------------------
# Generators
# ---------------------------------------------------------------------------

def generate_vendors(n: int = 20) -> list[dict]:
    vendors = []
    for i in range(1, n + 1):
        vendor_id = f"VND-{i:03d}"
        company = fake.company()
        vendors.append({
            "vendor_id": vendor_id,
            "name": company,
            "email": f"accounts@{fake.domain_name()}",
            "phone": fake.phone_number(),
            "address": {
                "street": fake.street_address(),
                "city": fake.city(),
                "state": fake.state_abbr(),
                "zip": fake.zipcode(),
                "country": "US",
            },
            "contact_person": fake.name(),
            "tax_id": f"EIN-{fake.numerify('##-#######')}",
            "payment_terms": random.choice(["Net 30", "Net 45", "Net 60", "Due on Receipt"]),
            "status": "active",
            "onboarded_date": _date_str(_random_past_date(1800)),
        })
    return vendors


def generate_purchase_orders(vendors: list[dict], n: int = 50) -> list[dict]:
    pos = []
    vendor_ids = [v["vendor_id"] for v in vendors]

    for i in range(1, n + 1):
        status = "open" if i <= 40 else "closed"
        vendor_id = random.choice(vendor_ids)
        category = random.choice(SERVICE_CATEGORIES)
        created_date = _random_past_date(540)
        due_date = created_date + timedelta(days=random.randint(30, 180))

        num_lines = random.randint(1, 5)
        line_items = []
        for j in range(1, num_lines + 1):
            unit_price = round(random.uniform(50, 500), 2)
            quantity = random.randint(1, 40)
            desc_template = random.choice(LINE_ITEM_DESCRIPTIONS[category])
            line_items.append({
                "line_number": j,
                "description": _fill_template(desc_template),
                "category": category,
                "quantity": quantity,
                "unit": random.choice(["hours", "units", "days", "months"]),
                "unit_price": unit_price,
                "line_total": round(unit_price * quantity, 2),
            })

        total_amount = round(sum(li["line_total"] for li in line_items), 2)
        approved_amount = total_amount if status == "open" else round(total_amount * random.uniform(0.85, 1.0), 2)

        pos.append({
            "po_number": f"PO-2024-{i:04d}",
            "vendor_id": vendor_id,
            "status": status,
            "category": category,
            "created_date": _date_str(created_date),
            "due_date": _date_str(due_date),
            "total_amount": total_amount,
            "approved_amount": approved_amount,
            "currency": "USD",
            "line_items": line_items,
            "notes": fake.sentence() if random.random() > 0.6 else "",
            "created_by": fake.name(),
            "department": random.choice(["Finance", "IT", "Operations", "HR", "Procurement", "Legal"]),
        })
    return pos


def generate_contracts(vendors: list[dict]) -> list[dict]:
    contracts = []
    for idx, vendor in enumerate(vendors, start=1):
        start_date = _random_past_date(900)
        end_date = _random_future_date(365)

        # Pick 2–4 service categories for this vendor
        num_services = random.randint(2, 4)
        selected = random.sample(SERVICE_CATEGORIES, num_services)
        base_rates = {
            "consulting": 150.00,
            "development": 200.00,
            "support": 75.00,
            "maintenance": 90.00,
            "training": 120.00,
            "logistics": 60.00,
        }
        approved_rates = {
            svc: round(base_rates[svc] * random.uniform(0.85, 1.20), 2)
            for svc in selected
        }

        contracts.append({
            "contract_id": f"CON-{idx:03d}",
            "vendor_id": vendor["vendor_id"],
            "vendor_name": vendor["name"],
            "contract_number": f"CTR-{fake.numerify('####')}-{start_date.year}",
            "status": "active" if end_date > datetime.now() else "expired",
            "start_date": _date_str(start_date),
            "end_date": _date_str(end_date),
            "approved_rates": approved_rates,
            "currency": "USD",
            "max_value": round(random.uniform(50000, 500000), 2),
            "payment_terms": vendor["payment_terms"],
            "auto_renewal": random.choice([True, False]),
            "signed_date": _date_str(start_date - timedelta(days=random.randint(5, 30))),
            "contract_manager": fake.name(),
        })
    return contracts


def generate_historical_invoices(
    vendors: list[dict],
    purchase_orders: list[dict],
    contracts: list[dict],
    n: int = 100,
) -> list[dict]:
    invoices = []
    vendor_ids = [v["vendor_id"] for v in vendors]
    contract_map = {c["vendor_id"]: c for c in contracts}
    po_map = {po["po_number"]: po for po in purchase_orders}

    for i in range(1, n + 1):
        status = random.choices(["paid", "rejected"], weights=[75, 25])[0]
        vendor_id = random.choice(vendor_ids)
        contract = contract_map.get(vendor_id)
        invoice_date = _random_past_date(540)
        due_date = invoice_date + timedelta(days=random.randint(30, 60))

        # Optionally link to a PO
        vendor_pos = [po for po in purchase_orders if po["vendor_id"] == vendor_id]
        linked_po = random.choice(vendor_pos) if vendor_pos and random.random() > 0.3 else None

        category = random.choice(SERVICE_CATEGORIES)
        if linked_po:
            category = linked_po["category"]

        # Build line items
        num_lines = random.randint(1, 4)
        line_items = []
        for j in range(1, num_lines + 1):
            if contract and category in contract["approved_rates"]:
                rate = contract["approved_rates"][category]
                # Introduce errors in rejected invoices sometimes
                if status == "rejected" and random.random() > 0.5:
                    rate = round(rate * random.uniform(1.10, 1.40), 2)  # overcharge
            else:
                rate = round(random.uniform(50, 300), 2)

            qty = random.randint(1, 30)
            desc_template = random.choice(LINE_ITEM_DESCRIPTIONS[category])
            line_items.append({
                "line_number": j,
                "description": _fill_template(desc_template),
                "category": category,
                "quantity": qty,
                "unit": random.choice(["hours", "units", "days"]),
                "unit_price": rate,
                "line_total": round(rate * qty, 2),
            })

        subtotal = round(sum(li["line_total"] for li in line_items), 2)
        tax_rate = random.choice([0.0, 0.05, 0.08, 0.10])
        tax_amount = round(subtotal * tax_rate, 2)
        total_amount = round(subtotal + tax_amount, 2)

        rejection_reasons = []
        if status == "rejected":
            rejection_reasons = random.sample(
                [
                    "Unit price exceeds contracted rate",
                    "PO number not found or closed",
                    "Duplicate invoice submission",
                    "Missing supporting documentation",
                    "Quantity billed exceeds PO quantity",
                    "Service period outside contract dates",
                    "Tax calculation error",
                    "Vendor not approved for this service category",
                ],
                k=random.randint(1, 2),
            )

        invoices.append({
            "invoice_number": f"INV-{invoice_date.year}-{i:05d}",
            "vendor_id": vendor_id,
            "vendor_name": next(v["name"] for v in vendors if v["vendor_id"] == vendor_id),
            "po_number": linked_po["po_number"] if linked_po else None,
            "contract_id": contract["contract_id"] if contract else None,
            "invoice_date": _date_str(invoice_date),
            "due_date": _date_str(due_date),
            "status": status,
            "category": category,
            "line_items": line_items,
            "subtotal": subtotal,
            "tax_rate": tax_rate,
            "tax_amount": tax_amount,
            "total_amount": total_amount,
            "currency": "USD",
            "payment_date": _date_str(due_date + timedelta(days=random.randint(0, 10))) if status == "paid" else None,
            "rejection_reasons": rejection_reasons,
            "notes": fake.sentence() if random.random() > 0.7 else "",
            "submitted_by": fake.name(),
        })
    return invoices


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def generate_all(output_dir: str = DATA_DIR) -> dict:
    print("Generating seed data...")

    vendors = generate_vendors(20)
    print(f"  Generated {len(vendors)} vendors")

    purchase_orders = generate_purchase_orders(vendors, 50)
    print(f"  Generated {len(purchase_orders)} purchase orders")

    contracts = generate_contracts(vendors)
    print(f"  Generated {len(contracts)} contracts")

    historical_invoices = generate_historical_invoices(vendors, purchase_orders, contracts, 100)
    print(f"  Generated {len(historical_invoices)} historical invoices")

    files = {
        "vendors.json": vendors,
        "purchase_orders.json": purchase_orders,
        "contracts.json": contracts,
        "historical_invoices.json": historical_invoices,
    }

    for filename, data in files.items():
        path = os.path.join(output_dir, filename)
        with open(path, "w") as f:
            json.dump(data, f, indent=2)
        print(f"  Saved {path}")

    print("Seed data generation complete.")
    return {
        "vendors": vendors,
        "purchase_orders": purchase_orders,
        "contracts": contracts,
        "historical_invoices": historical_invoices,
    }


if __name__ == "__main__":
    generate_all()
