/* ==========================================
   TRANSITION BOOT
   Keeps the wipe from flashing on load.
========================================== */

const params = new URLSearchParams(location.search);

const type =
    params.get("type") === "manga"
        ? "manga"
        : "anime";

const from =
    params.get("from") || "/";

const body = document.body;
const pageTransition = document.getElementById("page-transition");

function setTransitionState(toType, covered = false) {
    if (!pageTransition) return;

    pageTransition.dataset.to = toType;
    pageTransition.style.transition = "none";
    pageTransition.style.opacity = covered ? "1" : "0";
    pageTransition.style.transform = covered
        ? "translateX(0%)"
        : "translateX(110%)";
}

(function applyInstantCover() {
    const pending = sessionStorage.getItem("pendingTransition");
    if (!pending) return;

    sessionStorage.removeItem("pendingTransition");

    try {
        const { toType } = JSON.parse(pending);
        setTransitionState(toType, true);
    } catch {
        setTransitionState(type, true);
    }
})();

/* ==========================================
   18+ WARNING
========================================== */

document.addEventListener("DOMContentLoaded", () => {
    const warning = document.getElementById("age-warning");
    if (!warning) return;

    if (sessionStorage.getItem("nsfwWarningShown")) {
        warning.remove();
        return;
    }

    document
        .getElementById("accept-warning")
        ?.addEventListener("click", () => {
            sessionStorage.setItem("nsfwWarningShown", "true");
            warning.remove();
        });

    document
        .getElementById("reject-warning")
        ?.addEventListener("click", () => {
            body.classList.add("fade-out");
            setTimeout(() => {
                window.location.href = "/";
            }, 420);
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

let coverCache = {};

const CSV_FILE = type === "anime" ? "anime.csv" : "manga.csv";
const COVER_FILE = type === "anime" ? "anime-covers.json" : "manga-covers.json";

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
        triggerTransition(nextType, () => {
            location.href = `?type=${nextType}&from=${encodeURIComponent(from)}`;
        });
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

function triggerTransition(toType, callback) {
    if (!pageTransition) {
        callback();
        return;
    }

    setTransitionState(toType, false);
    void pageTransition.offsetWidth;

    body.classList.add("fade-out");

    requestAnimationFrame(() => {
        pageTransition.style.transition =
            "transform .48s cubic-bezier(.77,0,.18,1), opacity .22s ease";
        pageTransition.style.opacity = "1";
        pageTransition.style.transform = "translateX(0%)";
    });

    sessionStorage.setItem(
        "pendingTransition",
        JSON.stringify({ toType })
    );

    setTimeout(callback, 490);
}

function playReveal() {
    if (!pageTransition) return;

    if (pageTransition.style.transform !== "translateX(0%)") {
        body.classList.add("page-ready");
        return;
    }

    body.classList.add("page-ready");

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            pageTransition.style.transition =
                "transform .62s cubic-bezier(.77,0,.18,1), opacity .34s ease";
            pageTransition.style.opacity = "0";
            pageTransition.style.transform = "translateX(-110%)";
        });
    });

    setTimeout(() => {
        pageTransition.style.transition = "none";
        pageTransition.style.opacity = "0";
        pageTransition.style.transform = "translateX(110%)";
    }, 700);
}

document.addEventListener("DOMContentLoaded", () => {
    requestAnimationFrame(() => {
        body.classList.add("page-ready");
    });
});

window.addEventListener("load", playReveal);

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
   DATA FETCH + RENDER
========================================== */

Promise.all([
    fetch(CSV_FILE).then(r => r.text()),
    fetch(COVER_FILE).then(r => r.json())
]).then(([csv, covers]) => {
    coverCache = covers;

    const parsed = Papa.parse(csv, {
        header: true,
        skipEmptyLines: true
    });

    render(parsed.data);
}).catch(err => {
    console.error("Failed to load data:", err);
});

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
                    coverCache[String(animeId)] ||
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