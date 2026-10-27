#!/usr/bin/env python3
"""
Comifuro Event Catalog Re-Scraper & Static Asset Generator
==========================================================
Scrapes the official Comic Frontier catalog (CF23, CF24, etc.)
and generates/updates the static data files for GitHub Pages:
  - booths.json
  - booths.csv
  - booths-data.js
  - comifuro-samples.js

Usage:
  python update_catalog.py
  python update_catalog.py --url https://catalog.comifuro.net/catalog
  python update_catalog.py --url https://catalog.comifuro.net/cf24/catalog
"""

import sys
import os
import re
import json
import csv
import argparse
import urllib.request
from datetime import datetime

DEFAULT_CATALOG_URL = "https://catalog.comifuro.net/catalog"

def scrape_comifuro_catalog(url=DEFAULT_CATALOG_URL):
    print(f"[*] Connecting to Comifuro Catalog: {url}")
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,id;q=0.8"
    }
    
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            status = response.status
            content = response.read().decode("utf-8", errors="ignore")
            print(f"[+] Successfully fetched {len(content):,} bytes of HTML (Status: {status})")
    except Exception as e:
        print(f"[!] Error fetching catalog from {url}: {e}")
        sys.exit(1)

    # Extract window.__INITIAL_STATE__
    print("[*] Parsing embedded state JSON...")
    idx = content.find("window.__INITIAL_STATE__=")
    if idx == -1:
        # Fallback regex search
        match = re.search(r'window\.__INITIAL_STATE__\s*=\s*(\{.*?\});\s*(?:var currentScript|;|\n|</script>)', content, re.DOTALL)
        if match:
            json_str = match.group(1)
        else:
            print("[!] Could not find 'window.__INITIAL_STATE__' in the catalog HTML.")
            sys.exit(1)
    else:
        end_idx = content.find(";var currentScript=", idx)
        if end_idx == -1:
            end_idx = content.find(";</script>", idx)
        if end_idx == -1:
            end_idx = content.find(";\n", idx)
        json_str = content[idx + len("window.__INITIAL_STATE__="):end_idx]

    try:
        data = json.loads(json_str)
    except Exception as e:
        print(f"[!] Failed to parse JSON from INITIAL_STATE: {e}")
        sys.exit(1)

    circles = data.get("circle", {}).get("allCircle", [])
    if not circles:
        print("[!] No circles found in data.circle.allCircle.")
        sys.exit(1)

    print(f"[+] Found {len(circles):,} circles/booths in catalog dataset.")
    return circles


def normalize_name(s):
    if not s:
        return ""
    return re.sub(r"[\s\-_–—]+", "", s.lower())


