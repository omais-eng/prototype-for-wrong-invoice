import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import invoices, vendors, purchase_orders, dashboard

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="AI Invoice Resolution Platform (AIRP)",
    description=(
        "Automated invoice validation, duplicate detection, AI-powered analysis, "
        "and ERP integration for accounts payable workflows."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS — allow all origins for prototype
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(invoices.router, prefix="/api/v1")
app.include_router(vendors.router, prefix="/api/v1")
app.include_router(purchase_orders.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")


@app.on_event("startup")
async def startup_event():
    logger.info("AIRP Backend starting up…")
    from app.database import create_all_tables
    await create_all_tables()
    logger.info("Database tables ready.")


@app.get("/", tags=["root"])
async def root():
    return {"service": "AIRP Backend", "version": "1.0.0", "status": "running"}


@app.get("/health", tags=["root"])
async def health_check():
    try:
        from app.database import AsyncSessionLocal
        async with AsyncSessionLocal() as session:
            await session.execute(__import__("sqlalchemy").text("SELECT 1"))
        db_status = "ok"
    except Exception as exc:
        logger.warning("Health check DB error: %s", exc)
        db_status = "unreachable"

    return {
        "status": "healthy" if db_status == "ok" else "degraded",
        "database": db_status,
        "version": "1.0.0",
    }
