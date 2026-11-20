import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
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
from app.api.routes.public import catalog as public_catalog
from app.api.routes import reservations as staff_reservations
from app.api.routes import enquiries as staff_enquiries
from app.api.routes import restock as staff_restock
from app.api.routes import reviews as staff_reviews
from app.api.routes import trade_ins as staff_trade_ins
from app.api.routes import service_bookings as staff_service_bookings
from app.api.routes import email_log as staff_email_log
from app.api.routes import technician_profiles as staff_technician_profiles

logger = logging.getLogger(__name__)


async def _expiry_loop():
    """Background loop that runs expire_stale() every 10 minutes.

    Per spec 7.2: expires reservations, test drives, and trade-in offers.
    Also processes any queued emails that weren't sent via BackgroundTasks.
    Uses FOR UPDATE SKIP LOCKED so concurrent runs don't collide.
    """
    from app.db.session import SessionLocal
    from app.services.reservation_service import expire_stale
    from app.services import email_service
    from app.models.email_outbox import EmailOutbox

    while True:
        try:
            await asyncio.sleep(600)  # 10 minutes
            db = SessionLocal()
            try:
                count = expire_stale(db)
                db.commit()
                if count > 0:
                    logger.info(f"Expiry sweep: expired {count} reservation(s)")

                # Process any queued emails
                queued_emails = db.query(EmailOutbox).filter(
                    EmailOutbox.status == "Queued"
                ).limit(50).all()
                for email in queued_emails:
                    try:
                        await email_service.send(db, email.email_id)
                    except Exception as email_exc:
                        logger.error(f"Email #{email.email_id} send error: {email_exc}")

            except Exception as exc:
                db.rollback()
                logger.error(f"Expiry sweep error: {exc}")
            finally:
                db.close()
        except asyncio.CancelledError:
            break
        except Exception as exc:
            logger.error(f"Expiry loop unexpected error: {exc}")
            await asyncio.sleep(60)  # Back off on unexpected errors


@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan — starts the expiry background loop on startup."""
    task = asyncio.create_task(_expiry_loop())
    logger.info("Started reservation/test-drive/trade-in expiry background loop (every 10 min)")
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    logger.info("Stopped expiry background loop")


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
app.include_router(users.router, prefix=PREFIX)
app.include_router(vehicles.router, prefix=PREFIX)
app.include_router(customers.router, prefix=PREFIX)
app.include_router(test_drives.router, prefix=PREFIX)
app.include_router(sales.router, prefix=PREFIX)
app.include_router(service.router, prefix=PREFIX)
app.include_router(commissions.router, prefix=PREFIX)
app.include_router(dashboard.router, prefix=PREFIX)
# Staff additions for storefront
app.include_router(staff_reservations.router, prefix=PREFIX)
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
# Public routes (no auth)
app.include_router(public_catalog.router, prefix=PREFIX)
# Staff additions for storefront
app.include_router(staff_enquiries.router, prefix=PREFIX)
app.include_router(staff_restock.router, prefix=PREFIX)
app.include_router(staff_reviews.router, prefix=PREFIX)
app.include_router(staff_trade_ins.router, prefix=PREFIX)
app.include_router(staff_service_bookings.router, prefix=PREFIX)
app.include_router(staff_email_log.router, prefix=PREFIX)
app.include_router(staff_technician_profiles.router, prefix=PREFIX)


@app.get("/")
async def root():
    return {"message": "AutoEdge API is running", "docs": "/docs"}


@app.get("/health")
async def health():
    return {"status": "ok"}
