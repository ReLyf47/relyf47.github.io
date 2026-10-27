#!/usr/bin/env python3
"""
Comifuro X/Twitter & Socials Enricher (Option 2 Scraper)
=========================================================
Automatically discovers, enriches, and synchronizes:
  1. Multiple X/Twitter posts & catalogue announcements per circle
  2. Multiple artist Twitter/X handles under each circle/group
  3. Pre-order form links (Google Forms, Linktree, Trakteer, etc.)
  4. Community map datasets (Mikira details.json & enrich.json)

Usage:
  python enrich_x_posts.py
  python enrich_x_posts.py --edition 24
  python enrich_x_posts.py --edition 24 --scrape-missing --limit 50
"""

import sys
import os
import re
import json
import time
import html
import argparse
import urllib.request
import urllib.parse
from datetime import datetime

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0"
]


def extract_twitter_handle(url_or_str):
    if not url_or_str:
        return ""
    s = str(url_or_str).strip()
    m = re.search(r"(?:x|twitter)\.com/([A-Za-z0-9_]{1,15})", s, re.IGNORECASE)
    if m:
        return m.group(1)
    if s.startswith("@"):
        return s[1:].strip()
    if re.match(r"^[A-Za-z0-9_]{1,15}$", s):
        return s
    return ""


def search_duckduckgo_x_posts(handle, edition=""):
    """
    Searches DuckDuckGo HTML for catalogue / announcement tweets from the artist handle.
    Returns list of { id, author, text, url, po_link } dicts.
    """
    if not handle:
        return []

    ed_query = f"CF{edition}" if edition and edition.isdigit() else "CF OR Comifuro"
    query = f"site:x.com/{handle} ({ed_query} OR katalog OR catalogue OR booth)"
    search_url = "https://html.duckduckgo.com/html/?q=" + urllib.parse.quote(query)

    req = urllib.request.Request(search_url, headers={
        "User-Agent": USER_AGENTS[0],
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,id;q=0.8"
    })

    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            content = resp.read().decode("utf-8", errors="ignore")
    except Exception as e:
        print(f"    [!] Search request error for @{handle}: {e}")
        return []

    # Find result snippets and status URLs
    # Pattern 1: x.com/{handle}/status/{id}
    status_ids = re.findall(r"x\.com/" + re.escape(handle) + r"/status/(\d+)", content, re.IGNORECASE)
    snippets = re.findall(r"<a[^>]*class=\"result__snippet\"[^>]*>(.*?)</a>", content, re.DOTALL)

    results = []
    seen_ids = set()

    for idx, sid in enumerate(status_ids):
        if sid in seen_ids:
            continue
        seen_ids.add(sid)

        text = ""
        if idx < len(snippets):
            clean = re.sub(r"<[^>]+>", "", snippets[idx]).strip()
            text = html.unescape(clean)

        po_link = ""
        if text:
            m_po = re.search(r"(https?://(?:forms\.gle|docs\.google\.com/forms|t\.co/[a-zA-Z0-9]+)[^\s]*)", text)
            if m_po:
                po_link = m_po.group(1)

        results.append({
            "id": sid,
            "author": handle,
            "text": text or f"Pengumuman katalog Comifuro dari @{handle}",
            "url": f"https://x.com/{handle}/status/{sid}",
            "po_link": po_link
        })

    return results


def check_and_sync_community_dataset(edition="", output_dir="."):
    """
    Attempts to download updated details.json and enrich.json from Mikira if available.
    """
    map_dir = os.path.join(output_dir, "map")
    os.makedirs(map_dir, exist_ok=True)

    urls_to_try = [
        ("details.json", f"https://cf.mikira.id/heavy/details.json"),
        ("enrich.json", f"https://cf.mikira.id/heavy/enrich.json"),
    ]

    for fname, url in urls_to_try:
        target_path = os.path.join(map_dir, fname)
        if not os.path.exists(target_path):
            print(f"[*] Checking community dataset from {url}...")
            try:
                req = urllib.request.Request(url, headers={"User-Agent": USER_AGENTS[0]})
                with urllib.request.urlopen(req, timeout=15) as resp:
                    if resp.status == 200:
                        data_bytes = resp.read()
                        with open(target_path, "wb") as f:
                            f.write(data_bytes)
                        print(f"[+] Downloaded {fname} ({len(data_bytes):,} bytes)")
            except Exception as e:
                print(f"[*] Community {fname} not fetched: {e}")


