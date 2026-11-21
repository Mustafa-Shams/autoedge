"""Automatic car photo fetcher — spec section 12.1.

Sources (tried in order, stopping when a car has ≥ 2 photos):
1. Pexels API     — if PEXELS_API_KEY is set      (best quality, landscape)
2. Unsplash API   — if UNSPLASH_ACCESS_KEY is set  (landscape, min 1200 px)
3. Wikimedia Commons — always available, no key    (CC0/PD/CC-BY/CC-BY-SA)

Usage:
    cd backend
    python database/fetch_vehicle_images.py               # all available sources
    python database/fetch_vehicle_images.py --wiki-only    # Wikimedia only
    python database/fetch_vehicle_images.py --pexels-only  # Pexels only (needs key)

Article XX: Lawful Images Only — Pexels API, Unsplash API, and Wikimedia Commons
only, with credit. Never scrape Google/Bing or other sites.
"""
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Optional

# Add project root to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

import httpx


# ── Configuration ────────────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).parent
OUTPUT_JSON = SCRIPT_DIR / "vehicle_images.json"
OUTPUT_HTML = SCRIPT_DIR / "vehicle_images_preview.html"
RATE_LIMIT_DELAY = 0.5  # seconds between API calls
USER_AGENT = "AutoEdgeDemo/1.0 (student database project)"
MIN_PHOTOS_TARGET = 2   # try additional sources if below this

# Cars whose photos will be added manually by the owner's team.
# The script skips these entirely — no API calls, no entries in vehicle_images.json.
MANUAL_PHOTO_CARS = {
    ("Toyota", "Fortuner", 2023),
    ("Ferrari", "488 GTB", 2018),
    ("Mercedes-Benz", "C-Class C200", 2020),
    ("BMW", "M4 Competition", 2021),
    ("Porsche", "918 Spyder", 2015),
    ("Suzuki", "Swift", 2022),
}


def _get_vehicles_from_db() -> list[dict]:
    """Read vehicle make/model/year/body_type from the database."""
    from dotenv import load_dotenv
    load_dotenv(SCRIPT_DIR.parent / ".env")

    from app.core.config import settings
    from sqlalchemy import create_engine, text

    engine = create_engine(settings.DATABASE_URL)
    with engine.connect() as conn:
        result = conn.execute(text(
            "SELECT vehicle_id, make, model, year, body_type FROM vehicles ORDER BY vehicle_id"
        ))
        vehicles = [dict(row._mapping) for row in result]
    return vehicles


def _load_keys() -> tuple[str, str]:
    """Load API keys from environment / .env file. Returns (pexels_key, unsplash_key)."""
    try:
        from dotenv import load_dotenv
        load_dotenv(SCRIPT_DIR.parent / ".env")
    except Exception:
        pass

    pexels_key = os.environ.get("PEXELS_API_KEY", "").strip()
    unsplash_key = os.environ.get("UNSPLASH_ACCESS_KEY", "").strip()
    return pexels_key, unsplash_key


# ── Pexels API ───────────────────────────────────────────────────────

def _score_pexels_photo(alt: str, make: str, model: str) -> int:
    """Score a Pexels photo by how well its alt text matches the car."""
    alt_lower = alt.lower()
    make_lower = make.lower()
    model_lower = model.lower()
    score = 0

    if make_lower in alt_lower and model_lower in alt_lower:
        score += 3
    elif make_lower in alt_lower:
        score += 1

    # Penalize if alt mentions a different well-known brand
    other_brands = [
        "toyota", "honda", "bmw", "ford", "tesla", "hyundai", "kia",
        "mazda", "mercedes", "audi", "volkswagen", "chevrolet", "nissan",
        "jeep", "subaru", "lexus", "porsche", "ferrari", "lamborghini",
    ]
    for brand in other_brands:
        if brand in alt_lower and brand != make_lower:
            score -= 3
            break

    return score


