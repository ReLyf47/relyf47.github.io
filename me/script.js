/* ==========================================
   Default load
========================================== */

history.scrollRestoration = "manual";

window.addEventListener("load", () => {
    window.scrollTo(0, 0);

    document.getElementById("hero")?.scrollIntoView({
        behavior: "auto",
        block: "start",
    });
});

/* ==========================================
   BOOT SCREEN TYPEWRITER
========================================== */

window.onerror = function (msg, url, line) {
    console.error("ERROR:", msg, "line:", line);
};

const bootScreen = document.getElementById("boot-screen");
const bootText = document.getElementById("boot-text");

if (bootScreen && bootText) {
    const lines = [
        { text: "booting relyfOS...", delay: 800 },
        { text: "", delay: 200 },
        { text: "loading modules...", delay: 600 },
        { text: "", delay: 200 },
        { text: "✓ arch linux", delay: 300 },
        { text: "✓ programmer", delay: 300 },
        { text: "✓ gamer", delay: 300 },
        { text: "✓ anime addiction", delay: 300 },
        { text: "✓ questionable decisions", delay: 300 },
        { text: "", delay: 200 },
        { text: "system ready.", delay: 700 },
        { text: "", delay: 200 },
        { text: "click anywhere to continue", delay: 0 },
    ];

    let currentLine = 0;

    function typeLine() {
        if (currentLine >= lines.length) return;

        const lineObj = lines[currentLine];
        const text = lineObj.text;
        let charIndex = 0;

        const interval = setInterval(() => {
            if (charIndex < text.length) {
                bootText.textContent += text.charAt(charIndex);
                charIndex++;
            } else {
                clearInterval(interval);
                bootText.textContent += "\n";
                currentLine++;
                setTimeout(typeLine, lineObj.delay);
            }
        }, 2    );
    }

    bootText.textContent = "";
    typeLine();

    function dismissBoot() {
        bootScreen.classList.add("hidden");

        setTimeout(() => {
            bootScreen.remove();
        }, 800);
    }

    bootScreen.addEventListener("click", dismissBoot);
}

/* ==========================================
   MOUSE GLOW
========================================== */

const glow = document.getElementById("mouse-glow");

if (glow) {
    window.addEventListener("mousemove", (e) => {
        glow.style.left = e.clientX + "px";
        glow.style.top = e.clientY + "px";
    });
}

/* ==========================================
   SCROLL REVEAL
========================================== */

const revealElements = document.querySelectorAll(
    ".about-card, .dashboard-card, .collection-card, .contact-card, .project-terminal"
);

const revealObserver = new IntersectionObserver(
    (entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add("revealed");
            }
        });
    },
    {
        threshold: 0.15,
    }
);

revealElements.forEach((el) => {
    el.classList.add("reveal");
    revealObserver.observe(el);
});

/* ==========================================
   SKILL BAR ANIMATION
========================================== */

const skillBars = document.querySelectorAll(".bar div");

const skillObserver = new IntersectionObserver(
    (entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;

            const bar = entry.target;
            const targetWidth = bar.style.width;

            bar.style.width = "0";

            setTimeout(() => {
                bar.style.transition = "width 1.5s cubic-bezier(.22,.61,.36,1)";
                bar.style.width = targetWidth;
            }, 200);

            skillObserver.unobserve(bar);
        });
    },
    {
        threshold: 0.25,
    }
);

skillBars.forEach((bar) => {
    skillObserver.observe(bar);
});

/* ==========================================
   ACTIVE NAVIGATION
========================================== */

const sections = document.querySelectorAll("section");
const navLinks = document.querySelectorAll(".nav-links a");

function updateActiveNav() {
    let current = "";

    sections.forEach((section) => {
        const sectionTop = section.offsetTop - 150;

        if (window.scrollY >= sectionTop) {
            current = section.getAttribute("id");
        }
    });

    navLinks.forEach((link) => {
        link.classList.remove("active");

        if (link.getAttribute("href") === "#" + current) {
            link.classList.add("active");
        }
    });
}

window.addEventListener("scroll", updateActiveNav);
window.addEventListener("load", updateActiveNav);

/* ==========================================
   RANDOM TERMINAL COMMANDS
========================================== */

const projectTerminal = document.querySelector(".project-terminal pre");

if (projectTerminal) {
    const projects = [
        {
            name: "SimpleCalculator",
            url: "https://github.com/ReLyf47/SimpleCalculator",
        },
        {
            name: "FunnySpinningCube",
            url: "https://github.com/ReLyf47/FunnySpinningCube",
        },
        {
            name: "MoneyPylanner",
            url: "https://github.com/ReLyf47/MoneyPylanner",
        },
        {
            name: "CeLOE-Desktop",
            url: "https://github.com/ReLyf47/CeLOE-Desktop",
        },
        {
            name: "Website",
            url: "https://github.com/ReLyf47/relyf47.github.io",
        },
        {
            name: "Project-RTOS",
            url: "https://github.com/ReLyf47/Project-RTOS",
        },
    ];

    let index = 0;

    function renderProject() {
        const project = projects[index];

        projectTerminal.innerHTML = `
~ 
❯ ls projects
<a href="${project.url}"
   target="_blank"
   rel="noopener noreferrer"
   class="project-link">
${project.name}/
</a>
~ 
❯ <span class="terminal-cursor">█</span>
`;

        index = (index + 1) % projects.length;
    }

    renderProject();
    setInterval(renderProject, 5000);
}

