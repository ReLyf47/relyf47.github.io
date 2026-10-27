#!/usr/bin/env python3
"""
Comifuro Event Catalog Re-Scraper & Static Asset Generator
==========================================================
Scrapes the official Comic Frontier catalog (e.g. CF23, CF24, or generic)
and generates/updates the static data files for GitHub Pages:
  - data/booths.json
  - data/booths.csv
  - data/booths-data.js (includes window.EVENT_INFO)
  - data/event-info.json
  - data/comifuro-samples.js

Usage:
  python update_catalog.py
  python update_catalog.py --edition 24
  python update_catalog.py --url https://catalog.comifuro.net/catalog --edition 24
  python update_catalog.py --edition generic
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


def detect_edition(url="", html_content=""):
    """
    Attempts to auto-detect the Comifuro edition number from the URL or HTML contents.
    Returns string like '24' or '' if generic/not found.
    """
    # 1. Look in URL path e.g. /cf24/, /comifuro-24/
    if url:
        m = re.search(r'(?:cf|comifuro)[-_/]?(\d+)', url, re.IGNORECASE)
        if m:
            return m.group(1)

    # 2. Look in HTML <title> or heading e.g. "Comic Frontier 24"
    if html_content:
        m = re.search(r'(?:comic\s*frontier|comifuro)\s*(\d+)', html_content, re.IGNORECASE)
        if m:
            return m.group(1)

    return ""


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
    return circles, content


def normalize_name(s):
    if not s:
        return ""
    return re.sub(r"[\s\-_–—]+", "", s.lower())


def update_static_assets(circles, output_dir=".", edition=""):
    os.makedirs(output_dir, exist_ok=True)
    total = len(circles)
    edition_str = str(edition).strip() if edition else ""

    event_info = {
        "edition": edition_str,
        "name": f"Comifuro {edition_str}".strip() if edition_str else "Comifuro",
        "short_name": f"CF{edition_str}" if edition_str else "CF",
        "title": f"Comic Frontier {edition_str}".strip() if edition_str else "Comic Frontier",
        "updated_at": datetime.now().isoformat(),
        "total_circles": total
    }

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
    print(f"📊 CATALOG SUMMARY STATISTICS: {event_info['name']}")
    print("="*50)
    print(f"Edition Tag               : {edition_str or '(Generic Comifuro)'}")
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

    # Target output directory for data files (defaults to data/ if present)
    target_data_dir = os.path.join(output_dir, "data") if os.path.isdir(os.path.join(output_dir, "data")) else output_dir

    # 2. Write event-info.json
    event_info_path = os.path.join(target_data_dir, "event-info.json")
    with open(event_info_path, "w", encoding="utf-8") as f:
        json.dump(event_info, f, ensure_ascii=False, indent=2)
    print(f"[+] Saved: {event_info_path}")

    # 3. Write booths.json
    json_path = os.path.join(target_data_dir, "booths.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(circles, f, ensure_ascii=False, indent=2)
    print(f"[+] Saved: {json_path} ({os.path.getsize(json_path):,} bytes)")

    # 4. Write booths.csv
    csv_path = os.path.join(target_data_dir, "booths.csv")
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

    # 5. Write booths-data.js (includes window.EVENT_INFO for zero-CORS static browsing)
    js_data_path = os.path.join(target_data_dir, "booths-data.js")
    with open(js_data_path, "w", encoding="utf-8") as f:
        f.write("// Comifuro Scraped Catalog Booths Data\n")
        f.write(f"// Generated on: {datetime.now().isoformat()}\n")
        f.write(f"window.EVENT_INFO = {json.dumps(event_info, ensure_ascii=False)};\n")
        f.write("window.BOOTHS_DATA = ")
        json.dump(circles, f, ensure_ascii=False)
        f.write(";\n")
    print(f"[+] Saved: {js_data_path} ({os.path.getsize(js_data_path):,} bytes)")

    # 6. Build comifuro-samples.js mapping
    samples_js_path = os.path.join(target_data_dir, "comifuro-samples.js")
    existing_x_posts = {}
    if os.path.exists(samples_js_path):
        try:
            with open(samples_js_path, "r", encoding="utf-8") as f:
                prev_txt = f.read()
                m_idx = prev_txt.find("window.COMIFURO_SAMPLES_BY_NAME = ")
                if m_idx != -1:
                    end_idx = prev_txt.rfind(";")
                    parsed = json.loads(prev_txt[m_idx + len("window.COMIFURO_SAMPLES_BY_NAME = "):end_idx])
                    for k, v in parsed.items():
                        if isinstance(v, dict) and v.get("x_post"):
                            existing_x_posts[k] = v["x_post"]
            if existing_x_posts:
                print(f"[*] Preserved {len(existing_x_posts):,} previously enriched circle X announcement posts.")
        except Exception as e:
            print(f"[*] Note: couldn't load existing x_posts ({e})")

    # Check if map data.json exists in map/ or output directory
    data_json_path = None
    for candidate in [os.path.join("map", "data.json"), "data.json", "data.b303e0ca.json"]:
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

    # Load details.json and enrich.json if present
    details_data = {}
    enrich_data = {}
    for det_candidate in [os.path.join(output_dir, "map", "details.json"), os.path.join(output_dir, "details.json")]:
        if os.path.exists(det_candidate):
            try:
                with open(det_candidate, "r", encoding="utf-8") as f:
                    details_data = json.load(f)
                    print(f"[*] Loaded extended X-posts from {det_candidate} ({len(details_data):,} circles)")
                break
            except Exception as e:
                print(f"[!] Warning reading {det_candidate}: {e}")

    for enr_candidate in [os.path.join(output_dir, "map", "enrich.json"), os.path.join(output_dir, "enrich.json")]:
        if os.path.exists(enr_candidate):
            try:
                with open(enr_candidate, "r", encoding="utf-8") as f:
                    enrich_data = json.load(f)
                    print(f"[*] Loaded multi-socials from {enr_candidate} ({len(enrich_data):,} circles)")
                break
            except Exception as e:
                print(f"[!] Warning reading {enr_candidate}: {e}")

    mikira_name_to_idx = {}
    if mikira_c:
        for m_idx, item in enumerate(mikira_c):
            if isinstance(item, list) and len(item) > 0:
                m_name = item[0].strip()
                mikira_name_to_idx[m_name.lower()] = m_idx
                mikira_name_to_idx[normalize_name(m_name)] = m_idx

    samples_by_idx = {}
    samples_by_name = {}

    def extract_entry(c_match, mikira_idx=None):
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

        name_key = c_match["name"].strip().lower()

        # Resolve mikira index if not provided
        if mikira_idx is None:
            mikira_idx = mikira_name_to_idx.get(name_key) or mikira_name_to_idx.get(normalize_name(c_match["name"]))

        x_posts = []
        x_handles = []
        extra_socials = []
        po_link = ""

        # Primary Twitter handle from official registration
        if c_match.get("circle_twitter"):
            m_tw = re.search(r"(?:x|twitter)\.com/([A-Za-z0-9_]{1,15})", c_match["circle_twitter"])
            if m_tw:
                x_handles.append(m_tw.group(1))

        if mikira_idx is not None:
            str_idx = str(mikira_idx)
            det = details_data.get(str_idx, {})
            enr = enrich_data.get(str_idx, {})

            # Extract all socials / handles
            s_list = enr.get("s", [])
            for item in s_list:
                if isinstance(item, str):
                    if item.startswith("http"):
                        extra_socials.append(item)
                    elif item:
                        x_handles.append(item)
                elif isinstance(item, list) and len(item) >= 2:
                    k, u = item[0], item[1]
                    if k == "X":
                        m = re.search(r"(?:x|twitter)\.com/([A-Za-z0-9_]{1,15})", u)
                        if m:
                            x_handles.append(m.group(1))
                        else:
                            x_handles.append(u)
                    else:
                        extra_socials.append({"type": k, "url": u})

            # Extract pre-order link
            for l_item in det.get("l", []):
                if isinstance(l_item, list) and len(l_item) >= 2 and l_item[0] == "po":
                    po_link = l_item[1]
                    break

            # Extract posts
            for p in det.get("p", []):
                if isinstance(p, list) and len(p) >= 3:
                    a_val, tweet_id, p_text = p[0], str(p[1]), str(p[2])
                    author = ""
                    if isinstance(a_val, int) and 0 <= a_val < len(s_list):
                        cand = s_list[a_val]
                        author = cand if isinstance(cand, str) else (cand[1] if isinstance(cand, list) else "")
                        if "x.com/" in author or "twitter.com/" in author:
                            m = re.search(r"(?:x|twitter)\.com/([A-Za-z0-9_]{1,15})", author)
                            if m:
                                author = m.group(1)
                    elif isinstance(a_val, str):
                        author = a_val

                    if not author and x_handles:
                        author = x_handles[0]

                    post_url = f"https://x.com/{author or i/web}/status/{tweet_id}"
                    post_po = po_link
                    if not post_po:
                        po_m = re.search(r"(https?://(?:forms\.gle|docs\.google\.com/forms|t\.co/[a-zA-Z0-9]+)[^\s]*)", p_text)
                        if po_m:
                            post_po = po_m.group(1)

                    x_posts.append({
                        "id": tweet_id,
                        "author": author,
                        "text": p_text,
                        "url": post_url,
                        "po_link": post_po
                    })
                elif isinstance(p, list) and len(p) == 2 and isinstance(p[0], str) and p[0].startswith("http"):
                    # Direct external link (Instagram, etc.)
                    p_url, p_text = p[0], str(p[1])
                    post_po = po_link
                    po_m = re.search(r"(https?://(?:forms\.gle|docs\.google\.com/forms|t\.co/[a-zA-Z0-9]+)[^\s]*)", p_text)
                    if po_m:
                        post_po = po_m.group(1)
                    x_posts.append({
                        "id": "",
                        "author": c_match.get("name"),
                        "text": p_text,
                        "url": p_url,
                        "po_link": post_po
                    })

        # Fallback to existing_x_posts if no posts extracted from details.json
        if not x_posts:
            prev = existing_x_posts.get(name_key) or c_match.get("x_post")
            if prev and isinstance(prev, dict):
                x_posts.append(prev)
                if prev.get("po_link") and not po_link:
                    po_link = prev["po_link"]

        # Deduplicate handles
        x_handles = list(dict.fromkeys([h for h in x_handles if h]))

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
            "x_posts": x_posts,
            "x_post": x_posts[0] if x_posts else None,
            "x_handles": x_handles,
            "extra_socials": extra_socials,
            "po_link": po_link,
            "works": works,
            "official_url": f"https://catalog.comifuro.net/circle/{c_match['id']}"
        }

    # Map by mikira index
    if mikira_c:
        for idx, item in enumerate(mikira_c):
            name = item[0].strip() if isinstance(item, list) and len(item) > 0 else ""
            match = comifuro_by_name.get(name.lower()) or comifuro_by_norm.get(normalize_name(name))
            if match:
                entry = extract_entry(match, mikira_idx=idx)
                samples_by_idx[idx] = entry

    # Also map all circles by name
    for c in circles:
        name_lower = c["name"].strip().lower()
        entry = extract_entry(c)
        samples_by_name[name_lower] = entry

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
        for fname in ["comifuro-samples.js", "booths.json", "booths-data.js", "event-info.json"]:
            src = os.path.join(target_data_dir, fname)
            dst = os.path.join(mikira_subdir, fname)
            if os.path.exists(src):
                try:
                    import shutil
                    shutil.copy2(src, dst)
                    print(f"[+] Synced copy to: {dst}")
                except Exception:
                    pass

    print("\n✅ All static files updated successfully!")
    print("--------------------------------------------------")
    print("To publish your update to GitHub Pages:")
    print("  git add data/ index.html script.js styles.css update_catalog.py")
    print(f"  git commit -m \"Update catalog listing for {event_info['name']}\"")
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
    parser.add_argument(
        "--edition", "-e",
        default=None,
        help="Event edition number/tag (e.g. '24', '25', or 'generic' / '' for unbranded Comifuro). Auto-detected if omitted."
    )
    args = parser.parse_args()

    # Determine execution root
    out_dir = os.path.abspath(args.output_dir)
    print(f"Comifuro Re-Scraper Tool")
    print(f"Target URL : {args.url}")
    print(f"Output Dir : {out_dir}")

    circles, html_content = scrape_comifuro_catalog(args.url)

    # Resolve edition
    if args.edition is not None:
        raw_ed = args.edition.strip()
        edition = "" if raw_ed.lower() in ("generic", "none", "false", "") else raw_ed
    else:
        edition = detect_edition(url=args.url, html_content=html_content)

    print(f"Resolved Edition : {edition or '(Generic Comifuro)'}")
    update_static_assets(circles, out_dir, edition=edition)


if __name__ == "__main__":
    main()