def fetch_pexels(make: str, model: str, api_key: str) -> list[dict]:
    """Fetch car photos from Pexels API."""
    url = "https://api.pexels.com/v1/search"
    headers = {"Authorization": api_key}
    params = {
        "query": f"{make} {model} car",
        "orientation": "landscape",
        "per_page": 15,
    }

    try:
        resp = httpx.get(url, headers=headers, params=params, timeout=15)
        if resp.status_code == 429:
            wait = int(resp.headers.get("Retry-After", 10))
            print(f"  Pexels rate limited, waiting {wait}s...")
            time.sleep(wait)
            resp = httpx.get(url, headers=headers, params=params, timeout=15)

        if resp.status_code != 200:
            print(f"  Pexels error {resp.status_code}")
            return []

        data = resp.json()
        photos = data.get("photos", [])

        # Score and sort
        scored = []
        for p in photos:
            if p.get("width", 0) < 1200:
                continue
            alt = p.get("alt", "")
            score = _score_pexels_photo(alt, make, model)
            scored.append((score, p))

        scored.sort(key=lambda x: x[0], reverse=True)

        # Take best 4 distinct photos
        results = []
        seen_ids = set()
        for score, p in scored[:4]:
            if p["id"] in seen_ids:
                continue
            seen_ids.add(p["id"])
            photo_url = p["src"].get("large2x") or p["src"].get("large") or p["src"]["original"]
            results.append({
                "url": photo_url,
                "credit": f"Photo by {p['photographer']} on Pexels",
                "source_url": p["url"],
                "license": "Pexels License",
            })

        return results

    except Exception as e:
        print(f"  Pexels exception: {e}")
        return []


# ── Unsplash API ─────────────────────────────────────────────────────

def _score_unsplash_photo(description: str, alt: str, tags: list, make: str, model: str) -> int:
    """Score an Unsplash photo by relevance to the car."""
    text = f"{description} {alt} {' '.join(tags)}".lower()
    make_lower = make.lower()
    model_lower = model.lower()
    score = 0

    if make_lower in text and model_lower in text:
        score += 3
    elif make_lower in text:
        score += 1

    other_brands = [
        "toyota", "honda", "bmw", "ford", "tesla", "hyundai", "kia",
        "mazda", "mercedes", "audi", "volkswagen", "chevrolet", "nissan",
        "jeep", "subaru", "lexus", "porsche", "ferrari", "lamborghini",
    ]
    for brand in other_brands:
        if brand in text and brand != make_lower:
            score -= 3
            break

    return score


def fetch_unsplash(make: str, model: str, access_key: str) -> list[dict]:
    """Fetch car photos from Unsplash API (official search endpoint)."""
    url = "https://api.unsplash.com/search/photos"
    headers = {"Authorization": f"Client-ID {access_key}"}
    params = {
        "query": f"{make} {model} car",
        "orientation": "landscape",
        "per_page": 15,
    }

    try:
        resp = httpx.get(url, headers=headers, params=params, timeout=15)
        if resp.status_code == 429:
            wait = int(resp.headers.get("Retry-After", 10))
            print(f"  Unsplash rate limited, waiting {wait}s...")
            time.sleep(wait)
            resp = httpx.get(url, headers=headers, params=params, timeout=15)

        if resp.status_code == 403:
            print(f"  Unsplash 403 — key may be invalid or rate-limited")
            return []

        if resp.status_code != 200:
            print(f"  Unsplash error {resp.status_code}")
            return []

        data = resp.json()
        photos = data.get("results", [])

        # Score and sort
        scored = []
        for p in photos:
            # Min width 1200
            width = p.get("width", 0)
            if width < 1200:
                continue
            desc = p.get("description") or ""
            alt = p.get("alt_description") or ""
            tags = [t.get("title", "") for t in p.get("tags", [])]
            score = _score_unsplash_photo(desc, alt, tags, make, model)
            scored.append((score, p))

        scored.sort(key=lambda x: x[0], reverse=True)

        # Take best 4 distinct photos
        results = []
        seen_ids = set()
        for score, p in scored[:4]:
            pid = p["id"]
            if pid in seen_ids:
                continue
            seen_ids.add(pid)
            # Use the regular-quality URL (1080px wide) — good balance of quality and speed
            photo_url = p["urls"].get("regular") or p["urls"].get("full")
            photographer = p.get("user", {}).get("name", "Unknown")
            page_url = p.get("links", {}).get("html", "")
            results.append({
                "url": photo_url,
                "credit": f"Photo by {photographer} on Unsplash",
                "source_url": page_url,
                "license": "Unsplash License",
            })

        return results

    except Exception as e:
        print(f"  Unsplash exception: {e}")
        return []


