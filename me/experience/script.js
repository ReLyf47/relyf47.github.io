/* ==========================================
   STATE
========================================== */

const slides  = Array.from(document.querySelectorAll(".slide"));
const total   = slides.length;
let current   = 0;
let animating = false;

/* ==========================================
   THEME
========================================== */

function isDeepSlide(i) { return slides[i].classList.contains("slide-deep"); }

function applyTheme(i) {
    document.body.classList.toggle("is-deep", isDeepSlide(i));
}

/* ==========================================
   WATER SPLASH TRANSITION
   Persona-style: water erupts from bottom,
   splashes with bubbles + droplets, floods,
   drains to reveal new slide.
========================================== */

const waterOverlay = document.getElementById("water-overlay");
const waterCanvas  = document.getElementById("water-canvas");
const wCtx         = waterCanvas.getContext("2d");

function resizeWater() {
    waterCanvas.width  = window.innerWidth;
    waterCanvas.height = window.innerHeight;
}
resizeWater();
window.addEventListener("resize", resizeWater);

let waveAnim = null;

/* helpers */
function easeOut3(t) { return 1 - Math.pow(1 - t, 3); }
function easeIn3(t)  { return t * t * t; }
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

/* draw a smooth closed blob through an array of {x,y} points */
function drawBlob(pts) {
    if (pts.length < 3) return;
    wCtx.beginPath();
    for (let i = 0; i < pts.length; i++) {
        const p1 = pts[i];
        const p2 = pts[(i + 1) % pts.length];
        const mx = (p1.x + p2.x) / 2;
        const my = (p1.y + p2.y) / 2;
        if (i === 0) wCtx.moveTo(mx, my);
        else         wCtx.quadraticCurveTo(p1.x, p1.y, mx, my);
    }
    wCtx.closePath();
}

/* generate blob perimeter points — irregular, erupts from bottom */
function blobPts(cx, originY, rx, ry, noise, N) {
    return Array.from({ length: N }, (_, i) => {
        const a = (i / N) * Math.PI * 2 - Math.PI / 2; // start at top
        const n = 1 + (noise[i] - 0.5) * 0.55;
        // squash downward half so it feels like it came from below
        const sy = Math.sin(a) > 0 ? 0.55 : 1.2;
        return {
            x: cx       + Math.cos(a) * rx * n,
            y: originY  + Math.sin(a) * ry * sy * n,
        };
    });
}

/* droplets that fly off the eruption point */
function makeDroplets(W, H) {
    return Array.from({ length: 70 }, () => {
        const spread = (Math.random() - 0.5) * Math.PI * 0.95;
        // shoot upwards (angle centered at -PI/2)
        const angle  = -Math.PI / 2 + spread;
        const speed  = 300 + Math.random() * 450; // realistic splash velocity
        const col    = [
            [0,  120, 220],
            [0,  180, 255],
            [100, 225, 255],
            [210, 248, 255],
            [255, 255, 255],
        ][Math.floor(Math.random() * 5)];
        return {
            ox:    W * (0.05 + Math.random() * 0.9),
            oy:    H * 1.02,
            vx:    Math.cos(angle) * speed,
            vy:    Math.sin(angle) * speed,
            r:     2 + Math.random() * 9,
            col,
            alpha: 0.65 + Math.random() * 0.35,
        };
    });
}

/* bubbles that float inside the flood */
function makeBubbles(W, H) {
    return Array.from({ length: 90 }, () => ({
        x:     W * (0.02 + Math.random() * 0.96),
        y:     H * (0.1  + Math.random() * 0.8),
        r:     2 + Math.random() * 16,
        vy:    (0.8 + Math.random() * 2.5) * (Math.random() > 0.5 ? 1 : -1), // bubbles going up and down!
        phase: Math.random() * Math.PI * 2,
        alpha: 0.3 + Math.random() * 0.6,
    }));
}

