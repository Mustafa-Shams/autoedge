# DECISIONS — AutoEdge Storefront

Record of design decisions made during the storefront extension build (P30–P48).

---

## Decision Log

| # | Date | Phase | Question | Chosen Option | Rationale |
|---|---|---|---|---|---|
| 1 | 2026-11-08 | P30 | Storefront_seed.py location: `backend/database/` or `database/` at repo root? | `backend/database/storefront_seed.py` | Keeps seed alongside schema.sql and seed.sql; script needs backend imports and venv. |
| 2 | 2026-11-08 | P30 | Use separate SQLAlchemy model files or extend existing? | Separate model files per table, shared `__init__.py` | Follows existing codebase convention (one file per model). 25 model files total. |
| 3 | 2026-11-08 | P31 | Storefront framework: same Tailwind v3 as staff dashboard or v4? | Tailwind CSS v4 for storefront | Spec specifies new Vite project; v4 is the current version; no need to match staff dashboard. |
| 4 | 2026-11-10 | P33 | Customer token scope: same `scope` field or separate token type? | Add `scope: "customer"` to JWT payload | Cleanest isolation — staff tokens have no scope field, customer tokens have `scope: "customer"`. Both decoded by the same `jose.jwt.decode()` but different dependency functions check the scope. |
| 5 | 2026-11-10 | P34 | Vehicle catalog: query the `vehicles` table directly or use `v_vehicle_catalog` view? | Use view `v_vehicle_catalog` | Spec section 6.4 defines the view with joins for avg_rating and review_count. API reads from the view, writes go to the table. |
| 6 | 2026-11-12 | P36 | Bank account auto-creation: on signup or on first visit to bank page? | Auto-create on signup | Simpler UX — every customer always has a bank account and opening balance. No "setup" step needed. |
| 7 | 2026-11-12 | P37 | Reservation deposit: percentage from spec (`RESERVATION_DEPOSIT_PERCENT=10`) or let customer choose? | Fixed 10% from config | Spec section 9.1 is explicit: "10 % of `vehicles.price`". No customer choice. |
| 8 | 2026-11-12 | P37 | Lock order for reservation: vehicle → reservation → bank_account or different? | vehicle → reservation → bank_account | Per Article XIII of the constitution. All transactional routes follow this order. |
| 9 | 2026-11-14 | P38 | StockMovement.reference_id type: Integer or String? | Integer | Existing model uses `Integer` column. Reference IDs are reservation_id, sale_id, etc. |
| 10 | 2026-11-14 | P39 | Test drive expiry: cron job or checked on API access? | Checked on API access (expire_stale function) | No background worker needed; expiry is checked when test drives are listed or when a specific endpoint is called. |
| 11 | 2026-11-15 | P40 | Enquiry access: role-based or per-user flag? | Per-user `handles_enquiries` boolean on User model | Spec section 9.5 specifies this explicitly: "users.handles_enquiries = TRUE". Seed sets it for sarah and rita. |
| 12 | 2026-11-16 | P41 | Restock notification: email + in-app or in-app only? | Both email (if provider configured) + in-app notification | Spec section 9.6 says "notify every requester". Email via email_outbox, suppressed for @example.com domains. |
| 13 | 2026-11-16 | P42 | Review verified badge: how to determine? | Check if customer has a completed Sale for that vehicle | "Verified Buyer" badge appears when a Sale record exists for that customer + vehicle combination. |
| 14 | 2026-11-17 | P43 | Trade-in photo upload: Cloudinary direct or server-side? | Cloudinary direct (unsigned preset) | Spec section 9.7 and Manual Tasks section 17.1b. Keeps backend simple; frontend validates host. |
| 15 | 2026-11-17 | P44 | Service booking fee: from service_types.booking_fee or calculated? | From `service_types.booking_fee` | Spec section 9.8 defines booking_fee per service type. No calculation needed. |
| 16 | 2026-11-18 | P45 | Email provider: implement all three (Brevo, SendGrid, none) or just Brevo + none? | All three: Brevo, SendGrid, none | Spec section 10 defines the provider pattern. `none` logs only. Easy to add SendGrid alongside Brevo. |
| 17 | 2026-11-18 | P46 | Staff dashboard sidebar: where to add storefront management links? | Add Reservations and Staff nav items to sidebar | Staff need to see customer reservations, trade-ins, reviews, and service bookings from the dashboard. |
| 18 | 2026-11-20 | P47 | Ownership test responses: 403 Forbidden or 404 Not Found? | 404 Not Found | Spec section P47 explicitly says "404 not 403" — don't reveal that the resource exists to unauthorized users. |
| 19 | 2026-11-21 | Post-P48 | Increase showroom from 16 to 22 cars? | Yes — add 6 new vehicles (Fortuner, 488 GTB, C200, M4, 918, Swift) | Team decision: more variety (Coupe, Convertible, Diesel, Hybrid, budget). Photos added manually by teammates; `fetch_vehicle_images.py` skips them via `MANUAL_PHOTO_CARS` list. Colours may be changed later to match photos. |
| 20 | 2026-11-21 | Post-P48 | Should vehicle photos be loaded automatically from vehicle_images.json during seed? | No — photos added manually via staff portal vehicle form | Automatic photo matching mixed up different cars. `storefront_seed.py` no longer loads vehicle_images.json by default; opt-in with `--with-images` flag. `fetch_vehicle_images.py` is not called automatically anywhere. |
| 21 | 2026-11-21 | Post-P48 | Staff portal clarity: "Total Vehicles" KPI ambiguous (listings vs units) and vehicles page missing proper pagination | Disambiguate KPIs, add server-side paginated vehicle list | Dashboard: "Vehicle Listings" (count of rows = 22) + new "Units in Stock" card (sum of stock_quantity = 57). Backend `GET /api/v1/dashboard/stats` returns `units_in_stock`. `GET /api/v1/vehicles/` now returns `{items, total, skip, limit}` instead of a bare array. Vehicles page shows "Showing 1–10 of 22 vehicles", page-size selector (10/25/50), numbered page buttons, Prev/Next. Stock column kept. |

---

## Constitution Articles Referenced

| Article | Summary | Where Applied |
|---|---|---|
| XI | All money as Decimal/NUMERIC, never float | All price, balance, amount, fee fields |
| XIII | Lock order: vehicle → reservation → bank_account | reserve, cancel, expire, complete-sale routes |
| XV | customer_id always from token, never from request body | All `/store/` endpoints |
| XVI | Password hashing via `app.core.security` (bcrypt) | Customer signup, login, seed scripts |
| XVII | All colors in Tailwind tokens only | Storefront uses custom CSS variables mapped to Tailwind |
| XVIII | Show "Demo project — no real money" note near payment | Bank page, reservation payment, service booking payment |
| XIX | Ambiguity rule — ask owner, never guess | All decisions above were reviewed |