# ── Wikimedia Commons ────────────────────────────────────────────────

ALLOWED_LICENSES = {
    "cc0", "public domain", "cc-by", "cc by", "cc-by-sa", "cc by-sa",
    "cc-by-2.0", "cc-by-3.0", "cc-by-4.0",
    "cc-by-sa-2.0", "cc-by-sa-3.0", "cc-by-sa-4.0",
    "pd", "pd-self", "pd-old", "pd-usgov",
}

SKIP_KEYWORDS = {"logo", "diagram", "engine", "interior", "badge", "emblem", "cockpit", "dashboard"}


def fetch_wikimedia(make: str, model: str) -> list[dict]:
    """Fetch car photos from Wikimedia Commons."""
    url = "https://commons.wikimedia.org/w/api.php"
    params = {
        "action": "query",
        "generator": "search",
        "gsrsearch": f"{make} {model} car",
        "gsrnamespace": 6,
        "gsrlimit": 15,
        "prop": "imageinfo",
        "iiprop": "url|size|extmetadata",
        "iiurlwidth": 1280,
        "format": "json",
    }
    headers = {"User-Agent": USER_AGENT}

    try:
        resp = httpx.get(url, params=params, headers=headers, timeout=15)
        if resp.status_code == 429:
            wait = int(resp.headers.get("Retry-After", 10))
            print(f"  Wikimedia rate limited, waiting {wait}s...")
            time.sleep(wait)
            resp = httpx.get(url, params=params, headers=headers, timeout=15)

        if resp.status_code != 200:
            print(f"  Wikimedia error {resp.status_code}")
            return []

        data = resp.json()
        pages = data.get("query", {}).get("pages", {})

        results = []
        for page_id, page in pages.items():
            title = page.get("title", "").lower()

            # Skip logos, diagrams, engine bays, interiors
            if any(kw in title for kw in SKIP_KEYWORDS):
                continue

            imageinfo = page.get("imageinfo", [{}])[0]
            meta = imageinfo.get("extmetadata", {})

            # Check license
            license_short = meta.get("LicenseShortName", {}).get("value", "").lower()

            is_allowed = False
            for allowed in ALLOWED_LICENSES:
                if allowed in license_short:
                    is_allowed = True
                    break
            if not is_allowed:
                continue

            # Use thumburl for resized version
            thumb_url = imageinfo.get("thumburl")
            if not thumb_url:
                continue

            # Must be reasonably large
            thumb_width = imageinfo.get("thumbwidth", 0)
            if thumb_width < 640:
                continue

            # Get artist/credit
            artist = meta.get("Artist", {}).get("value", "Unknown")
            artist_clean = re.sub(r"<[^>]+>", "", artist).strip()
            if len(artist_clean) > 80:
                artist_clean = artist_clean[:80] + "…"

            desc_url = imageinfo.get("descriptionurl", "")

            results.append({
                "url": thumb_url,
                "credit": f"{artist_clean} / Wikimedia Commons, {license_short}",
                "source_url": desc_url,
                "license": license_short,
            })

            if len(results) >= 4:
                break

        return results

    except Exception as e:
        print(f"  Wikimedia exception: {e}")
        return []


# ── Helpers ──────────────────────────────────────────────────────────

def _identify_source(photo: dict) -> str:
    """Identify which source a photo came from."""
    license_val = photo.get("license", "").lower()
    credit_val = photo.get("credit", "").lower()
    if "pexels" in license_val or "pexels" in credit_val:
        return "Pexels"
    if "unsplash" in license_val or "unsplash" in credit_val:
        return "Unsplash"
    return "Wikimedia"


