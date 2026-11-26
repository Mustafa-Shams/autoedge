"""Seed files must let a fresh installation sign in with the documented demo password."""
import re
from pathlib import Path

import bcrypt

SEED = Path(__file__).resolve().parents[1] / "database" / "seed.sql"


def test_seed_sql_staff_hash_matches_documented_password():
    text = SEED.read_text(encoding="utf-8")
    documented = re.search(r"Default password for all users: (\S+)", text).group(1)
    hashes = set(re.findall(r"'(\$2[aby]\$\d\d\$[^']+)'", text))
    assert hashes and all(bcrypt.checkpw(documented.encode(), h.encode()) for h in hashes)