def enrich_catalog(output_dir=".", edition="", scrape_missing=False, limit=30):
    print("\n" + "="*55)
    print(f"🚀 COMIFURO SOCIALS & X-POST ENRICHER (OPTION 2)")
    print("="*55)
    edition_str = str(edition).strip() if edition else ""
    if edition_str:
        print(f"Event Edition Target : CF{edition_str} (Comifuro {edition_str})")
    else:
        print("Event Edition Target : (Auto / Generic)")

    # 1. Sync community dataset if missing
    check_and_sync_community_dataset(edition=edition_str, output_dir=output_dir)

    # 2. Load booths data
    target_data_dir = os.path.join(output_dir, "data") if os.path.isdir(os.path.join(output_dir, "data")) else output_dir
    booths_path = os.path.join(target_data_dir, "booths.json")
    if not os.path.exists(booths_path):
        # Fallback to booths-data.js
        js_path = os.path.join(target_data_dir, "booths-data.js")
        if os.path.exists(js_path):
            with open(js_path, "r", encoding="utf-8") as f:
                c = f.read()
                idx = c.find("window.BOOTHS_DATA = ")
                if idx != -1:
                    circles = json.loads(c[idx + len("window.BOOTHS_DATA = "):c.rfind(";")])
                else:
                    print("[!] Could not parse booths-data.js")
                    return
        else:
            print(f"[!] No booths dataset found in {target_data_dir}")
            return
    else:
        with open(booths_path, "r", encoding="utf-8") as f:
            circles = json.load(f)

    total_circles = len(circles)
    print(f"[*] Loaded {total_circles:,} circles from catalog.")

    # 3. Load samples dataset
    samples_path = os.path.join(target_data_dir, "comifuro-samples.js")
    samples_by_name = {}
    if os.path.exists(samples_path):
        try:
            with open(samples_path, "r", encoding="utf-8") as f:
                txt = f.read()
                idx = txt.find("window.COMIFURO_SAMPLES_BY_NAME = ")
                if idx != -1:
                    samples_by_name = json.loads(txt[idx + len("window.COMIFURO_SAMPLES_BY_NAME = "):txt.rfind(";")])
        except Exception as e:
            print(f"[*] Warning loading samples: {e}")

    # 4. Optional Live Scraper for missing circles
    newly_enriched = 0
    if scrape_missing:
        print(f"\n[*] Running live X discovery scraper (limit: {limit} circles)...")
        candidates = []
        for c in circles:
            name_key = c["name"].strip().lower()
            s_entry = samples_by_name.get(name_key, {})
            has_posts = bool(s_entry.get("x_posts") or s_entry.get("x_post"))
            if not has_posts:
                handle = extract_twitter_handle(c.get("circle_twitter") or c.get("circle_other_socials"))
                if handle:
                    candidates.append((c, handle))

        print(f"[*] Found {len(candidates)} circles without X-posts that have a Twitter handle.")
        for idx, (c, handle) in enumerate(candidates[:limit]):
            print(f"  [{idx+1}/{min(len(candidates), limit)}] Searching X posts for circle '{c['name']}' (@{handle})...")
            posts = search_duckduckgo_x_posts(handle, edition=edition_str)
            if posts:
                print(f"    [+] Found {len(posts)} announcement tweet(s)!")
                name_key = c["name"].strip().lower()
                if name_key not in samples_by_name:
                    samples_by_name[name_key] = {
                        "id": c["id"],
                        "name": c["name"],
                        "circle_code": c.get("circle_code"),
                        "sampleworks": c.get("sampleworks_images") or [],
                        "has_samples": bool(c.get("sampleworks_images")),
                        "x_posts": posts,
                        "x_post": posts[0],
                        "x_handles": [handle],
                        "po_link": posts[0].get("po_link", "")
                    }
                else:
                    samples_by_name[name_key]["x_posts"] = posts
                    samples_by_name[name_key]["x_post"] = posts[0]
                    if handle not in samples_by_name[name_key].get("x_handles", []):
                        samples_by_name[name_key].setdefault("x_handles", []).append(handle)
                    if posts[0].get("po_link") and not samples_by_name[name_key].get("po_link"):
                        samples_by_name[name_key]["po_link"] = posts[0]["po_link"]
                newly_enriched += 1
            else:
                print(f"    [-] No recent CF tweets found for @{handle}.")
            time.sleep(0.8)

    # 5. Re-run static asset generator to refresh all mapping files cleanly
    print("\n[*] Refreshing static mapping files with latest enriched posts...")
    from update_catalog import update_static_assets
    update_static_assets(circles, output_dir=output_dir, edition=edition_str)

    # 6. Final Report
    with open(samples_path, "r", encoding="utf-8") as f:
        txt = f.read()
        idx = txt.find("window.COMIFURO_SAMPLES_BY_NAME = ")
        final_samples = json.loads(txt[idx + len("window.COMIFURO_SAMPLES_BY_NAME = "):txt.rfind(";")])

    total_with_x = sum(1 for v in final_samples.values() if v.get("x_posts") or v.get("x_post"))
    total_multi_x = sum(1 for v in final_samples.values() if len(v.get("x_posts", [])) > 1)
    total_with_po = sum(1 for v in final_samples.values() if v.get("po_link") or any(p.get("po_link") for p in v.get("x_posts", [])))

    print("\n" + "="*55)
    print("📊 ENRICHMENT SUMMARY")
    print("="*55)
    print(f"Total Circles in Catalog        : {total_circles:,}")
    print(f"Circles with X-Post / Promos    : {total_with_x:,} ({total_with_x/total_circles*100:.1f}%)")
    print(f"Circles with MULTIPLE X-Posts   : {total_multi_x:,}")
    print(f"Circles with Pre-Order Links    : {total_with_po:,}")
    if scrape_missing:
        print(f"Newly Discovered Live Posts     : {newly_enriched:,}")
    print("="*55 + "\n")


def main():
    parser = argparse.ArgumentParser(description="Enrich Comifuro catalog with X-posts and multi-socials.")
    parser.add_argument("--output-dir", "-o", default=".", help="Root catalog directory")
    parser.add_argument("--edition", "-e", default="", help="Event edition number (e.g. 24)")
    parser.add_argument("--scrape-missing", "-s", action="store_true", help="Run live DuckDuckGo X scraper for missing circles")
    parser.add_argument("--limit", "-l", type=int, default=25, help="Max circles to search live")

    args = parser.parse_args()
    enrich_catalog(output_dir=args.output_dir, edition=args.edition, scrape_missing=args.scrape_missing, limit=args.limit)


if __name__ == "__main__":
    main()
