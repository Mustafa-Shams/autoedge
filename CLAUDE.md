# CLAUDE.md — AutoEdge

Read [AGENTS.md](AGENTS.md) first. It points to docs/HANDOFF.md, docs/REDESIGN.md and docs/DECISIONS.md, which are the authoritative description of the approved workflow. The redesign workflow is final: verify and finish it, do not redesign or remove features.

## HARD SAFETY RULES (obey in every session)

1. NEVER connect to the remote Neon database or any remote DB, and never read DATABASE_URL from backend/.env for tests. Tests use TEST_DATABASE_URL pointing to a disposable LOCAL PostgreSQL (owner's server: 127.0.0.1:55432, binaries in C:\pgsql\pgsql\bin). The fixtures in backend/tests/conftest.py and backend/app/core/test_database.py refuse any host other than localhost/127.0.0.1 and any URL containing neon.tech, railway or supabase. Keep that guard and its tests.
2. NEVER push, deploy, force-push, or run alembic against any remote database. The owner does those.
3. NEVER print, log or commit secrets (database URLs, SECRET_KEY, Brevo/Cloudinary keys, passwords).
4. Alembic migrations must be idempotent/safe and tested on a throwaway local database (upgrade, downgrade, re-upgrade). Never edit an already-applied migration (0001–0005); add a new one.
5. If a decision is ambiguous, ask the owner with 2–4 options (recommended first) and record the answer in docs/DECISIONS.md. Keep docs/HANDOFF.md current at the end of every task so another agent can resume.
6. Passwords are bcrypt hashes and must never be shown to anyone. Reset flows only.

## Running tests

```powershell
Set-Location backend
$env:TEST_DATABASE_URL = "postgresql://autoedge_test@127.0.0.1:55432/postgres"
.\venv\Scripts\python.exe -m pytest -q
```

Pytest creates a uniquely named child database, migrates it to head, and drops it at exit.