/* Draw a realistic, smooth curvy water wave across the screen */
function drawRealisticWave(progress, scale, phase, baseAmp, color) {
    const W = waterCanvas.width;
    const H = waterCanvas.height;
    
    // progress is between 0 and 1
    const currentHeight = H * progress * scale;
    if (currentHeight <= 0) return;
    
    const amplitude = baseAmp * (1 - progress);
    
    wCtx.beginPath();
    // Start at bottom-left
    wCtx.moveTo(0, H);
    
    // Loop across the screen width to draw the wavy top edge
    const step = 15;
    for (let x = 0; x <= W; x += step) {
        // Sum of three harmonic sine waves for a natural liquid wave profile
        const waveOffset = Math.sin(x * 0.005 + phase) * amplitude
                         + Math.cos(x * 0.012 - phase * 0.7) * (amplitude * 0.5)
                         + Math.sin(x * 0.024 + phase * 1.3) * (amplitude * 0.2);
        
        const y = H - currentHeight + waveOffset;
        wCtx.lineTo(x, y);
    }
    
    // Line to bottom-right and close path
    wCtx.lineTo(W, H);
    wCtx.closePath();
    
    wCtx.fillStyle = color;
    wCtx.fill();
}

function runDiveTransition(diving, onMidpoint, onDone) {
    onMidpoint._fired = false;

    const W = waterCanvas.width;
    const H = waterCanvas.height;

    const droplets  = makeDroplets(W, H);
    const bubbles   = makeBubbles(W, H);
    const GRAVITY   = 400;   // px/s² (realistic gravity)

    // timing (ms)
    const T_RISE  = 400;
    const T_HOLD  = 120;
    const T_DRAIN = 360;
    const TOTAL   = T_RISE + T_HOLD + T_DRAIN;

    waterOverlay.style.opacity = "1";
    waterOverlay.classList.add("active");
    if (waveAnim) cancelAnimationFrame(waveAnim);
    let t0 = null;

    function frame(ts) {
        if (!t0) t0 = ts;
        const ms     = ts - t0;
        const riseT  = clamp(ms / T_RISE,  0, 1);
        const holdT  = clamp((ms - T_RISE) / T_HOLD, 0, 1);
        const drainT = clamp((ms - T_RISE - T_HOLD) / T_DRAIN, 0, 1);
        const isHold  = ms >= T_RISE && ms < T_RISE + T_HOLD;
        const isDrain = ms >= T_RISE + T_HOLD;

        wCtx.clearRect(0, 0, W, H);

        // Progress variables for animation phases
        let progress = 0;
        if (isDrain) {
            progress = 1 - easeIn3(drainT);
        } else if (isHold) {
            progress = 1;
        } else {
            progress = easeOut3(riseT);
        }

        const blobAlpha = isDrain ? clamp(1 - drainT * 1.5, 0, 1) : 1;

        // Wave phase based on time to animate the fluid flow
        const phase = ms * 0.006;

        /* ==========================================
           DRAW THREE WAVE LAYERS
           Layer 3: Foam Crest (Highest, drawn first)
           Layer 2: Vibrant Mid-Blue (Middle, drawn second)
           Layer 1: Deep Navy/Blue (Lowest, drawn third, covers everything below it)
           ========================================== */
        
        // Foam layer (Highest leading edge)
        const foamProgress = progress;
        drawRealisticWave(foamProgress, 1.04, phase, 50, `rgba(210, 248, 255, ${blobAlpha * 0.95})`);

        // Mid-blue layer (Middle leading edge)
        const midProgress = Math.pow(progress, 1.3);
        drawRealisticWave(midProgress, 1.02, phase + 2.0, 40, `rgba(0, 110, 210, ${blobAlpha * 0.98})`);

        // Deep-navy layer (Lowest leading edge, covers everything below to form base)
        const deepProgress = Math.pow(progress, 1.6);
        drawRealisticWave(deepProgress, 1.0, phase - 1.5, 30, `rgba(0, 45, 120, ${blobAlpha})`);

        /* -- droplets (flying particles) -- */
        const dt = ms / 1000;
        droplets.forEach(d => {
            const px = d.ox + d.vx * dt;
            const py = d.oy + d.vy * dt + 0.5 * GRAVITY * dt * dt;
            const da = d.alpha * clamp(1.2 - (ms / TOTAL), 0, 1) * blobAlpha;
            if (da <= 0 || px < 0 || px > W || py < -20 || py > H + 20) return;

            const [r,g,b] = d.col;
            
            // Draw realistic round water drops
            wCtx.beginPath();
            wCtx.arc(px, py, d.r, 0, Math.PI * 2);
            wCtx.fillStyle = `rgba(${r},${g},${b},${da})`;
            wCtx.fill();
            
            // Glint highlight inside drop
            wCtx.beginPath();
            wCtx.arc(px - d.r * 0.3, py - d.r * 0.3, d.r * 0.28, 0, Math.PI * 2);
            wCtx.fillStyle = `rgba(255,255,255,${da * 0.65})`;
            wCtx.fill();
        });

        /* -- bubbles -- */
        const ba = isDrain ? clamp(1 - drainT * 1.5, 0, 1) : 1;
        if (ba > 0) {
            bubbles.forEach(b => {
                const by = b.y - ms * b.vy * 0.05;
                const bx = b.x + Math.sin(ms * 0.002 + b.phase) * 12;
                if (by + b.r < 0 || by - b.r > H) return;
                const a = b.alpha * ba;
                // bubble ring
                wCtx.beginPath();
                wCtx.arc(bx, by, b.r, 0, Math.PI * 2);
                wCtx.strokeStyle = `rgba(180, 240, 255, ${a})`;
                wCtx.lineWidth   = 1.5;
                wCtx.stroke();
                // inner light fill
                wCtx.beginPath();
                wCtx.arc(bx, by, b.r, 0, Math.PI * 2);
                wCtx.fillStyle = `rgba(200, 245, 255, ${a * 0.12})`;
                wCtx.fill();
                // glint
                wCtx.beginPath();
                wCtx.arc(bx - b.r*0.33, by - b.r*0.33, b.r * 0.25, 0, Math.PI*2);
                wCtx.fillStyle = `rgba(255,255,255,${a * 0.6})`;
                wCtx.fill();
            });
        }

        /* -- midpoint: swap slides while screen is covered -- */
        if (ms >= T_RISE + T_HOLD * 0.35 && !onMidpoint._fired) {
            onMidpoint._fired = true;
            onMidpoint();
        }

        if (ms < TOTAL) {
            waveAnim = requestAnimationFrame(frame);
        } else {
            wCtx.clearRect(0, 0, W, H);
            waterOverlay.style.opacity = "0";
            waterOverlay.classList.remove("active");
            onDone();
        }
    }

    waveAnim = requestAnimationFrame(frame);
}

