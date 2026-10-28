# AutoEdge — Car Showroom Management System
## Spec-Driven Project Specification (Spec Kit Plus Format)

> **Project Name:** AutoEdge Car Showroom Management System  
> **Author:** Mustafa Shams  
> **Email:** mustafashams003@gmail.com  
> **Course:** Database Systems  
> **Target Deployment:** Live web app (Vercel + Railway + Neon)  
> **AI Build Tool:** Antigravity IDE + agy CLI + Spec Kit Plus  
> **Spec Version:** 1.0.0  
> **Date:** 2026-10-28  

---

## CONSTITUTION (Governing Rules — Agent Must Never Violate These)

```
ARTICLE I   — Library-First: Use specified libraries only. No custom reinventions.
ARTICLE II  — CLI Interface Mandate: All scaffolding, migrations, and seeding via CLI commands.
ARTICLE III — Test-First Imperative: Write at least one smoke test per route before proceeding.
ARTICLE IV  — Schema-First: Database tables and indexes must exist before any backend code.
ARTICLE V   — Env-First: All secrets in .env files. Never hardcode credentials anywhere.
ARTICLE VI  — Mobile-Responsive: Every UI page must work at 375px minimum viewport width.
ARTICLE VII — Simplicity: No over-engineering. One file per concern. No unnecessary abstraction.
ARTICLE VIII— Anti-Abstraction: Don't create base classes or factories unless reused 3+ times.
ARTICLE IX  — Integration-First: Test actual DB connections, not mocks, for all DB logic.
ARTICLE X   — Dark Theme Only: The entire UI uses the AutoEdge dark color palette. No light mode.
```

---

## PROJECT OVERVIEW

| Field             | Value                                                   |
|-------------------|---------------------------------------------------------|
| App Name          | AutoEdge Car Showroom Management System                 |
| Type              | Full-stack web application (SPA + REST API)             |
| Purpose           | Manage vehicle inventory, sales, test drives, service, and staff commissions for a car dealership |
| Users (Roles)     | manager, sales_executive, technician, receptionist      |
| Core Modules      | 4 (Inventory & Sales, Test Drive & Leads, Service & Maintenance, Commission & Performance) |
| Database          | PostgreSQL (Neon cloud, free tier)                      |
| Frontend Host     | Vercel                                                  |
| Backend Host      | Railway                                                 |
| GitHub Repo       | Public repository                                       |
| Auth Method       | JWT (Bearer token, 24h expiry)                          |
| API Style         | REST (JSON)                                             |

---

## TECH STACK (MANDATORY — DO NOT DEVIATE)

### Frontend
| Technology       | Version | Purpose                                      |
|------------------|---------|----------------------------------------------|
| React            | 18.x    | UI framework (component-based SPA)           |
| Vite             | 5.x     | Build tool (NOT Create React App)            |
| TailwindCSS      | 3.x     | Utility-first CSS styling                    |
| Shadcn/ui        | latest  | Pre-built accessible UI components           |
| React Router DOM | 6.x     | Client-side routing / navigation             |
| Axios            | 1.x     | HTTP client for API calls                    |
| TanStack Query   | v5      | Server-state caching and data fetching       |
| Recharts         | 2.x     | Charts and data visualization                |
| Lucide React     | latest  | Icon library                                 |

### Backend
| Technology         | Version | Purpose                                    |
|--------------------|---------|--------------------------------------------|
| Python             | 3.11+   | Runtime language                           |
| FastAPI            | 0.110+  | REST API framework (async, auto-docs)      |
| SQLAlchemy         | 2.x     | ORM (Object-Relational Mapper)             |
| Alembic            | 1.x     | Database migrations                        |
| Psycopg2-binary    | 2.9+    | PostgreSQL driver for Python               |
| python-jose        | 3.x     | JWT token creation and verification        |
| passlib[bcrypt]    | 1.7+    | Password hashing (bcrypt algorithm)        |
| Uvicorn            | 0.27+   | ASGI server to run FastAPI                 |
| python-dotenv      | 1.x     | Load .env environment variables            |
| Pydantic           | v2      | Request/response data validation           |

### Infrastructure
| Service    | Purpose                            | Free Tier |
|------------|------------------------------------|-----------|
| Neon       | PostgreSQL cloud database          | Yes       |
| Railway    | Python backend hosting             | Yes       |
| Vercel     | React frontend hosting             | Yes       |
| GitHub     | Source code repository (public)    | Yes       |

---

## ENVIRONMENT VARIABLES

### Backend `.env` (Railway)
```
DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require
SECRET_KEY=your-256-bit-random-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
CORS_ORIGINS=https://your-app.vercel.app,http://localhost:5173
```

### Frontend `.env` (Vercel)
```
VITE_API_BASE_URL=https://your-backend.railway.app
```

---

## FOLDER STRUCTURE

