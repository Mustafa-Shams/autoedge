"""Compare two scripts/db_check.py JSON snapshots (files only; no database access).

Usage: python scripts/compare_db_check.py before.json after.json
Prints the Alembic versions, added/removed tables, views and triggers, and every row count that changed.
Exit code 1 if any table that existed before lost rows.
"""
import json
import sys


def load(path):
    with open(path, encoding="utf-8") as handle:
        data = json.load(handle)
    rows = {(t["schema"], t["name"]): t["rows"] for t in data["tables"]}
    views = {(v["schema"], v["name"]) for v in data["views"]}
    triggers = {(t["schema"], t["table"], t["name"]) for t in data["triggers"]}
    return data["alembic_version"], rows, views, triggers


def main(before_path, after_path):
    (v1, r1, w1, t1), (v2, r2, w2, t2) = load(before_path), load(after_path)
    print(f"alembic: {v1} -> {v2}")
    print(f"tables: {len(r1)} -> {len(r2)}")
    for label, old, new in (("table", set(r1), set(r2)), ("view", w1, w2), ("trigger", t1, t2)):
        for item in sorted(new - old):
            print(f"  + {label} {'.'.join(item)}")
        for item in sorted(old - new):
            print(f"  - {label} {'.'.join(item)}")
    lost = []
    for key in sorted(set(r1) & set(r2)):
        if r1[key] != r2[key]:
            print(f"  rows {'.'.join(key)}: {r1[key]} -> {r2[key]}")
            if r2[key] < r1[key]:
                lost.append(key)
    for key in sorted(set(r2) - set(r1)):
        print(f"  rows {'.'.join(key)} (new): {r2[key]}")
    if lost:
        print("ROWS LOST in: " + ", ".join(".".join(k) for k in lost))
        return 1
    print("No existing table lost rows.")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    sys.exit(main(sys.argv[1], sys.argv[2]))
