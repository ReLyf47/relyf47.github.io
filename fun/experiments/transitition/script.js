// ── TAB BLOCK ────────────────────────────────────────
document.addEventListener('keydown', e => { if (e.key === 'Tab') e.preventDefault(); });

// ── STATE ─────────────────────────────────────────────
let theme       = 'p3';
let p3Idx       = 0;
let p5Idx       = 0;
let busy        = false;   // transition lock
let p3OpenIdx   = -1;      // which p3 item has sub open
let p5OpenIdx   = -1;

// ── DOM ───────────────────────────────────────────────
const themeLink  = document.getElementById('theme-link');
const wipes      = [...document.querySelectorAll('.wipe')];

// P3R
const p3MenuEl   = document.getElementById('p3-menu');
const p3WalletEl = document.querySelector('.p3-wallet');
const p3HudEl    = document.querySelector('.p3-hud');
const p3DescEl   = document.getElementById('p3-desc');
const p3Items    = [...document.querySelectorAll('.p3-item')];

// P5R
const p5RootEl   = document.getElementById('p5-root');
const p5WalletEl = document.querySelector('.p5-wallet');
const p5PanelEl  = document.querySelector('.p5-panel');
const p5Items    = [...document.querySelectorAll('.p5-item')];
const p5TagTitle = document.getElementById('p5-tag-title');
const p5UseLbl   = document.getElementById('p5-use-lbl');

// ── SNAP.SVG ──────────────────────────────────────────
let snap = null, snapR = null, snapB = null, snapTick = null;
const rnd = (a,b) => Math.floor(Math.random()*(b-a+1))+a;

function initSnap() {
    if (typeof Snap === 'undefined' || snap) return;
    snap  = Snap('.p5-sel');
    snapR = snap?.select('.p5-sel-red');
    snapB = snap?.select('.p5-sel-blue');
}

function startSnap() {
    if (snapTick) clearInterval(snapTick);
    snapTick = setInterval(() => {
        if (theme !== 'p5' || !snapR || !snapB) return;
        snapR.animate({ points:`${rnd(0,15)},${rnd(15,25)} ${rnd(80,95)},${rnd(15,25)} ${rnd(75,90)},${rnd(25,35)} ${rnd(5,20)},${rnd(25,35)}` }, 110);
        snapB.animate({ points:`${rnd(15,35)},${rnd(5,15)} ${rnd(85,100)},${rnd(25,35)} ${rnd(90,105)},${rnd(30,45)} ${rnd(10,25)},${rnd(40,50)}` }, 110);
    }, 120);
}

// ── WIPE ──────────────────────────────────────────────
function doWipe(cb) {
    if (busy) return; busy = true;
    const dur = 250, gap = 50;
    wipes.forEach((w,i) => w.animate([
        { clipPath:'polygon(0 0,0 0,-20% 100%,-20% 100%)' },
        { clipPath:'polygon(0 0,120% 0,100% 100%,-20% 100%)' }
    ],{ duration:dur, delay:i*gap, fill:'forwards', easing:'cubic-bezier(.7,0,.3,1)' }));

    setTimeout(() => {
        cb?.();
        wipes.forEach((w,i) => w.animate([
            { clipPath:'polygon(0 0,120% 0,100% 100%,-20% 100%)' },
            { clipPath:'polygon(120% 0,120% 0,100% 100%,100% 100%)' }
        ],{ duration:dur, delay:i*gap, fill:'forwards', easing:'cubic-bezier(.7,0,.3,1)' }));
        setTimeout(() => { busy = false; }, dur + wipes.length*gap);
    }, dur + wipes.length*gap);
}

// ── P3R ───────────────────────────────────────────────
function p3Refresh() {
    p3Items.forEach((el,i) => {
        el.classList.toggle('active', i === p3Idx);
        el.classList.toggle('open',   i === p3OpenIdx);
    });
    const lbl = p3Items[p3Idx]?.querySelector('.p3-lbl')?.textContent ?? '';
    if (p3DescEl) p3DescEl.textContent = lbl ? `Use ${lbl}` : 'Command';
}

function p3Select() {
    const key = p3Items[p3Idx]?.dataset.key;
    if (p3OpenIdx === p3Idx) {
        // already open — activate
        if (key === 'system') window.location.href = '../';
        // other keys: no-op (placeholder)
    } else {
        // open sub-panel
        p3OpenIdx = p3Idx;
        p3Refresh();
    }
}

// ── P5R ───────────────────────────────────────────────
function p5Place(defer = false) {
    const go = () => {
        const el  = p5Items[p5Idx];
        const sel = document.querySelector('.p5-sel');
        if (el && sel) {
            const r = el.getBoundingClientRect();
            if (r.width > 0) {
                sel.style.left   = `${r.left + r.width/2}px`;
                sel.style.top    = `${r.top  + r.height/2}px`;
                sel.style.width  = `${r.width  + 80}px`;
                sel.style.height = `${r.height + 50}px`;
                sel.classList.add('placed');
            }
        }
        const lbl = p5Items[p5Idx]?.querySelector('.p5-tiles')?.textContent?.trim() ?? '';
        if (p5TagTitle) p5TagTitle.textContent = `MeNu: ${lbl}`;
        if (p5UseLbl)   p5UseLbl.textContent   = lbl ? `Use ${lbl}` : 'Command';
    };
    defer ? requestAnimationFrame(() => requestAnimationFrame(go)) : go();
}