```
autoedge/
├── frontend/                        # React + Vite app (deployed to Vercel)
│   ├── public/
│   │   └── favicon.ico
│   ├── src/
│   │   ├── api/                     # Axios instances and API call functions
│   │   │   ├── axiosInstance.js     # Base axios config with auth interceptors
│   │   │   ├── authApi.js
│   │   │   ├── vehiclesApi.js
│   │   │   ├── customersApi.js
│   │   │   ├── testDrivesApi.js
│   │   │   ├── salesApi.js
│   │   │   ├── serviceApi.js
│   │   │   └── commissionsApi.js
│   │   ├── components/              # Reusable UI components
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.jsx
│   │   │   │   ├── Topbar.jsx
│   │   │   │   └── PageWrapper.jsx
│   │   │   ├── common/
│   │   │   │   ├── StatusBadge.jsx
│   │   │   │   ├── DataTable.jsx
│   │   │   │   ├── ConfirmDialog.jsx
│   │   │   │   ├── LoadingSpinner.jsx
│   │   │   │   └── EmptyState.jsx
│   │   │   └── charts/
│   │   │       ├── SalesBarChart.jsx
│   │   │       └── CommissionLineChart.jsx
│   │   ├── pages/                   # One file per route
│   │   │   ├── auth/
│   │   │   │   └── LoginPage.jsx
│   │   │   ├── dashboard/
│   │   │   │   └── DashboardPage.jsx
│   │   │   ├── vehicles/
│   │   │   │   ├── VehiclesPage.jsx
│   │   │   │   ├── VehicleDetailPage.jsx
│   │   │   │   └── VehicleFormPage.jsx
│   │   │   ├── customers/
│   │   │   │   ├── CustomersPage.jsx
│   │   │   │   └── CustomerFormPage.jsx
│   │   │   ├── testdrives/
│   │   │   │   ├── TestDrivesPage.jsx
│   │   │   │   └── TestDriveFormPage.jsx
│   │   │   ├── sales/
│   │   │   │   ├── SalesPage.jsx
│   │   │   │   └── SaleFormPage.jsx
│   │   │   ├── service/
│   │   │   │   ├── ServicePage.jsx
│   │   │   │   └── ServiceFormPage.jsx
│   │   │   └── commissions/
│   │   │       └── CommissionsPage.jsx
│   │   ├── hooks/                   # Custom React hooks
│   │   │   ├── useAuth.js
│   │   │   └── useDebounce.js
│   │   ├── store/                   # Auth state (context or zustand)
│   │   │   └── authStore.js
│   │   ├── utils/
│   │   │   ├── formatters.js        # Date, currency, number formatters
│   │   │   └── roleGuard.js         # Role-based render helpers
│   │   ├── router/
│   │   │   └── AppRouter.jsx        # All routes + ProtectedRoute wrapper
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── tailwind.config.js
│   ├── vite.config.js
│   ├── .env
│   └── package.json
│
├── backend/                         # FastAPI app (deployed to Railway)
│   ├── app/
│   │   ├── api/
│   │   │   ├── deps.py              # Shared dependencies (get_db, get_current_user)
│   │   │   └── routes/
│   │   │       ├── auth.py
│   │   │       ├── users.py
│   │   │       ├── vehicles.py
│   │   │       ├── customers.py
│   │   │       ├── test_drives.py
│   │   │       ├── sales.py
│   │   │       ├── service.py
│   │   │       └── commissions.py
│   │   ├── core/
│   │   │   ├── config.py            # Pydantic settings from .env
│   │   │   └── security.py          # JWT create/verify, password hash
│   │   ├── db/
│   │   │   ├── base.py              # SQLAlchemy Base
│   │   │   └── session.py           # engine + SessionLocal factory
│   │   ├── models/                  # SQLAlchemy ORM models
│   │   │   ├── user.py
│   │   │   ├── vehicle.py
│   │   │   ├── customer.py
│   │   │   ├── test_drive.py
│   │   │   ├── sale.py
│   │   │   ├── service_job.py
│   │   │   ├── service_part.py
│   │   │   └── commission.py
│   │   ├── schemas/                 # Pydantic request/response schemas
│   │   │   ├── auth.py
│   │   │   ├── user.py
│   │   │   ├── vehicle.py
│   │   │   ├── customer.py
│   │   │   ├── test_drive.py
│   │   │   ├── sale.py
│   │   │   ├── service.py
│   │   │   └── commission.py
│   │   ├── crud/                    # DB query functions per entity
│   │   │   ├── crud_user.py
│   │   │   ├── crud_vehicle.py
│   │   │   ├── crud_customer.py
│   │   │   ├── crud_test_drive.py
│   │   │   ├── crud_sale.py
│   │   │   ├── crud_service.py
│   │   │   └── crud_commission.py
│   │   └── main.py                  # FastAPI app entry point
│   ├── alembic/
│   │   ├── versions/                # Migration scripts (auto-generated)
│   │   └── env.py
│   ├── database/
│   │   ├── schema.sql               # Raw SQL for table creation + indexes
│   │   └── seed.sql                 # Sample data for testing
│   ├── tests/
│   │   └── test_routes.py           # Smoke tests for all routes
│   ├── alembic.ini
│   ├── requirements.txt
│   ├── .env
│   └── Procfile                     # For Railway: "web: uvicorn app.main:app --host 0.0.0.0 --port $PORT"
│
└── README.md
```

---

## DATABASE SCHEMA (with Performance Indexes)

> **Strategy:** Every foreign key column has an index. All status/role ENUM columns are indexed (frequent WHERE clauses). Date columns used in range queries are indexed. Composite indexes on the most common multi-column query patterns.