# ── Main ─────────────────────────────────────────────────────────────

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Fetch car photos for AutoEdge")
    parser.add_argument("--pexels-only", action="store_true",
                        help="Use only Pexels (needs PEXELS_API_KEY)")
    parser.add_argument("--wiki-only", action="store_true",
                        help="Use only Wikimedia Commons (no key needed)")
    parser.add_argument("--unsplash-only", action="store_true",
                        help="Use only Unsplash (needs UNSPLASH_ACCESS_KEY)")
    args = parser.parse_args()

    # Load existing data (preserve "locked" entries)
    existing = {}
    if OUTPUT_JSON.exists():
        with open(OUTPUT_JSON) as f:
            existing = json.load(f)

    pexels_key, unsplash_key = _load_keys()

    # Report available sources
    print("=" * 60)
    print("AVAILABLE SOURCES")
    print("=" * 60)
    if pexels_key:
        print("  ✅ Pexels API — key found")
    else:
        print("  ⬚  Pexels API — no key (PEXELS_API_KEY empty or missing, skipping)")
    if unsplash_key:
        print("  ✅ Unsplash API — key found")
    else:
        print("  ⬚  Unsplash API — no key (UNSPLASH_ACCESS_KEY empty or missing, skipping)")
    print("  ✅ Wikimedia Commons — always available (no key needed)")
    print()

    vehicles = _get_vehicles_from_db()
    print(f"Found {len(vehicles)} vehicles in database.\n")

    result = {}
    low_photo_cars = []
    source_stats = {"Pexels": 0, "Unsplash": 0, "Wikimedia": 0}

    for v in vehicles:
        key = f"{v['make']}|{v['model']}|{v['year']}"
        print(f"→ {key}")

        # Skip cars whose photos are managed manually by the team
        if (v["make"], v["model"], v["year"]) in MANUAL_PHOTO_CARS:
            print("  [MANUAL PHOTOS — skipped by team decision]")
            # Don't overwrite existing data if present
            if key in existing:
                result[key] = existing[key]
            else:
                result[key] = []
            print()
            continue

        # Skip locked entries
        if key in existing:
            old_photos = existing[key]
            if isinstance(old_photos, list) and any(p.get("locked") for p in old_photos):
                print("  [LOCKED — skipped]")
                result[key] = old_photos
                continue

        photos = []
        car_sources = []

        # ── Source 1: Pexels (if key available and not excluded) ──────
        if not args.wiki_only and not args.unsplash_only and pexels_key:
            print("  Pexels: ", end="")
            pexels_photos = fetch_pexels(v["make"], v["model"], pexels_key)
            print(f"{len(pexels_photos)} photos")
            photos.extend(pexels_photos)
            if pexels_photos:
                car_sources.append("Pexels")
            time.sleep(RATE_LIMIT_DELAY)

        # ── Source 2: Unsplash (if key available, used when < 2 photos) ──
        if not args.wiki_only and not args.pexels_only and unsplash_key and len(photos) < MIN_PHOTOS_TARGET:
            print("  Unsplash: ", end="")
            unsplash_photos = fetch_unsplash(v["make"], v["model"], unsplash_key)
            print(f"{len(unsplash_photos)} photos")
            existing_urls = {p["url"] for p in photos}
            for up in unsplash_photos:
                if up["url"] not in existing_urls and len(photos) < 4:
                    photos.append(up)
            if unsplash_photos:
                car_sources.append("Unsplash")
            time.sleep(RATE_LIMIT_DELAY)

        # ── Source 3: Wikimedia (always available, used when < 2 photos) ──
        if not args.pexels_only and not args.unsplash_only and len(photos) < MIN_PHOTOS_TARGET:
            print("  Wikimedia: ", end="")
            wiki_photos = fetch_wikimedia(v["make"], v["model"])
            print(f"{len(wiki_photos)} photos")
            existing_urls = {p["url"] for p in photos}
            for wp in wiki_photos:
                if wp["url"] not in existing_urls and len(photos) < 4:
                    photos.append(wp)
            if wiki_photos:
                car_sources.append("Wikimedia")
            time.sleep(RATE_LIMIT_DELAY)

        # Track stats
        for p in photos:
            src = _identify_source(p)
            source_stats[src] = source_stats.get(src, 0) + 1

        if len(photos) < MIN_PHOTOS_TARGET:
            low_photo_cars.append(key)

        result[key] = photos
        source_str = " + ".join(car_sources) if car_sources else "none"
        print(f"  Total: {len(photos)} photos (from: {source_str})\n")

    # Write JSON
    with open(OUTPUT_JSON, "w") as f:
        json.dump(result, f, indent=2)
    print(f"\n✅ Wrote {OUTPUT_JSON}")

    # Generate preview HTML
    _generate_preview_html(result)
    print(f"✅ Wrote {OUTPUT_HTML}")

    # ── Report ───────────────────────────────────────────────────────
    print(f"\n{'='*60}")
    print("REPORT")
    print(f"{'='*60}")
    for key, photos in result.items():
        sources = set(_identify_source(p) for p in photos)
        count = len(photos)
        indicator = "✅" if count >= MIN_PHOTOS_TARGET else "⚠️"
        print(f"  {indicator} {key}: {count} photos ({', '.join(sources) if sources else 'none'})")

    print(f"\n  Source totals: {', '.join(f'{k}: {v}' for k, v in source_stats.items() if v > 0)}")
    total_photos = sum(len(p) for p in result.values())
    print(f"  Total photos: {total_photos} across {len(result)} vehicles")

    if low_photo_cars:
        print(f"\n⚠️  Cars with fewer than {MIN_PHOTOS_TARGET} photos ({len(low_photo_cars)}):")
        for car in low_photo_cars:
            print(f"    - {car}")

    if len(low_photo_cars) > 3:
        print(f"\n⚠️  More than 3 cars have fewer than {MIN_PHOTOS_TARGET} photos.")
        print("    The storefront will show a fallback image for cars without photos.")
        print("    You can add photos manually later via the staff vehicle form.")

    if not low_photo_cars:
        print(f"\n🎉 All vehicles have at least {MIN_PHOTOS_TARGET} photos!")


