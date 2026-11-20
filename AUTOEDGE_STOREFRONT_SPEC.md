# AutoEdge — Customer Storefront Extension
## Spec-Driven Project Specification v2.0 (Spec Kit Plus Format) — Phases P30 → P48

> **Project:** AutoEdge Car Showroom — Public Storefront + Customer Accounts  
> **Author:** Mustafa Shams  
> **Course:** Database Systems  
> **Builds on:** `AUTOEDGE_SPEC.md` v1.0 (phases P01–P29, already complete and deployed)  
> **AI Build Tool:** Antigravity IDE + agy CLI + Spec Kit Plus  
> **Deadline:** about 2.5–3 weeks from 2026-11-01 (see TIMELINE AND CUT-LINES)  
> **Date:** 2026-11-01

---

## 0. HOW TO USE THIS DOCUMENT (READ FIRST)

1. This spec **extends** v1.0. Do not rebuild anything that already exists (staff login, dashboard, vehicles, customers, test drives, sales, service, commissions). Extend it.
2. **Inspect the existing code before changing it.** Where this spec and the existing code disagree about a name or signature, follow the existing code and note the difference in your phase report.
3. Known corrections to v1.0 (the live code already differs from the v1.0 text):
   - Password hashing uses the raw **`bcrypt`** library (`bcrypt.hashpw` / `bcrypt.checkpw`) in `app/core/security.py`, NOT passlib.
   - Python is **3.11**. Dependencies are pinned in `backend/requirements.txt` (psycopg2-binary 2.9.13, pydantic 2.10.6, pydantic-settings 2.7.0). Do not upgrade them.
   - The staff frontend reads `VITE_API_BASE_URL` WITHOUT `/api/v1` at the end; the code appends `/api/v1/...`. The storefront does the same.
   - Backend is deployed on Railway with Root Directory `/backend`; frontend on Vercel with Root Directory `frontend`. The storefront will be a **second** Vercel project with Root Directory `storefront`.
4. Execute phases in order P30 → P48. Run every `[GATE]` before continuing. `[P]` means the phase may run in parallel with its neighbours.
5. After each phase print: `Phase PXX complete. Proceeding to PYY.` and list files changed.
6. **Ambiguity rule — ASK THE OWNER, never guess and never silently pick "the simplest option".**
   Whenever something is genuinely unclear AND the answer changes behaviour, data, money, security, cost or what the owner will see (a business rule this spec does not cover, a choice between two designs, a missing credential, a conflict between this spec and the existing code, a risky or irreversible action), STOP before building that part and ask. Every question must contain:
   - (a) the question in one plain sentence (the owner is non-technical; avoid jargon);
   - (b) one line on why it matters;
   - (c) 2 to 4 concrete options, each with a one-line consequence, your recommended option FIRST and marked `(Recommended)`;
   - (d) an extra choice: `Or type your own answer`.
   Use the IDE's question/choice UI if it has one; otherwise print a numbered list in chat and wait. After the owner answers, record it in `docs/DECISIONS.md` (date, phase, question, chosen option) and continue according to the answer.
   Do NOT ask about trivia that changes no behaviour (file names inside the agreed structure, spacing, icon choice, variable names): decide those yourself. If several questions come up in one phase, ask them together in ONE batch. If the owner has not answered yet, finish every part that does not depend on the answer and leave the blocked part unbuilt.