```sql
-- ============================================================
-- TABLE 1: users
-- ============================================================
CREATE TABLE users (
    user_id       SERIAL PRIMARY KEY,
    full_name     VARCHAR(100)  NOT NULL,
    email         VARCHAR(150)  NOT NULL UNIQUE,
    password_hash VARCHAR(255)  NOT NULL,
    role          VARCHAR(30)   NOT NULL CHECK (role IN ('manager','sales_executive','technician','receptionist')),
    is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Indexes
CREATE INDEX idx_users_email    ON users(email);       -- Login lookup O(log n)
CREATE INDEX idx_users_role     ON users(role);        -- Filter by role O(log n)
CREATE INDEX idx_users_active   ON users(is_active);   -- Active staff filter

-- ============================================================
-- TABLE 2: vehicles
-- ============================================================
CREATE TABLE vehicles (
    vehicle_id     SERIAL PRIMARY KEY,
    make           VARCHAR(50)   NOT NULL,
    model          VARCHAR(50)   NOT NULL,
    year           INTEGER       NOT NULL,
    color          VARCHAR(40),
    fuel_type      VARCHAR(20),
    transmission   VARCHAR(20),
    body_type      VARCHAR(20),
    condition_type VARCHAR(15)   NOT NULL DEFAULT 'New' CHECK (condition_type IN ('New','Used','Certified')),
    mileage_km     INTEGER       NOT NULL DEFAULT 0,
    vin_number     VARCHAR(30)   UNIQUE,
    price          NUMERIC(12,2) NOT NULL,
    status         VARCHAR(15)   NOT NULL DEFAULT 'Available' CHECK (status IN ('Available','Reserved','Sold')),
    notes          TEXT,
    date_added     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Indexes
CREATE INDEX idx_vehicles_status     ON vehicles(status);            -- Most common filter: "show available"
CREATE INDEX idx_vehicles_make_model ON vehicles(make, model);       -- Composite: brand search
CREATE INDEX idx_vehicles_year       ON vehicles(year);              -- Year range filter
CREATE INDEX idx_vehicles_price      ON vehicles(price);             -- Price range filter
CREATE INDEX idx_vehicles_condition  ON vehicles(condition_type);    -- New/Used/Certified filter

-- ============================================================
-- TABLE 3: customers
-- ============================================================
CREATE TABLE customers (
    customer_id  SERIAL PRIMARY KEY,
    full_name    VARCHAR(100) NOT NULL,
    email        VARCHAR(150) UNIQUE,
    phone        VARCHAR(20)  NOT NULL,
    address      TEXT,
    id_type      VARCHAR(20),
    id_number    VARCHAR(50),
    notes        TEXT,
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Indexes
CREATE INDEX idx_customers_phone     ON customers(phone);      -- Quick phone lookup O(log n)
CREATE INDEX idx_customers_email     ON customers(email);      -- Email search
CREATE INDEX idx_customers_fullname  ON customers(full_name);  -- Name search

-- ============================================================
-- TABLE 4: test_drives
-- ============================================================
CREATE TABLE test_drives (
    test_drive_id  SERIAL PRIMARY KEY,
    customer_id    INTEGER      NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    vehicle_id     INTEGER      NOT NULL REFERENCES vehicles(vehicle_id)   ON DELETE CASCADE,
    assigned_to    INTEGER      REFERENCES users(user_id),
    booking_date   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    scheduled_date DATE         NOT NULL,
    status         VARCHAR(20)  NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled','Completed','Cancelled','No-Show')),
    notes          TEXT,
    lead_status    VARCHAR(20)  NOT NULL DEFAULT 'New' CHECK (lead_status IN ('New','Interested','Hot','Converted','Lost'))
);
-- Indexes
CREATE INDEX idx_td_customer       ON test_drives(customer_id);                  -- FK
CREATE INDEX idx_td_vehicle        ON test_drives(vehicle_id);                   -- FK
CREATE INDEX idx_td_assigned       ON test_drives(assigned_to);                  -- FK
CREATE INDEX idx_td_status         ON test_drives(status);                       -- Filter by status
CREATE INDEX idx_td_lead           ON test_drives(lead_status);                  -- Lead pipeline filter
CREATE INDEX idx_td_scheduled      ON test_drives(scheduled_date);               -- Date range queries
CREATE INDEX idx_td_staff_date     ON test_drives(assigned_to, scheduled_date);  -- Composite: staff schedule

-- ============================================================
-- TABLE 5: sales
-- ============================================================
CREATE TABLE sales (
    sale_id      SERIAL PRIMARY KEY,
    vehicle_id   INTEGER       NOT NULL REFERENCES vehicles(vehicle_id) ON DELETE RESTRICT,
    customer_id  INTEGER       NOT NULL REFERENCES customers(customer_id) ON DELETE RESTRICT,
    staff_id     INTEGER       NOT NULL REFERENCES users(user_id),
    sale_date    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sale_price   NUMERIC(12,2) NOT NULL,
    discount     NUMERIC(10,2) NOT NULL DEFAULT 0,
    payment_type VARCHAR(30)   NOT NULL DEFAULT 'Cash' CHECK (payment_type IN ('Cash','Finance','Lease')),
    status       VARCHAR(20)   NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Completed','Cancelled')),
    notes        TEXT
);
-- Indexes
CREATE INDEX idx_sales_vehicle    ON sales(vehicle_id);              -- FK
CREATE INDEX idx_sales_customer   ON sales(customer_id);             -- FK
CREATE INDEX idx_sales_staff      ON sales(staff_id);                -- FK
CREATE INDEX idx_sales_status     ON sales(status);                  -- Filter completed/pending
CREATE INDEX idx_sales_date       ON sales(sale_date);               -- Date range reports
CREATE INDEX idx_sales_staff_date ON sales(staff_id, sale_date);     -- Composite: commission calc

-- ============================================================
-- TABLE 6: service_jobs
-- ============================================================
CREATE TABLE service_jobs (
    job_id       SERIAL PRIMARY KEY,
    vehicle_id   INTEGER      NOT NULL REFERENCES vehicles(vehicle_id) ON DELETE RESTRICT,
    customer_id  INTEGER      NOT NULL REFERENCES customers(customer_id) ON DELETE RESTRICT,
    technician_id INTEGER     REFERENCES users(user_id),
    job_type     VARCHAR(50)  NOT NULL,
    description  TEXT,
    status       VARCHAR(20)  NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','In Progress','Completed','Cancelled')),
    job_date     DATE         NOT NULL DEFAULT CURRENT_DATE,
    estimated_cost NUMERIC(10,2),
    final_cost   NUMERIC(10,2),
    notes        TEXT,
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Indexes
CREATE INDEX idx_sj_vehicle     ON service_jobs(vehicle_id);            -- FK
CREATE INDEX idx_sj_customer    ON service_jobs(customer_id);           -- FK
CREATE INDEX idx_sj_technician  ON service_jobs(technician_id);         -- FK
CREATE INDEX idx_sj_status      ON service_jobs(status);                -- Filter by status
CREATE INDEX idx_sj_date        ON service_jobs(job_date);              -- Date range queries
CREATE INDEX idx_sj_tech_date   ON service_jobs(technician_id, job_date); -- Composite: tech workload

-- ============================================================
-- TABLE 7: service_parts
-- ============================================================
CREATE TABLE service_parts (
    part_id     SERIAL PRIMARY KEY,
    job_id      INTEGER       NOT NULL REFERENCES service_jobs(job_id) ON DELETE CASCADE,
    part_name   VARCHAR(100)  NOT NULL,
    part_number VARCHAR(50),
    quantity    INTEGER       NOT NULL DEFAULT 1,
    unit_cost   NUMERIC(10,2) NOT NULL,
    total_cost  NUMERIC(10,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED
);
-- Indexes
CREATE INDEX idx_parts_job ON service_parts(job_id);  -- FK (most critical for JOIN)

-- ============================================================
-- TABLE 8: commissions
-- ============================================================
CREATE TABLE commissions (
    commission_id  SERIAL PRIMARY KEY,
    staff_id       INTEGER       NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    sale_id        INTEGER       NOT NULL REFERENCES sales(sale_id) ON DELETE CASCADE UNIQUE,
    rate_percent   NUMERIC(5,2)  NOT NULL DEFAULT 2.50,
    commission_amt NUMERIC(10,2) NOT NULL,
    status         VARCHAR(20)   NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Paid')),
    created_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    paid_at        TIMESTAMP
);
-- Indexes
CREATE INDEX idx_comm_staff     ON commissions(staff_id);            -- FK
CREATE INDEX idx_comm_sale      ON commissions(sale_id);             -- FK (unique)
CREATE INDEX idx_comm_status    ON commissions(status);              -- Filter paid/pending
CREATE INDEX idx_comm_staff_status ON commissions(staff_id, status); -- Composite: staff dashboard
```

---

## SEED DATA (database/seed.sql)