/* ==========================================
   SMOOTH CARD TILT
========================================== */

const cards = document.querySelectorAll(
    ".dashboard-card, .collection-card, .contact-card"
);

cards.forEach((card) => {
    card.addEventListener("mousemove", (e) => {
        const rect = card.getBoundingClientRect();

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const rotateX = (y - rect.height / 2) / 20;
        const rotateY = -(x - rect.width / 2) / 20;

        card.style.transform = `
            perspective(1000px)
            rotateX(${rotateX}deg)
            rotateY(${rotateY}deg)
            translateY(-8px)
        `;
    });

    card.addEventListener("mouseleave", () => {
        card.style.transform = "perspective(1000px) rotateX(0) rotateY(0)";
    });
});

/* ==========================================
   EASTER EGG
========================================== */

let typed = "";

window.addEventListener("keydown", (e) => {
    typed += e.key.toLowerCase();

    if (typed.length > 20) {
        typed = typed.slice(-20);
    }

    if (typed.includes("arch")) {
        alert("I use Arch, btw.");
        typed = "";
    }
});

/* ==========================================
   SMOOTH SCROLL LINKS
========================================== */

document.querySelectorAll("[data-scroll]").forEach((link) => {
    link.addEventListener("click", (e) => {
        e.preventDefault();

        const target = document.getElementById(link.dataset.scroll);

        if (target) {
            target.scrollIntoView({
                behavior: "smooth",
                block: "start",
            });
        }
    });
});

/* ==========================================
   ANIME / MANGA CARD DYNAMIC BANNER
========================================== */

const animeCard =
    document.querySelector(".anime-card");

if (animeCard) {

    const animeLayers =
        setupCardLayers(animeCard);

    function setAnimeImage(imageUrl) {

        const incoming =
            animeLayers.active
                ? animeLayers.bgA
                : animeLayers.bgB;

        const outgoing =
            animeLayers.active
                ? animeLayers.bgB
                : animeLayers.bgA;

        incoming.style.backgroundImage =
            `url("${imageUrl}")`;

        requestAnimationFrame(() => {

            incoming.style.opacity = "1";
            outgoing.style.opacity = "0";

        });

        animeLayers.active =
            !animeLayers.active;
    }

    async function loadRandomBanner() {

        try {

            const sources = [
                "../extra/animanga/assets/anime-banners.json",
                "../extra/animanga/assets/manga-banners.json"
            ];

            const selectedSource =
                sources[
                    Math.floor(
                        Math.random() *
                        sources.length
                    )
                ];

            const response =
                await fetch(selectedSource);

            const banners =
                await response.json();

            if (!banners.length) return;

            const banner =
                banners[
                    Math.floor(
                        Math.random() *
                        banners.length
                    )
                ];

            const imageUrl =
                typeof banner === "string"
                    ? banner
                    : banner.image;

            const preload =
                new Image();

            preload.onload = () => {
                setAnimeImage(imageUrl);
            };

            preload.src = imageUrl;

        }

        catch (err) {

            console.error(
                "Failed to load banner:",
                err
            );

        }
    }

    loadRandomBanner();

    setInterval(
        loadRandomBanner,
        10000
    );
}

/* ==========================================
   GAME CARD DYNAMIC BANNER
========================================== */

function setupCardLayers(card) {

    const bgA = document.createElement("div");
    const bgB = document.createElement("div");

    bgA.className = "card-bg card-bg-a";
    bgB.className = "card-bg card-bg-b";

    card.prepend(bgA);
    card.prepend(bgB);

    return {
        bgA,
        bgB,
        active: false
    };
}

const gamesCard = document.querySelector(".games-card");

if (gamesCard) {

    const gameLayers = setupCardLayers(gamesCard);

    function setCardImage(imageUrl) {

        const incoming =
            gameLayers.active
                ? gameLayers.bgA
                : gameLayers.bgB;

        const outgoing =
            gameLayers.active
                ? gameLayers.bgB
                : gameLayers.bgA;

        incoming.style.backgroundImage =
            `url("${imageUrl}")`;

        requestAnimationFrame(() => {
            incoming.style.opacity = "1";
            outgoing.style.opacity = "0";
        });

        gameLayers.active = !gameLayers.active;
    }

    async function loadRandomGameBanner() {

        try {

            const response =
                await fetch("../extra/games/games.json");

            const games =
                await response.json();

            const validGames = games.filter(
                game =>
                    game.favorite &&
                    game.image &&
                    game.image.includes("/apps/")
            );

            if (!validGames.length) return;

            const randomGame =
                validGames[
                    Math.floor(
                        Math.random() *
                        validGames.length
                    )
                ];

            const appid =
                randomGame.image.match(
                    /apps\/(\d+)\//
                )[1];

            const hero2x =
                `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appid}/library_hero_2x.jpg`;

            const hero =
                `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appid}/library_hero.jpg`;

            const img2x = new Image();

            img2x.onload = () => {
                setCardImage(hero2x);
            };

            img2x.onerror = () => {

                const imgHero =
                    new Image();

                imgHero.onload = () => {
                    setCardImage(hero);
                };

                imgHero.onerror = () => {
                    setCardImage(portrait);
                };

                imgHero.src = hero;
            };

            img2x.src = hero2x;

        }

        catch (err) {

            console.error(
                "Failed to load game banner:",
                err
            );

        }
    }

    loadRandomGameBanner();

    setInterval(
        loadRandomGameBanner,
        10000
    );
}