function p5Refresh() {
    p5Items.forEach((el,i) => {
        el.classList.toggle('active', i === p5Idx);
        el.classList.toggle('open',   i === p5OpenIdx);
    });
    p5Place();
}

function p5Select() {
    const key = p5Items[p5Idx]?.dataset.key;
    if (p5OpenIdx === p5Idx) {
        // already open — activate
        if (key === 'system') window.location.href = '../';
    } else {
        p5OpenIdx = p5Idx;
        p5Refresh();
    }
}

// ── THEME SWITCH ──────────────────────────────────────
function showP3() {
    [p3MenuEl, p3WalletEl, p3HudEl].forEach(el => el && (el.style.display = ''));
    [p5RootEl, p5WalletEl, p5PanelEl].forEach(el => el && (el.style.display = 'none'));
    if (snapTick) clearInterval(snapTick);
    p3Refresh();
}

function showP5() {
    [p3MenuEl, p3WalletEl, p3HudEl].forEach(el => el && (el.style.display = 'none'));
    [p5RootEl].forEach(el => el && (el.style.display = ''));
    initSnap();
    startSnap();
    setTimeout(() => p5Place(true), 420);
}

function switchTheme(t) {
    if (t === theme) return;
    doWipe(() => {
        theme = t;
        document.body.className = `theme-${t}`;
        themeLink.href = `${t}r.css`;
        t === 'p3' ? showP3() : showP5();
    });
}

// ── KEYBOARD ─────────────────────────────────────────
window.addEventListener('keydown', e => {
    if (busy) return;
    if (e.key === '1') { switchTheme('p3'); return; }
    if (e.key === '3') { switchTheme('p5'); return; }

    if (theme === 'p3') {
        if (e.key === 'ArrowDown')  { p3Idx = (p3Idx+1) % p3Items.length; p3OpenIdx=-1; p3Refresh(); e.preventDefault(); }
        if (e.key === 'ArrowUp')    { p3Idx = (p3Idx-1+p3Items.length) % p3Items.length; p3OpenIdx=-1; p3Refresh(); e.preventDefault(); }
        if (e.key === 'Enter')      { p3Select(); e.preventDefault(); }
        if (e.key === 'Escape')     { p3OpenIdx=-1; p3Refresh(); }
    } else {
        if (e.key === 'ArrowDown')  { p5Idx = (p5Idx+1) % p5Items.length; p5OpenIdx=-1; p5Refresh(); e.preventDefault(); }
        if (e.key === 'ArrowUp')    { p5Idx = (p5Idx-1+p5Items.length) % p5Items.length; p5OpenIdx=-1; p5Refresh(); e.preventDefault(); }
        if (e.key === 'Enter')      { p5Select(); e.preventDefault(); }
        if (e.key === 'Escape')     { p5OpenIdx=-1; p5Refresh(); }
    }
});

// ── MOUSE ─────────────────────────────────────────────
p3Items.forEach((el,i) => {
    el.addEventListener('mouseenter', () => { if (!busy) { p3Idx=i; p3Refresh(); } });
    // click opens sub — don't toggle closed on click (Escape closes)
    el.addEventListener('click', e => {
        if (!busy && e.target === el || e.target === el.querySelector('.p3-lbl')) {
            p3Idx = i; p3Select();
        }
    });
});
p5Items.forEach((el,i) => {
    el.addEventListener('mouseenter', () => { if (!busy) { p5Idx=i; p5Refresh(); } });
    el.addEventListener('click', e => {
        if (!busy && (e.target === el || e.target.closest('.p5-tiles'))) {
            p5Idx = i; p5Select();
        }
    });
});

// ── GO BACK BUTTONS ───────────────────────────────────
document.getElementById('p3-back')?.addEventListener('click', () => { window.location.href = '../'; });
document.getElementById('p5-back')?.addEventListener('click', () => { window.location.href = '../'; });

// ── PARALLAX ─────────────────────────────────────────
document.addEventListener('mousemove', e => {
    const x = e.clientX/window.innerWidth  - .5;
    const y = e.clientY/window.innerHeight - .5;
    document.querySelectorAll('.char-fore').forEach(el =>
        el.style.transform = `translate(${x*-15}px,${y*-15}px)`);
    document.querySelectorAll('.char-back').forEach(el =>
        el.style.transform = `scale(1.1) translate(${x*-30}px,${y*-30}px)`);
});

// ── INIT ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    document.body.className = 'theme-p3';
    themeLink.href = 'p3r.css';
    [p5RootEl, p5WalletEl, p5PanelEl].forEach(el => el && (el.style.display='none'));
    p3Refresh();
});