```sql
-- Insert default manager account (password: Admin@1234)
INSERT INTO users (full_name, email, password_hash, role) VALUES
('Admin Manager',      'admin@autoedge.com',   '$2b$12$PLACEHOLDER_BCRYPT_HASH', 'manager'),
('Sarah Sales',        'sarah@autoedge.com',   '$2b$12$PLACEHOLDER_BCRYPT_HASH', 'sales_executive'),
('Tom Tech',           'tom@autoedge.com',     '$2b$12$PLACEHOLDER_BCRYPT_HASH', 'technician'),
('Rita Reception',     'rita@autoedge.com',    '$2b$12$PLACEHOLDER_BCRYPT_HASH', 'receptionist');

-- Sample vehicles
INSERT INTO vehicles (make, model, year, color, fuel_type, transmission, condition_type, price, status) VALUES
('Toyota',  'Camry',     2023, 'Silver',     'Petrol', 'Automatic', 'New',  28500.00, 'Available'),
('Honda',   'Civic',     2022, 'White',      'Petrol', 'Automatic', 'Used', 19900.00, 'Available'),
('BMW',     '3 Series',  2023, 'Black',      'Petrol', 'Automatic', 'New',  52000.00, 'Available'),
('Ford',    'F-150',     2021, 'Red',        'Diesel', 'Automatic', 'Used', 34000.00, 'Reserved'),
('Tesla',   'Model 3',   2023, 'Blue',       'Electric','Automatic','New',  44900.00, 'Available'),
('Hyundai', 'Tucson',    2022, 'Grey',       'Petrol', 'Automatic', 'Certified',23500.00,'Available'),
('Kia',     'Sportage',  2023, 'White',      'Hybrid', 'Automatic', 'New',  31000.00, 'Available'),
('Mazda',   'CX-5',      2021, 'Deep Red',   'Petrol', 'Automatic', 'Used', 22000.00, 'Available');

-- Sample customers
INSERT INTO customers (full_name, email, phone, address) VALUES
('Ali Hassan',      'ali@email.com',    '+1-555-0101', '123 Main St'),
('Maria Garcia',    'maria@email.com',  '+1-555-0102', '456 Oak Ave'),
('John Williams',   'john@email.com',   '+1-555-0103', '789 Pine Rd'),
('Fatima Khan',     'fatima@email.com', '+1-555-0104', '321 Elm Blvd'),
('David Chen',      'david@email.com',  '+1-555-0105', '654 Maple Dr');
```

---

## USER ROLES & PERMISSIONS MATRIX

| Feature                      | manager | sales_executive | technician | receptionist |
|------------------------------|:-------:|:---------------:|:----------:|:------------:|
| View dashboard (all metrics) | ✅      | ❌              | ❌         | ❌           |
| View own sales metrics       | ✅      | ✅              | ❌         | ❌           |
| Add / edit vehicles          | ✅      | ✅              | ❌         | ❌           |
| Delete vehicles              | ✅      | ❌              | ❌         | ❌           |
| View vehicles                | ✅      | ✅              | ✅         | ✅           |
| Create customer records      | ✅      | ✅              | ❌         | ✅           |
| Edit customer records        | ✅      | ✅              | ❌         | ✅           |
| Book test drive              | ✅      | ✅              | ❌         | ✅           |
| Update test drive status     | ✅      | ✅              | ❌         | ✅           |
| Record a sale                | ✅      | ✅              | ❌         | ❌           |
| View all sales               | ✅      | ❌              | ❌         | ❌           |
| View own sales only          | ✅      | ✅              | ❌         | ❌           |
| Create service job           | ✅      | ❌              | ✅         | ✅           |
| Update service job status    | ✅      | ❌              | ✅         | ❌           |
| Add parts to service job     | ✅      | ❌              | ✅         | ❌           |
| View commissions (all)       | ✅      | ❌              | ❌         | ❌           |
| View own commissions         | ✅      | ✅              | ❌         | ❌           |
| Approve commissions          | ✅      | ❌              | ❌         | ❌           |
| Manage users (CRUD)          | ✅      | ❌              | ❌         | ❌           |

---

## REST API ENDPOINTS

> Base URL (production): `https://your-backend.railway.app`  
> All protected routes require: `Authorization: Bearer <token>`

### AUTH
```
POST   /api/v1/auth/login          → { access_token, token_type, role }
POST   /api/v1/auth/logout         → 200 OK (client drops token)
GET    /api/v1/auth/me             → current user profile  [PROTECTED]
```

### USERS (manager only)
```
GET    /api/v1/users               → list all users
POST   /api/v1/users               → create new user
GET    /api/v1/users/{id}          → get user by ID
PUT    /api/v1/users/{id}          → update user
DELETE /api/v1/users/{id}          → soft delete (set is_active=false)
```

### VEHICLES
```
GET    /api/v1/vehicles            → list all vehicles (filter: status, make, year, price_min, price_max)
POST   /api/v1/vehicles            → add new vehicle  [manager/sales_executive]
GET    /api/v1/vehicles/{id}       → get vehicle detail
PUT    /api/v1/vehicles/{id}       → update vehicle   [manager/sales_executive]
DELETE /api/v1/vehicles/{id}       → delete vehicle   [manager only]
GET    /api/v1/vehicles/available  → all Available vehicles only
```

### CUSTOMERS
```
GET    /api/v1/customers           → list all customers (search: name, phone, email)
POST   /api/v1/customers           → add new customer
GET    /api/v1/customers/{id}      → get customer detail
PUT    /api/v1/customers/{id}      → update customer
GET    /api/v1/customers/{id}/history → customer's full activity history
```

### TEST DRIVES
```
GET    /api/v1/test-drives         → list test drives (filter: status, date, lead_status)
POST   /api/v1/test-drives         → book test drive
GET    /api/v1/test-drives/{id}    → get booking detail
PUT    /api/v1/test-drives/{id}    → update status / lead status
DELETE /api/v1/test-drives/{id}    → cancel booking
```

### SALES
```
GET    /api/v1/sales               → list all sales  [manager] or own sales [sales_executive]
POST   /api/v1/sales               → record new sale
GET    /api/v1/sales/{id}          → get sale detail
PUT    /api/v1/sales/{id}          → update sale status
GET    /api/v1/sales/stats         → sales summary stats [manager]
```

### SERVICE JOBS
```
GET    /api/v1/service             → list all service jobs (filter: status, technician, date)
POST   /api/v1/service             → create service job
GET    /api/v1/service/{id}        → get job detail
PUT    /api/v1/service/{id}        → update job status / final cost
POST   /api/v1/service/{id}/parts  → add parts to job
GET    /api/v1/service/{id}/parts  → list parts for job
DELETE /api/v1/service/{id}/parts/{part_id} → remove part
```

