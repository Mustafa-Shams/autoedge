# HANDOFF — AutoEdge Storefront
Last updated: 2026-11-21 20:20 PKT by Antigravity session
Current phase: Post-P48 hotfix — status: COMPLETE

## Done
- P30: DB schema — 19 new tables, Alembic migration, storefront_schema.sql — key files: `backend/alembic/versions/`, `backend/database/storefront_schema.sql`
- P31: Storefront React scaffold — Vite + Tailwind v4, dark theme, routing, auth context — key files: `storefront/`
- P32: Storefront seed data — 8 new vehicles (expanded to 22 total via team decision), service types, technicians, 3 demo customers — key files: `backend/database/storefront_seed.py`
- P33: Customer auth — signup, login, profile, check-email, JWT with scope:"customer" — key files: `backend/app/api/routes/store/auth.py`, `backend/app/api/routes/store/account.py`
- P34: Public catalog — `/api/v1/public/catalog` with filters, search, sort, pagination, `v_vehicle_catalog` view — key files: `backend/app/api/routes/public/catalog.py`
- P35: Storefront pages — Home, Cars, CarDetail, Compare, EMI, Service/Trade-in info, About, Contact — key files: `storefront/src/pages/public/`
- P36: Wishlist, notifications, bank — CRUD endpoints + React pages — key files: `backend/app/api/routes/store/bank.py`, `storefront/src/pages/account/BankPage.jsx`
- P37: Reservations — reserve with 10% deposit, cancel with 10% fee, auto-expire, receipt, idempotency — key files: `backend/app/services/reservation_service.py`
- P38: Stock movements + trigger — `stock_movements` table, PL/pgSQL trigger on vehicles.status — key files: `backend/app/models/stock_movement.py`
- P39: Test drives — customer request, staff confirm/decline, 48h auto-expire — key files: `backend/app/api/routes/store/test_drives.py`
- P40: Enquiries — threaded inbox, customer + staff messages, `handles_enquiries` flag — key files: `backend/app/api/routes/store/enquiries.py`
- P41: Restock requests — customer request, staff restock, notify requesters — key files: `backend/app/api/routes/store/restock.py`
- P42: Reviews — one per car per customer, verified badge, moderation — key files: `backend/app/api/routes/store/reviews.py`
- P43: Trade-ins — submit with Cloudinary photos, offer, accept/reject, 7-day expiry — key files: `backend/app/api/routes/store/trade_ins.py`
- P44: Service bookings — book with technician/time, confirm, link to service job — key files: `backend/app/api/routes/store/service_bookings.py`
- P45: Notifications + email — in-app notifications, email_outbox, Brevo/SendGrid/none — key files: `backend/app/services/email_service.py`
- P46: Staff dashboard integration — Reservations + Staff nav items, ReservationsStaffPage — key files: `frontend/src/pages/reservations/ReservationsStaffPage.jsx`
- P47: Hardening — 99 tests (cross-token, ownership, expiry), accessibility pass, 375px layout — key files: `backend/tests/test_cross_token.py`, `backend/tests/test_ownership.py`, `backend/tests/test_expiry.py`
- P48: README, HANDOFF, DECISIONS — COMPLETE
- Post-P48: Showroom expanded from 16 → 22 vehicles (Decision #19). 6 new cars added: Toyota Fortuner, Ferrari 488 GTB, Mercedes-Benz C-Class C200, BMW M4 Competition, Porsche 918 Spyder, Suzuki Swift. Photos for new cars are manual (teammates will add later). fetch_vehicle_images.py has MANUAL_PHOTO_CARS skip list.
- Post-P48 hotfix (Decision #22): Trailing-slash 307 fix on 5 POST routes (reviews, enquiries, test_drives, trade_ins, restock). BankCard 3D flip with `/store/bank/sensitive` endpoint. NotificationContext for unified unread count. Compare page Remove/Clear working. EMI vehicle dropdown. CarDetail sticky fix + wishlist toggle. BackButton components in both apps. 12 new tests (111 total).
- Vehicle image fix (Decision #23): `PUT /vehicles/{id}/images/bulk` atomic endpoint. `VehicleResponse` now includes `images[]`. Staff form rewrite: loads existing images on edit, thumbnail previews, inline edit/delete/reorder/make-main, auto-adds pending URL, URL validation, max 8, transactional save via bulk endpoint. Storefront `CarDetailPage` prepends `main_image_url` as first gallery image. 17 new tests (128 total).

## Half-done / in progress
- None — all phases complete

## Next step (do this first after the re-check)
- Create the second Vercel project for storefront (manual — user must do this)
- Add `STORE_BASE_URL` and storefront Vercel URL to Railway `CORS_ORIGINS` (manual)
- Run `python database/storefront_seed.py` against Neon if not already seeded
- Run the FINAL CHECKLIST from spec section 18

## Not done yet (in order)
- Nothing — all phases complete, showroom expanded to 22 vehicles

## Waiting on the owner
- Vercel: create second project (Root Directory `storefront`, Framework Vite, env vars)
- Railway: add storefront URL to `CORS_ORIGINS`, set `STORE_BASE_URL`
- Cloudinary: create unsigned upload preset `autoedge_tradein` (if trade-in photos needed for demo)

## Re-check first (the new session runs these before any new work)
- [x] `pytest tests/ -v --tb=short` → 128 passed (99 original + 12 post-P48 + 17 image tests)
- [x] `cd storefront && npm run build` → 0 errors
- [x] `cd frontend && npm run build` → 0 errors
- [ ] README.md has ER diagram, demo logins, DB features list
- [ ] docs/DECISIONS.md and docs/HANDOFF.md exist

## Known problems and workarounds
- Staff frontend chunk size warning (944KB) — pre-existing from P01-P29, not critical for demo
- Pexels API keys paused — script now supports Wikimedia Commons + Unsplash fallbacks. 6 new cars skip image fetch (MANUAL_PHOTO_CARS). Fallback gradient + car icon shown when no images.
- Email sending requires Brevo/SendGrid setup — `EMAIL_PROVIDER=none` logs only (default)

## Setup facts (names only, never secret values)
- Env variables already set locally: `DATABASE_URL`, `SECRET_KEY`, `CORS_ORIGINS`, `SHOWROOM_TIMEZONE`, `DEMO_STARTING_BALANCE`, `EMAIL_PROVIDER`, `STORE_BASE_URL`
- Railway env vars needed: `DATABASE_URL`, `SECRET_KEY`, `CORS_ORIGINS` (must include `https://autoedge-three.vercel.app,https://autoedge-storefront.vercel.app`), `STORE_BASE_URL` (the storefront Vercel URL), `SHOWROOM_TIMEZONE` (defaults to `Asia/Karachi`), `EMAIL_PROVIDER` (defaults to `none`), `DEMO_STARTING_BALANCE` (defaults to `50000.00`)
- Where things live: spec `AUTOEDGE_STOREFRONT_SPEC.md`, answers `docs/DECISIONS.md`, seed `backend/database/storefront_seed.py`