def _generate_preview_html(data: dict):
    """Generate a simple HTML contact sheet for the owner to review."""
    html_parts = ["""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>AutoEdge Vehicle Images Preview</title>
<style>
body { font-family: Inter, sans-serif; background: #0D0F17; color: #E8EAF0; padding: 20px; }
h1 { color: #4D7FFF; }
.car { margin-bottom: 30px; border: 1px solid #2A2D3E; border-radius: 8px; padding: 16px; background: #161821; }
.car h2 { margin: 0 0 12px 0; font-size: 18px; }
.photos { display: flex; gap: 10px; flex-wrap: wrap; }
.photos img { height: 180px; border-radius: 6px; object-fit: cover; }
.credit { font-size: 11px; color: #8B90A7; margin-top: 4px; }
.source-badge { display: inline-block; font-size: 10px; padding: 2px 6px; border-radius: 4px; margin-left: 6px; }
.source-pexels { background: #05A081; color: white; }
.source-unsplash { background: #111; color: white; border: 1px solid #333; }
.source-wikimedia { background: #339966; color: white; }
.no-photos { color: #EF4444; font-style: italic; }
.count { font-size: 13px; color: #8B90A7; margin-left: 10px; }
</style></head><body>
<h1>🚗 AutoEdge — Vehicle Images Preview</h1>
<p>Review the photos below. Replace any by editing <code>vehicle_images.json</code> (set <code>"locked": true</code> to keep on re-run).</p>
"""]

    for key, photos in data.items():
        count = len(photos)
        count_color = "#4ADE80" if count >= 2 else "#EF4444"
        html_parts.append(f'<div class="car"><h2>{key} <span class="count" style="color:{count_color}">{count} photo{"s" if count != 1 else ""}</span></h2>')
        if photos:
            html_parts.append('<div class="photos">')
            for p in photos:
                credit = p.get("credit", "")
                source = p.get("source_url", "")
                src_name = _identify_source(p)
                badge_class = f"source-{src_name.lower()}"
                html_parts.append(
                    f'<div><img src="{p["url"]}" alt="{key}" loading="lazy">'
                    f'<div class="credit"><a href="{source}" style="color:#4D7FFF">{credit}</a>'
                    f' <span class="source-badge {badge_class}">{src_name}</span></div></div>'
                )
            html_parts.append('</div>')
        else:
            html_parts.append('<p class="no-photos">No photos found — fallback image will be used.</p>')
        html_parts.append('</div>')

    html_parts.append('</body></html>')

    with open(OUTPUT_HTML, "w", encoding="utf-8") as f:
        f.write("\n".join(html_parts))


if __name__ == "__main__":
    main()