### COMMISSIONS
```
GET    /api/v1/commissions         → list all [manager] or own [sales_executive]
GET    /api/v1/commissions/{id}    → get commission detail
PUT    /api/v1/commissions/{id}    → approve or mark paid  [manager only]
GET    /api/v1/commissions/summary → per-staff commission totals [manager]
```

### DASHBOARD (manager only)
```
GET    /api/v1/dashboard/stats     → total vehicles, active sales, revenue, pending jobs
GET    /api/v1/dashboard/monthly   → monthly sales chart data (last 12 months)
GET    /api/v1/dashboard/top-staff → top 5 sales staff by revenue
```

---

## UI DESIGN SYSTEM

### Color Palette (CSS Variables — apply in tailwind.config.js)
```js
colors: {
  bg: {
    primary:   '#0D0F17',   // Main app background
    card:      '#161821',   // Cards, sidebars
    elevated:  '#1E2130',   // Modals, dropdowns, hover states
    border:    '#2A2D3E',   // All borders and dividers
  },
  text: {
    primary:   '#E8EAF0',   // Main text
    secondary: '#8B90A7',   // Labels, meta, placeholders
    muted:     '#4A4F6A',   // Disabled, timestamps
  },
  accent: {
    blue:      '#4D7FFF',   // Primary CTA buttons, links, active states
    blueHover: '#3D6FEF',
  },
  status: {
    available: '#22C55E',   // Green  — vehicle available, job completed
    reserved:  '#F59E0B',   // Amber  — reserved, pending, in-progress
    sold:      '#8B5CF6',   // Purple — sold vehicles
    cancelled: '#EF4444',   // Red    — cancelled, error, danger
    scheduled: '#3B82F6',   // Blue   — scheduled test drives
  }
}
```

### Typography
```
Font: Inter (Google Fonts)
Sizes: text-xs(12) text-sm(14) text-base(16) text-lg(18) text-xl(20) text-2xl(24) text-3xl(30)
Page headings: text-2xl font-bold text-text-primary
Card headings: text-lg font-semibold text-text-primary
Body text:     text-sm text-text-secondary
Labels:        text-xs font-medium uppercase tracking-wide text-text-muted
```

### Component Standards
- **Cards:** `bg-bg-card border border-bg-border rounded-xl p-6`
- **Tables:** Striped rows with `even:bg-bg-elevated`, hover highlight
- **Buttons (primary):** `bg-accent-blue hover:bg-accent-blueHover text-white rounded-lg px-4 py-2`
- **Buttons (ghost):** `border border-bg-border text-text-secondary hover:bg-bg-elevated`
- **Inputs:** `bg-bg-elevated border border-bg-border text-text-primary rounded-lg px-3 py-2 focus:border-accent-blue`
- **Sidebar:** Fixed left 240px wide, `bg-bg-card border-r border-bg-border`
- **Topbar:** `bg-bg-card border-b border-bg-border h-16`

---

## DO'S AND DON'TS

### ✅ ALWAYS DO
- Use `async/await` everywhere in FastAPI route handlers
- Use `db: Session = Depends(get_db)` dependency injection for all DB sessions
- Hash passwords with `passlib.context.CryptContext(schemes=["bcrypt"])`
- Return proper HTTP status codes (201 for create, 404 for not found, 401 for unauthorized, 403 for forbidden)
- Use Pydantic v2 `model_config = ConfigDict(from_attributes=True)` in all response schemas
- Add `try/except` blocks around DB commits to catch IntegrityError
- Use `CURRENT_TIMESTAMP` as default for all `created_at` fields
- Add CORS middleware in main.py with `allow_origins` from env variable
- Use TanStack Query's `useQuery` for data fetching (NOT plain useEffect + useState)
- Use React Router `<Outlet />` for nested layout routes
- Validate JWT expiry on every protected route request
- Set `httpOnly` flag considerations; store JWT in memory or `sessionStorage`, NOT `localStorage`
- Run `alembic upgrade head` to apply migrations — never manually ALTER TABLE in production

### ❌ NEVER DO
- NEVER commit `.env` files to GitHub (add to `.gitignore` immediately)
- NEVER store plaintext passwords in the database
- NEVER use `SELECT *` in production queries — always specify columns
- NEVER use `time.sleep()` or blocking calls in async FastAPI routes
- NEVER install Create React App (use Vite only)
- NEVER use Oracle APEX or similar all-in-one platforms
- NEVER deploy backend to GitHub Pages (static hosting only)
- NEVER skip database indexes on foreign keys
- NEVER leave `SECRET_KEY` as a default placeholder in production
- NEVER use synchronous SQLAlchemy session in async FastAPI context
- NEVER hardcode API base URL in frontend code (use `import.meta.env.VITE_API_BASE_URL`)
- NEVER return password_hash in any API response schema
- NEVER delete a vehicle that has associated sales records (use ON DELETE RESTRICT)

---

## EXPECTED FINAL OUTCOME CHECKLIST

```
- [ ] GitHub repo is public and has a clean README.md
- [ ] Frontend deployed live at https://*.vercel.app
- [ ] Backend deployed live at https://*.railway.app
- [ ] /docs (FastAPI Swagger UI) is accessible on the backend URL
- [ ] Login page works with all 4 roles
- [ ] JWT authentication working, protected routes redirect to login
- [ ] Vehicle inventory CRUD works with status filtering
- [ ] Test drive booking form works and saves correctly
- [ ] Sale recording updates vehicle status to 'Sold'
- [ ] Commission auto-created when a sale is recorded
- [ ] Service job can be created, updated, and parts added
- [ ] Manager dashboard shows charts with real data from DB
- [ ] All tables have proper pagination (limit/offset)
- [ ] All search/filter inputs work correctly
- [ ] Status badges display correct colors per status
- [ ] Mobile layout works at 375px viewport
- [ ] No console errors in production build
- [ ] All API responses use consistent JSON structure
- [ ] Environment variables are properly set on Vercel and Railway
- [ ] Alembic migrations folder has at least one migration file
```

---

## DEVELOPMENT PHASES (Spec Kit Plus — agy CLI Execution Order)

> **Instructions for AI Agent (agy CLI):**
> - Execute phases in order: P01 → P29
> - Complete each phase fully before starting the next
> - Run tests/smoke checks at every `[GATE]` marker
> - Use `[P]` marker phases — these CAN be done in parallel
> - Use `[NEEDS CLARIFICATION]` to flag anything ambiguous before proceeding
> - After each phase, confirm: "Phase PXX complete. Proceeding to PYY."

---

### P01 — Repository & Monorepo Setup
**Objective:** Create GitHub repo with proper structure.

