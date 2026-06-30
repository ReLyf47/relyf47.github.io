/* ==========================================
   TRANSITION BOOT
   Initializes URL parameters and states.
========================================== */

const params = new URLSearchParams(location.search);

let type =
    params.get("type") === "manga"
        ? "manga"
        : "anime";

const from =
    params.get("from") || "/";

const body = document.body;
const pageTransition = document.getElementById("page-transition");

/* ==========================================
   18+ WARNING
========================================== */

document.addEventListener("DOMContentLoaded", () => {
    const warning = document.getElementById("age-warning");
    if (!warning) return;

    if (sessionStorage.getItem("nsfwWarningShown")) {
        warning.remove();
        document.body.style.overflow = "";
        return;
    }

    document.body.style.overflow = "hidden";

    document
        .getElementById("accept-warning")
        ?.addEventListener("click", () => {
            sessionStorage.setItem("nsfwWarningShown", "true");
            sessionStorage.setItem("nsfwAllowed", "true");
            document.body.style.overflow = "";
            warning.remove();
            renderFilteredData();
        });

    document
        .getElementById("reject-warning")
        ?.addEventListener("click", () => {
            sessionStorage.setItem("nsfwWarningShown", "true");
            sessionStorage.setItem("nsfwAllowed", "false");
            document.body.style.overflow = "";
            warning.remove();
            renderFilteredData();
        });
});

/* ==========================================
   REFERRER MEMORY
========================================== */

if (!sessionStorage.getItem("animangaReferrer")) {
    if (document.referrer && !document.referrer.includes("/extra/animanga/")) {
        sessionStorage.setItem("animangaReferrer", document.referrer);
    }
}

/* ==========================================
   CONSTANTS
========================================== */

const STATUS_ORDER = [
    "COMPLETED",
    "CURRENT",
    "PAUSED",
    "DROPPED",
    "PLANNING"
];

const STATUS_NAMES = {
    COMPLETED: "Completed",
    CURRENT: type === "manga" ? "Reading" : "Watching",
    PAUSED: "Paused",
    DROPPED: "Dropped",
    PLANNING: "Planning"
};

const FORMAT_ORDER = [
    "TV",
    "MOVIE",
    "TV_SHORT",
    "OVA",
    "ONA",
    "SPECIAL",
    "MANGA",
    "NOVEL",
    "LIGHT_NOVEL",
    "ONE_SHOT"
];

const pageTitle = document.getElementById("page-title");
const switchBtn = document.getElementById("switch-btn");
const topbar = document.querySelector(".topbar");

if (pageTitle) {
    pageTitle.textContent = type === "anime" ? "Anime List" : "Manga List";
}

if (switchBtn) {
    switchBtn.textContent = type === "anime" ? "Switch to Manga" : "Switch to Anime";

    switchBtn.addEventListener("click", () => {
        const nextType = type === "anime" ? "manga" : "anime";
        performTransition(nextType, true);
    });
}

/* ==========================================
   TOPBAR SCROLL POLISH
========================================== */

function updateTopbarState() {
    if (!topbar) return;

    topbar.classList.toggle("compact", window.scrollY > 100);
}

window.addEventListener("scroll", updateTopbarState, {
    passive: true
});

window.addEventListener("load", updateTopbarState);

/* ==========================================
   TRANSITION FUNCTIONS
========================================== */

let isTransitioning = false;

function updateState(nextType) {
    type = nextType;
    
    // Update body classes
    body.classList.toggle("manga-mode", type === "manga");
    
    // Update titles and buttons
    if (pageTitle) {
        pageTitle.textContent = type === "anime" ? "Anime List" : "Manga List";
    }
    if (switchBtn) {
        switchBtn.textContent = type === "anime" ? "Switch to Manga" : "Switch to Anime";
    }
    
    // Update status name for current type
    STATUS_NAMES.CURRENT = type === "manga" ? "Reading" : "Watching";
    
    // Load and render data
    loadAndRenderData(type);
}

function performTransition(nextType, pushHistory = true) {
    if (type === nextType || isTransitioning) return;
    isTransitioning = true;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const executeStateUpdate = () => {
        if (document.startViewTransition) {
            document.startViewTransition(() => updateState(nextType));
        } else {
            updateState(nextType);
        }
    };

    if (pushHistory) {
        const newUrl = `?type=${nextType}&from=${encodeURIComponent(from)}`;
        history.pushState({ type: nextType }, '', newUrl);
    }

    if (prefersReducedMotion || !pageTransition) {
        executeStateUpdate();
        isTransitioning = false;
        return;
    }

    // 1. Set target media type to update active color theme (glow and eyes)
    pageTransition.dataset.to = nextType;
    
    // 2. Trigger the synced CSS animations
    pageTransition.classList.add("active");
    executeStateUpdate();

    // 3. Cleanup after animation completes (800ms)
    setTimeout(() => {
        pageTransition.classList.remove("active");
        isTransitioning = false;
    }, 800);
}

