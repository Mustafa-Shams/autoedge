from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.routes import auth, users, vehicles, customers, test_drives, sales, service, commissions, dashboard

app = FastAPI(
    title="AutoEdge API",
    description="Car Showroom Management System REST API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
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
app.include_router(auth.router, prefix=PREFIX)
app.include_router(users.router, prefix=PREFIX)
app.include_router(vehicles.router, prefix=PREFIX)
app.include_router(customers.router, prefix=PREFIX)
app.include_router(test_drives.router, prefix=PREFIX)
app.include_router(sales.router, prefix=PREFIX)
app.include_router(service.router, prefix=PREFIX)
app.include_router(commissions.router, prefix=PREFIX)
app.include_router(dashboard.router, prefix=PREFIX)


@app.get("/")
async def root():
    return {"message": "AutoEdge API is running", "docs": "/docs"}


@app.get("/health")
async def health():
    return {"status": "ok"}