```bash
# Commands to run:
mkdir autoedge && cd autoedge
git init
mkdir frontend backend
echo "# AutoEdge Car Showroom Management System" > README.md
echo ".env\n*.pyc\n__pycache__/\nnode_modules/\ndist/" > .gitignore
git add . && git commit -m "chore: init monorepo structure"
# Push to GitHub as public repo
```

**Deliverable:** GitHub repo is live with `frontend/` and `backend/` folders.

---

### P02 — Backend Project Bootstrap
**Objective:** Initialize FastAPI project with all dependencies.

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install fastapi uvicorn[standard] sqlalchemy psycopg2-binary python-jose passlib[bcrypt] alembic python-dotenv pydantic[email]
pip freeze > requirements.txt
mkdir -p app/api/routes app/core app/db app/models app/schemas app/crud database tests
touch app/__init__.py app/main.py app/api/__init__.py app/api/deps.py
touch app/core/__init__.py app/core/config.py app/core/security.py
touch app/db/__init__.py app/db/base.py app/db/session.py
touch Procfile
echo "web: uvicorn app.main:app --host 0.0.0.0 --port \$PORT" > Procfile
```

**Deliverable:** `backend/` directory structure fully created with empty files in place.

---

### P03 — Database on Neon (PostgreSQL)
**Objective:** Create Neon project and get connection string.

```
Steps:
1. Go to https://neon.tech and create a free account
2. Create a new project: "autoedge"
3. Create a database: "autoedge_db"
4. Copy the connection string (sslmode=require)
5. Paste into backend/.env as DATABASE_URL
```

**Deliverable:** `.env` file exists in `backend/` with `DATABASE_URL` set.

---

### P04 — SQLAlchemy Base + Database Session
**Objective:** Set up DB connection layer.

**File:** `app/db/base.py`
```python
from sqlalchemy.orm import DeclarativeBase
class Base(DeclarativeBase):
    pass
```

**File:** `app/db/session.py`
```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
```

**File:** `app/core/config.py`
```python
from pydantic_settings import BaseSettings
class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    CORS_ORIGINS: str = "http://localhost:5173"
    class Config:
        env_file = ".env"
settings = Settings()
```

**File:** `app/api/deps.py`
```python
from app.db.session import SessionLocal
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

**Deliverable:** DB session factory and config loaded from `.env`.

---

### P05 — ORM Models (All 8 Tables)
**Objective:** Create SQLAlchemy ORM model classes matching the schema exactly.

Create one file per model in `app/models/`:
- `user.py` → maps to `users` table
- `vehicle.py` → maps to `vehicles` table
- `customer.py` → maps to `customers` table
- `test_drive.py` → maps to `test_drives` table
- `sale.py` → maps to `sales` table
- `service_job.py` → maps to `service_jobs` table
- `service_part.py` → maps to `service_parts` table
- `commission.py` → maps to `commissions` table

All models must import from `app.db.base.Base`. All relationships use `relationship()` with `back_populates`.

**Deliverable:** 8 model files, all importable without errors.

---

### P06 — Alembic Migration Setup + Initial Migration
**Objective:** Generate migration from ORM models and apply to Neon DB.

```bash
cd backend
alembic init alembic
# Edit alembic/env.py:
#   import all models, set target_metadata = Base.metadata
#   set sqlalchemy.url = settings.DATABASE_URL
alembic revision --autogenerate -m "create_all_tables"
alembic upgrade head
```

**[GATE]:** Run `SELECT table_name FROM information_schema.tables WHERE table_schema='public';` in Neon console. All 8 tables must appear.

**Deliverable:** All 8 tables created in Neon PostgreSQL.

---

