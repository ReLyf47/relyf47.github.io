#!/usr/bin/env bash
# =====================================================================
# COMIFURO CATALOG ONE-CLICK MASTER UPDATER
# =====================================================================
# Scrapes the official Comifuro catalog and automatically enriches:
#   - Booths data (CSV, JSON, JS)
#   - Multiple X/Twitter announcement posts per circle
#   - Multiple artist Twitter/X handles
#   - Pre-order form links (Google Forms, Linktree, Trakteer)
#   - Sample works and circle cut avatars
#
# USAGE:
#   ./update_catalog.sh            # Auto-detects edition from CF site
#   ./update_catalog.sh 24         # Updates for Comifuro 24
#   ./update_catalog.sh 24 --scrape-x  # Also runs live DuckDuckGo discovery
# =====================================================================

set -e

# Change directory to the script's home
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

EDITION=""
SCRAPE_X=false
CUSTOM_URL=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --edition|-e)
      EDITION="$2"
      shift 2
      ;;
    --scrape-x|-s)
      SCRAPE_X=true
      shift
      ;;
    --url|-u)
      CUSTOM_URL="$2"
      shift 2
      ;;
    --help|-h)
      echo "Comifuro One-Click Catalog Updater"
      echo "Usage: ./update_catalog.sh [edition_number] [options]"
      echo ""
      echo "Arguments:"
      echo "  edition_number        e.g. '24', '25', or 'generic'"
      echo "  --scrape-x, -s        Run live DuckDuckGo search for missing X-posts"
      echo "  --url, -u URL         Custom catalog URL (default: https://catalog.comifuro.net/catalog)"
      echo "  --help, -h            Show this help"
      exit 0
      ;;
    *)
      if [[ -z "$EDITION" && "$1" =~ ^[0-9]+|generic$ ]]; then
        EDITION="$1"
      fi
      shift
      ;;
  esac
done

echo ""
echo "=========================================================="
echo "⚡ COMIFURO 1-CLICK CATALOG & FLOOR MAP UPDATER"
echo "=========================================================="
if [[ -n "$EDITION" ]]; then
  echo "Target Event Edition : Comifuro $EDITION (CF$EDITION)"
else
  echo "Target Event Edition : (Auto-detecting from official catalog)"
fi
echo "Working Directory    : $SCRIPT_DIR"
echo "=========================================================="
echo ""

# 1. Check Python3
if ! command -v python3 &> /dev/null; then
  echo "[!] Error: python3 is not installed or not in PATH."
  exit 1
fi

# 2. Run Catalog Scraper
echo "[*] Step 1/3: Scraping official catalog from catalog.comifuro.net..."
PY_ARGS=("--output-dir" ".")
if [[ -n "$EDITION" ]]; then
  PY_ARGS+=("--edition" "$EDITION")
fi
if [[ -n "$CUSTOM_URL" ]]; then
  PY_ARGS+=("--url" "$CUSTOM_URL")
fi

python3 update_catalog.py "${PY_ARGS[@]}"

# 3. Run Socials & Multi-X Post Enricher (Option 2)
echo ""
echo "[*] Step 2/3: Enriching multiple X-posts, artist handles & pre-orders..."
ENRICH_ARGS=("--output-dir" ".")
if [[ -n "$EDITION" ]]; then
  ENRICH_ARGS+=("--edition" "$EDITION")
fi
if [[ "$SCRAPE_X" == true ]]; then
  ENRICH_ARGS+=("--scrape-missing" "--limit" "30")
fi

python3 enrich_x_posts.py "${ENRICH_ARGS[@]}"

# 4. Verify syntax and data integrity
echo "[*] Step 3/3: Running validation checks..."
if command -v node &> /dev/null; then
  node -c script.js
  if [[ -f "map/map.js" ]]; then
    node -c map/map.js
  fi
  echo "[+] JavaScript syntax verification passed!"
else
  echo "[*] Node not installed, skipped node syntax check."
fi

echo ""
echo "=========================================================="
echo "🎉 ALL DONE! CATALOG IS FULLY UPDATED & READY TO DEPLOY"
echo "=========================================================="
echo "To publish your changes to GitHub Pages, run:"
echo "  git add ."
echo "  git commit -m \"Update catalog data for Comifuro ${EDITION:-current}\""
echo "  git push origin main"
echo "=========================================================="
echo ""