document.addEventListener("DOMContentLoaded", () => {
    requestAnimationFrame(() => {
        body.classList.add("page-ready");
    });
});

window.addEventListener("popstate", (e) => {
    const nextType = (e.state && e.state.type) || 
                     (new URLSearchParams(location.search).get("type") === "manga" ? "manga" : "anime");
    if (nextType !== type) {
        performTransition(nextType, false);
    }
});

/* ==========================================
   NORMALISE / FORMAT HELPERS
========================================== */

function normalizeScore(score) {
    const num = Number(score) || 0;
    return num > 10 ? Math.round(num / 10) : num;
}

function getFormatOrder(entries) {
    const formats = [...new Set(entries.map(x => x.Format).filter(Boolean))];

    formats.sort((a, b) => {
        const ia = FORMAT_ORDER.indexOf(a);
        const ib = FORMAT_ORDER.indexOf(b);

        if (ia === -1 && ib === -1) return a.localeCompare(b);
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
    });

    return formats;
}

/* ==========================================
   DATA FETCH + RENDER (WITH CACHING & PREFETCHING)
========================================== */

const dataCache = {
    anime: null,
    manga: null
};

let allData = [];

function renderFilteredData() {
    const nsfwAllowed = sessionStorage.getItem("nsfwAllowed") === "true";
    const filteredData = nsfwAllowed ? allData : allData.filter(item => !item.NSFW);
    render(filteredData);
}

function loadAndRenderData(targetType) {
    if (dataCache[targetType]) {
        allData = dataCache[targetType];
        renderFilteredData();
        return Promise.resolve();
    }

    const file = targetType === "anime" ? "assets/anime.json" : "assets/manga.json";
    return fetch(file)
        .then(r => r.json())
        .then(items => {
            dataCache[targetType] = items;
            if (type === targetType) {
                allData = items;
                renderFilteredData();
            }
            const otherType = targetType === "anime" ? "manga" : "anime";
            if (!dataCache[otherType]) {
                prefetchData(otherType);
            }
        })
        .catch(err => {
            console.error(`Failed to load ${targetType} data:`, err);
        });
}

function prefetchData(targetType) {
    const file = targetType === "anime" ? "assets/anime.json" : "assets/manga.json";
    fetch(file)
        .then(r => r.json())
        .then(items => {
            dataCache[targetType] = items;
        })
        .catch(err => {
            console.error(`Failed to prefetch ${targetType} data:`, err);
        });
}

// Initial load
loadAndRenderData(type);

function render(data) {
    const container = document.getElementById("anime-list");
    if (!container) return;

    container.innerHTML = "";

    STATUS_ORDER.forEach(status => {
        const statusEntries = data.filter(x => x.Status === status);
        if (!statusEntries.length) return;

        const details = document.createElement("details");
        details.open = true;

        const summary = document.createElement("summary");
        summary.textContent = `${STATUS_NAMES[status]} (${statusEntries.length})`;
        details.appendChild(summary);

        const formats = getFormatOrder(statusEntries);

        formats.forEach(format => {
            const formatEntries = statusEntries.filter(x => x.Format === format);
            if (!formatEntries.length) return;

            formatEntries.sort((a, b) => {
                const scoreA = normalizeScore(a.Score);
                const scoreB = normalizeScore(b.Score);

                if (scoreB !== scoreA) return scoreB - scoreA;
                return (a.Title || "").localeCompare(b.Title || "");
            });

            const section = document.createElement("div");
            section.className = "format";
            section.innerHTML = `<div class="format-title">${format}</div>`;

            const grid = document.createElement("div");
            grid.className = "anime-grid";

            formatEntries.forEach(entry => {
                const score = normalizeScore(entry.Score);

                const animeId =
                    entry["AniList ID"] ||
                    entry['"AniList ID"'] ||
                    entry.AniListID ||
                    entry.id;

                const cover =
                    entry.Cover ||
                    "https://placehold.co/400x600?text=No+Cover";

                const card = document.createElement("a");
                card.className = "anime-card";
                card.href =
                    type === "anime"
                        ? `https://anilist.co/anime/${animeId}/`
                        : `https://anilist.co/manga/${animeId}/`;
                card.target = "_blank";
                card.rel = "noopener noreferrer";

                card.innerHTML = `
                    <img loading="lazy" src="${cover}" alt="${entry.Title}">
                    <div class="anime-info">
                        <div class="anime-title">${entry.Title}</div>
                        <div class="anime-score">${score}/10</div>
                    </div>
                `;

                grid.appendChild(card);
            });

            section.appendChild(grid);
            details.appendChild(section);
        });

        container.appendChild(details);
    });
}

/* ==========================================
   BACK BUTTON
========================================== */

const backBtn = document.getElementById("back-btn");

if (backBtn) {
    backBtn.addEventListener("click", (e) => {
        e.preventDefault();
        body.classList.add("fade-out");
        setTimeout(() => {
            location.href = from;
        }, 420);
    });
}

/* ==========================================
   MISC
========================================== */

document.body.classList.toggle("manga-mode", type === "manga");