### P07 — Raw SQL Schema + Indexes File
**Objective:** Write `database/schema.sql` with all CREATE TABLE statements AND all CREATE INDEX statements (copy from this spec's DATABASE SCHEMA section exactly).

**Deliverable:** `backend/database/schema.sql` exists with all tables + all performance indexes documented.

---

### P08 — Seed Data Injection
**Objective:** Write and execute `database/seed.sql`.

```bash
# Generate bcrypt hashes for seed passwords first:
python -c "from passlib.context import CryptContext; ctx = CryptContext(schemes=['bcrypt']); print(ctx.hash('Admin@1234'))"
# Replace PLACEHOLDER_BCRYPT_HASH in seed.sql with actual hash
# Then run seed.sql against Neon:
psql $DATABASE_URL -f database/seed.sql
```

**[GATE]:** `SELECT * FROM users;` in Neon returns 4 rows. `SELECT count(*) FROM vehicles;` returns 8.

**Deliverable:** All seed data is in the database.

---

### P09 — Security Core (JWT + Password Hashing)
**Objective:** Implement `app/core/security.py`.

```python
from datetime import datetime, timedelta
from jose import jwt
from passlib.context import CryptContext
from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def decode_access_token(token: str) -> dict:
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
```

**Deliverable:** Security functions importable and tested.

---

### P10 — Pydantic Schemas (All Entities)
**Objective:** Write request/response schemas in `app/schemas/`. Each entity needs:
- `Base` schema (shared fields)
- `Create` schema (for POST body)
- `Update` schema (for PUT body, all Optional)
- `Response` schema (what API returns — NEVER include password_hash)

All Response schemas must have `model_config = ConfigDict(from_attributes=True)`.

**Deliverable:** 8 schema files, all valid Pydantic v2 models.

---

### P11 — Auth Routes + Protected Route Dependency
**Objective:** Implement login endpoint and current-user dependency.

**File:** `app/api/routes/auth.py`
- `POST /auth/login` — verify email+password, return JWT token and role
- `GET /auth/me` — return current user from JWT

**Update:** `app/api/deps.py`
- Add `get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db))` — validates JWT, returns User object
- Add `require_role(allowed_roles: list)` — role enforcement dependency

**File:** `app/main.py`
- Create FastAPI app
- Add CORSMiddleware with origins from settings
- Include all routers under `/api/v1/` prefix

**[GATE]:** `POST /api/v1/auth/login` with `{email: "admin@autoedge.com", password: "Admin@1234"}` returns `{access_token: "...", role: "manager"}`.

**Deliverable:** Login works and returns valid JWT.

---

### P12 — CRUD Functions (All Entities) [P]
**Objective:** Write all database query functions in `app/crud/`. These are plain Python functions, NOT classes.

Each crud file exposes:
- `get_{entity}(db, id)` — single record
- `get_{entities}(db, skip, limit, **filters)` — paginated list with optional filters
- `create_{entity}(db, obj_in)` — insert and return
- `update_{entity}(db, id, obj_in)` — update and return
- `delete_{entity}(db, id)` — hard or soft delete

**Deliverable:** 7 crud files (no crud for service_parts — handle in service crud).

---

### P13 — Vehicles API Routes [P]
**Objective:** Implement all 6 vehicle endpoints.

```
GET    /api/v1/vehicles          → paginated list, filter by status/make/year/price
POST   /api/v1/vehicles          → create vehicle [manager, sales_executive]
GET    /api/v1/vehicles/{id}     → vehicle detail
PUT    /api/v1/vehicles/{id}     → update vehicle [manager, sales_executive]
DELETE /api/v1/vehicles/{id}     → delete [manager only]
GET    /api/v1/vehicles/available → available only (shortcut route)
```

**[GATE]:** GET `/api/v1/vehicles` returns the 8 seed vehicles.

---

### P14 — Customers API Routes [P]
**Objective:** Implement customer CRUD + history endpoint.

```
GET    /api/v1/customers         → paginated list, search by name/phone/email
POST   /api/v1/customers         → create customer
GET    /api/v1/customers/{id}    → detail
PUT    /api/v1/customers/{id}    → update
GET    /api/v1/customers/{id}/history → all test drives + sales + service for this customer
```

**[GATE]:** GET `/api/v1/customers` returns 5 seed customers.

---

### P15 — Test Drives API Routes [P]
**Objective:** Implement test drive booking endpoints.

```
GET    /api/v1/test-drives       → list, filter by status/lead_status/date
POST   /api/v1/test-drives       → book new test drive
GET    /api/v1/test-drives/{id}  → detail
PUT    /api/v1/test-drives/{id}  → update status and lead_status
DELETE /api/v1/test-drives/{id}  → cancel
```

**[GATE]:** POST `/api/v1/test-drives` creates a booking and returns it with status: "Scheduled".

---

### P16 — Sales API Routes [P]
**Objective:** Implement sales recording. Auto-update vehicle status to 'Sold' on sale completion.

```
GET    /api/v1/sales             → manager sees all, sales_executive sees own
POST   /api/v1/sales             → record sale, auto-set vehicle status='Sold', auto-create commission
GET    /api/v1/sales/{id}        → sale detail
PUT    /api/v1/sales/{id}        → update sale status
GET    /api/v1/sales/stats       → totals summary [manager]
```

**Side effect on POST:** When `status='Completed'`:
1. Update `vehicles.status = 'Sold'` for the vehicle
2. Auto-create a `commissions` record with `rate_percent=2.50`

**[GATE]:** After creating a completed sale for a vehicle, that vehicle's status changes to 'Sold'.

---

### P17 — Service API Routes [P]
**Objective:** Implement service job management + parts sub-resource.

```
GET    /api/v1/service           → list jobs, filter by status/technician
POST   /api/v1/service           → create service job
GET    /api/v1/service/{id}      → job detail with parts
PUT    /api/v1/service/{id}      → update status/final_cost
POST   /api/v1/service/{id}/parts → add part to job
GET    /api/v1/service/{id}/parts → list parts
DELETE /api/v1/service/{id}/parts/{part_id} → remove part
```

**[GATE]:** Create a service job, add 2 parts to it, GET the job and confirm parts array has 2 items.

---

### P18 — Commissions API Routes [P]
**Objective:** Implement commission management endpoints.

```
GET    /api/v1/commissions       → manager: all | sales_exec: own
GET    /api/v1/commissions/{id}  → detail
PUT    /api/v1/commissions/{id}  → approve or mark paid [manager]
GET    /api/v1/commissions/summary → per-staff totals [manager]
```

**[GATE]:** GET `/api/v1/commissions` returns commissions matching sales created in P16.

---

### P19 — Dashboard Stats Endpoints [P]
**Objective:** Implement manager dashboard aggregate queries.

```
GET /api/v1/dashboard/stats    → { total_vehicles, available_vehicles, sold_this_month, total_revenue_this_month, pending_service_jobs }
GET /api/v1/dashboard/monthly  → [ { month: "Jan", revenue: 52000 }, ... ] (last 12 months)
GET /api/v1/dashboard/top-staff → [ { staff_name, total_sales, total_commission }, ... ] (top 5)
```

**[GATE]:** `/api/v1/dashboard/stats` returns valid numbers (not zeros) based on seed data.

---

### P20 — Frontend Bootstrap (React + Vite + Tailwind)
**Objective:** Initialize React frontend with all dependencies.

```bash
cd frontend
npm create vite@latest . -- --template react
npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm install axios @tanstack/react-query react-router-dom lucide-react recharts
npm install -D @types/node
npx shadcn-ui@latest init   # select: Dark theme, CSS variables, Zinc color
```

Configure `tailwind.config.js` with the AutoEdge color palette from this spec.

**[GATE]:** `npm run dev` starts successfully at `http://localhost:5173`.

---

### P21 — Axios Instance + Auth Store
**Objective:** Set up API communication layer and authentication state.

**File:** `src/api/axiosInstance.js`
- Create Axios instance with `baseURL: import.meta.env.VITE_API_BASE_URL`
- Add request interceptor: attach `Authorization: Bearer <token>` from storage
- Add response interceptor: redirect to `/login` on 401

**File:** `src/store/authStore.js`
- Store: `{ user, token, role, login(token, user), logout() }`
- Persist token in `sessionStorage`

**Deliverable:** API instance and auth store ready.

---

### P22 — App Router + Protected Routes
**Objective:** Set up all routes and role-based route protection.

**File:** `src/router/AppRouter.jsx`
```
/login                  → LoginPage (public)
/                       → redirect to /dashboard
/dashboard              → DashboardPage      [manager]
/vehicles               → VehiclesPage       [all roles]
/vehicles/:id           → VehicleDetailPage  [all roles]
/vehicles/new           → VehicleFormPage    [manager, sales_executive]
/customers              → CustomersPage      [manager, sales_executive, receptionist]
/test-drives            → TestDrivesPage     [manager, sales_executive, receptionist]
/sales                  → SalesPage          [manager, sales_executive]
/service                → ServicePage        [manager, technician, receptionist]
/commissions            → CommissionsPage    [manager, sales_executive]
```

`ProtectedRoute` checks: is logged in? → has required role? → renders page, else redirects.

**Deliverable:** Full routing with role guards working.

---

### P23 — Layout Components (Sidebar + Topbar)
**Objective:** Build the persistent app shell.

**Sidebar:**
- Fixed 240px left panel, `bg-bg-card`
- Logo area at top
- Nav links with icons (Lucide): Dashboard, Vehicles, Customers, Test Drives, Sales, Service, Commissions
- Links shown/hidden based on user role
- Active link highlighted with `text-accent-blue bg-bg-elevated`
- Bottom: user avatar + name + logout button

**Topbar:**
- 64px height, `bg-bg-card border-b border-bg-border`
- Current page title on left
- User role badge and name on right

**PageWrapper:** Main content area with left `ml-60` offset and `p-6` padding.

**Deliverable:** App shell renders for all authenticated pages.

---

### P24 — Login Page
**Objective:** Build the login UI and wire up to auth API.

- Full-screen centered card on `bg-bg-primary`
- AutoEdge logo/title at top
- Email + Password inputs (styled per design system)
- Submit button calls `POST /api/v1/auth/login`
- On success: store token + user in authStore, redirect to `/dashboard`
- On failure: show error message in red below form
- No "Sign up" link (admin creates users)

**[GATE]:** Login with `admin@autoedge.com / Admin@1234` redirects to `/dashboard`.

---

### P25 — Vehicles Module UI [P]
**Objective:** Build all vehicle pages.

**VehiclesPage:**
- Filter bar: status dropdown (All/Available/Reserved/Sold), search input (make/model)
- Data table: thumbnail placeholder, Make, Model, Year, Color, Price, Status badge, Actions
- Status badges use colors from design system
- Add Vehicle button (top right) → `/vehicles/new`
- Pagination (10 per page)

**VehicleFormPage (Create/Edit):**
- Form fields: make, model, year, color, fuel_type, transmission, body_type, condition_type, mileage_km, vin_number, price, notes
- Submit calls POST or PUT accordingly

**VehicleDetailPage:**
- All vehicle info displayed in a card
- Status badge prominent
- Edit button (authorized roles only)

**[GATE]:** Vehicle list loads and displays all 8 seed vehicles.

---

### P26 — Customers + Test Drives UI [P]
**Objective:** Build customer management and test drive booking pages.

**CustomersPage:**
- Search bar (name, phone, email)
- Table: Name, Phone, Email, Address, Actions
- Add Customer button

**TestDrivesPage:**
- Filter by status and lead status
- Table: Customer, Vehicle, Assigned Staff, Date, Status, Lead Status
- Status and Lead badges with appropriate colors
- Book Test Drive button → opens form

**TestDriveFormPage:**
- Dropdowns: select customer (searchable), select available vehicle (searchable)
- Date picker for scheduled date
- Assign to staff member (sales_executive)
- Notes textarea

**[GATE]:** Create a test drive booking via UI form and see it appear in the list.

---

### P27 — Sales + Commissions UI [P]
**Objective:** Build sales recording and commission tracking pages.

**SalesPage:**
- Table: Vehicle, Customer, Staff, Sale Date, Price, Payment Type, Status
- Record Sale button → form

**SaleFormPage:**
- Select sold vehicle (only Available/Reserved), select customer, sale price, discount, payment type
- Auto-shows commission preview: price × 2.5%

**CommissionsPage:**
- Manager view: table of all commissions with staff name, sale info, amount, status
- Sales executive view: own commissions only
- Manager can click commission row to approve/mark paid

**[GATE]:** Record a sale, then check Commissions page — commission auto-appears.

---

### P28 — Service Module UI + Dashboard [P]
**Objective:** Build service jobs UI and manager dashboard.

**ServicePage:**
- Filter by status, technician
- Table: Vehicle, Customer, Job Type, Technician, Date, Status, Cost
- Create Service Job button

**ServiceJobDetail (modal or page):**
- Job info at top
- Parts sub-table with Add Part button
- Update status dropdown

**DashboardPage (manager only):**
- 5 KPI stat cards (total vehicles, available, sold this month, revenue, pending jobs)
- Monthly revenue BarChart (Recharts) — last 12 months
- Top Staff table with commission totals

**[GATE]:** Dashboard loads and charts display with real data from API.

---

### P29 — Deployment + Final Testing
**Objective:** Deploy full stack to production and verify everything works live.

**Backend to Railway:**
```bash
cd backend
railway login
railway init
railway link
railway variables set DATABASE_URL=... SECRET_KEY=... CORS_ORIGINS=https://your-app.vercel.app
railway up
```

**Frontend to Vercel:**
```bash
cd frontend
vercel login
vercel
# Set environment variable: VITE_API_BASE_URL=https://your-backend.railway.app
vercel --prod
```

**Final Checks:**
```
- [ ] Live frontend URL loads login page
- [ ] Login works with all 4 test accounts
- [ ] Vehicles list loads data from live DB
- [ ] Add vehicle form works
- [ ] Test drive booking works
- [ ] Record sale auto-marks vehicle as Sold
- [ ] Commission appears after sale
- [ ] Service job + parts workflow works
- [ ] Manager dashboard shows charts with real data
- [ ] FastAPI /docs accessible at backend URL
- [ ] No CORS errors in browser console
- [ ] Mobile layout looks correct at 375px
- [ ] GitHub repo is public with README
```

**Deliverable:** AutoEdge is live, publicly accessible, and fully functional.

---

## LOCAL DEVELOPMENT SETUP

```bash
# 1. Clone repo
git clone https://github.com/YOUR_USERNAME/autoedge.git
cd autoedge

# 2. Backend setup
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # Fill in your Neon DATABASE_URL and SECRET_KEY
alembic upgrade head
psql $DATABASE_URL -f database/seed.sql
uvicorn app.main:app --reload --port 8000

# 3. Frontend setup (new terminal)
cd frontend
npm install
cp .env.example .env   # Set VITE_API_BASE_URL=http://localhost:8000
npm run dev
```

**Dev URLs:**
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000`
- API Docs (Swagger): `http://localhost:8000/docs`

---

## SUMMARY FOR agy CLI

When using this spec with Antigravity agy CLI:

1. Feed this entire `.md` file as the project specification
2. Execute phases **sequentially** P01 → P29
3. At every `[GATE]` checkpoint, run the verification command before continuing
4. Phases marked `[P]` (P12-P19, P25-P28) can be parallelized if the agent supports it
5. All SQL schema and indexes are in the **DATABASE SCHEMA** section — use exactly as written
6. Never skip the `alembic upgrade head` step (P06) — the DB must exist before any backend code
7. Seed data (P08) must run before any frontend testing
8. Use the `/sp.specify` → `/sp.plan` → `/sp.tasks` flow if running within full Spec Kit Plus environment

---

*End of AutoEdge Specification — Version 1.0.0*
