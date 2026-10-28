# AutoEdge Car Showroom Management System

A full-stack web application for managing vehicle inventory, sales, test drives, service, and staff commissions for a car dealership.

## Tech Stack

- **Frontend:** React 18 + Vite + TailwindCSS + Shadcn/ui (Vercel)
- **Backend:** FastAPI + SQLAlchemy + Alembic + PostgreSQL (Railway + Neon)
- **Auth:** JWT (Bearer token, 24h expiry)

## Roles

| Role | Access |
|------|--------|
| `manager` | Full access to all modules |
| `sales_executive` | Vehicles, Customers, Test Drives, Sales, Commissions |
| `technician` | Service Jobs |
| `receptionist` | Customers, Test Drives, Service Jobs |

## Modules

1. **Inventory & Sales** — Vehicle CRUD, sales recording, status tracking
2. **Test Drive & Leads** — Booking, scheduling, lead pipeline
3. **Service & Maintenance** — Job management, parts tracking
4. **Commission & Performance** — Auto-commission on sales, approval workflow

## Local Development

```bash
# Backend
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env   # Fill in DATABASE_URL and SECRET_KEY
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Frontend (new terminal)
cd frontend
npm install
cp .env.example .env   # Set VITE_API_BASE_URL=http://localhost:8000
npm run dev
```

**Dev URLs:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- Swagger Docs: http://localhost:8000/docs

## Default Test Accounts (password: `Admin@1234`)

| Email | Role |
|-------|------|
| admin@autoedge.com | manager |
| sarah@autoedge.com | sales_executive |
| tom@autoedge.com | technician |
| rita@autoedge.com | receptionist |

## Deployment

- **Frontend:** Vercel — set `VITE_API_BASE_URL` env variable
- **Backend:** Railway — set `DATABASE_URL`, `SECRET_KEY`, `CORS_ORIGINS` env variables
- **Database:** Neon (PostgreSQL free tier)