7. After every phase that touches the schema, update `backend/database/schema.sql` (documentation copy) AND create an Alembic revision. Run the old smoke tests (`tests/test_routes.py`) — they must still pass.
8. **Session handoff (guidance, to save the owner's free-tier usage).** The owner works on free limits and often has to continue in a fresh session or on another account. A fresh session that rereads the whole repository and every `.md` file burns a large part of the new limit before any work is done. So, as a direction (use judgement, not a rigid rule):
   - **Keep `docs/HANDOFF.md` up to date** using the template in 0.1: refresh it after every finished phase, after every answer the owner gives, and whenever the session looks like it may stop soon (very long session, usage warnings). Keep it to about one page.
   - **At the start of a session**, if `docs/HANDOFF.md` exists, read it FIRST and prefer not to re-read the whole repository or every `.md` file. Open only the files it points to and only the parts of this spec that the next step needs.
   - **Then verify before building**: run the "Re-check first" list in the handoff. If something fails, fix it before any new work (the last session may have been cut off half-way). If everything passes, continue from "Next step".
   - **If the handoff is missing or looks stale** (for example it says P37 is done but the code or `git log` disagrees), rebuild it with a light inspection (`git log --oneline -20`, `alembic current`, run the tests) instead of reading everything, and ask the owner if something is still unclear.
   - Keep the handoff short: point to file paths instead of pasting code or long logs. Detailed owner answers stay in `docs/DECISIONS.md`. Never write secrets (API keys, passwords, connection strings) in it.

### 0.1 `docs/HANDOFF.md` template

```
# HANDOFF — AutoEdge Storefront
Last updated: <date and time> by <session or account label>
Current phase: P__ — status: not started | in progress | done | gate failed

## Done
- P__: <one line of what exists now> — key files: <paths>

## Half-done / in progress
- <what was started but not finished, and exactly where it stopped>

## Next step (do this first after the re-check)
- <the very next concrete action>

## Not done yet (in order)
- P__ …

## Waiting on the owner
- <question + the options that were offered>   (or "nothing")

## Re-check first (the new session runs these before any new work)
- [ ] <gate or command for the last finished phase, with the expected result>
- [ ] `pytest tests/test_routes.py` (old features must still pass)
- [ ] <anything risky the last session touched>

## Known problems and workarounds
- <issue — what was tried — current workaround>

## Setup facts (names only, never secret values)
- Env variables already set locally: <names>; still missing: <names>
- Where things live: spec `AUTOEDGE_STOREFRONT_SPEC.md`, answers `docs/DECISIONS.md`, seed `backend/database/storefront_seed.py`
```

---

## 1. CONSTITUTION ADDENDUM (in addition to Articles I–X of v1.0)

```
ARTICLE XI   — Money is Decimal: All amounts use NUMERIC in the DB and Decimal in Python. Never float.
ARTICLE XII  — One Transaction per Business Action: Reserve, cancel, expire, refund, service-fee payment and
               sale completion each run inside ONE database transaction that either fully commits or fully
               rolls back (stock, balance, ledger rows and status change together).
ARTICLE XIII — Lock Order: When a transaction locks rows it ALWAYS locks in this order:
               vehicle row -> reservation/booking row -> bank_account row. This prevents deadlocks.
ARTICLE XIV  — Token Scope Separation: Staff tokens and customer tokens are different "scopes". A customer
               token must never work on a staff endpoint and vice versa.
ARTICLE XV   — Ownership from Token, Not Body: Every /store/me/* endpoint takes customer_id from the verified
               token. A customer_id in a request body is ignored or rejected.
ARTICLE XVI  — Hash via the App: Seed scripts must create password hashes by calling
               app.core.security.hash_password(). Never paste a hash from another tool (this caused a
               401 bug during P29).
ARTICLE XVII — Theme Tokens Only (storefront): All colours, radii, fonts come from tailwind.config.js tokens.
               No hard-coded hex values and no inline colour styles inside components. Reason: the owner will
               redesign the storefront look later; one token file must be enough to restyle it.
ARTICLE XVIII— Demo Honesty: The bank, payments and emails are simulated. The UI must never ask for a real
               card number, and must show a small "Demo project — no real money" note near payment screens.
ARTICLE XIX  — Ask, Don't Assume: Follow the Ambiguity rule in section 0, item 6. When something unclear
               changes behaviour, data, money, security or cost, ask the owner with options and wait.
ARTICLE XX   — Lawful Images Only: Car photos come ONLY from sources with an official API or an open licence
               (Pexels API, Wikimedia Commons). Never scrape Google/Bing Images or other sites. Always keep the
               photographer credit and source link, and show the credit on the storefront.
```

Article X (dark theme only) still applies to the storefront for now, using the SAME palette as the staff dashboard.

---

## 2. KEY DECISIONS (already agreed with the owner)

| Topic | Decision |
|---|---|
| Architecture | ONE backend (Railway) + ONE database (Neon). TWO frontends: `frontend/` (staff, existing) and `storefront/` (public, new, own Vercel project and URL). |
| Public vs login | Browsing is public: home, inventory, car details, reviews, compare, EMI calculator, service info, about, contact. Login is required for: test drive, enquiry, reserve/pay, wishlist, reviews, trade-in, service booking, restock request. |
| Logged-in view | A logged-in customer still sees the normal website; the navbar just gains extra items (wishlist, notifications, My Account menu). |
| Signup | Full name, phone, email, password, confirm password. Email must be unique (case-insensitive). Phone is required because `customers.phone` is NOT NULL. |
| Login | Email + password. Trim whitespace and lower-case the email before use. Generic error message. |
| Buying | NOT a cart. Customer **reserves** a car by paying an advance deposit from a simulated bank account. Remaining balance is paid at the showroom; staff completes the sale. |
| Stock | `vehicles.stock_quantity` counts units still available to reserve or sell. Reserving takes 1 unit off. Out-of-stock cars stay listed, shaded, with a "Request this car" button. |
| Reservation hold | Customer chooses 7 to 30 days. Deposit = 10% of price (configurable). |
| Test drive | Customer sends a request for a date and hourly slot. Staff must confirm within 48 hours or it expires automatically. |
| Payments | Simulated bank: each customer gets a demo bank account with a starting balance, a ledger/statement, top-up and refunds. Confirm each payment by re-entering the account password. |
| Email | Every email is first written to `email_outbox`. Sent through an HTTPS email API only to real addresses. Fake/demo addresses are marked `Suppressed`. In-app notifications always work for everyone. |
| Enquiries inbox | Staff-side, visible only to the manager and to staff who have `handles_enquiries = true` (and a suitable role). |
| Theme | Same dark theme as dashboard for now. Redesign comes after the project. |
| Questions | When something unclear changes behaviour, money, data, security or cost, the agent asks the owner with 2–4 options (recommended first) plus "type your own answer", waits, records the answer in `docs/DECISIONS.md`, then continues. It does not silently pick the simplest option. |
| Car photos | Found automatically from the internet by a script (Pexels API first, Wikimedia Commons as fallback), with photographer credit shown. No manual photo hunting. |
| Session handoff | The owner switches free-tier accounts often. The agent keeps a one-page `docs/HANDOFF.md` (done, half-done, next step, waiting on owner, re-check list) so a new session reads that first instead of rereading the whole repo, verifies the re-check list, then continues. |

---

## 3. ARCHITECTURE

```
 Customer browser ──► storefront (Vercel #2)  ─┐
                                               ├──► FastAPI backend (Railway) ──► Neon PostgreSQL
 Staff browser    ──► frontend   (Vercel #1)  ─┘
```

### 3.1 API namespaces

| Prefix | Auth | Used by |
|---|---|---|
| `/api/v1/public/*` | none | storefront (catalog, technicians, slots) |
| `/api/v1/store/auth/*` | none | storefront (register, login, check-email) |
| `/api/v1/store/*` | customer token | storefront (everything personal) |
| `/api/v1/*` (existing + new staff routes) | staff token | staff dashboard |

### 3.2 Token scopes (Article XIV)

- Staff token payload: `{"sub": "<staff email>", "scope": "staff", "role": "<role>", "exp": ...}`
- Customer token payload: `{"sub": "customer:<account_id>", "scope": "customer", "role": "customer", "customer_id": <int>, "exp": ...}`
- Update `create_access_token` callers so staff tokens now include `"scope": "staff"`.
- `get_current_user` (staff) rejects any token whose `scope != "staff"` with 401. Tokens with no scope are also rejected (staff simply log in again once).
- New dependency `get_current_customer` rejects any token whose `scope != "customer"` with 401 and loads the `customer_accounts` row; inactive accounts get 403.
- **[GATE in P32]:** a customer token sent to `GET /api/v1/users` or `GET /api/v1/sales` returns 401/403; a staff token sent to `GET /api/v1/store/me` returns 401.

### 3.3 Time handling

Add `app/core/time.py` with `utcnow()` returning a naive UTC `datetime` (`datetime.now(timezone.utc).replace(tzinfo=None)`). Use it for every timestamp written by the new code. Slot times (`scheduled_time`, `time_slot`) are naive showroom-local times; the showroom timezone is `SHOWROOM_TIMEZONE` (default `Asia/Karachi`) and is used only to decide whether a slot is in the past.

---

## 4. ENVIRONMENT VARIABLES

### 4.1 Backend (Railway) — add to existing

```
CORS_ORIGINS=https://autoedge-three.vercel.app,https://<STOREFRONT>.vercel.app,http://localhost:5173,http://localhost:5174
STORE_BASE_URL=https://<STOREFRONT>.vercel.app      # used for links inside emails
SHOWROOM_TIMEZONE=Asia/Karachi

DEMO_STARTING_BALANCE=50000.00
RESERVATION_DEPOSIT_PERCENT=10
RESERVATION_MIN_HOLD_DAYS=7
RESERVATION_MAX_HOLD_DAYS=30
CANCELLATION_FEE_PERCENT=10                          # kept from the deposit on cancel or expiry
MAX_ACTIVE_RESERVATIONS_PER_CUSTOMER=3
MAX_ACTIVE_TEST_DRIVES_PER_CUSTOMER=3
TEST_DRIVE_REQUEST_EXPIRY_HOURS=48
TRADE_IN_OFFER_VALID_DAYS=7

EMAIL_PROVIDER=brevo                                 # brevo | sendgrid | none
EMAIL_API_KEY=
EMAIL_FROM_ADDRESS=                                  # must be a sender verified at the provider
EMAIL_FROM_NAME=AutoEdge
EMAIL_SUPPRESS_DOMAINS=example.com,example.org,example.net,email.com,test.com,autoedge.com

# LOCAL ONLY (put in backend/.env on the owner's computer; NOT needed on Railway). Used by fetch_vehicle_images.py
PEXELS_API_KEY=
CLOUDINARY_API_KEY=          # only needed if --rehost-cloudinary is used
CLOUDINARY_API_SECRET=
```

### 4.2 Storefront (Vercel #2)

```
VITE_API_BASE_URL=https://autoedge-production.up.railway.app     # no /api/v1 at the end, no trailing slash
VITE_CLOUDINARY_CLOUD_NAME=
VITE_CLOUDINARY_UPLOAD_PRESET=autoedge_tradein
```

`storefront/.env` must be git-ignored; commit `storefront/.env.example` with local values (`http://localhost:8000`).

---

## 5. FOLDER STRUCTURE ADDITIONS

```
autoedge/
├── frontend/                         # existing staff dashboard (extended in P46)
├── storefront/                       # NEW public site (React 18 + Vite + Tailwind + React Router + Axios + TanStack Query)
│   ├── public/
│   ├── src/
│   │   ├── api/                      # axiosInstance.js, publicApi.js, storeAuthApi.js, accountApi.js, ...
│   │   ├── components/
│   │   │   ├── layout/               # Navbar.jsx, Footer.jsx, AccountLayout.jsx
│   │   │   ├── cars/                 # CarCard.jsx, CarGrid.jsx, FilterBar.jsx, ImageGallery.jsx, SpecTable.jsx, StockBadge.jsx, CompareBar.jsx
│   │   │   ├── payment/              # BankCard.jsx, CheckoutModal.jsx, ProcessingSteps.jsx, Receipt.jsx
│   │   │   ├── common/               # ProtectedRoute, EmptyState, LoadingSpinner, StatusBadge, StarRating, ConfirmDialog, ImageWithFallback
│   │   │   └── forms/                # ImageUploader.jsx (Cloudinary), PasswordField.jsx (with eye toggle)
│   │   ├── pages/
│   │   │   ├── public/               # HomePage, InventoryPage, CarDetailPage, ComparePage, EmiPage, ServiceInfoPage, TradeInInfoPage, AboutPage, ContactPage
│   │   │   ├── auth/                 # LoginPage, SignupPage
│   │   │   └── account/              # OverviewPage, ProfilePage, BankPage, ReservationsPage, TestDrivesPage, EnquiriesPage, EnquiryThreadPage,
│   │   │                             # TradeInsPage, TradeInFormPage, GaragePage, ServiceBookingsPage, ServiceBookingFormPage,
│   │   │                             # WishlistPage, ReviewsPage, NotificationsPage, ReceiptPage
│   │   ├── hooks/                    # useAuth, useCompare, useDebounce
│   │   ├── store/                    # authStore.js (customer token in sessionStorage)
│   │   ├── utils/                    # formatters.js, emi.js, validators.js
│   │   ├── router/AppRouter.jsx
│   │   ├── App.jsx, main.jsx
│   ├── index.html, tailwind.config.js (SAME tokens as staff app), vite.config.js, vercel.json, package.json
│
└── backend/
    └── app/
        ├── api/routes/
        │   ├── public/               # catalog.py, service_info.py
        │   ├── store/                # auth.py, account.py, bank.py, reservations.py, test_drives.py, enquiries.py, trade_ins.py,
        │   │                         # garage.py, service_bookings.py, reviews.py, wishlist.py, restock.py, notifications.py
        │   └── staff additions       # enquiries.py, trade_ins.py, restock.py, reservations.py, service_bookings.py, reviews.py, email_log.py
        ├── services/                 # NEW: multi-table transactional logic (plain functions)
        │   ├── bank_service.py       # debit, credit, top_up, statement (row-locked)
        │   ├── reservation_service.py# reserve, cancel, expire_stale, convert_on_sale
        │   ├── stock_service.py      # change_stock (writes stock_movements, notifies restock requesters)
        │   ├── test_drive_service.py # request, confirm, decline, expire
        │   ├── service_booking_service.py
        │   ├── notify_service.py     # notify(customer_id, type, title, message, link) -> notification + email_outbox row
        │   ├── email_service.py      # provider adapters, suppression rules
        │   └── email_templates.py
        ├── models/                   # one model file per new table
        ├── schemas/                  # Pydantic v2 schemas (explicit allow-list for public schemas)
        └── crud/                     # plain functions as in v1.0
    ├── database/
    │   ├── storefront_schema.sql     # documentation copy of all new DDL (section 6)
    │   ├── storefront_seed.py        # python seed (uses hash_password)
    │   ├── fetch_vehicle_images.py   # NEW: finds car photos on the internet automatically (see 12.1)
    │   ├── vehicle_images.json       # written by the fetch script: {"Make|Model|Year": [{url, credit, source_url, license}, ...]}
    │   └── vehicle_images_preview.html # contact sheet so the owner can eyeball the chosen photos
    └── tests/                        # test_store_auth.py, test_reservations.py, test_race.py, test_expiry.py, ...
```

---

## 6. DATABASE CHANGES

> 19 new tables (total 27). Create them in the order shown (foreign keys depend on order).  
> Alembic autogenerate cannot create partial-index WHERE clauses reliably, CHECK replacements, functions, triggers or views. Write those with `op.execute(...)`.  
> Suggested revisions: `0002_store_tables`, `0003_store_alterations`, `0004_store_triggers_views`.

### 6.1 New tables

```sql
CREATE SEQUENCE txn_ref_seq START 1;

-- 1. customer accounts (login identity for the storefront)
CREATE TABLE customer_accounts (
    account_id     SERIAL PRIMARY KEY,
    customer_id    INTEGER      NOT NULL UNIQUE REFERENCES customers(customer_id) ON DELETE CASCADE,
    email          VARCHAR(150) NOT NULL UNIQUE,
    password_hash  VARCHAR(255) NOT NULL,
    is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
    email_verified BOOLEAN      NOT NULL DEFAULT FALSE,
    last_login_at  TIMESTAMP,
    created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_ca_email_lower CHECK (email = LOWER(TRIM(email)))
);

-- 2. extra vehicle photos (main photo lives in vehicles.main_image_url)
CREATE TABLE vehicle_images (
    image_id   SERIAL PRIMARY KEY,
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(vehicle_id) ON DELETE CASCADE,
    image_url  TEXT    NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    credit     TEXT,                    -- e.g. 'Photo by Jane Doe on Pexels'
    source_url TEXT                     -- page where the photo was found (for attribution)
);
CREATE INDEX idx_vimg_vehicle ON vehicle_images(vehicle_id, sort_order);

-- 3. reservations (advance-deposit holds)
CREATE TABLE reservations (
    reservation_id SERIAL PRIMARY KEY,
    customer_id    INTEGER       NOT NULL REFERENCES customers(customer_id) ON DELETE RESTRICT,
    vehicle_id     INTEGER       NOT NULL REFERENCES vehicles(vehicle_id)   ON DELETE RESTRICT,
    deposit_amount NUMERIC(12,2) NOT NULL CHECK (deposit_amount > 0),
    hold_days      INTEGER       NOT NULL CHECK (hold_days BETWEEN 7 AND 30),
    reserved_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at     TIMESTAMP     NOT NULL,
    status         VARCHAR(15)   NOT NULL DEFAULT 'Active'
                   CHECK (status IN ('Active','Converted','Cancelled','Expired')),
    closed_at      TIMESTAMP,
    notes          TEXT
);
CREATE INDEX idx_res_customer ON reservations(customer_id);
CREATE INDEX idx_res_vehicle  ON reservations(vehicle_id);
CREATE INDEX idx_res_status   ON reservations(status);
CREATE INDEX idx_res_expiry   ON reservations(expires_at) WHERE status = 'Active';
CREATE UNIQUE INDEX uq_res_active_per_customer_vehicle ON reservations(customer_id, vehicle_id) WHERE status = 'Active';

-- 4. customer-owned cars ("My Garage")
CREATE TABLE customer_vehicles (
    cv_id          SERIAL PRIMARY KEY,
    customer_id    INTEGER     NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    make           VARCHAR(50) NOT NULL,
    model          VARCHAR(50) NOT NULL,
    year           INTEGER     NOT NULL,
    color          VARCHAR(40),
    plate_number   VARCHAR(20),
    vin_number     VARCHAR(30),
    source_sale_id INTEGER REFERENCES sales(sale_id) ON DELETE SET NULL,   -- set when bought from AutoEdge
    created_at     TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_cv_customer ON customer_vehicles(customer_id);
CREATE UNIQUE INDEX uq_cv_plate ON customer_vehicles(customer_id, plate_number) WHERE plate_number IS NOT NULL;

-- 5. service catalogue
CREATE TABLE service_types (
    service_type_id    SERIAL PRIMARY KEY,
    name               VARCHAR(60)   NOT NULL UNIQUE,
    description        TEXT,
    base_price         NUMERIC(10,2) NOT NULL,
    booking_fee        NUMERIC(8,2)  NOT NULL,
    duration_minutes   INTEGER       NOT NULL DEFAULT 60,   -- informational only
    required_specialty VARCHAR(30),                         -- NULL = any technician
    is_active          BOOLEAN       NOT NULL DEFAULT TRUE
);

-- 6. technician public profiles (choose-your-mechanic feature)
CREATE TABLE technician_profiles (
    user_id          INTEGER PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    specialty        VARCHAR(30) NOT NULL
                     CHECK (specialty IN ('Mechanic','Electrician','AC Specialist','Body & Paint','Tyre & Alignment')),
    years_experience INTEGER     NOT NULL DEFAULT 0,
    bio              TEXT,
    photo_url        TEXT,
    is_bookable      BOOLEAN     NOT NULL DEFAULT TRUE
);

-- 7. service bookings made from the storefront
CREATE TABLE service_bookings (
    booking_id      SERIAL PRIMARY KEY,
    customer_id     INTEGER       NOT NULL REFERENCES customers(customer_id)        ON DELETE RESTRICT,
    cv_id           INTEGER       NOT NULL REFERENCES customer_vehicles(cv_id)       ON DELETE RESTRICT,
    service_type_id INTEGER       NOT NULL REFERENCES service_types(service_type_id),
    technician_id   INTEGER       REFERENCES users(user_id),      -- NULL = "no preference", assigned on confirm
    booking_date    DATE          NOT NULL,
    time_slot       TIME          NOT NULL,
    notes           TEXT,
    fee_amount      NUMERIC(8,2)  NOT NULL,
    status          VARCHAR(15)   NOT NULL DEFAULT 'Booked'
                    CHECK (status IN ('Booked','Confirmed','Completed','Cancelled','No-Show')),
    service_job_id  INTEGER       REFERENCES service_jobs(job_id) ON DELETE SET NULL,
    created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_sb_customer ON service_bookings(customer_id);
CREATE INDEX idx_sb_status   ON service_bookings(status);
CREATE INDEX idx_sb_date     ON service_bookings(booking_date);
CREATE UNIQUE INDEX uq_sb_tech_slot ON service_bookings(technician_id, booking_date, time_slot)
    WHERE technician_id IS NOT NULL AND status IN ('Booked','Confirmed');

-- 8. simulated bank
CREATE TABLE bank_accounts (
    bank_account_id SERIAL PRIMARY KEY,
    customer_id     INTEGER       NOT NULL UNIQUE REFERENCES customers(customer_id) ON DELETE CASCADE,
    bank_name       VARCHAR(60)   NOT NULL DEFAULT 'AutoEdge Demo Bank',
    account_number  VARCHAR(20)   NOT NULL UNIQUE,            -- e.g. 'AE' + 10 random digits
    card_last4      CHAR(4)       NOT NULL,                   -- display only; never store a full card number
    balance         NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),   -- DB-level insufficient-funds guard
    created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bank_transactions (
    txn_id             SERIAL PRIMARY KEY,
    bank_account_id    INTEGER       NOT NULL REFERENCES bank_accounts(bank_account_id) ON DELETE CASCADE,
    txn_type           VARCHAR(30)   NOT NULL
                       CHECK (txn_type IN ('Opening Balance','Top Up','Reservation Deposit','Service Booking Fee','Refund')),
    direction          VARCHAR(6)    NOT NULL CHECK (direction IN ('Credit','Debit')),
    amount             NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    balance_after      NUMERIC(14,2) NOT NULL,
    reference_code     VARCHAR(30)   NOT NULL UNIQUE,         -- 'TXN-YYYYMMDD-' || lpad(nextval('txn_ref_seq'),6,'0')
    idempotency_key    VARCHAR(64)   UNIQUE,                  -- stops double charging on double-click / retry
    description        VARCHAR(200),
    reservation_id     INTEGER REFERENCES reservations(reservation_id)       ON DELETE SET NULL,
    service_booking_id INTEGER REFERENCES service_bookings(booking_id)       ON DELETE SET NULL,
    created_at         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_bt_account_date ON bank_transactions(bank_account_id, created_at DESC);
CREATE INDEX idx_bt_reservation  ON bank_transactions(reservation_id);
CREATE INDEX idx_bt_booking      ON bank_transactions(service_booking_id);

-- 9. inventory ledger (every stock change is explained)
CREATE TABLE stock_movements (
    movement_id  SERIAL PRIMARY KEY,
    vehicle_id   INTEGER     NOT NULL REFERENCES vehicles(vehicle_id) ON DELETE CASCADE,
    change_qty   INTEGER     NOT NULL CHECK (change_qty <> 0),
    reason       VARCHAR(30) NOT NULL
                 CHECK (reason IN ('Reservation','Reservation Cancelled','Reservation Expired','Sale','Restock','Manual Adjustment')),
    reference_id INTEGER,                                     -- reservation_id / sale_id / NULL
    created_by   INTEGER REFERENCES users(user_id),           -- NULL when done by a customer or the system
    created_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_sm_vehicle ON stock_movements(vehicle_id, created_at DESC);

-- 10. "Request this car" demand signal
CREATE TABLE restock_requests (
    request_id   SERIAL PRIMARY KEY,
    customer_id  INTEGER     NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    vehicle_id   INTEGER     NOT NULL REFERENCES vehicles(vehicle_id)   ON DELETE CASCADE,
    status       VARCHAR(12) NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','Fulfilled','Withdrawn')),
    created_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fulfilled_at TIMESTAMP
);
CREATE INDEX idx_rr_vehicle_status ON restock_requests(vehicle_id, status);
CREATE UNIQUE INDEX uq_rr_open ON restock_requests(customer_id, vehicle_id) WHERE status = 'Open';

-- 11. enquiries (conversation threads)
CREATE TABLE enquiries (
    enquiry_id  SERIAL PRIMARY KEY,
    customer_id INTEGER      NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    vehicle_id  INTEGER      REFERENCES vehicles(vehicle_id) ON DELETE SET NULL,   -- NULL = general enquiry
    subject     VARCHAR(150) NOT NULL,
    status      VARCHAR(10)  NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','Answered','Closed')),
    assigned_to INTEGER      REFERENCES users(user_id),
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_enq_customer ON enquiries(customer_id);
CREATE INDEX idx_enq_status   ON enquiries(status, updated_at DESC);
CREATE INDEX idx_enq_assigned ON enquiries(assigned_to);

CREATE TABLE enquiry_messages (
    message_id     SERIAL PRIMARY KEY,
    enquiry_id     INTEGER     NOT NULL REFERENCES enquiries(enquiry_id) ON DELETE CASCADE,
    sender_type    VARCHAR(10) NOT NULL CHECK (sender_type IN ('customer','staff')),
    sender_user_id INTEGER     REFERENCES users(user_id),        -- set when sender_type = 'staff'
    body           TEXT        NOT NULL,
    created_at     TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_em_enquiry ON enquiry_messages(enquiry_id, created_at);

-- 12. trade-in requests
CREATE TABLE trade_in_requests (
    trade_in_id        SERIAL PRIMARY KEY,
    customer_id        INTEGER       NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    target_vehicle_id  INTEGER       REFERENCES vehicles(vehicle_id) ON DELETE SET NULL,   -- car they want to buy (optional)
    make               VARCHAR(50)   NOT NULL,
    model              VARCHAR(50)   NOT NULL,
    year               INTEGER       NOT NULL,
    mileage_km         INTEGER       NOT NULL CHECK (mileage_km >= 0),
    color              VARCHAR(40),
    condition_rating   VARCHAR(10)   NOT NULL CHECK (condition_rating IN ('Excellent','Good','Fair','Poor')),
    description        TEXT,
    expected_price     NUMERIC(12,2),
    indicative_low     NUMERIC(12,2),               -- computed at submission (see section 7.7), informational
    indicative_high    NUMERIC(12,2),
    status             VARCHAR(15)   NOT NULL DEFAULT 'Submitted'
                       CHECK (status IN ('Submitted','Under Review','Offer Made','Accepted','Declined','Expired','Completed','Cancelled')),
    offered_value      NUMERIC(12,2),
    offer_valid_until  TIMESTAMP,
    appraised_by       INTEGER       REFERENCES users(user_id),
    staff_notes        TEXT,
    created_at         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_ti_customer ON trade_in_requests(customer_id);
CREATE INDEX idx_ti_status   ON trade_in_requests(status);

CREATE TABLE trade_in_images (
    image_id    SERIAL PRIMARY KEY,
    trade_in_id INTEGER   NOT NULL REFERENCES trade_in_requests(trade_in_id) ON DELETE CASCADE,
    image_url   TEXT      NOT NULL,
    uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_tii_trade ON trade_in_images(trade_in_id);

-- 13. reviews
CREATE TABLE reviews (
    review_id   SERIAL PRIMARY KEY,
    vehicle_id  INTEGER     NOT NULL REFERENCES vehicles(vehicle_id)   ON DELETE CASCADE,
    customer_id INTEGER     NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    rating      INTEGER     NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title       VARCHAR(120),
    body        TEXT        NOT NULL,
    is_visible  BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_review_one_per_customer_vehicle UNIQUE (vehicle_id, customer_id)
);
CREATE INDEX idx_rev_vehicle ON reviews(vehicle_id, is_visible);

-- 14. wishlist
CREATE TABLE wishlist_items (
    customer_id INTEGER   NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    vehicle_id  INTEGER   NOT NULL REFERENCES vehicles(vehicle_id)   ON DELETE CASCADE,
    added_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (customer_id, vehicle_id)
);

-- 15. in-app notifications
CREATE TABLE notifications (
    notification_id SERIAL PRIMARY KEY,
    customer_id     INTEGER      NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    type            VARCHAR(40)  NOT NULL,
    title           VARCHAR(150) NOT NULL,
    message         TEXT         NOT NULL,
    link_path       VARCHAR(200),                       -- storefront route, e.g. '/account/reservations'
    is_read         BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_notif_customer ON notifications(customer_id, is_read, created_at DESC);

-- 16. email outbox / log
CREATE TABLE email_outbox (
    email_id      SERIAL PRIMARY KEY,
    customer_id   INTEGER      REFERENCES customers(customer_id) ON DELETE SET NULL,
    to_email      VARCHAR(150) NOT NULL,
    subject       VARCHAR(200) NOT NULL,
    body_html     TEXT         NOT NULL,
    status        VARCHAR(12)  NOT NULL DEFAULT 'Queued' CHECK (status IN ('Queued','Sent','Failed','Suppressed')),
    error_message TEXT,
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at       TIMESTAMP
);
CREATE INDEX idx_eo_status ON email_outbox(status, created_at DESC);
```

(Table count: customer_accounts, vehicle_images, reservations, customer_vehicles, service_types, technician_profiles, service_bookings, bank_accounts, bank_transactions, stock_movements, restock_requests, enquiries, enquiry_messages, trade_in_requests, trade_in_images, reviews, wishlist_items, notifications, email_outbox = 19.)

### 6.2 Alterations to existing tables

```sql
-- users: who handles customer enquiries
ALTER TABLE users ADD COLUMN handles_enquiries BOOLEAN NOT NULL DEFAULT FALSE;

-- vehicles: storefront fields + stock
ALTER TABLE vehicles
    ADD COLUMN stock_quantity INTEGER NOT NULL DEFAULT 1 CHECK (stock_quantity >= 0),
    ADD COLUMN description    TEXT,
    ADD COLUMN main_image_url TEXT,
    ADD COLUMN engine         VARCHAR(60),
    ADD COLUMN horsepower     INTEGER,
    ADD COLUMN seats          INTEGER,
    ADD COLUMN drivetrain     VARCHAR(20),
    ADD COLUMN is_published   BOOLEAN NOT NULL DEFAULT TRUE;
CREATE INDEX idx_vehicles_stock     ON vehicles(stock_quantity);
CREATE INDEX idx_vehicles_published ON vehicles(is_published);
CREATE INDEX idx_vehicles_body      ON vehicles(body_type);
CREATE INDEX idx_vehicles_fuel      ON vehicles(fuel_type);
-- NOTE: vin_number stays UNIQUE/NULLable. A listing with stock > 1 leaves vin_number NULL.

-- test_drives: online requests, time slots, 48h expiry
ALTER TABLE test_drives
    ADD COLUMN scheduled_time TIME,
    ADD COLUMN source         VARCHAR(10) NOT NULL DEFAULT 'Staff' CHECK (source IN ('Staff','Online')),
    ADD COLUMN expires_at     TIMESTAMP;
-- NOTE: look up the REAL constraint name first (SELECT conname FROM pg_constraint WHERE conrelid='test_drives'::regclass AND contype='c';)
-- PostgreSQL normally names it test_drives_status_check, but Alembic/ORM naming may differ. Use whatever name exists.
ALTER TABLE test_drives DROP CONSTRAINT test_drives_status_check;
ALTER TABLE test_drives ADD CONSTRAINT test_drives_status_check
    CHECK (status IN ('Requested','Scheduled','Completed','Cancelled','No-Show','Expired'));
CREATE UNIQUE INDEX uq_td_slot ON test_drives(vehicle_id, scheduled_date, scheduled_time)
    WHERE status IN ('Requested','Scheduled') AND scheduled_time IS NOT NULL;
CREATE INDEX idx_td_expires ON test_drives(expires_at) WHERE status = 'Requested';

-- sales: link to reservation and trade-in, record credits
ALTER TABLE sales
    ADD COLUMN reservation_id  INTEGER REFERENCES reservations(reservation_id),
    ADD COLUMN trade_in_id     INTEGER REFERENCES trade_in_requests(trade_in_id),
    ADD COLUMN deposit_credit  NUMERIC(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN trade_in_credit NUMERIC(12,2) NOT NULL DEFAULT 0;
CREATE INDEX idx_sales_reservation ON sales(reservation_id);

-- service_jobs: a job may belong to a customer-owned car instead of a showroom vehicle
ALTER TABLE service_jobs ALTER COLUMN vehicle_id DROP NOT NULL;
ALTER TABLE service_jobs ADD COLUMN customer_vehicle_id INTEGER REFERENCES customer_vehicles(cv_id) ON DELETE RESTRICT;
ALTER TABLE service_jobs ADD CONSTRAINT chk_sj_vehicle_ref CHECK (vehicle_id IS NOT NULL OR customer_vehicle_id IS NOT NULL);
CREATE INDEX idx_sj_cust_vehicle ON service_jobs(customer_vehicle_id);
```

The existing Service API/UI must show a `vehicle_label` ("2022 Honda Civic") built from whichever of `vehicle_id` / `customer_vehicle_id` is set.

### 6.3 Trigger (keeps legacy `vehicles.status` in sync with stock)

```sql
CREATE OR REPLACE FUNCTION fn_sync_vehicle_status() RETURNS trigger AS $$
BEGIN
    IF NEW.stock_quantity > 0 THEN
        NEW.status := 'Available';
    ELSIF EXISTS (SELECT 1 FROM reservations r WHERE r.vehicle_id = NEW.vehicle_id AND r.status = 'Active') THEN
        NEW.status := 'Reserved';
    ELSE
        NEW.status := 'Sold';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_vehicle_status_sync
BEFORE UPDATE OF stock_quantity ON vehicles
FOR EACH ROW EXECUTE FUNCTION fn_sync_vehicle_status();
```

Application rule: inside a reserve transaction, INSERT the reservation BEFORE decrementing stock so the trigger sees the active reservation and sets `Reserved`.

### 6.4 Views

```sql
CREATE OR REPLACE VIEW v_vehicle_catalog AS
SELECT v.vehicle_id, v.make, v.model, v.year, v.color, v.fuel_type, v.transmission, v.body_type,
       v.condition_type, v.mileage_km, v.price, v.stock_quantity, v.main_image_url, v.description,
       v.engine, v.horsepower, v.seats, v.drivetrain,
       COALESCE(rv.avg_rating, 0)::NUMERIC(3,2) AS avg_rating,
       COALESCE(rv.review_count, 0)             AS review_count,
       COALESCE(rq.open_requests, 0)            AS open_restock_requests
FROM vehicles v
LEFT JOIN (SELECT vehicle_id, AVG(rating) AS avg_rating, COUNT(*) AS review_count
           FROM reviews WHERE is_visible GROUP BY vehicle_id) rv ON rv.vehicle_id = v.vehicle_id
LEFT JOIN (SELECT vehicle_id, COUNT(*) AS open_requests
           FROM restock_requests WHERE status = 'Open' GROUP BY vehicle_id) rq ON rq.vehicle_id = v.vehicle_id
WHERE v.is_published;

CREATE OR REPLACE VIEW v_restock_priority AS
SELECT v.vehicle_id, v.make, v.model, v.year, v.price,
       COUNT(rr.request_id) AS open_requests,
       MIN(rr.created_at)   AS oldest_request_at
FROM vehicles v
JOIN restock_requests rr ON rr.vehicle_id = v.vehicle_id AND rr.status = 'Open'
WHERE v.stock_quantity = 0
GROUP BY v.vehicle_id, v.make, v.model, v.year, v.price
ORDER BY open_requests DESC, oldest_request_at ASC;
```

**[GATE P30]:** `SELECT count(*) FROM information_schema.tables WHERE table_schema='public';` returns 27 (plus `alembic_version`). `SELECT * FROM v_vehicle_catalog LIMIT 1;` runs. Old smoke tests still pass.

---

## 7. BUSINESS RULES

### 7.1 Signup and login

- **Register** (`POST /store/auth/register`): body `{full_name, email, phone, password, confirm_password}`.
  - Trim all strings. Lower-case the email. Reject if `password != confirm_password` (422). Password: min 8 chars, at least one letter and one digit. Phone: 7–20 chars of digits, spaces, `+`, `-`.
  - If `customer_accounts.email` already exists → **409 "An account with this email already exists."**
  - Look for `customers` row with the same email (case-insensitive). If found and it has NO account (a walk-in customer created by staff) → **link** to that row. Otherwise create a new `customers` row. (Known limitation: without email verification, anyone who knows a walk-in customer's email could claim that record. Optional stretch S-1 adds email verification.)
  - In ONE transaction: create/link customer, create account, create `bank_accounts` row (random unique `account_number`, random `card_last4`, balance 0) then credit `DEMO_STARTING_BALANCE` with a `bank_transactions` row of type `Opening Balance`, create welcome notification + email_outbox row.
  - Return token + customer profile (auto-login).
- **Login** (`POST /store/auth/login`, JSON body `{email, password}`): trim + lowercase email; verify with `bcrypt.checkpw`; on any failure return 401 `"Invalid email or password"`; update `last_login_at`.
- `GET /store/auth/check-email?email=` → `{available: true|false}` for live validation in the signup form.
- After login the site stays the normal website. `?next=` query param returns the customer to the page they came from.

### 7.2 Stock and reservation (the core DB showpiece)

`vehicles.stock_quantity` = units still free to reserve or sell.

**Reserve** — `POST /store/reservations` body `{vehicle_id, hold_days (7..30), password, idempotency_key}`:

1. Run `expire_stale()` (cheap) first.
2. Verify the customer's password (bcrypt). Wrong → 401 `"Incorrect password"`, nothing changes.
3. If `idempotency_key` already exists in `bank_transactions` → return the existing reservation with 200 (no second charge).
4. `BEGIN`
   1. `SELECT ... FROM vehicles WHERE vehicle_id=:id AND is_published FOR UPDATE`. If `stock_quantity = 0` → 409 `"Out of stock"`.
   2. Customer must have fewer than `MAX_ACTIVE_RESERVATIONS_PER_CUSTOMER` Active reservations and none Active for this vehicle → else 409.
   3. `deposit = ROUND(price * RESERVATION_DEPOSIT_PERCENT / 100, 2)`.
   4. `SELECT ... FROM bank_accounts WHERE customer_id=:c FOR UPDATE`. If `balance < deposit` → rollback, 402 `"Payment declined: insufficient funds"`.
   5. INSERT `reservations` (`Active`, `expires_at = utcnow() + hold_days`).
   6. UPDATE `bank_accounts` balance minus deposit; INSERT `bank_transactions` (`Debit`, `Reservation Deposit`, `balance_after`, new `reference_code`, `idempotency_key`, `reservation_id`).
   7. UPDATE `vehicles SET stock_quantity = stock_quantity - 1` (trigger syncs `status`); INSERT `stock_movements` (`-1`, `Reservation`, reservation_id).
5. `COMMIT`. After commit (BackgroundTasks): `notify(customer, 'reservation_confirmed', ...)`.

Locking order is always vehicle → reservation → bank account (Article XIII).

**Cancel by customer** — `POST /store/reservations/{id}/cancel`: lock reservation (must be `Active` and owned by the caller) → vehicle → bank account. Refund = `deposit * (100 - CANCELLATION_FEE_PERCENT) / 100`. Credit bank (`Refund` txn), status `Cancelled`, `closed_at`, stock +1 (`Reservation Cancelled`). Notify.

**Expiry** — a reservation past `expires_at` is closed exactly like a cancel with status `Expired` and reason `Reservation Expired`, same refund rule. `expire_stale()` runs: (a) as a background loop every 10 minutes started in FastAPI lifespan, and (b) at the start of catalog listing, reserve, and the customer's own reservation/test-drive/trade-in listings. Use `FOR UPDATE SKIP LOCKED` so concurrent sweeps do not collide. It also expires test drives, and trade-in offers (see below).

**Stock rising from 0 to above 0** (cancel, expiry or restock) → `stock_service.change_stock` notifies every customer with an `Open` restock request for that vehicle (`restock_available` notification) in request order.

**Sale completion** (extends P16): when a sale becomes `Completed` (on POST with that status, or PUT from `Pending`):
- If `reservation_id` supplied: reservation must be `Active`, same vehicle and customer → `status='Converted'`, `closed_at`; set `sales.deposit_credit = deposit_amount`; stock is NOT decremented again.
- Else: lock vehicle; stock must be ≥ 1 (else 409); decrement; `stock_movements` (`Sale`).
- If `trade_in_id` supplied: trade-in must be `Accepted` and belong to the customer → set `trade_in_credit = offered_value`, trade-in `Completed`.
- Balance due at showroom = `sale_price - discount - deposit_credit - trade_in_credit` (show it in the staff sale form).
- Commission creation stays as in v1.0.
- Insert a `customer_vehicles` row (make/model/year/color from the vehicle, `source_sale_id`) so the car appears in the customer's garage.
- Cancelling a `Completed` sale is NOT supported; only `Pending` sales may be cancelled.

### 7.3 Test drive requests (48-hour expiry)

- `POST /store/test-drives` body `{vehicle_id, scheduled_date, scheduled_time, notes}`.
- Allowed slots: hourly `09:00`–`17:00`, Monday–Saturday. Date from today to +30 days; a slot today must start at least 2 hours from now. Vehicle must be published with `stock_quantity > 0`.
- Customer may have at most `MAX_ACTIVE_TEST_DRIVES_PER_CUSTOMER` active (`Requested` or `Scheduled`).
- Insert with `source='Online'`, `status='Requested'`, `lead_status='New'`, `expires_at = LEAST(utcnow() + 48h, slot start)`. The unique index `uq_td_slot` makes two people unable to take the same car and slot (catch `IntegrityError` → 409 "That slot was just taken").
- Staff **confirm** → `status='Scheduled'`, `assigned_to` set, `expires_at = NULL`, notify. Staff **decline** (reason required) → `Cancelled`, notify.
- Nobody confirms in time → `expire_stale()` sets `Expired` and notifies the customer.
- Customer may cancel while `Requested`/`Scheduled` up to 2 hours before the slot.
- `GET /public/test-drive-slots?vehicle_id=&date=` returns each slot with `available: true|false`.

### 7.4 Restock requests ("Request this car")

- Only for vehicles with `stock_quantity = 0`. One `Open` request per customer per vehicle (unique index). Customer can withdraw.
- Public catalog shows `open_restock_requests` ("12 people are waiting").
- Staff page **Restock Priority** reads `v_restock_priority` (most requested first, ties by oldest request). Action **Restock** `{quantity ≥ 1}` → `change_stock(+quantity, 'Restock')`, marks all `Open` requests for that vehicle `Fulfilled` (`fulfilled_at`), notifications go out through the stock-rise rule above.

### 7.5 Enquiries

- Customer starts a thread (optionally about a vehicle). Customer reply sets `status='Open'`; staff reply sets `Answered`; either side may `Close` (customer can re-open by replying).
- Staff access rule `require_enquiry_access`: `role == 'manager'` OR (`role IN ('sales_executive','receptionist')` AND `users.handles_enquiries = TRUE`). Technicians never.
- Staff can "Assign to me" (`assigned_to`). A staff reply triggers `enquiry_replied` notification + email.

### 7.6 Reviews and wishlist

- Review: logged-in customers only; one per (vehicle, customer) (unique constraint). Rating 1–5, body required (min 10 chars). Customer may edit/delete own review. Manager may hide a review (`is_visible=false`).
- "Verified" badge in responses = the customer has a `Completed` test drive OR `Completed` sale for that vehicle (computed with EXISTS, not stored).
- Wishlist: logged-in only; add/remove; stored per account. The heart icon on a card for a logged-out visitor sends them to login with `?next=`.

### 7.7 Trade-in

- `POST /store/trade-ins` body: `{target_vehicle_id?, make, model, year, mileage_km, color, condition_rating, description, expected_price?, image_urls[3..8]}`.
- Every image URL must be `https://res.cloudinary.com/<VITE_CLOUDINARY_CLOUD_NAME>/...` (reject any other host).
- **Indicative estimate** (informational only, shown right after submit and stored in `indicative_low/high`):
  `reference` = average catalog price of vehicles with the same make+model; else same make; else no estimate.
  `estimate = reference * max(0.30, 1 - 0.08 * age_years) * max(0.60, 1 - mileage_km/300000) * condition_factor`
  with `condition_factor`: Excellent 1.00, Good 0.92, Fair 0.80, Poor 0.65. Range = estimate ±8%. If no reference: "We will appraise after reviewing your photos."
- **Real value** comes from staff: a sales executive or manager reviews the photos, sets `offered_value`, `staff_notes`, `status='Offer Made'`, `offer_valid_until = now + TRADE_IN_OFFER_VALID_DAYS`. Customer gets notified; customer **Accepts** (`Accepted`) or **Declines** (`Declined`). Unanswered offers become `Expired` in `expire_stale()`.
- An `Accepted` trade-in can be applied on a sale (7.2): the credit reduces the balance due.
- (Stretch S-5, not required: AI image assessment. The human appraisal above is the required process.)

### 7.8 Service booking

- Customer needs at least one car in **My Garage** (they can add one inline; cars bought from AutoEdge appear automatically).
- Choose: car, service type, technician (list filtered by `service_types.required_specialty`; "No preference" allowed), date (tomorrow to +30 days, Mon–Sat), time slot (hourly `09:00`–`16:00`; a chosen technician's taken slots are disabled via `GET /public/technicians/{id}/availability?date=`), notes.
- Pay `service_types.booking_fee` from the bank inside one transaction (same pattern as reserve, with idempotency key and password confirmation). Insert booking `Booked`.
- Staff (receptionist / manager / technician) **confirm**: assigns a technician (the chosen one, or pick one when "no preference"), creates a `service_jobs` row (`customer_id`, `customer_vehicle_id`, `technician_id`, `job_type = service type name`, `job_date`, `estimated_cost = base_price`) and links `service_job_id`; booking becomes `Confirmed`.
- When the linked service job becomes `Completed`, the booking becomes `Completed` (update inside the existing service-job update function). The customer sees job status and final cost.
- Customer cancel: ≥ 24 hours before the slot → refund 100% of the fee; later → no refund. Technician slot is freed.

### 7.9 Notifications and email (and what to do about fake customers)

`notify(customer_id, type, title, message, link_path)` does, in the caller's transaction or right after commit:
1. INSERT `notifications` (always, for every customer, real or fake — this is the primary channel and is shown with a bell icon).
2. INSERT `email_outbox` (`Queued`) addressed to the account email.
3. In `BackgroundTasks`: `email_service.send(email_id)`:
   - `EMAIL_PROVIDER=none` or address domain in `EMAIL_SUPPRESS_DOMAINS` or a reserved test TLD (`.test`, `.invalid`, `.example`, `.localhost`) → status `Suppressed` (no network call).
   - Otherwise call the provider's HTTPS API. Success → `Sent` (+`sent_at`); any exception → `Failed` with `error_message`. A failed email must NEVER break the main action.

So demo/fake customers (e.g. `demo1@example.com`) still see notifications in the app and their emails appear in the staff **Email Log** as `Suppressed`, while real addresses (the owner and friends) receive real emails.

Provider notes: Railway blocks outbound SMTP, so use an **HTTPS API** provider. SendGrid's free plan has been retired (trial only). Brevo's free plan with a single verified sender address is the recommended default; adapters for Brevo (`POST https://api.brevo.com/v3/smtp/email`, header `api-key`) and SendGrid (`POST https://api.sendgrid.com/v3/mail/send`, Bearer key) live in `email_service.py`, chosen by `EMAIL_PROVIDER`. Use `httpx` (already in requirements) with a 10-second timeout.

Notification types: `welcome`, `reservation_confirmed`, `reservation_cancelled`, `reservation_expired`, `reservation_expiring_soon` (stretch), `test_drive_requested`, `test_drive_confirmed`, `test_drive_declined`, `test_drive_expired`, `enquiry_replied`, `trade_in_offer`, `trade_in_expired`, `service_booked`, `service_confirmed`, `service_completed`, `restock_available`, `purchase_completed`, `top_up`.

---

## 8. SIMULATED BANK AND PAYMENT EXPERIENCE ("feels real")

Backend (already specified in 6 and 7): bank account per customer, starting balance, ledger with `balance_after` and unique reference codes, `CHECK (balance >= 0)`, idempotency keys, row locks, refunds, top-up (`POST /store/bank/top-up` `{amount}`, 100.00–50,000.00, max 5 top-ups per rolling 24 hours, labelled "Demo funds").

Storefront experience:

1. **Bank card visual** on the Bank page and in the checkout: gradient card showing bank name "AutoEdge Demo Bank", masked number `•••• •••• •••• 4821` (only `card_last4`), account title (customer name), and current balance.
2. **Statement page**: table of transactions with date, reference code, description, debit (red) / credit (green), running `balance_after`; filter by type; pagination.
3. **Checkout modal** (reservation and service fee): order summary (car or service, deposit = 10%, hold period selector 7/14/21/30 days, "balance due at showroom"), "Pay from AutoEdge Demo Bank •••• 4821 — Balance $50,000.00", a **Confirm with your account password** field, and a **Pay $X** button. Show the small "Demo project — no real money" note.
4. **Processing sequence**: after clicking Pay show steps "Contacting bank…", "Authorising payment…", "Payment confirmed" (about 1.5–2 seconds total, purely cosmetic; the backend call runs at the same time). Disable the button and send a fresh `idempotency_key` (UUID created when the modal opens).
5. **Success screen**: receipt number (`RSV-000123` / `SVC-000045`), transaction reference, amount, new balance, hold-until date, "View receipt" (printable page using the browser's print-to-PDF) and "Go to My Reservations".
6. **Failure states**: `"Payment declined — insufficient funds"` with a "Top up demo balance" link; `"Incorrect password"`; `"This car was just reserved/sold out"` (409) with a "Request this car" link.
7. **Never** ask for a real card number, CVV, or expiry anywhere.

---

## 9. ROLES AND PERMISSIONS (additions to the v1.0 matrix)

| Feature | manager | sales_executive | technician | receptionist | customer |
|---|:--:|:--:|:--:|:--:|:--:|
| Enquiries inbox (view/reply) | ✅ | ✅ only if `handles_enquiries` | ❌ | ✅ only if `handles_enquiries` | own threads only |
| Toggle a staff member's `handles_enquiries` | ✅ | ❌ | ❌ | ❌ | ❌ |
| Confirm / decline online test-drive requests | ✅ | ✅ | ❌ | ✅ | ❌ |
| View reservations (staff list) | ✅ | ✅ | ❌ | ✅ | own only |
| Cancel a reservation for a customer (with refund) | ✅ | ❌ | ❌ | ❌ | own only |
| Trade-in appraisal (set offer) | ✅ | ✅ | ❌ | ❌ | own only (accept/decline) |
| Restock Priority page + restock action | ✅ | ✅ | ❌ | ❌ | request only |
| Manage vehicle stock, images, description, publish flag | ✅ | ✅ | ❌ | ❌ | ❌ |
| Service bookings: view/confirm | ✅ | ❌ | ✅ (own technician bookings) | ✅ | own only |
| Moderate reviews (hide/show) | ✅ | ❌ | ❌ | ❌ | edit/delete own |
| Email Log | ✅ | ❌ | ❌ | ❌ | ❌ |
| Staff page (manage enquiry access, technician profiles) | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## 10. API ENDPOINTS

Conventions as v1.0: JSON, correct status codes, pagination `page`/`page_size` (max 50), Pydantic v2 schemas with `from_attributes=True`, never return `password_hash`. Public schemas are explicit allow-lists (no `notes`, no staff emails, no customer data).

### 10.1 Public (no auth)

```
GET  /api/v1/public/vehicles                 filters: q, make, body_type, fuel_type, condition_type, year_min, year_max,
                                             price_min, price_max, in_stock_only, sort (newest|price_asc|price_desc|rating), page, page_size
GET  /api/v1/public/vehicles/filters         distinct makes, body types, fuel types, year and price bounds
GET  /api/v1/public/vehicles/featured        6 newest in-stock cars
GET  /api/v1/public/vehicles/compare?ids=1,2,3     2..3 vehicles with full specs
GET  /api/v1/public/vehicles/{id}            detail + images[] + specs + avg_rating + review_count + open_restock_requests + availability
GET  /api/v1/public/vehicles/{id}/reviews    visible reviews, paginated, with verified flag
GET  /api/v1/public/test-drive-slots?vehicle_id=&date=
GET  /api/v1/public/service-types
GET  /api/v1/public/technicians?specialty=   name, specialty, years_experience, bio, photo_url  (NO email)
GET  /api/v1/public/technicians/{id}/availability?date=
```

Each vehicle in public responses includes `stock_quantity` and `availability: "in_stock" | "out_of_stock"`; the card shows "Only N left" when 1 ≤ stock ≤ 3.

### 10.2 Customer auth (no token)

```
POST /api/v1/store/auth/register
POST /api/v1/store/auth/login
GET  /api/v1/store/auth/check-email?email=
```

### 10.3 Customer endpoints (customer token required)

```
GET/PUT  /api/v1/store/me                       profile (name, phone, address); email is read-only
POST     /api/v1/store/me/change-password       {current_password, new_password, confirm_password}

GET      /api/v1/store/wishlist
POST     /api/v1/store/wishlist/{vehicle_id}
DELETE   /api/v1/store/wishlist/{vehicle_id}

GET      /api/v1/store/bank                     account summary (balance, card_last4, bank_name, account_number masked)
GET      /api/v1/store/bank/transactions        paginated statement
POST     /api/v1/store/bank/top-up              {amount}

POST     /api/v1/store/reservations             {vehicle_id, hold_days, password, idempotency_key}
GET      /api/v1/store/reservations             mine (status filter)
GET      /api/v1/store/reservations/{id}
GET      /api/v1/store/reservations/{id}/receipt
POST     /api/v1/store/reservations/{id}/cancel

POST     /api/v1/store/test-drives              {vehicle_id, scheduled_date, scheduled_time, notes}
GET      /api/v1/store/test-drives
POST     /api/v1/store/test-drives/{id}/cancel

POST     /api/v1/store/enquiries                {vehicle_id?, subject, message}
GET      /api/v1/store/enquiries
GET      /api/v1/store/enquiries/{id}           thread with messages
POST     /api/v1/store/enquiries/{id}/messages  {body}
POST     /api/v1/store/enquiries/{id}/close

POST     /api/v1/store/trade-ins                (body in 7.7)
GET      /api/v1/store/trade-ins
GET      /api/v1/store/trade-ins/{id}
POST     /api/v1/store/trade-ins/{id}/respond   {accept: true|false}
POST     /api/v1/store/trade-ins/{id}/cancel    (only while Submitted / Under Review)

GET/POST /api/v1/store/garage                   my cars
PUT/DELETE /api/v1/store/garage/{cv_id}         (delete blocked if used by a booking)

POST     /api/v1/store/service-bookings         {cv_id, service_type_id, technician_id?, booking_date, time_slot, notes, password, idempotency_key}
GET      /api/v1/store/service-bookings
GET      /api/v1/store/service-bookings/{id}/receipt
POST     /api/v1/store/service-bookings/{id}/cancel

POST     /api/v1/store/reviews                  {vehicle_id, rating, title?, body}
GET      /api/v1/store/reviews                  mine
PUT/DELETE /api/v1/store/reviews/{id}

POST     /api/v1/store/restock-requests         {vehicle_id}
GET      /api/v1/store/restock-requests         mine
DELETE   /api/v1/store/restock-requests/{vehicle_id}

GET      /api/v1/store/notifications            paginated
GET      /api/v1/store/notifications/unread-count
POST     /api/v1/store/notifications/{id}/read
POST     /api/v1/store/notifications/read-all
```

### 10.4 Staff additions (staff token, role rules in section 9)

```
GET   /api/v1/enquiries                         filters: status, assigned_to, vehicle_id          [enquiry access]
GET   /api/v1/enquiries/{id}
POST  /api/v1/enquiries/{id}/reply              {body}                                              [enquiry access]
PUT   /api/v1/enquiries/{id}                    {status?, assigned_to?}                             [enquiry access]
PUT   /api/v1/users/{id}/enquiry-access         {handles_enquiries: bool}                           [manager]

POST  /api/v1/test-drives/{id}/confirm          {assigned_to?}   (Requested -> Scheduled)           [manager, sales_executive, receptionist]
POST  /api/v1/test-drives/{id}/decline          {reason}                                            [same]

GET   /api/v1/reservations                      filters: status, vehicle_id, customer_id            [manager, sales_executive, receptionist]
GET   /api/v1/reservations/{id}
POST  /api/v1/reservations/{id}/cancel          staff cancel with refund                            [manager]

GET   /api/v1/trade-ins                         filters: status                                     [manager, sales_executive]
GET   /api/v1/trade-ins/{id}                    includes images
PUT   /api/v1/trade-ins/{id}                    {status: 'Under Review' | 'Offer Made', offered_value?, staff_notes?}

GET   /api/v1/restock/priority                  reads v_restock_priority                            [manager, sales_executive]
POST  /api/v1/vehicles/{id}/restock             {quantity}                                          [manager, sales_executive]
POST  /api/v1/vehicles/{id}/images              {image_url, sort_order}                             [manager, sales_executive]
DELETE /api/v1/vehicles/{id}/images/{image_id}
PUT   /api/v1/vehicles/{id}                     existing, now accepts stock_quantity, description, main_image_url, engine, horsepower, seats, drivetrain, is_published
                                                (manual stock edits write a stock_movements row with reason 'Manual Adjustment')

GET   /api/v1/service-bookings                  [manager, receptionist, technician(own)]
POST  /api/v1/service-bookings/{id}/confirm     {technician_id?}  -> creates service_job
PUT   /api/v1/service-bookings/{id}             {status}

GET   /api/v1/reviews                           [manager]
PUT   /api/v1/reviews/{id}/visibility           {is_visible}

GET   /api/v1/email-log                         filters: status                                     [manager]
GET   /api/v1/technician-profiles               [manager]
PUT   /api/v1/technician-profiles/{user_id}     [manager]

GET   /api/v1/dashboard/stats                   existing; add active_reservations, pending_test_drive_requests,
                                                open_enquiries (only if caller has enquiry access), out_of_stock_with_requests
```

Existing `POST /sales` and `PUT /sales/{id}` follow 7.2 (accept `reservation_id`, `trade_in_id`).

---

## 11. UI SPECIFICATION

### 11.1 Design tokens (storefront uses the SAME palette as `frontend/`, Article X and XVII)

Copy `frontend/tailwind.config.js` colours (bg.primary `#0D0F17`, bg.card `#161821`, bg.elevated `#1E2130`, bg.border `#2A2D3E`, text.*, accent.blue `#4D7FFF`, status.*) into `storefront/tailwind.config.js` only. Components reference token class names only. Font: Inter. Mobile-first, works at 375px.

### 11.2 Routes

Public:
```
/                    HomePage
/cars                InventoryPage         (filters in query string)
/cars/:id            CarDetailPage
/compare             ComparePage           (ids in query string, max 3)
/emi-calculator      EmiPage
/service             ServiceInfoPage       (service types, technicians, "Book a service" CTA)
/trade-in            TradeInInfoPage       (how it works, "Start trade-in" CTA)
/about, /contact     static pages (with "Demo project, not a real dealership" note)
/login, /signup
```
Protected (customer):
```
/account                       OverviewPage (shortcuts, active reservations, upcoming test drives/services, unread notifications)
/account/profile
/account/bank                  BankPage (card, balance, statement, top-up)
/account/reservations          (+ receipt at /account/receipts/reservation/:id)
/account/test-drives
/account/enquiries             /account/enquiries/:id  (thread)
/account/trade-ins             /account/trade-ins/new
/account/garage
/account/service-bookings      /account/service-bookings/new   (+ receipt at /account/receipts/service/:id)
/account/wishlist
/account/reviews
/account/notifications
```
`ProtectedRoute` redirects logged-out visitors to `/login?next=<current path>`.

### 11.3 Navbar

Logged out: Logo, Cars, Compare, EMI Calculator, Service, Trade-In, About, Contact | Log in, Sign up.  
Logged in: same links + wishlist heart (count), notification bell (unread count), **My Account** dropdown (Overview, Bank, Reservations, Test Drives, Enquiries, Trade-ins, Garage, Service Bookings, Reviews, Profile, Log out). The website itself never disappears after login.

### 11.4 Key components and behaviours

- **CarCard**: image (with fallback), make/model/year, price, fuel/transmission chips, star rating, heart (wishlist), "Compare" checkbox. Stock states:
  - in stock: normal; `Only N left` badge when N ≤ 3;
  - stock = 0: image and card shaded dark (overlay), centred label **"Out of Stock — Currently Unavailable"**, and a **"Request this car"** button (login required; after clicking it turns into "Requested ✓" and shows "N people waiting"). The card is NEVER labelled "Booked" while stock > 0.
- **CompareBar**: sticky bar at the bottom listing up to 3 selected cars with "Compare now" and "Clear"; selection kept in `localStorage` (not sensitive).
- **CarDetailPage**: gallery (thumbnails), price, specs table, description, stock badge, rating + reviews list with "Verified" badges, review form (logged-in only), buttons: **Reserve this car** (opens CheckoutModal), **Book a test drive** (slot picker), **Send enquiry**, **Add to wishlist**, **Compare**, EMI mini-calculator prefilled with the car price, related cars. Out-of-stock cars show **Request this car** instead of Reserve/Test drive.
- **Photo credits**: under the gallery on CarDetailPage show each photo's `credit` as a small link to its `source_url`, plus the note "Images are for illustration only." The Footer also says "Car photos courtesy of Pexels and Wikimedia Commons contributors."
- **EMI calculator** (`utils/emi.js`, pure frontend): inputs price (default from car), down payment % (default 20), annual interest % (default 7.5), term months (12/24/36/48/60/72). `r = rate/12/100`; if `r = 0` then `emi = principal/n`, else `emi = P*r*(1+r)^n / ((1+r)^n - 1)`; show monthly EMI, total interest, total payable; button "Ask about finance" creates a prefilled enquiry (login required).
- **Signup form**: full name, phone, email (live availability check, debounced), password, confirm password (both with eye toggle — use the shared `PasswordField`, and trim values on submit so pasted text works), inline validation messages.
- **Login form**: email + password (trimmed on submit), generic error.
- **TradeIn form**: vehicle details + `ImageUploader` (3–8 photos, uploaded straight from the browser to Cloudinary with the unsigned preset, thumbnails with remove buttons, 5 MB max each, jpg/png/webp), shows the indicative estimate after submit.
- **Notifications**: bell dropdown (latest 5) + full page; clicking marks read and navigates to `link_path`.
- Every list page has loading, empty and error states; every protected API error 401 → redirect to login.

### 11.5 Staff dashboard changes (`frontend/`, phase P46)

- **Sidebar** gains (role-gated per section 9): Enquiries (only if manager, or `handles_enquiries`), Reservations, Trade-ins, Restock Priority, Service Bookings, Reviews (manager), Email Log (manager), Staff (manager).
- **Vehicles**: table gets Stock column and Published toggle; form gets stock, description, main image URL, up to 8 extra image URLs, engine, horsepower, seats, drivetrain.
- **Test Drives**: `Requested` filter + badge, "Online" source badge, time slot column, Confirm and Decline (with reason) buttons, countdown to expiry.
- **Sales form**: after choosing a customer, show their Active reservations and Accepted trade-ins; selecting them fills the credits and shows "Balance due at showroom".
- **Dashboard**: new KPI cards — Active reservations, Pending test-drive requests, Open enquiries (only for those with access), Out-of-stock cars with requests.
- **Enquiries**: inbox list (status filter, assign to me) + thread view with reply box.
- **Trade-ins**: list + detail with photo gallery, customer's stated details, indicative range, offer form.
- **Restock Priority**: ranked table from `v_restock_priority` with a Restock action.
- **Service Bookings**: list + Confirm (choose technician) + status update.
- **Staff page**: users table with "Handles enquiries" toggle; technician profile editor (specialty, bio, photo URL, bookable).
- Existing Service pages show `vehicle_label` for customer-owned cars.

---

## 12. SEED DATA ADDENDUM (`database/storefront_seed.py`)

Idempotent (safe to re-run; use `ON CONFLICT DO NOTHING` / existence checks). All password hashes come from `hash_password()` (Article XVI).

1. **Vehicles backfill** (set stock, body type, specs, descriptions, publish):

| Vehicle | stock | body_type | notes |
|---|---:|---|---|
| Toyota Camry 2023 | 4 | Sedan | |
| Honda Civic 2022 | 2 | Sedan | |
| BMW 3 Series 2023 | 3 | Sedan | |
| Ford F-150 2021 | **0** | Truck | out-of-stock demo; gets restock requests |
| Tesla Model 3 2023 | 5 | Sedan | |
| Hyundai Tucson 2022 | 2 | SUV | |
| Kia Sportage 2023 | 3 | SUV | |
| Mazda CX-5 2021 | 1 | SUV | shows "Only 1 left" |

   Note: the status trigger will turn the F-150 from `Reserved` to `Sold`/`Reserved` according to the rule in 6.3; that is expected.
2. **Add 8 more vehicles** so the showroom looks real (mix of body types and fuels, realistic prices, `vin_number` NULL): Mercedes-Benz C-Class (Sedan), Audi A4 (Sedan), Toyota Corolla (Sedan), Honda Accord (Sedan), Jeep Wrangler (SUV), Volkswagen Golf (Hatchback), Chevrolet Camaro (Coupe, **stock 0** — second out-of-stock demo), Nissan Leaf (Hatchback, Electric). Stock between 1 and 6.
3. **Images**: run `fetch_vehicle_images.py` first (section 12.1), then read `database/vehicle_images.json`; for each vehicle set `main_image_url` to the first URL and insert every photo (including the first, `sort_order` 0, 1, 2, …) into `vehicle_images` with its `credit` and `source_url`. Vehicles with no photo render the storefront fallback image (neutral card with a car icon).
4. **Service types**:

| Name | base_price | booking_fee | minutes | required_specialty |
|---|---:|---:|---:|---|
| Oil Change | 45.00 | 5.00 | 45 | Mechanic |
| Full Vehicle Service | 180.00 | 15.00 | 120 | Mechanic |
| Brake Inspection & Repair | 120.00 | 10.00 | 60 | Mechanic |
| Tyre Rotation & Wheel Alignment | 70.00 | 8.00 | 60 | Tyre & Alignment |
| AC Service & Gas Refill | 95.00 | 10.00 | 60 | AC Specialist |
| Battery & Electrical Diagnostics | 60.00 | 8.00 | 60 | Electrician |
| Dent & Paint Touch-up | 250.00 | 20.00 | 120 | Body & Paint |
| General Inspection | 40.00 | 5.00 | 45 | (any) |

5. **Technicians**: existing Tom Tech → profile `Mechanic`. Add users (role `technician`, password `Admin@1234`): Elena Volt `elena@autoedge.com` (Electrician), Raj Patel `raj@autoedge.com` (AC Specialist), Marcus Cole `marcus@autoedge.com` (Body & Paint), Lina Torres `lina@autoedge.com` (Tyre & Alignment); each with years_experience, a short bio and `photo_url` NULL (storefront shows an initials avatar).
6. **Enquiry access**: `handles_enquiries = TRUE` for Sarah Sales and Rita Reception; Tom Tech stays FALSE.
7. **Demo customers** (so the site looks alive; password `Demo@1234`, starting balance as configured): `demo1@example.com`, `demo2@example.com`, `demo3@example.com` with names, phones, accounts and bank accounts. Create: 3 `Open` restock requests on the F-150 (one per demo customer) and 1 on the Camaro; 6 reviews spread over 4 vehicles; 2 wishlist items; 1 Active reservation (demo1, a 14-day hold, going through the real `reserve` service so stock and ledger are consistent); 1 enquiry thread with one staff reply.
8. Print a summary of counts at the end.

### 12.1 Automatic car photos (`backend/database/fetch_vehicle_images.py`)

Goal: the owner never has to hunt for or upload car pictures by hand. The script runs on the owner's computer (not on Railway), is re-runnable, and produces the JSON that the seed reads. Article XX applies.

1. Read every vehicle's `make`, `model`, `year`, `body_type` from the database.
2. **Source 1 — Pexels API** (free key in `PEXELS_API_KEY`): `GET https://api.pexels.com/v1/search?query=<make> <model>&orientation=landscape&per_page=15` with header `Authorization: <key>`. Keep photos at least 1200 px wide. Score each result by its `alt` text: contains both make and model +3, contains make only +1, contains an unrelated brand −3. Take the best 4 distinct photos. Store the photo's large URL (`src.large2x` or `src.large`), `credit = "Photo by <photographer> on Pexels"`, `source_url = <photo page url>`, `license = "Pexels License"`.
3. **Source 2 — Wikimedia Commons** (no key), used when Pexels gives fewer than 2 good photos for a car: `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=<make> <model>&gsrnamespace=6&gsrlimit=15&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1280&format=json`. Accept only licences CC0, Public domain, CC BY, CC BY-SA; skip logos, diagrams, engine bays and interiors when the title says so; use `thumburl`; `credit = "<Artist> / Wikimedia Commons, <licence>"`; `source_url = descriptionurl`. Send a descriptive `User-Agent` header (for example `AutoEdgeDemo/1.0 (student project; contact: <owner email>)`).
4. Be polite: wait 0.5 s between calls, retry once after a 429 with the wait the API asks for, never run more than one request at a time.
5. Store the **provider URLs directly** (hot-linked). Do not download images into the git repository. Optional flag `--rehost-cloudinary` uploads each chosen image to the owner's Cloudinary account by remote URL (Cloudinary API key and secret from the local `.env`) and stores the `res.cloudinary.com` URL instead, so the photos stay available even if the original disappears. Default: off.
6. Write `database/vehicle_images.json` as `{"Make|Model|Year": [{"url": "...", "credit": "...", "source_url": "...", "license": "..."}, ...]}`. An entry marked `"locked": true` (owner replaced it by hand) is never overwritten on re-run.
7. Also generate `database/vehicle_images_preview.html`: a simple page showing each car's name with its chosen photos and credits, so the non-technical owner can look at them in a browser.
8. Print a report: photos found per car, which source was used, and cars with fewer than 2 photos.
9. **Ask the owner (section 0 item 6)** when more than 3 cars have fewer than 2 photos, or when the preview shows photos that clearly are not the right car. Options to offer: use Wikimedia only for those cars; use a generic photo for that body type; leave the fallback image for now; or let the owner paste image links.
10. Known limitation to tell the owner: internet photos will normally show the correct make and model, but not always the exact year or colour in the database description. The car detail page shows the note "Images are for illustration only." The owner can replace any photo later in the staff vehicle form.
11. The script must never print or commit the API keys; `.env` stays git-ignored.

---

## 13. DO'S AND DON'TS (additions)

### ✅ ALWAYS DO
- Put multi-table business actions in `app/services/*` and run them in one transaction with `with db.begin():` semantics; roll back on any exception.
- Use `SELECT ... FOR UPDATE` on the vehicle row and bank account row for every stock/money change, in the documented lock order.
- Take `customer_id` from the token. Check ownership on every read and write of customer data (404, not 403, for other people's rows).
- Use `Decimal` and `NUMERIC`. Return money as strings or fixed-2 numbers, formatted by the frontend.
- Use idempotency keys on every payment endpoint.
- Write a `stock_movements` row for every stock change and a `bank_transactions` row for every balance change.
- Catch `IntegrityError` from the partial unique indexes and convert it into a friendly 409.
- Trim and lower-case emails everywhere before comparison or storage.
- Give every storefront list page loading, empty and error states.
- Keep all colours in Tailwind tokens (Article XVII).
- Keep `database/schema.sql` / `storefront_schema.sql` and Alembic in sync.

### ❌ NEVER DO
- NEVER let a customer token pass a staff dependency (or the reverse).
- NEVER expose staff emails, customer personal data, internal notes or password hashes in public or other customers' responses.
- NEVER decrement stock below zero or debit a balance below zero (the CHECK constraints are the last line of defence, the app checks first).
- NEVER charge twice for the same `idempotency_key`.
- NEVER ask for or store a real card number, CVV or expiry.
- NEVER accept trade-in image URLs from any host other than the configured Cloudinary cloud.
- NEVER let a failed email or notification roll back or fail the main business action.
- NEVER use floats for money; NEVER hard-code the API URL; NEVER commit `.env` files.
- NEVER paste a password hash generated elsewhere into a seed file (Article XVI).
- NEVER put JWTs in `localStorage` (use `sessionStorage`).
- NEVER add a shopping cart; the buying flow is reserve-and-pay-deposit.

---

## 14. DEVELOPMENT PHASES (P30 → P48)

### P30 — Store schema migration [GATE]
**Objective:** Implement section 6 completely.  
Create ORM models for the 19 new tables; Alembic revisions `0002_store_tables`, `0003_store_alterations`, `0004_store_triggers_views` (raw SQL for partial indexes, constraint replacement, function, trigger, views); copy DDL into `database/storefront_schema.sql`; apply with `alembic upgrade head` to Neon.  
**[GATE]:** 27 tables present; both views queryable; trigger works (`UPDATE vehicles SET stock_quantity=0 WHERE vehicle_id=...` changes `status`); `pytest tests/test_routes.py` still green; staff login still works.

### P31 — Storefront seed [GATE]
Implement `fetch_vehicle_images.py` (section 12.1; needs the owner's `PEXELS_API_KEY` in `backend/.env` — ask the owner for it if missing), run it, show the owner `vehicle_images_preview.html`, then implement `storefront_seed.py` (section 12) using the generated `vehicle_images.json`.  
**[GATE]:** 16 vehicles, F-150 and Camaro at stock 0, 8 service types, 5 technician profiles, 3 demo customers, 4 open restock requests, 1 Active reservation, ledger totals consistent (`SUM` of debits/credits equals `balance - starting balance`).

### P32 — Customer auth backend + token scopes [GATE]
Add `scope` claims, `get_current_customer`, harden `get_current_user`, implement `/store/auth/*`, `/store/me`, change-password, bank-account creation on register, welcome notification. Add `app/core/time.py`.  
**[GATE]:** register works and rejects duplicate email (409, case-insensitive) and mismatched confirm password (422); login with pasted trailing spaces still works; customer token on `GET /api/v1/users` → 401/403; staff token on `GET /api/v1/store/me` → 401; existing staff login unchanged.

### P33 — Public catalog API [P] [GATE]
Implement section 10.1 including filters, sorting, pagination, compare, slots, technicians, availability, using the views and explicit public schemas.  
**[GATE]:** `GET /api/v1/public/vehicles?in_stock_only=true` excludes the F-150; `GET /public/vehicles/{F-150 id}` shows `availability:"out_of_stock"` and `open_restock_requests:3`; technician payload contains no email field.

### P34 — Storefront bootstrap
Create `storefront/` (Vite React, Tailwind with same tokens, React Router, Axios, TanStack Query), axios instance (`VITE_API_BASE_URL`), customer `authStore` (sessionStorage), layout (Navbar, Footer), `ProtectedRoute`, `ImageWithFallback`, `PasswordField`, `vercel.json` with SPA rewrite.  
**[GATE]:** `npm run dev` on port 5174 renders the layout; `npm run build` succeeds.

### P35 — Public pages [P] [GATE]
HomePage, InventoryPage (filters, sort, pagination, compare selection), CarDetailPage (gallery, specs, reviews list, out-of-stock state, EMI mini-calculator), ComparePage, EmiPage, ServiceInfoPage, TradeInInfoPage, About, Contact. Buttons that need login redirect to `/login?next=`.  
**[GATE]:** all 16 cars display; shaded out-of-stock cards show "Request this car"; compare works for 3 cars; EMI result matches a hand calculation.

### P36 — Signup, Login, Account shell, Wishlist, Notifications [GATE]
Signup/Login pages with all validation rules (7.1), account layout and navbar changes, wishlist backend+UI, notifications backend+UI (bell, page), profile page with change password.  
**[GATE]:** signup shows live "email already registered" message; after login the full public site is still reachable and the extra menu appears; wishlist persists after logout/login; unread count updates.

### P37 — Bank + reservation services (backend) [GATE]
Implement `bank_service`, `stock_service`, `reservation_service` (reserve, cancel, expire_stale, convert_on_sale), bank/reservation/restock endpoints, expiry background loop in lifespan, sale-completion changes (7.2), staff reservation endpoints.  
**[GATE]:** `tests/test_reservations.py` passes: reserve reduces stock by 1 and balance by 10% of price and writes ledger + stock movement; insufficient funds changes nothing; same idempotency key does not charge twice; cancel refunds 90% and restores stock; manually back-dating `expires_at` then calling `expire_stale()` expires and refunds. `tests/test_race.py`: 10 concurrent reserve calls on a car with stock 1 → exactly 1 success, 9 get 409, balances consistent.

### P38 — Reservation and payment UI [GATE]
Bank page (card, statement, top-up), CheckoutModal with processing steps and success/failure screens (section 8), My Reservations (status, countdown, cancel), printable receipt page, "Reserve this car" on detail/cards.  
**[GATE]:** full flow in the browser: reserve → balance drops → card shows "N-1 left" (or shaded out-of-stock when it reaches 0) → reservation appears in My Reservations and in the staff Reservations list → cancel refunds.

### P39 — Test drive requests [GATE]
Customer endpoints and UI (slot picker using availability), staff confirm/decline endpoints and staff Test Drives page changes, expiry in `expire_stale()`.  
**[GATE]:** two customers cannot take the same slot (second gets a friendly 409); a request back-dated past 48h becomes `Expired`; confirm moves it to `Scheduled` and the customer is notified.

### P40 — Enquiries + Staff page [GATE]
Customer thread endpoints/UI, staff inbox endpoints with `require_enquiry_access`, staff Enquiries pages, Staff page with the "Handles enquiries" toggle, sidebar gating.  
**[GATE]:** Tom Tech (technician) cannot see or call the inbox; Sarah can; turning her flag off hides it; a staff reply appears in the customer's thread and creates a notification.

### P41 — Out-of-stock UX, restock requests, Restock Priority [GATE]
Request-this-car endpoints/UI, staff Restock Priority page and restock action, restock notifications.  
**[GATE]:** requesting the Camaro twice from one account is rejected; Restock +2 on the F-150 marks its 3 requests `Fulfilled`, stock becomes 2, and the 3 customers receive `restock_available`.

### P42 — Reviews [P] [GATE]
Review endpoints/UI (write, edit, delete, verified badge, rating summary on cards), staff moderation page.  
**[GATE]:** second review by the same customer on the same car is rejected; hiding a review removes it from public listing and the average.

### P43 — Trade-in [GATE]
Cloudinary `ImageUploader`, trade-in form with indicative estimate, customer pages, staff appraisal pages, offer expiry, accept/decline, use on sale (7.2).  
**[GATE]:** form refuses fewer than 3 photos and non-Cloudinary URLs; a staff offer appears for the customer; accepting it and recording a sale with `trade_in_id` reduces the balance due and marks the trade-in `Completed`.

### P44 — Garage + Service booking [GATE]
Garage endpoints/UI, service types/technicians/availability usage, booking with fee payment, staff Service Bookings page (confirm creates `service_jobs`), status mirroring when the job completes, existing Service pages show `vehicle_label`.  
**[GATE]:** choosing a technician and slot makes that slot unavailable for others; cancel ≥24h refunds the fee; confirming creates a job visible on the old Service page; completing the job marks the booking `Completed`.

### P45 — Notifications fan-out + Email [GATE]
Finish `notify_service` for every type in 7.9, `email_templates`, Brevo and SendGrid adapters, suppression rules, staff Email Log page.  
**[GATE]:** a booking by `demo1@example.com` creates a notification and an `email_outbox` row with status `Suppressed`; a booking by a real address with a valid provider key shows `Sent`; a deliberately wrong API key shows `Failed` and the booking itself still succeeds.

### P46 — Staff dashboard integration [P]
Implement section 11.5 (sidebar, vehicles form/table, test drives, sales form with credits, dashboard KPIs).  
**[GATE]:** a manager can add a car with stock 3 and 4 image URLs and see it on the storefront immediately; unpublishing hides it; the sales form shows a customer's Active reservation and prefilled deposit credit.

### P47 — Hardening and tests [GATE]
Cross-token tests, ownership tests (customer A cannot read B's reservation/bank/trade-in: 404), concurrency test, expiry tests, rate-limit-lite for login (optional), pagination limits, Cloudinary host validation test, accessibility pass for forms, 375px layout pass on every storefront page.  
**[GATE]:** `pytest` green; no console errors on any storefront page; Lighthouse performance on `/cars` ≥ 70 on mobile (lazy-loaded images).

### P48 — Deployment and README [GATE]
1. Create second Vercel project from the same repo: Root Directory `storefront`, Framework Vite, env vars from 4.2.
2. Add the storefront URL to Railway `CORS_ORIGINS` and `STORE_BASE_URL`; add the email and business-rule variables from 4.1; redeploy.
3. Run `python database/storefront_seed.py` against Neon (one time).
4. Update `README.md`: both live URLs, architecture diagram, demo logins (staff and customer), feature list, how to run locally (backend 8000, staff 5173, storefront 5174), ER diagram image (generate from the 27 tables), and the DB features list in section 16.
**[GATE]:** run the FINAL CHECKLIST below on the live URLs.

---

## 15. TIMELINE AND CUT-LINES (about 3 weeks)

| Week | Phases | Result |
|---|---|---|
| 1 | P30–P36 | Schema, seed, customer auth, public catalog, public pages, signup/login, wishlist, notifications |
| 2 | P37–P42 | Bank, reservations, stock, test drives, enquiries, restock, reviews |
| 3 | P43–P48 | Trade-in, service booking, email, staff integration, hardening, deployment |

If time runs short, cut in this order (last item cut first): (1) real email sending — keep `email_outbox` + in-app notifications; (2) review moderation page; (3) trade-in photo upload polish; (4) service-booking technician choice (keep "no preference"); (5) compare page. **Never cut:** P30–P33, P36–P39 (the database core) and P48 (deployment).

Stretch ideas, only after everything above is green: S-1 email verification by link; S-2 login lockout after repeated failures; S-3 `reservation_expiring_soon` reminder; S-4 reservation extension for a small fee; S-5 AI image assessment for trade-ins; S-6 saved searches.

---

## 16. DATABASE FEATURES TO SHOW THE TEACHER (put this list in the README)

- 27 normalised tables with primary keys, foreign keys (RESTRICT / CASCADE / SET NULL chosen deliberately) and CHECK constraints.
- Partial unique indexes (one active reservation per customer per car, one open restock request, no double-booked test-drive or technician slot).
- A PL/pgSQL **trigger** keeping `vehicles.status` consistent with stock.
- **Views** (`v_vehicle_catalog`, `v_restock_priority`) used by the API.
- **Transactions** with `SELECT ... FOR UPDATE`, a fixed lock order, and an idempotency key (reserve, cancel, expire, pay service fee, complete sale).
- Ledger tables (`bank_transactions`, `stock_movements`) giving a full audit trail; `CHECK (balance >= 0)` as DB-level protection.
- Concurrency test proving no overselling.
- Aggregations and joins: ratings, restock ranking, dashboard KPIs, customer history.
- Indexes on every foreign key and on status/date columns, with the reason in comments.

---

## 17. MANUAL TASKS FOR THE OWNER (cannot be done by the agent)

1. **Pexels API key** (free, about 2 minutes): sign up at pexels.com, open the API page, copy the key into `backend/.env` as `PEXELS_API_KEY`. This lets `fetch_vehicle_images.py` find the car photos for you automatically. No manual photo uploading is needed.
1b. **Cloudinary** (free account) is now needed ONLY for customers' trade-in photo uploads: create an **unsigned upload preset** named `autoedge_tradein` (folder `autoedge/trade-ins`, allowed formats jpg/png/webp, max file size 5 MB). Note the cloud name.
2. **Email provider**: create a free Brevo account, verify one sender address (your own Gmail is fine), create an API key, then set `EMAIL_PROVIDER=brevo`, `EMAIL_API_KEY`, `EMAIL_FROM_ADDRESS` on Railway. Check the provider's current free limits when you sign up. Until then keep `EMAIL_PROVIDER=none`: everything works, emails are just logged.
3. **Vercel**: second project from the same GitHub repo, Root Directory `storefront`, add the three env variables.
4. **Railway**: add the new variables (4.1), add the new Vercel URL to `CORS_ORIGINS`, and check the remaining trial credit before the demo.

---

## 18. FINAL CHECKLIST (live URLs)

```
Public site
- [ ] Storefront live on its own Vercel URL; staff dashboard still live on the old URL
- [ ] Home, Cars, Car detail, Compare, EMI, Service, Trade-in, About, Contact load without login
- [ ] Filters, search, sort, pagination work; car photos load (found automatically, fallback if missing)
- [ ] Photographer credit and "Images are for illustration only" visible on car detail pages
- [ ] In-stock card shows "Only N left" when N <= 3; out-of-stock card is shaded with "Request this car"
- [ ] Refresh (F5) on any storefront route does not 404

Accounts
- [ ] Signup rejects duplicate email, weak password, mismatched confirm password
- [ ] Login works with pasted credentials (trimmed); generic error on failure
- [ ] After login the full website is still visible plus the My Account menu
- [ ] Customer token cannot call staff endpoints; staff token cannot call /store/me

Buying
- [ ] Reserve: balance drops by the deposit, stock drops by 1, reservation listed in storefront AND staff dashboard
- [ ] Insufficient funds shows a decline and changes nothing
- [ ] Double-click does not charge twice
- [ ] Cancel refunds 90%; expired reservation refunds and restores stock
- [ ] Sale from a reservation records deposit credit and does not decrement stock twice
- [ ] Request this car -> staff Restock Priority shows it ranked by request count -> restock notifies requesters

Other features
- [ ] Test drive request -> staff confirm/decline; unconfirmed request expires after 48h
- [ ] Enquiry thread works both ways; inbox hidden from technicians and from staff without access
- [ ] Reviews: one per car per customer, verified badge, moderation works
- [ ] Wishlist saved per account
- [ ] Trade-in with 3+ Cloudinary photos -> offer -> accept -> used on a sale
- [ ] Service booking with technician choice and fee -> staff confirm -> job created -> completion mirrors back
- [ ] Notifications bell works; Email Log shows Sent / Suppressed / Failed correctly
- [ ] Mobile layout fine at 375px; no console errors; /docs still reachable
- [ ] README updated with URLs, demo logins, ER diagram and the database-features list
```

---

*End of AutoEdge Storefront Extension Specification — Version 2.0*
