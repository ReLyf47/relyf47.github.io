# Comic Frontier Curated Catalog & Floor Map

> **100% Vibecoded**, inspired by [https://cf.mikira.id/heavy/](https://cf.mikira.id/heavy/), data scraped directly from [https://catalog.comifuro.net/catalog](https://catalog.comifuro.net/catalog).

Curated exhibition directory and interactive floor map with integrated official Comifuro sample works, instant booth floor map pinpointing, Instagram-style zoomed post modal, and fallback to official X announcements.

---

## 🚀 Live Demo & Pages

- **Designer Catalog + Circle Detail Spotlight:** [`index.html`](index.html)
- **Directory Table + Rating Filter:** [`catalog.html`](catalog.html)

Both pages are built with **100% native HTML, CSS, and JavaScript** with zero build tools or server dependencies, ready for **GitHub Pages**.

---

## ✨ Features

1. **Curated Designer Catalog View (Default):**
   - High-end Tokyo art exhibition / obsidian glassmorphism dark aesthetic.
   - Quick Rating Filter pills: **Semua (1,957)**, **GA (1,107)**, **PG (700)**, and **M (150)** with glowing status indicators.
   - Real-time search across booth codes, circle names, and fandoms (press `/` to search).
   - Filter by day (Sabtu, Minggu), block (A to Z, AA to AH), and artwork availability.
   - Visual Art Cards grid and compact Directory Table view modes.
   - Personal Wishlist bookmarking system (`⭐`).

2. **Comprehensive Circle & Floor Map Detail View ("Lihat Detail"):**
   - Clicking `"Lihat Detail"` on any booth card or table row opens a glassmorphic spotlight modal.
   - **Left Main Card:**
     - **Top Split:** Official circle cut poster alongside an embedded **Mini Floor Map Viewport** centered directly on the booth's coordinates with pink booth pin and surrounding aisles.
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
   - Contains the exact quote:
     > `"100% Vibecoded, inspired by https://cf.mikira.id/heavy/, data scraped directly from https://catalog.comifuro.net/catalog"`
   - Accessible anytime via the `ℹ` info button in the top navigation bar.

---

## 🔄 How to Re-Scrape & Update for Future Events (e.g. CF24)

Whenever a new event arrives (such as Comic Frontier 24), you can re-scrape the latest catalog with a single command:

```bash
# Default re-scrape (current catalog):
python update_catalog.py

# Or specify a custom event URL:
python update_catalog.py --url https://catalog.comifuro.net/catalog
```

### What `update_catalog.py` Does:
1. Connects to the target Comifuro catalog URL and parses the latest participating circles.
2. Generates updated `booths.json`, `booths.csv`, `booths-data.js`, and `comifuro-samples.js`.
3. Displays a statistical summary of ratings, days, and sample works.

### Deploying the Update to GitHub Pages:
```bash
git add booths.json booths.csv booths-data.js comifuro-samples.js index.html
git commit -m "Update catalog listing for CF24"
git push origin main
```
Your GitHub Pages site will automatically update within 1-2 minutes!

---

## 🛠️ GitHub Pages Deployment

1. Create a repository on GitHub (e.g., `cf-catalog`).
2. Push all files in this directory to the repository:
   ```bash
   git init
   git add .
   git commit -m "Initial release of CF designer catalog & floor map"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main
   ```
3. In your GitHub repository:
   - Go to **Settings** > **Pages**.
   - Under **Build and deployment** > **Branch**, select `main` and root `/`.
   - Click **Save**.
4. Your site will be live at `https://<your-username>.github.io/<your-repo>/`!
