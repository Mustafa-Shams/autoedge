# Rollout: redesign (Alembic 0005 → 0016)

For the owner only. Agents never run these steps (see CLAUDE.md). Run each command yourself, in the order given, and stop at the first failure.

## What this release changes

- **Database:** Alembic moves from `0005_staff_portal` to `0016_enquiry_category`. Migration 0006 replaces the four empty stray tables (`deals`, `inventory_units`, `sales_assistance`, `trade_acquisitions`) with the real ones, but only if they are empty. If any of them has rows, it stops and changes nothing. It backfills one deal per existing reservation and completed sale, plus one physical unit per car in stock. No existing row is changed or deleted.
- **Code:** the backend, staff portal and storefront must go live together, so all three deploy from the same push.
- **Settings:** no new Railway or Vercel variables.
- **Rehearsed locally on November 26:** a copy at 0005 with data and the four empty strays went to head with no lost rows, and all post-migration checks passed. Upgrade → downgrade → re-upgrade reproduced an identical schema.

## 0. Before you start

1. **Rotate the exposed credentials first.** Change the Neon database password and create a new Brevo API key. Put the new values only into Railway (backend service → Variables: `DATABASE_URL`, `EMAIL_API_KEY`) and into your local `backend/.env`. Delete the old Brevo key in Brevo.
2. **Pick a quiet time.** The production window takes about five minutes.
3. **Keep the existing backup branch** `backup-before-reconcile`.
4. **Get the direct connection string, not the pooled one.** In the Neon console, click **Connect**, choose the branch, and turn **Connection pooling** off. Migrations hold locks inside one transaction, which works best on a direct connection.
5. Open **one** PowerShell window in the repository root for the database steps, and close it when you finish. The session variables below would otherwise keep pointing at Neon.

Never paste a connection string into a file or a chat. The commands read it from a session variable, which stays out of your PowerShell history.

## 1. Rehearse on a Neon test branch

In Neon, go to **Branches → Create branch**. Set the parent to your primary branch, the point to **Now**, and the name to `rollout-test`. Copy its direct connection string.

```powershell
# Paste the rollout-test connection string when prompted (it is not echoed to history)
$env:DB_CHECK_URL = Read-Host "rollout-test connection string"
$env:DATABASE_URL = $env:DB_CHECK_URL
Remove-Item Env:AUTOEDGE_TESTING -ErrorAction SilentlyContinue

# Snapshot before
backend\venv\Scripts\python.exe scripts\db_check.py > rollout-test-before.json

Set-Location backend
.\venv\Scripts\python.exe -m alembic current          # expect: 0005_staff_portal
.\venv\Scripts\python.exe -m alembic upgrade head
.\venv\Scripts\python.exe -m alembic current          # expect: 0016_enquiry_category (head)
Set-Location ..

# Snapshot after, compare, and check consistency
backend\venv\Scripts\python.exe scripts\db_check.py > rollout-test-after.json
backend\venv\Scripts\python.exe scripts\compare_db_check.py rollout-test-before.json rollout-test-after.json
backend\venv\Scripts\python.exe scripts\post_migration_check.py
```

`$env:DATABASE_URL` set in the session overrides the value in `backend/.env`. This was confirmed locally.

**What a good result looks like:**

- `compare_db_check.py` prints Alembic `0005_staff_portal -> 0016_enquiry_category`. It shows one added table, `deal_activity`, and one added trigger, `stock_units_on_insert`. It ends with "No existing table lost rows."
- `deals` grows from 0 to the number of reservations plus completed sales. On your figures that is 3 reservations and 0 sales. `inventory_units` grows to the total stock plus active reservations.
- Every other table keeps its count: vehicles 23, users 8, customers 11, reservations 3, reviews 7, sales 0, trade_in_requests 2.
- `post_migration_check.py` ends with "All checks passed."

**If `alembic upgrade head` fails:** nothing was changed, because the whole upgrade is one transaction. Run `alembic current`, which should still show 0005. Stop and send the error text (never the connection string) to the agent. The two expected refusals are "Refusing to remove nonempty table public.<name>" and "Ambiguous completed sale for reservation <id>". Both mean the data needs a decision before upgrading.

### Smoke test against the test branch

Run the new backend locally against `rollout-test` with email switched off, then point the local storefront and staff portal at it:

```powershell
# Window 1 (backend): same session as above, so DATABASE_URL still points at rollout-test
$env:EMAIL_PROVIDER = "none"
$env:CORS_ORIGINS = "http://localhost:5173,http://localhost:5174"
Set-Location backend
.\venv\Scripts\python.exe -m uvicorn app.main:app --port 8000
```

```powershell
# Window 2 (storefront)
Set-Location storefront
$env:VITE_API_BASE_URL = "http://localhost:8000"; npm run dev -- --port 5174
```

```powershell
# Window 3 (staff portal)
Set-Location frontend
$env:VITE_API_BASE_URL = "http://localhost:8000"; npm run dev -- --port 5173
```

Check these on http://localhost:5174 and http://localhost:5173:

1. A customer signs in. **My Account → Reservations** shows their existing hold, and **My deals** shows it with a deal number.
2. Run Story 1 from [DEMO.md](DEMO.md): **Buy now**, pay, then a staff member uses **Today → Confirm pickup → Verify VIN and confirm pickup**. The car appears in the **Garage**.
3. On the staff side, **Enquiries** shows category badges, and **Today** loads for admin, sarah and rita.

Stop the three windows. Then delete the `rollout-test` branch in Neon, or keep it until production is done.

## 2. Production database

1. **Make a fresh backup branch.** In Neon, go to **Branches → Create branch** from the primary branch at **Now**, and name it `pre-redesign-YYYYMMDD`.
2. **Stop writes for the window.** In Railway, open the backend service, then **Deployments**, and choose **⋮ → Remove** on the active deployment. The live sites will show errors for a few minutes. The push in step 3 starts a new deployment.
3. Run the same commands as in section 1, with the primary branch's direct connection string and file names `prod-before.json` and `prod-after.json`:

```powershell
$env:DB_CHECK_URL = Read-Host "PRIMARY connection string"
$env:DATABASE_URL = $env:DB_CHECK_URL
backend\venv\Scripts\python.exe scripts\db_check.py > prod-before.json
Set-Location backend
.\venv\Scripts\python.exe -m alembic current          # expect: 0005_staff_portal
.\venv\Scripts\python.exe -m alembic upgrade head
.\venv\Scripts\python.exe -m alembic current          # expect: 0016_enquiry_category (head)
Set-Location ..
backend\venv\Scripts\python.exe scripts\db_check.py > prod-after.json
backend\venv\Scripts\python.exe scripts\compare_db_check.py prod-before.json prod-after.json
backend\venv\Scripts\python.exe scripts\post_migration_check.py
Remove-Item Env:DATABASE_URL, Env:DB_CHECK_URL
```

The results must look like the rehearsal. If anything differs, do not push. Go to Rollback.

## 3. Push the code (only after the migration succeeded)

The work is on the local branch `redesign-local`.

```powershell
git checkout main
git merge --ff-only redesign-local
git push origin main
```

- Railway builds and starts the backend from `main`. Watch **Deployments** until it is active and the log shows the server started.
- Vercel deploys both projects, the staff portal and the storefront, from the same push. Wait until both show **Ready**.

## 4. Live smoke test

1. Open https://autoedge-production.up.railway.app/docs. It should load.
2. On https://autoedge-storefront.vercel.app, sign in as a demo customer. Check **Demo wallet** (flip card, eye button, statement with Debit and Credit), **My deals**, and **Enquiries → New Enquiry** (topic list).
3. On https://autoedge-three.vercel.app, sign in as admin. **Today**, **Deals**, **Sales and pickups**, **Enquiries** and **Commissions** should all load.
4. Under **Staff → Email Log**, choose **Send test email** to your own address. It should be accepted by Brevo with the new key.
5. Run `post_migration_check.py` once more against the primary branch the next day. The deals and units must still reconcile.

## Rollback

| Situation | What to do |
|---|---|
| `alembic upgrade head` failed | Nothing changed. Keep the old code running, and restart the Railway deployment if you removed it. |
| Migration succeeded, checks look wrong, code not pushed yet | In Neon, restore the primary branch from `pre-redesign-YYYYMMDD`, or use point-in-time restore to just before the migration. Then redeploy the previous Railway deployment. Do not use `alembic downgrade`: it refuses once deals exist, which is intended. |
| New code is live and broken | Railway: **Deployments → previous deployment → Redeploy**. Vercel, for each project: **Deployments → previous → Promote to Production**. The old code is not guaranteed to work with the new schema, so also restore the database as in the row above. Anything customers did after the migration is lost. If that matters, fix forward instead. |

After a rollback, record what happened in `docs/HANDOFF.md` so the next session starts from the real state.
