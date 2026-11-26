import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.deps import require_module
from app.api.routes import auth, users, vehicles, customers, test_drives, sales, service, commissions, dashboard
from app.api.routes.store import auth as store_auth, account as store_account
from app.api.routes.store import wishlist as store_wishlist, notifications as store_notifications
from app.api.routes.store import bank as store_bank, reservations as store_reservations
from app.api.routes.store import test_drives as store_test_drives
from app.api.routes.store import enquiries as store_enquiries
from app.api.routes.store import restock as store_restock
from app.api.routes.store import reviews as store_reviews
from app.api.routes.store import trade_ins as store_trade_ins
from app.api.routes.store import garage as store_garage
from app.api.routes.store import service_bookings as store_service_bookings
from app.api.routes import deals
from app.api.routes.store import purchases as store_purchases
from app.api.routes.public import catalog as public_catalog
from app.api.routes import reservations as staff_reservations
from app.api.routes import enquiries as staff_enquiries
from app.api.routes import restock as staff_restock
from app.api.routes import reviews as staff_reviews
from app.api.routes import trade_ins as staff_trade_ins
from app.api.routes import service_bookings as staff_service_bookings
from app.api.routes import email_log as staff_email_log
from app.api.routes import technician_profiles as staff_technician_profiles
from app.api.routes import sales_assistance, today

logger = logging.getLogger(__name__)


def _sweep_expiries():
    from app.db.session import SessionLocal
    from app.services.reservation_service import expire_stale

    with SessionLocal.begin() as db:
        return expire_stale(db)


async def _expiry_loop():
    """Sweep at startup and every three minutes, independently of email delivery."""
    while True:
        try:
            count = await asyncio.to_thread(_sweep_expiries)
            if count:
                logger.info("Expiry sweep expired %s reservation(s)", count)
        except Exception:
            logger.exception("Expiry sweep failed")
        await asyncio.sleep(180)


async def _email_loop():
    from app.db.session import SessionLocal
    from app.services import email_service
    from app.models.email_outbox import EmailOutbox

    while True:
        try:
            with SessionLocal() as db:
                email_ids = [
                    row.email_id for row in db.query(EmailOutbox.email_id)
                    .filter(EmailOutbox.status == "Queued")
                    .order_by(EmailOutbox.email_id).limit(50)
                ]
            for email_id in email_ids:
                with SessionLocal() as db:
                    await email_service.send(db, email_id)
        except Exception:
            logger.exception("Queued email processing failed")
        await asyncio.sleep(180)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan — starts the expiry background loop on startup."""
    tasks = [asyncio.create_task(_expiry_loop()), asyncio.create_task(_email_loop())]
    try:
        yield
    finally:
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)


app = FastAPI(
    title="AutoEdge API",
    description="Car Showroom Management System REST API",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS Middleware
origins = [origin.strip() for origin in settings.CORS_ORIGINS.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all routers under /api/v1
PREFIX = "/api/v1"
# Staff routes (existing)
app.include_router(auth.router, prefix=PREFIX)
app.include_router(users.router, prefix=PREFIX, dependencies=[Depends(require_module("staff"))])
app.include_router(vehicles.router, prefix=PREFIX, dependencies=[Depends(require_module("vehicles"))])
app.include_router(customers.router, prefix=PREFIX, dependencies=[Depends(require_module("customers"))])
app.include_router(test_drives.router, prefix=PREFIX, dependencies=[Depends(require_module("test_drives"))])
app.include_router(sales_assistance.router, prefix=PREFIX, dependencies=[Depends(require_module("sales"))])
app.include_router(sales.router, prefix=PREFIX, dependencies=[Depends(require_module("sales"))])
app.include_router(today.router, prefix=PREFIX)
app.include_router(service.router, prefix=PREFIX, dependencies=[Depends(require_module("service"))])
app.include_router(commissions.router, prefix=PREFIX, dependencies=[Depends(require_module("commissions"))])
app.include_router(dashboard.router, prefix=PREFIX, dependencies=[Depends(require_module("dashboard"))])
# Staff additions for storefront
app.include_router(staff_reservations.router, prefix=PREFIX, dependencies=[Depends(require_module("reservations"))])
# Customer storefront routes
app.include_router(store_auth.router, prefix=PREFIX)
app.include_router(store_account.router, prefix=PREFIX)
app.include_router(store_wishlist.router, prefix=PREFIX)
app.include_router(store_notifications.router, prefix=PREFIX)
app.include_router(store_bank.router, prefix=PREFIX)
app.include_router(store_reservations.router, prefix=PREFIX)
app.include_router(store_test_drives.router, prefix=PREFIX)
app.include_router(store_enquiries.router, prefix=PREFIX)
app.include_router(store_restock.router, prefix=PREFIX)
app.include_router(store_reviews.router, prefix=PREFIX)
app.include_router(store_trade_ins.router, prefix=PREFIX)
app.include_router(store_garage.router, prefix=PREFIX)
app.include_router(store_service_bookings.router, prefix=PREFIX)
app.include_router(deals.router, prefix=PREFIX)
app.include_router(store_purchases.router, prefix=PREFIX)
# Public routes (no auth)
app.include_router(public_catalog.router, prefix=PREFIX)
# Staff additions for storefront
app.include_router(staff_enquiries.router, prefix=PREFIX, dependencies=[Depends(require_module("enquiries"))])
app.include_router(staff_restock.router, prefix=PREFIX, dependencies=[Depends(require_module("restock"))])
app.include_router(staff_reviews.router, prefix=PREFIX, dependencies=[Depends(require_module("reviews"))])
app.include_router(staff_trade_ins.router, prefix=PREFIX, dependencies=[Depends(require_module("trade_ins"))])
app.include_router(staff_service_bookings.router, prefix=PREFIX, dependencies=[Depends(require_module("service"))])
app.include_router(staff_email_log.router, prefix=PREFIX, dependencies=[Depends(require_module("email_log"))])
app.include_router(staff_technician_profiles.router, prefix=PREFIX, dependencies=[Depends(require_module("staff"))])


@app.get("/")
async def root():
    return {"message": "AutoEdge API is running", "docs": "/docs"}


@app.get("/health")
async def health():
    return {"status": "ok"}