def update_static_assets(circles, output_dir="."):
    os.makedirs(output_dir, exist_ok=True)
    total = len(circles)

    # 1. Statistics Summary
    ratings_count = {}
    days_count = {}
    with_samples_count = 0

    for c in circles:
        r = c.get("rating") or "GA"
        ratings_count[r] = ratings_count.get(r, 0) + 1
        d = c.get("day") or "Both Days"
        days_count[d] = days_count.get(d, 0) + 1
        samples = c.get("sampleworks_images") or []
        if len(samples) > 0:
            with_samples_count += 1

    print("\n" + "="*50)
    print("📊 CATALOG SUMMARY STATISTICS")
    print("="*50)
    print(f"Total Participating Booths: {total:,}")
    print("\nContent Ratings Breakdown:")
    for r, count in sorted(ratings_count.items(), key=lambda x: x[1], reverse=True):
        pct = (count / total) * 100
        print(f"  • {r:4s} : {count:5,d} booths ({pct:5.1f}%)")

    print("\nDay Attendance Breakdown:")
    for d, count in sorted(days_count.items(), key=lambda x: x[1], reverse=True):
        print(f"  • {d:12s} : {count:5,d} booths")

    print(f"\nBooths with Sample Works : {with_samples_count:,} ({with_samples_count/total*100:.1f}%)")
    print("="*50 + "\n")

    # 2. Write booths.json
    json_path = os.path.join(output_dir, "booths.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(circles, f, ensure_ascii=False, indent=2)
    print(f"[+] Saved: {json_path} ({os.path.getsize(json_path):,} bytes)")

    # 3. Write booths.csv
    csv_path = os.path.join(output_dir, "booths.csv")
    fields = [
        'id', 'circle_code', 'name', 'rating', 'day', 'fandom', 'other_fandom',
        'Space', 'circle_cut', 'circle_twitter', 'circle_instagram',
        'circle_facebook', 'circle_youtube', 'circle_other_socials', 'marketplace_link',
        'SellsComic', 'SellsArtbook', 'SellsNovel', 'SellsGoods', 'SellsGame',
        'SellsMusic', 'SellsCommision', 'SellsHandmadeCrafts', 'SellsMagazine', 'SellsPhotobookCosplay'
    ]
    with open(csv_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields, extrasaction='ignore')
        writer.writeheader()
        for c in circles:
            writer.writerow(c)
    print(f"[+] Saved: {csv_path} ({os.path.getsize(csv_path):,} bytes)")

    # 4. Write booths-data.js (for zero-CORS offline browsing)
    js_data_path = os.path.join(output_dir, "booths-data.js")
    with open(js_data_path, "w", encoding="utf-8") as f:
        f.write("// Comifuro Scraped Catalog Booths Data\n")
        f.write("window.BOOTHS_DATA = ")
        json.dump(circles, f, ensure_ascii=False)
        f.write(";\n")
    print(f"[+] Saved: {js_data_path} ({os.path.getsize(js_data_path):,} bytes)")

    # 5. Build comifuro-samples.js mapping
    # Check if map data.b303e0ca.json or data.json exists in directory to map mikira indexes
    data_json_path = None
    for candidate in ["data.b303e0ca.json", "data.json"]:
        p = os.path.join(output_dir, candidate)
        if os.path.exists(p):
            data_json_path = p
            break

    mikira_c = []
    if data_json_path:
        try:
            with open(data_json_path, "r", encoding="utf-8") as f:
                d = json.load(f)
                mikira_c = d.get("c", [])
                print(f"[*] Linked with map circle indexes from {data_json_path} ({len(mikira_c):,} circles)")
        except Exception as e:
            print(f"[!] Warning reading map data: {e}")

    comifuro_by_name = {c["name"].strip().lower(): c for c in circles}
    comifuro_by_norm = {normalize_name(c["name"]): c for c in circles}
    comifuro_by_code = {}
    for c in circles:
        code = c.get("circle_code") or ""
        if code:
            for part in code.split("/"):
                comifuro_by_code[part.strip().upper()] = c

    samples_by_idx = {}
    samples_by_name = {}

    def extract_entry(c_match):
        samples = c_match.get("sampleworks_images") or []
        works = []
        for w_key, w_name in [
            ("SellsArtbook", "Artbook"), ("SellsGoods", "Goods"), ("SellsComic", "Comic"),
            ("SellsNovel", "Novel"), ("SellsGame", "Game"), ("SellsMusic", "Music"),
            ("SellsCommision", "Commission"), ("SellsHandmadeCrafts", "Handmade Crafts"),
            ("SellsMagazine", "Magazine"), ("SellsPhotobookCosplay", "Cosplay Photobook")
        ]:
            if c_match.get(w_key):
                works.append(w_name)

        return {
            "id": c_match["id"],
            "name": c_match["name"],
            "circle_code": c_match.get("circle_code"),
            "rating": c_match.get("rating") or "GA",
            "day": c_match.get("day") or "Both Days",
            "fandom": c_match.get("fandom") or "",
            "other_fandom": c_match.get("other_fandom") or "",
            "circle_cut": c_match.get("circle_cut") or "",
            "sampleworks": samples,
            "has_samples": len(samples) > 0,
            "works": works,
            "official_url": f"https://catalog.comifuro.net/circle/{c_match['id']}"
        }

    # Map by mikira index
    if mikira_c:
        for idx, item in enumerate(mikira_c):
            name = item[0].strip() if isinstance(item, list) and len(item) > 0 else ""
            match = comifuro_by_name.get(name.lower()) or comifuro_by_norm.get(normalize_name(name))
            if match:
                entry = extract_entry(match)
                samples_by_idx[idx] = entry

    # Also map all circles by name
    for c in circles:
        name_lower = c["name"].strip().lower()
        entry = extract_entry(c)
        samples_by_name[name_lower] = entry

    samples_js_path = os.path.join(output_dir, "comifuro-samples.js")
    with open(samples_js_path, "w", encoding="utf-8") as f:
        f.write("// Comifuro Catalog Sample Works Mapping for Floor Map & Lightbox\n")
        f.write(f"// Generated on: {datetime.now().isoformat()}\n")
        f.write("window.COMIFURO_SAMPLES_BY_IDX = ")
        json.dump(samples_by_idx, f, ensure_ascii=False)
        f.write(";\n")
        f.write("window.COMIFURO_SAMPLES_BY_NAME = ")
        json.dump(samples_by_name, f, ensure_ascii=False)
        f.write(";\n")

    print(f"[+] Saved: {samples_js_path} ({os.path.getsize(samples_js_path):,} bytes)")

    # Also update in mikira/ subdirectory if it exists
    mikira_subdir = os.path.join(output_dir, "mikira")
    if os.path.isdir(mikira_subdir):
        for fname in ["comifuro-samples.js", "booths.json"]:
            src = os.path.join(output_dir, fname)
            dst = os.path.join(mikira_subdir, fname)
            try:
                import shutil
                shutil.copy2(src, dst)
                print(f"[+] Synced copy to: {dst}")
            except Exception:
                pass

    print("\n✅ All static files updated successfully!")
    print("--------------------------------------------------")
    print("To publish your update to GitHub Pages:")
    print("  git add booths.json booths.csv booths-data.js comifuro-samples.js")
    print("  git commit -m \"Update catalog listing for Comifuro\"")
    print("  git push origin main")
    print("--------------------------------------------------")


def main():
    parser = argparse.ArgumentParser(
        description="Scrape Comifuro catalog and update GitHub Pages static files."
    )
    parser.add_argument(
        "--url", "-u",
        default=DEFAULT_CATALOG_URL,
        help=f"Target Comifuro catalog URL (default: {DEFAULT_CATALOG_URL})"
    )
    parser.add_argument(
        "--output-dir", "-o",
        default=".",
        help="Directory to save static output files (default: current directory)"
    )
    args = parser.parse_args()

    # Determine execution root
    out_dir = os.path.abspath(args.output_dir)
    print(f"Comifuro Re-Scraper Tool")
    print(f"Target URL : {args.url}")
    print(f"Output Dir : {out_dir}")

    circles = scrape_comifuro_catalog(args.url)
    update_static_assets(circles, out_dir)


if __name__ == "__main__":
    main()
