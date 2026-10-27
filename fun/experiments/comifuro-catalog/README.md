# Comic Frontier Curated Catalog & Floor Map

> **100% Vibecoded**, inspired by [https://cf.mikira.id/heavy/](https://cf.mikira.id/heavy/), data scraped directly from [https://catalog.comifuro.net/catalog](https://catalog.comifuro.net/catalog).

Curated exhibition directory and interactive floor map with integrated official Comifuro sample works, instant booth floor map pinpointing, Instagram-style zoomed post modal, data export (CSV/JSON), and fallback to official X announcements.

---

## 🚀 Live Demo & Application

- **Designer Catalog + Interactive Floor Map:** [`index.html`](index.html)

Built with **100% native HTML5, CSS3, and modern JavaScript** with zero build dependencies, clean separation of concerns, and fully ready for **GitHub Pages**.

---

## 📁 Clean Architecture & Project Structure

The project has been refactored into a clean, modular structure:

```text
comifuro-catalog/
├── index.html              # Main application shell (semantic HTML5 markup)
├── styles.css              # Obsidian glassmorphic & Memphis styling rules
├── script.js               # Application controller & state management (with CSV/JSON export)
├── README.md               # Documentation & maintenance guide
├── update_catalog.sh       # ⚡ 1-Click Master Updater Script (runs scraper + enricher + validation)
├── update_catalog.py       # Catalog re-scraper and static asset generator
├── enrich_x_posts.py       # Option 2: Automated multi-X post & artist socials enricher
├── manifest.webmanifest    # Progressive Web App manifest
├── favicon.svg             # SVG vector favicon
├── favicon-32.png          # Standard 32x32 PNG favicon
├── apple-touch-icon.png    # iOS touch icon
├── data/                   # Scraped catalog datasets
│   ├── booths-data.js      # Global BOOTHS_DATA array for zero-CORS offline browsing
│   ├── comifuro-samples.js # Official sample works catalog mappings & multi-X posts
│   └── booths.csv          # Pre-generated complete booth directory CSV
└── map/                    # Interactive floor map engine & venue datasets
    ├── map.js              # Canvas floor map renderer & pan/zoom navigation engine
    ├── map.css             # Floor map UI stylesheets and controls
    ├── data.json           # ICE BSD floor layout geometry and booth coordinates
    ├── details.json        # Extended booth details (5,200+ X posts & pre-orders)
    ├── enrich.json         # Multi-artist Twitter handles, fandom tags and community metadata
    ├── aliases.json        # Search aliases for circles and fandoms
    ├── labels.json         # Map aisle and hall labels
    ├── rallies.json        # Stamp rally metadata
    ├── events.json         # Stage and activity schedules
    ├── announce.json       # Live announcements feed
    └── i18n-*.json         # Localization files (en, ja, th, vi, zh)
```

---

## ✨ Features

1. **Curated Designer Catalog View (Default):**
   - High-end Tokyo art exhibition / obsidian glassmorphism aesthetic.
   - Quick Rating Filter pills: **Semua (1,957)**, **GA (1,107)**, **PG (700)**, and **M (150)** with glowing status indicators.
   - Real-time search across booth codes, circle names, and fandoms (press `/` to search).
   - Filter by day (Sabtu, Minggu), block (A to Z, AA to AH), and artwork availability.
   - Visual Art Cards grid and compact Directory Table view modes.
   - One-click **Export CSV** and **Export JSON** buttons for filtered results.
   - Personal Wishlist bookmarking system (`⭐`).

2. **Comprehensive Circle & Floor Map Detail View ("Lihat Detail"):**
   - Clicking `"Lihat Detail"` on any booth card or table row opens a spotlight modal.
   - **Left Main Card:**
     - **Top Split:** Official circle cut poster alongside an embedded **Mini Floor Map Viewport** centered directly on the booth's coordinates with pin and surrounding aisles.
     - **Circle Metadata:** Monospace booth pill (e.g. `AA-01/AA-02`, `P-12ab`), bold circle name, Day (`Both Days`), Space (`Booth_B`), and content rating badge (`GA / PG / M`).
     - **Fandoms & Works:** Curated fandoms list and works offered badges (`Artbook`, `Goods`, `Comic`, `Game`, etc.).
     - **Links & Socials:** Clickable buttons for official Twitter / 𝕏, Instagram, Facebook, and YouTube channels.
     - **Official X Post Announcement Box:** Verified quoted tweet announcement, author handle, `Buka postingan ↗`, and `📋 Form Pre-Order ↗` links.
     - **Action Bar:** `Open on Official Comifuro ↗` and vibrant magenta gradient `★ Add to Wishlist` button.
     - **Full Map Mode:** One-click `⛶ Peta Penuh` button on the mini map expands directly into full-screen interactive floor map navigation.
   - **Right Panel (SAMPLE WORKS):**
     - Attached gallery tab displaying high-resolution sample work sheets.
     - Clicking any thumbnail opens the full Instagram-style post lightbox modal.
     - Graceful empty state when a circle has not uploaded catalog sheets.

3. **Instagram-Style Zoomed Post Modal:**
   - Clicking any sample artwork opens a full Instagram-like modal rather than a plain new tab.
   - **Left stage:** High-resolution artwork view with carousel pagination dots, next/prev arrow buttons, and link to full-resolution source image.
   - **Right sidebar:** Artist circle cut avatar, circle name, booth badge, content rating badge (GA/PG/M), fandom tags, merchandise types, sample counter, and official Comifuro catalog link.
   - Full keyboard navigation with `←` / `→` (or `A` / `D`) and `Esc` to close.

4. **Smart Fallback (Sample Works vs. X Announcements):**
   - **Circles with sample works:** Displays an artwork preview thumbnail strip.
   - **Circles without sample works:** Automatically displays their verified official X (Twitter) announcement post quote, direct tweet link, and pre-order form.

5. **First-Visit Disclaimer Modal:**
   - Welcome intro displayed only on the user's first visit (persisted via `localStorage`).
   - Accessible anytime via the `ℹ` info button in the top navigation bar.

---

## 🔄 1-Click Master Updater (e.g. for CF24, CF25, and Future Events)

Whenever a new event arrives (such as Comic Frontier 24), you can update the entire application, scrape all official circles, and automatically enrich multiple X/Twitter posts and artist handles with **a single command**:

```bash
# ⚡ 1-Click Full Update (Auto-detects edition from official catalog):
./update_catalog.sh

# Or explicitly specify the edition number (e.g. CF24):
./update_catalog.sh 24

# Or also run live DuckDuckGo discovery for missing X posts:
./update_catalog.sh 24 --scrape-x
```

### What `./update_catalog.sh` Does Under the Hood:
1. **Official Catalog Scraper (`update_catalog.py`):**
   - Connects to `https://catalog.comifuro.net/catalog` (or custom URL) and extracts all registered booths.
   - Saves clean, structured datasets in `data/`: `booths.json`, `booths.csv`, `booths-data.js`, and `event-info.json`.
2. **Socials & Multi-X Post Enricher (`enrich_x_posts.py` - Option 2):**
   - Discovers and links **multiple X/Twitter announcement tweets** per circle (with tab switching and tweet navigation).
   - Extracts all individual artist Twitter handles in group circles (`@Artist1`, `@Artist2`, etc.).
   - Discovers pre-order form links (Google Forms, Linktree, Trakteer) directly from announcement tweets.
   - Preserves previously saved posts so manual verifications are never overwritten.
3. **Syntax & Data Integrity Validation:**
   - Validates all generated JSON and verifies JavaScript syntax with `node -c`.

### Deploying Updates to GitHub Pages:
```bash
git add .
git commit -m "Update catalog data for Comifuro 24"
git push origin main
```