/* ==========================================
   SLIDE ENGINE
========================================== */

function crossesBoundary(from, to) {
    return isDeepSlide(from) !== isDeepSlide(to);
}

function swapSlides(from, to, direction) {
    slides[from].classList.add(direction === "down" ? "exit-up" : "exit-down");
    slides[from].classList.remove("active");
    slides[to].classList.add("active");
    updateDots(to);
    current = to;
    setTimeout(() => slides[from].classList.remove("exit-up", "exit-down"), 750);
}

function goTo(index, direction) {
    if (animating) return;
    if (index >= total) index = 0;
    if (index < 0)      index = total - 1;
    if (index === current) return;

    animating = true;

    const useWater = crossesBoundary(current, index);

    if (useWater) {
        runDiveTransition(
            isDeepSlide(index),   // true = diving in, false = resurfacing
            () => {
                applyTheme(index);
                swapSlides(current, index, direction);
            },
            () => { animating = false; }
        );
    } else {
        applyTheme(index);
        swapSlides(current, index, direction);
        setTimeout(() => { animating = false; }, 800);
    }
}

function next() { goTo(current + 1, "down"); }
function prev() { goTo(current - 1, "up");   }

// init
slides[0].classList.add("active");
applyTheme(0);

/* ==========================================
   NAV DOTS
========================================== */

const dotsContainer = document.getElementById("nav-dots");
slides.forEach((_, i) => {
    const dot = document.createElement("div");
    dot.className = "nav-dot" + (i === 0 ? " active" : "");
    dot.addEventListener("click", () => goTo(i, i > current ? "down" : "up"));
    dotsContainer.appendChild(dot);
});

