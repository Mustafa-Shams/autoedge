"""Automatic car photo fetcher — spec section 12.1.

Sources:
1. Pexels API (if PEXELS_API_KEY is set) — best quality, landscape orientation
2. Wikimedia Commons (fallback, no key needed) — CC0/PD/CC-BY/CC-BY-SA only

Usage:
    cd backend
    python database/fetch_vehicle_images.py           # fetch from available sources
    python database/fetch_vehicle_images.py --pexels-only   # Pexels only
    python database/fetch_vehicle_images.py --wiki-only     # Wikimedia only

Article XX: Lawful Images Only — Pexels API and Wikimedia Commons only, with credit.
"""
import json
import os
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
            # Rate limited — wait and retry once
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
            # Filter: at least 1200px wide
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
            # Prefer large2x, fallback to large
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
            license_url_val = meta.get("LicenseUrl", {}).get("value", "")

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
            # Strip HTML tags from artist
            import re
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


# ── Main ─────────────────────────────────────────────────────────────

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Fetch car photos for AutoEdge")
    parser.add_argument("--pexels-only", action="store_true")
    parser.add_argument("--wiki-only", action="store_true")
    args = parser.parse_args()

    # Load existing data (preserve "locked" entries)
    existing = {}
    if OUTPUT_JSON.exists():
        with open(OUTPUT_JSON) as f:
            existing = json.load(f)

    pexels_key = os.environ.get("PEXELS_API_KEY", "")
    if not pexels_key:
        try:
            from dotenv import load_dotenv
            load_dotenv(SCRIPT_DIR.parent / ".env")
            pexels_key = os.environ.get("PEXELS_API_KEY", "")
        except Exception:
            pass

    vehicles = _get_vehicles_from_db()
    print(f"Found {len(vehicles)} vehicles in database.\n")

    result = {}
    low_photo_cars = []

    for v in vehicles:
        key = f"{v['make']}|{v['model']}|{v['year']}"
        print(f"→ {key}")

        # Skip locked entries
        if key in existing:
            old_photos = existing[key]
            if isinstance(old_photos, list) and any(p.get("locked") for p in old_photos):
                print("  [LOCKED — skipped]")
                result[key] = old_photos
                continue

        photos = []

        # Try Pexels first
        if not args.wiki_only and pexels_key:
            print("  Pexels: ", end="")
            pexels_photos = fetch_pexels(v["make"], v["model"], pexels_key)
            print(f"{len(pexels_photos)} photos")
            photos.extend(pexels_photos)
            time.sleep(RATE_LIMIT_DELAY)

        # Wikimedia fallback (or primary if pexels-only is not set and Pexels gave <2)
        if not args.pexels_only and len(photos) < 2:
            print("  Wikimedia: ", end="")
            wiki_photos = fetch_wikimedia(v["make"], v["model"])
            print(f"{len(wiki_photos)} photos")
            # Add wiki photos that aren't duplicates
            existing_urls = {p["url"] for p in photos}
            for wp in wiki_photos:
                if wp["url"] not in existing_urls and len(photos) < 4:
                    photos.append(wp)
            time.sleep(RATE_LIMIT_DELAY)

        if len(photos) < 2:
            low_photo_cars.append(key)

        result[key] = photos
        print(f"  Total: {len(photos)} photos\n")

    # Write JSON
    with open(OUTPUT_JSON, "w") as f:
        json.dump(result, f, indent=2)
    print(f"\n✅ Wrote {OUTPUT_JSON}")

    # Generate preview HTML
    _generate_preview_html(result)
    print(f"✅ Wrote {OUTPUT_HTML}")

    # Report
    print(f"\n{'='*60}")
    print("REPORT")
    print(f"{'='*60}")
    for key, photos in result.items():
        sources = set(
            "Pexels" if "pexels" in p.get("license", "").lower() else "Wikimedia"
            for p in photos
        )
        print(f"  {key}: {len(photos)} photos ({', '.join(sources) if sources else 'none'})")

    if low_photo_cars:
        print(f"\n⚠️  Cars with fewer than 2 photos ({len(low_photo_cars)}):")
        for car in low_photo_cars:
            print(f"    - {car}")

    if len(low_photo_cars) > 3:
        print("\n⚠️  More than 3 cars have fewer than 2 photos.")
        print("    The storefront will show a fallback image for cars without photos.")
        print("    You can add photos manually later via the staff vehicle form.")


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
.no-photos { color: #EF4444; font-style: italic; }
</style></head><body>
<h1>🚗 AutoEdge — Vehicle Images Preview</h1>
<p>Review the photos below. Replace any by editing <code>vehicle_images.json</code> (set <code>"locked": true</code> to keep on re-run).</p>
"""]

    for key, photos in data.items():
        html_parts.append(f'<div class="car"><h2>{key}</h2>')
        if photos:
            html_parts.append('<div class="photos">')
            for p in photos:
                credit = p.get("credit", "")
                source = p.get("source_url", "")
                html_parts.append(
                    f'<div><img src="{p["url"]}" alt="{key}" loading="lazy">'
                    f'<div class="credit"><a href="{source}" style="color:#4D7FFF">{credit}</a></div></div>'
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
