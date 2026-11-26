# HANDOFF — AutoEdge

## Claude session, November 26 — owner's seven-step plan

Branch `redesign-local` (local only, never pushed). The owner confirmed the redesign workflow is final; commissions for assisted deals, the 20% pre-pickup refund, deals, units, trade acquisitions, Today and the outbox are by design. Safety rules are in CLAUDE.md. Tests use only `TEST_DATABASE_URL=postgresql://autoedge_test@127.0.0.1:55432/postgres` (owner's local server, binaries in C:\pgsql\pgsqlin).

| Step | Status | Evidence |
|---|---|---|
| 0. Checkpoint branch | Done | Commit 0df96d0 on redesign-local holds the whole Codex working tree. Secret scan of the diff found nothing. |
| 1. Full suite + two PostgreSQL bugs | Done | 192 passed, 7 warnings, on local PostgreSQL. Service cancellation writes txn_type `Refund` and new technicians default to `General`, allowed by 0016. Both regression tests now assert the stored values directly. |
| 2. Migration round trip and schema comparison | Done | New tests in backend/tests/test_deal_migration.py: 0005 plus the four model-shaped empty strays -> head -> 0005 -> head. The 0005 catalog (columns, indexes, constraints, triggers, views, functions) is identical after downgrade and head is identical after re-upgrade. Model comparison leaves only eight reviewed naming differences (ACCEPTED_MODEL_DIFFERENCES); any new drift fails the test. 0016 downgrade no longer fails when technicians use General: the old rule is re-added NOT VALID and validated when no General row exists. scripts/db_check.py reviewed: read-only repeatable-read transaction, SELECT only; it now also reads DB_CHECK_URL. 13 migration tests passed. |
| 3. Restore bank flip card | Next | |
| 4. Enquiry categories | Pending | |
| 5. Leftovers | Pending | |
| 6. docs/DEMO.md | Pending | |
| 7. docs/ROLLOUT.md | Pending | |


## Local schema reconciliation — current checkpoint

November 24. The owner requires repository-only evidence and disposable local PostgreSQL verification. All prior remote repair plans are superseded. The recorded four tables map to inventory_units and deals (0006_units_and_deals), sales_assistance (0009_sales_assistance), and trade_acquisitions (0010_trade_acquisitions). No remote connection was made in this session. Next verify the test database guard, migration round trip and read-only inspector before release.

The pytest guard now checks TEST_DATABASE_URL before collection, pins loopback, and disables dotenv for test application and migration processes. An unconfigured collection exited with the required refusal. The guard and four-stray fixture passed 16 focused tests on the new loopback PostgreSQL cluster. The rehearsal inspected the catalog with scripts/db_check.py, kept the sentinel customer unchanged, repeated upgrade at 0006, downgraded to 0005, re-upgraded to 0006 and then reached head. Removed an additional import-time reservation seed. All 190 then-current tests collected against an unused loopback port with no server. An external-host URL was rejected before collection. The first full PostgreSQL run had 186 passes and four failures. The expiry fixture used a nonexistent stock reason, service refunds used an unsupported ledger type, and the portal defaulted technicians to a specialty rejected by the database. Corrected the fixture and refund type and extended the specialty constraint in 0016. All four focused service/technician regressions passed, and the guard/expiry set passed 23 tests. Each populated-stray case rolled back at 0005 with its sentinel preserved. The full suite rerun is the remaining check.

## Connected workflow follow-up

Resume here first. Preserve the ten earlier redesign steps below. Work locally with disposable records.

1. Verified. Migration 0012_email_render stores template inputs. The outbox worker renders on delivery and retry. Notification HTML, including fallback text and links, is rendered in the delivery session. An injected template failure left a cancelled booking and its refund intact. All four targeted cancellation/email tests passed.
2. Implemented migration 0013, vehicle-specific interest capture, both deal history endpoints/pages, purchase/hold reuse and account-scoped access. Nine targeted checkout, attribution, drive and trade tests passed, including buyer and staff history and cross-account denial. General enquiries can be explicitly attached to the correct customer’s deal. Confirmed on both portals in Chromium. Historical backfill is covered by the final PostgreSQL migration check.
3. Verified. The storefront fetches a signed ten-minute quote with exact expiry, deposit and cancellation refund. Successful payment opens the numbered deal and checkout. Five targeted checkout/assistance tests passed, including tamper rejection and exact persisted deadlines. Storefront production build passed.
4. Verified on SQLite. Migration 0014 introduces a private physical unit at intake. Staff record the document reference, VIN, odometer, condition check, verifier and approved terms version. Publication attaches that same unit to the retail listing. Legacy intake can be rechecked. Five trade/showroom tests passed, including credit, standalone payment, excess at pickup and intake-to-listing unit identity.
5. Verified locally. Today shows the responsible staff member, action and record. Related modules have permission-filtered navigation tabs. Completed sales show the earned commission and its evidence. Garage, wallet, conversations and notifications link to the deal. Earlier acquired vehicles without ownership checks appear in the intake-verification queue. Resale assignment requires both inventory and trade-in editing access.

**Final local verification, November 24.** All 171 backend tests passed with seven warnings on disposable SQLite and loopback PostgreSQL. The three focused trade-in cases also passed after refining the legacy-intake queue. Both production builds passed; Vite reports a staff bundle-size warning. Chromium verified a customer linking an earlier general enquiry to the reserved deal, staff opening the same deal, cash and wallet purchases, commission on the sale, pickup, garage booking, trade-in withdrawal before intake, physical intake, standalone settlement and resale on the storefront. The 390-pixel vehicle page fit the viewport.

**Earlier redesign checkpoint.** The local workflow implementation was verified. For database reconciliation use the current checkpoint at the top of this file. Production release and live Brevo delivery verification remain pending.

### Remote database incident and rollout hold

**Historical preflight.** The current owner instruction and local-only checkpoint above supersede the proposed remote archive operation.

On November 24, the first full test invocation collected application modules before the fixtures selected SQLite. The five schema-reset transactions on the configured remote PostgreSQL database failed on a dependent catalog view. Other collection fixtures invoked SQLAlchemy create_all on the cached engine. No test body executed during that invocation. Subsequent read-only metadata checks found Alembic at 0005_staff_portal with four unexpected tables: deals, inventory_units, sales_assistance and trade_acquisitions. Each contained zero rows. Existing enquiries and email_outbox lacked the redesign columns; the new inventory and acquisition tables contained 0014-era fields. The remote database was not migrated, repaired or stamped. Its exact prior schema has not been independently reconstructed.

Do not run the deployment commands below on that database as it stands. Reconcile against a pre-run backup or point-in-time branch first. Use a disposable copy for rehearsals. The owner must authorize any remote schema repair. The guarded rehearsal at backend/database/rehearse_0005_reconciliation.sql archived the four empty tables on a disposable reconstruction and preserved revision 0005. The subsequent upgrade to 0015_deal_activity passed. The script was never run against the remote database. All subsequent business submissions and migration tests ran on disposable databases.

## Earlier ten-step redesign

The earlier build sequence and acceptance criteria are in [REDESIGN.md](REDESIGN.md). Resume from the connected workflow checkpoint above.

- Completed the redesign plan and resume protocol.
- Step 1 complete locally. Updated backend/app/services/test_drive_service.py to compare showroom slots consistently in UTC and use cancellation-specific notifications. Updated backend/app/services/service_booking_service.py to send the service cancellation notification with its cancellation text. Updated storefront/src/pages/public/EmiPage.jsx to retrieve all public catalog pages in batches of 50.
- Verification: two API regressions in backend/tests/test_staff_portal.py passed on disposable SQLite, including a second cancellation and the persisted refund receipt. Storefront production build passed. EMI pagination logic passed mocked catalogs of 0, 50, 51 and 123 vehicles.
- Step 2 implemented locally. Migration 0006_units_and_deals preserves available quantities, allocates one unit per held or sold car, links each converted reservation to its sale, and leaves all VINs unverified. Closed holds retain their deal with no allocated car. Old completed sales retain their existing garage and commission records. Pending sales acquire a unit on completion. Active paths for holds, cancellations, expiry, staff sales, inventory adjustments and the storefront seed now maintain these links.
- Step 2 verification passed on disposable loopback PostgreSQL 18.7. tests/test_deal_migration.py covers an ambiguous ownership rollback, populated upgrade, downgrade/re-upgrade, reconciliation and completing a migrated hold on its original unit. SQLite staff-sale checks cover garage deferral. Later full-suite runs include the updated fixture cleanup.
- Step 3 complete locally. Migration 0007_wallet_purchase, purchase_service.py and the store purchases routes connect Buy now and Complete purchase to the demo wallet. Both portals build. The backend suite passed 157 tests including two PostgreSQL last-unit races (two buyers and a simultaneous retry), failed charge rollback, verified deposit reconciliation, receipt ownership, pickup and refund. An additional targeted expired-checkout regression passed. Staff build reports a bundle-size warning.
- Step 4 complete locally. Migration 0008_showroom_receipts, showroom_service.py, the staff Sales page and My purchases now share one enquiry thread per purchase, a pickup deadline, verified cash and lender funding, and an outstanding balance. Staff-recorded sales require full-payment evidence before handover. Returning a paid trade-in requires both the customer's agreement and manager confirmation of the physical return before refund and stock release. The full suite passed 160 tests including disposable PostgreSQL migration and race checks. Both production builds passed. Headless Chrome on local disposable data verified mobile Buy now through login, wallet payment, receipt, messages and garage, plus desktop staff cash sale, payment verification, pickup scheduling and VIN handover.
- Step 5 implemented locally in 0009_sales_assistance, sales_assistance.py, sales and commission handling, and the staff Today page. Recording a walk-in or linking a matching staff conversation or completed test drive assigns one active owner before payment. The next matching sale consumes the evidence. Pickup pays that owner once. A repeat purchase requires new evidence. Today filters pickups, cancellation approvals, test drives, service appointments and enquiries by staff role and module access. All three qualifying paths passed targeted integration tests, including permission checks, a repeated pickup and a second unassisted sale. Staff production build passed.
- Step 6 implemented locally. Migration 0010_trade_acquisitions, staff AcquisitionPanel and customer Trade-ins implement an unpublished draft on acceptance, inspection, versioned customer approval, verified intake, checkout credit, and resale publication after collection. Standalone resale requires physical intake and a manager-recorded payment reference for the entire value. Agreed excess payment requires a separate receipt at pickup. These are records of separate payments, outside the demo wallet. Five targeted trade-in/payment cases passed, including standalone acquisition, excess, and bilateral cancellation. The Step 9 suite subsequently passed with both settlement branches included.
- Step 7 implemented locally. The staff sidebar groups permitted modules under Sales, Inventory, Service, Customers and Administration, with Today as the landing page and a module search. Today includes trade-in and workshop tasks. A local browser verified the Today pickup deep link, module search and checkout/handover flow after navigation changed.
- Step 8 complete locally. Catalog, wishlist and comparison link to checkout or restock according to stock. Filter values follow the URL, the catalog restores scroll after loading, and the wallet shows the balance and last four digits without fetching full card details. Purchase notifications, wallet activity and enquiry threads link to individual receipts. The storefront built. Local Chrome passed catalog search, keyboard compare, restock links, wishlist, checkout/login return, messages, cash payment and VIN handover. Vehicle detail fit a 390px viewport.
- Step 9 complete locally. Garage cards link to car-specific booking, history and purchase receipts. Workshop status and assignment update the booking in the same transaction. Cancellation uses the appointment refund ledger. Receipts include technician, parts, workshop charges and wallet refund. Staff can record parts from the job form. Purchase and service history survive garage edits. Migration 0011_workshop_status keeps in-progress appointment slots reserved. Both builds passed; the full backend suite passed 168 tests with seven warnings, including disposable PostgreSQL. Both same-car workshop regressions passed again after adding parts validation.
- Step 10 complete locally. All 169 backend tests passed with seven warnings against disposable test databases. PostgreSQL checks covered ambiguous ownership rollback, populated migrations through 0011, workshop downgrade/re-upgrade and slot protection, and concurrent purchases of the last unit. Both production builds and both lint commands completed. The staff bundle still triggers Vite's size warning. Local Chromium passed mobile/desktop checkout, assisted commission at pickup, accepted trade-in followed by declined inspection with no custody or listing, garage-to-booking preselection, catalog loading/empty/error/retry, comparison, filter and scroll restoration, and keyboard focus return in both portals. The workshop API tests covered completion, parts, receipts, cancellation and refunds.
- All ten redesign steps are complete in the local working tree. The next owner action is staging migration and coordinated deployment as described below. Production and live Brevo delivery remain unverified.
- AGENTS.md directs future build sessions to this checkpoint first.
- Owner approved two further rules. A manager-approved cancellation of a fully paid purchase before pickup refunds 20% of the total actually paid into the demo wallet and releases the unit. For excess verified trade-in credit, require separate settlement agreed by the customer and manager before completion. The backend suite at the step 2 checkpoint passed 152 tests including the PostgreSQL migration test.
- The owner clarified that a pre-pickup cancellation involving an acquired trade-in refunds 20% of cash and wallet payments and returns the trade-in. Both parties must agree before either vehicle is released. One salesperson owns a deal before payment. A recorded sale-related conversation, completed test drive or walk-in appointment qualifies. Pay that owner at pickup.

### Owner deployment for the redesign

The current local Alembic head is `0016_enquiry_category`. The older deployment sections below describe previous releases. Back up the intended PostgreSQL database and run the following from the repository root against a staging copy first. Use the backend environment for the intended database.

```powershell
Set-Location backend
.\venv\Scripts\python.exe -m alembic current
.\venv\Scripts\python.exe -m alembic upgrade 0016_enquiry_category
.\venv\Scripts\python.exe -m alembic current
```

Confirm the final revision, then deploy the matching backend, staff portal and storefront together. The redesign uses the existing environment variables. On staging, check one wallet checkout, VIN handover and garage receipt, then a paid trade-in and a service booking. If migration reports ambiguous historical sale/reservation ownership, reconcile the identified record using the original receipts and rerun. Once new transactions exist, use the backup to recover if rollback would discard purchase or trade-in evidence.

Live Railway email delivery still requires a deployed manager send from Email Log. Browser verification uses local Chromium with disposable records. Separate acquisition and excess payments require staff to enter evidence of payment. The demo wallet does not execute those external transfers.

## Brevo delivery investigation

The backend already posted to `https://api.brevo.com/v3/smtp/email` with the `api-key` header. Its configuration check trimmed the key and sender address only to test whether they contained a value. The actual request used the original strings. Surrounding quotes could therefore reach Brevo as part of the key. Whitespace or newlines could also make HTTPX reject the header before a response. An empty key took the Skipped path. The exact credential seen by the running Railway deployment has not been verified.

The backend reads `EMAIL_PROVIDER`, `EMAIL_API_KEY`, `EMAIL_FROM_ADDRESS`, and `EMAIL_FROM_NAME` (default `AutoEdge`) when the process starts. All four are now trimmed of outer whitespace and matching surrounding quotes. The Brevo request sends the cleaned key, JSON Content-Type and Accept headers, sender name and address, recipient name and address, subject, and HTML content. The recipient address doubles as the display name for a test email. Customer notifications use the customer's name when available.

After deploying these changes or updating variables on the Railway **backend service**, open **Staff → Email Log**, enter a deliverable address, and choose **Send test email**. This manager action calls `POST /api/v1/email-log/test` with `{"to":"recipient@your-domain.com"}` and records the attempt in the outbox. The HTTP status mirrors the provider response. The panel displays its status and body, including a Brevo message ID on acceptance. When the provider was never reached, the panel shows the local reason. Existing test-domain suppression applies.

For a repeated 401, compare the normalized key length and first eight characters in the backend failure log with the locally working key. The prefix and length can reveal a mismatch but cannot identify the full key. Keys eight characters or shorter have their prefix withheld. The outbox stores the complete HTTP failure body with credential echoes redacted. An earlier bug in the staff Retry API client was also fixed. This change needs no database migration or new Railway variables.

Local verification passed all 149 backend tests with seven warnings. Five new provider-mocked cases covered request construction, quoted and padded Railway-style values, recipient names, manager access, 201 acceptance, 401 rejection, redaction, long error bodies, and local failures without a provider response. The staff frontend build and lint passed. The build retains its bundle-size warning. Live Railway delivery is pending deployment and a manager test.

## Staff portal follow-up

Updated 2026-11-22 PKT. The staff-portal changes are local. See decisions 24–33 for the original causes, access rules, and rollout.

| Area | Completed work |
|---|---|
| A. Layout and service jobs | All protected staff routes share the sidebar and top bar. Forms and detail dialogs use Back. Route rendering failures get a recoverable panel. The service form loads real vehicle, customer, and technician summaries from the backend. |
| B. Vehicle inventory | Server-side multi-word search, stable sorting, existing page size, and a Reserved filter and Reserved: N badge based on unexpired active holds. |
| C. Reservations | Startup and three-minute worker, lazy expiry, committed stock and refund ledgers, notification, and elapsed-deadline labels. |
| D. Customers | Storefront-enabled customer creation, password setup or reset, and manager deactivation or history-protected deletion. |
| E. Trade-ins | Scrollable details, interactive photo lightbox, and offer status, amount, and expiry. |
| F. Reviews | Full review dialog and Hide/Show. |
| G. Enquiries | Correct staff API paths, visible request errors, complete thread, and working reply. Managers see all. Eligible flagged staff see all with their configured module permissions. |
| H. Email log | Skipped status, provider banner, error expansion, and manager retry. |
| I. Staff | Add, edit, activity, enquiry switch, password reset with forced change, and deactivation or history-protected deletion. Technician profiles include skills, working days and hours, rate, photo preview, and upcoming bookings. |

### Local verification

- The complete backend suite passed all 144 tests with seven warnings. It includes 16 new staff-portal regression cases. Windows installs now declare the IANA time-zone data used for technician booking dates.
- Headless Chrome signed in to the local production build and verified the sidebar, header, and title on all nine reported pages. It created a service job with PostgreSQL-backed vehicle, customer, and technician choices, checked the Reserved badge, moderated a review, and exercised the trade-in photo viewer. A deliberately malformed form response produced the Back/Reload panel, and sidebar navigation recovered.
- PostgreSQL upgrade through 0004 and 0005, known missing-provider failure conversion, downgrade to 0004, and re-upgrade passed.
- Two concurrent local PostgreSQL expiry transactions refunded 90% once, wrote one movement and notification, and restored stock. The vehicle status trigger stayed in use.
- The same local PostgreSQL installation served the service form's dropdown data and accepted a service job with real IDs.
- The frontend and storefront production builds passed. Staff frontend lint reported no errors. Vite reported the existing staff bundle-size warning.

### Owner deployment

Run the following from the repository root in PowerShell with the intended Neon database URL configured for the backend. Apply the migration before deploying the backend and staff portal.

```powershell
Set-Location backend
.\venv\Scripts\python.exe -m alembic upgrade 0005_staff_portal
.\venv\Scripts\python.exe -m alembic current
```

The expected revision is 0005_staff_portal. It adds staff access and session fields, technician profile fields, customer status, an active-reservation lookup index, and the Skipped email status. The email error_message column already existed. Migration 0003's older test-drive constraint lookup was corrected for fresh installs.

No new Railway variables are required. Optional email delivery uses EMAIL_PROVIDER (brevo or sendgrid), EMAIL_API_KEY, and EMAIL_FROM_ADDRESS. When configured, EMAIL_FROM_NAME and EMAIL_SUPPRESS_DOMAINS retain their existing behavior.

The original local Staff and Commissions pages already mounted PageWrapper. The shared route layout now covers both, and the cause of their earlier deployed appearance could not be reproduced locally.

The deployed manager session, the reported production rows, and live email provider delivery remain unverified. Local testing used only throwaway data.

---

## Storefront handoff from 2026-11-21
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