function updateDots(i) {
    document.querySelectorAll(".nav-dot").forEach((d, j) => d.classList.toggle("active", j === i));
}

/* ==========================================
   INPUT
========================================== */

let wheelCD = false;
window.addEventListener("wheel", e => {
    if (wheelCD || animating) return;
    wheelCD = true;
    e.deltaY > 0 ? next() : prev();
    setTimeout(() => { wheelCD = false; }, 1200);
}, { passive: true });

window.addEventListener("keydown", e => {
    if (["ArrowDown","PageDown"," "].includes(e.key)) { e.preventDefault(); next(); }
    if (["ArrowUp","PageUp"].includes(e.key))          { e.preventDefault(); prev(); }
});

let touchY = 0;
window.addEventListener("touchstart", e => { touchY = e.touches[0].clientY; }, { passive: true });
window.addEventListener("touchend",   e => {
    const d = touchY - e.changedTouches[0].clientY;
    if (Math.abs(d) < 40) return;
    d > 0 ? next() : prev();
});

/* ==========================================
   PARTICLES (deep slides only)
========================================== */

const pCanvas = document.getElementById("particles");
const pCtx    = pCanvas.getContext("2d");
let parts     = [];

function resizeP() { pCanvas.width = window.innerWidth; pCanvas.height = window.innerHeight; }
resizeP();
window.addEventListener("resize", () => { resizeP(); initParts(); });

function makePart() {
    return {
        x: Math.random() * pCanvas.width,
        y: Math.random() * pCanvas.height,
        r: Math.random() * 1.4 + 0.3,
        op: Math.random() * 0.45 + 0.08,
        vx: (Math.random() - 0.5) * 0.12,
        vy: -(Math.random() * 0.2 + 0.04),
        ph: Math.random() * Math.PI * 2,
        ps: Math.random() * 0.01 + 0.004,
    };
}

function initParts() {
    parts = Array.from({ length: Math.floor(pCanvas.width * pCanvas.height / 12000) }, makePart);
}

function drawParts() {
    pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);
    parts.forEach(p => {
        p.ph += p.ps;
        const a = p.op * (0.5 + 0.5 * Math.sin(p.ph));
        const g = pCtx.createRadialGradient(p.x,p.y,0, p.x,p.y,p.r*5);
        g.addColorStop(0, `rgba(0,229,255,${a})`);
        g.addColorStop(1, "rgba(0,229,255,0)");
        pCtx.beginPath();
        pCtx.arc(p.x, p.y, p.r, 0, Math.PI*2);
        pCtx.fillStyle = g;
        pCtx.fill();
        p.x += p.vx; p.y += p.vy;
        if (p.y < -10)                  p.y = pCanvas.height + 10;
        if (p.x < -10)                  p.x = pCanvas.width  + 10;
        if (p.x > pCanvas.width  + 10)  p.x = -10;
    });
    requestAnimationFrame(drawParts);
}
initParts();
drawParts();

/* ==========================================
   MOUSE GLOW
========================================== */

const glow = document.createElement("div");
glow.style.cssText = `
    position:fixed;z-index:1;pointer-events:none;
    width:480px;height:480px;border-radius:50%;
    background:radial-gradient(circle,rgba(0,229,255,.07),transparent 70%);
    transform:translate(-50%,-50%);
    transition:left .1s linear,top .1s linear,opacity .8s ease;
    opacity:0;
`;
document.body.appendChild(glow);
window.addEventListener("mousemove", e => { glow.style.left = e.clientX+"px"; glow.style.top = e.clientY+"px"; });

new MutationObserver(() => {
    glow.style.opacity = document.body.classList.contains("is-deep") ? "1" : "0";
}).observe(document.body, { attributes: true, attributeFilter: ["class"] });

/* ==========================================
   DYNAMIC BACK BUTTON
   ========================================== */
const backBtn = document.querySelector(".nav-back");
if (backBtn) {
    backBtn.addEventListener("click", e => {
        e.preventDefault();
        if (
            document.referrer &&
            new URL(document.referrer).origin === window.location.origin
        ) {
            window.history.back();
        } else {
            window.location.href = "../";
        }
    });
}

