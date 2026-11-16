import { animate, createTimeline, stagger } from './anime.esm.min.js';

// Respect prefers-reduced-motion
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const deck = document.getElementById('deck');
const slides = [...document.querySelectorAll('.slide')];
const navHeader = document.querySelector('.nav');
const regStatus = document.getElementById('registry-status');
const indexButtons = document.querySelectorAll('.side-index .index-item');

let currentSlideIndex = 0;
let isNavigating = false;
let currentDeckAnim = null;
let currentContentAnim = null;

const SLIDE_METAS = [
  { theme: 'hero', title: '● PROLOGUE' },
  { theme: 'studio', title: '● 01 STUDIO VOID' },
  { theme: 'mosaic', title: '● 02 MOSAIC SANDBOX' },
  { theme: 'limits', title: '● 03 LIMITS RAYMARCHER' },
  { theme: 'persona', title: '● 04 PERSONA UI' },
  { theme: 'comifuro', title: '● 05 COMIFURO CATALOG' }
];

// Each exhibit arrives in its own idiom; targets are the slide's [data-enter] blocks
const flicker = t => (t < 0.18 ? t / 0.18 : t < 0.3 ? 0.2 : t < 0.42 ? 1 : t < 0.5 ? 0.5 : 1);
const ENTRANCES = {
  hero:     () => ({ opacity: [0, 1], translateY: [30, 0], duration: 650, ease: 'out(3)' }),
  // atelier: a slow, quiet fade, nothing snaps
  studio:   () => ({ opacity: [0, 1], translateY: [18, 0], duration: 1100, ease: 'out(2)', delay: stagger(180, { start: 200 }) }),
  // shards: tip in and settle into their cells
  mosaic:   () => ({ opacity: [0, 1], rotate: [-5, 0], scale: [0.94, 1], duration: 560, ease: 'out(3)', delay: stagger(110, { start: 120 }) }),
  // CRT: the console flickers on
  limits:   () => ({ opacity: [0, 1], duration: 620, ease: flicker, delay: stagger(140, { start: 160 }) }),
  // comic: slam in from the left on a skew
  persona:  () => ({ opacity: [0, 1], translateX: [-140, 0], skewX: [-18, 0], duration: 380, ease: 'out(4)', delay: stagger(90, { start: 90 }) }),
  // stickers: pop with a little overshoot
  comifuro: () => ({ opacity: [0, 1], scale: [0.7, 1], rotate: [-4, 0], duration: 620, ease: 'outBack(1.7)', delay: stagger(110, { start: 120 }) })
};

// ═══════════════════════════════════════════════════════
// 1. ACTIVE IFRAME MANAGER (Ensures 60 FPS, Zero Lag)
// ═══════════════════════════════════════════════════════
const manageSlideIframes = (activeIndex) => {
  slides.forEach((slide, idx) => {
    const vp = slide.querySelector('.preview-viewport');
    if (!vp) return;
    const ifr = vp.querySelector('iframe');
    const toggleBtn = slide.querySelector('.btn-toggle-interact');

    if (idx === activeIndex) {
      // Load current slide iframe if not already loaded
      const targetSrc = vp.dataset.src;
      if (ifr && targetSrc && ifr.getAttribute('src') !== targetSrc) {
        ifr.onload = () => {
          vp.classList.add('loaded');
        };
        ifr.src = targetSrc;
        setTimeout(() => {
          vp.classList.add('loaded');
        }, 450);
      }
    } else {
      // Teardown offscreen iframes so background WebGL/RAF loops do not chug GPU
      if (ifr && ifr.getAttribute('src') !== 'about:blank') {
        ifr.src = 'about:blank';
      }
      vp.classList.remove('loaded', 'interactive');
      if (toggleBtn) {
        toggleBtn.classList.remove('active');
        const lbl = toggleBtn.querySelector('.interact-label');
        if (lbl) lbl.textContent = 'ENABLE INTERACTION';
      }
    }
  });
};

// ═══════════════════════════════════════════════════════
// 2. KINETIC SLIDE TRANSITION (Anime.js v4)
// ═══════════════════════════════════════════════════════
export const goToSlide = (targetIndex, immediate = false) => {
  if (targetIndex < 0 || targetIndex >= slides.length) return;
  if (targetIndex === currentSlideIndex && !immediate) return;

  const prevIndex = currentSlideIndex;
  currentSlideIndex = targetIndex;
  const targetSlide = slides[targetIndex];
  const meta = SLIDE_METAS[targetIndex] || { theme: 'hero', title: '● ARCHIVE' };

  // Re-tint the fixed chrome (nav + side index); each slide paints its own ground
  document.body.setAttribute('data-theme', meta.theme);
  if (regStatus) regStatus.textContent = meta.title;

  // Update Side Index Buttons
  indexButtons.forEach((btn, idx) => {
    btn.classList.toggle('active', idx === targetIndex);
  });

  // Manage iframe resources
  manageSlideIframes(targetIndex);

  if (immediate || prefersReducedMotion) {
    if (deck) deck.style.transform = `translate3d(0, -${targetIndex * 100}%, 0)`;
    isNavigating = false;
    return;
  }

  isNavigating = true;

  if (currentDeckAnim) currentDeckAnim.pause();
  if (currentContentAnim) currentContentAnim.pause();

  // GPU Deck Translation
  currentDeckAnim = animate(deck, {
    translateY: `${-targetIndex * 100}%`,
    duration: 750,
    ease: 'out(4)',
    onComplete: () => {
      // Cooldown buffer to cleanly absorb residual mouse wheel spins
      setTimeout(() => {
        isNavigating = false;
      }, 160);
    }
  });

  // Outgoing Slide Motion
  const prevSlide = slides[prevIndex];
  if (prevSlide) {
    const prevInner = prevSlide.querySelector('.slide-inner');
    if (prevInner) {
      animate(prevInner, {
        opacity: [1, 0.1],
        translateY: [0, -30],
        duration: 400,
        ease: 'in(2)'
      });
    }
  }

  // Incoming slide: restore its container, then let the exhibit arrive in its own idiom
  const incomingInner = targetSlide.querySelector('.slide-inner');
  if (incomingInner) {
    animate(incomingInner, { opacity: [0, 1], translateY: 0, duration: 450, ease: 'out(3)' });
  }
  const entering = targetSlide.querySelectorAll('[data-enter]');
  if (entering.length) {
    animate(entering, (ENTRANCES[meta.theme] || ENTRANCES.hero)());
  }
};

// ═══════════════════════════════════════════════════════
// 3. WHEEL INTERCEPTION ("Scroll Stop, Scroll Stop")
// ═══════════════════════════════════════════════════════
window.addEventListener('wheel', (e) => {
  // Check if target is an interactive iframe or button
  const isInteractiveTarget = (e.target instanceof Element) && e.target.closest('.interactive');
  if (isInteractiveTarget) return;

  e.preventDefault();

  if (isNavigating) return;
  if (Math.abs(e.deltaY) < 16) return;

  if (e.deltaY > 0) {
    if (currentSlideIndex < slides.length - 1) {
      goToSlide(currentSlideIndex + 1);
    }
  } else if (e.deltaY < 0) {
    if (currentSlideIndex > 0) {
      goToSlide(currentSlideIndex - 1);
    }
  }
}, { passive: false });

// ═══════════════════════════════════════════════════════
// 4. TOUCH / SWIPE NAVIGATION
// ═══════════════════════════════════════════════════════
let touchStartY = 0;
let touchStartX = 0;

window.addEventListener('touchstart', (e) => {
  if (e.touches.length === 1) {
    touchStartY = e.touches[0].clientY;
    touchStartX = e.touches[0].clientX;
  }
}, { passive: true });

window.addEventListener('touchmove', (e) => {
  if (isNavigating && e.cancelable) {
    e.preventDefault();
  }
}, { passive: false });

window.addEventListener('touchend', (e) => {
  if (isNavigating || e.changedTouches.length !== 1) return;
  const deltaY = touchStartY - e.changedTouches[0].clientY;
  const deltaX = touchStartX - e.changedTouches[0].clientX;

  if (Math.abs(deltaY) > 35 && Math.abs(deltaY) > Math.abs(deltaX)) {
    if (deltaY > 0 && currentSlideIndex < slides.length - 1) {
      goToSlide(currentSlideIndex + 1);
    } else if (deltaY < 0 && currentSlideIndex > 0) {
      goToSlide(currentSlideIndex - 1);
    }
  }
}, { passive: true });

// ═══════════════════════════════════════════════════════
// 5. KEYBOARD NAVIGATION
// ═══════════════════════════════════════════════════════
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    // Exit interactive mode on current slide
    const activeVp = slides[currentSlideIndex]?.querySelector('.preview-viewport');
    const toggleBtn = slides[currentSlideIndex]?.querySelector('.btn-toggle-interact');
    if (activeVp && activeVp.classList.contains('interactive')) {
      activeVp.classList.remove('interactive');
      if (toggleBtn) {
        toggleBtn.classList.remove('active');
        const lbl = toggleBtn.querySelector('.interact-label');
        if (lbl) lbl.textContent = 'ENABLE INTERACTION';
      }
      return;
    }
  }

  if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
  if (e.altKey || e.ctrlKey || e.metaKey) return;

  if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
    e.preventDefault();
    if (currentSlideIndex < slides.length - 1) {
      goToSlide(currentSlideIndex + 1);
    }
  } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
    e.preventDefault();
    if (currentSlideIndex > 0) {
      goToSlide(currentSlideIndex - 1);
    }
  } else if (e.key === 'Home') {
    e.preventDefault();
    goToSlide(0);
  } else if (e.key === 'End') {
    e.preventDefault();
    goToSlide(slides.length - 1);
  }
});

// ═══════════════════════════════════════════════════════
// 6. BUTTONS & INTERACTION TOGGLES
// ═══════════════════════════════════════════════════════
document.getElementById('scroll-btn')?.addEventListener('click', (e) => {
  e.preventDefault();
  goToSlide(1);
});

document.querySelectorAll('.dir-row').forEach(row => {
  row.addEventListener('click', (e) => {
    e.preventDefault();
    const gotoIdx = parseInt(row.dataset.goto, 10);
    if (!isNaN(gotoIdx)) {
      goToSlide(gotoIdx);
    }
  });
});

indexButtons.forEach((btn, idx) => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    goToSlide(idx);
  });
});

// Interactive toggle on previews
document.querySelectorAll('.btn-toggle-interact').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const slide = btn.closest('.slide');
    if (!slide) return;
    const vp = slide.querySelector('.preview-viewport');
    if (!vp) return;

    const isInteractive = vp.classList.toggle('interactive');
    btn.classList.toggle('active', isInteractive);
    const lbl = btn.querySelector('.interact-label');
    if (lbl) {
      lbl.textContent = isInteractive ? 'ACTIVE // ESC TO EXIT' : 'ENABLE INTERACTION';
    }
  });
});

// ═══════════════════════════════════════════════════════
// 7. DESKTOP SPATIAL 3D TILT (Damped Antigravity Physics)
// ═══════════════════════════════════════════════════════
if (window.matchMedia('(min-width: 960px)').matches && !prefersReducedMotion) {
  slides.forEach(slide => {
    const plinth = slide.querySelector('[data-tilt]');
    if (!plinth) return;

    let rafId = null;

    slide.addEventListener('mousemove', (e) => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const rect = slide.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;

        const rotX = y * -4.5;
        const rotY = x * 6.5;
        plinth.style.transform = `perspective(1200px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg)`;
      });
    });

    slide.addEventListener('mouseleave', () => {
      plinth.style.transform = '';
    });
  });
}

// ═══════════════════════════════════════════════════════
// 8. 1080p SCALING ENGINE VIA RESIZEOBSERVER
// ═══════════════════════════════════════════════════════
const viewports = document.querySelectorAll('.preview-viewport');
const updateScale = (el, width) => {
  const w = width || el.clientWidth;
  if (w > 0) {
    el.style.setProperty('--fs', (Math.max(0.1, w / 1920)).toFixed(4));
  }
};

const viewportResizeObserver = new ResizeObserver((entries) => {
  for (const entry of entries) {
    updateScale(entry.target, entry.contentRect.width);
  }
});

viewports.forEach(vp => {
  updateScale(vp);
  viewportResizeObserver.observe(vp);
});

// ═══════════════════════════════════════════════════════
// 8b. MOSAIC SHARD FIELD — the exhibit's ground echoes the experiment:
//     a lattice of greyscale triangles that reshuffles under the cursor
// ═══════════════════════════════════════════════════════
const shardCanvas = document.getElementById('shard-field');
if (shardCanvas) {
  const ctx = shardCanvas.getContext('2d');
  const SIDE = 56;
  const H = SIDE * Math.sqrt(3) / 2;
  const RADIUS = 95;
  let shards = [];
  let pending = null;

  const shade = () => `hsl(30, 3%, ${(84 + Math.random() * 11).toFixed(1)}%)`;
  const paint = (s) => {
    ctx.fillStyle = ctx.strokeStyle = s.c; // same-tone stroke hides anti-alias seams
    ctx.beginPath();
    ctx.moveTo(s.p[0], s.p[1]);
    ctx.lineTo(s.p[2], s.p[3]);
    ctx.lineTo(s.p[4], s.p[5]);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };

  const build = () => {
    const { width, height } = shardCanvas.getBoundingClientRect();
    if (!width || !height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    shardCanvas.width = Math.round(width * dpr);
    shardCanvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    shards = [];
    for (let r = 0; r * H < height; r++) {
      for (let i = -1; i * SIDE / 2 < width; i++) {
        const x = i * SIDE / 2;
        const y = r * H;
        const up = (i + r) % 2 === 0;
        const p = up ? [x, y + H, x + SIDE / 2, y, x + SIDE, y + H]
                     : [x, y, x + SIDE, y, x + SIDE / 2, y + H];
        shards.push({ p, cx: x + SIDE / 2, cy: y + H / 2, c: shade() });
      }
    }
    shards.forEach(paint);
  };

  const reshuffle = () => {
    const { x, y } = pending;
    pending = null;
    for (const s of shards) {
      if (Math.hypot(s.cx - x, s.cy - y) < RADIUS) {
        s.c = shade();
        paint(s);
      }
    }
  };

  new ResizeObserver(build).observe(shardCanvas);

  if (!prefersReducedMotion) {
    shardCanvas.parentElement.addEventListener('pointermove', (e) => {
      const rect = shardCanvas.getBoundingClientRect();
      if (!pending) requestAnimationFrame(reshuffle);
      pending = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    });
  }
}

// ═══════════════════════════════════════════════════════
// 9. HERO ENTRANCE CHOREOGRAPHY (Anime.js v4)
// ═══════════════════════════════════════════════════════
const initHeroAnimation = () => {
  if (prefersReducedMotion) return;

  const label = document.querySelector('.curatorial-label');
  const subhead = document.querySelector('.title-subhead');
  const title = document.querySelector('.title-main');
  const intro = document.querySelector('.hero-intro-text');
  const dirRows = document.querySelectorAll('.exhibition-directory .dir-row');
  const enterAction = document.querySelector('.hero-enter-action');
  const arrow = document.querySelector('.enter-arrow');

  const heroTL = createTimeline({
    defaults: { ease: 'out(3)' }
  });

  if (label) {
    heroTL.add(label, {
      opacity: [0, 1],
      translateY: [15, 0],
      duration: 500
    });
  }

  if (subhead) {
    heroTL.add(subhead, {
      opacity: [0, 1],
      translateY: [20, 0],
      duration: 500
    }, '-=300');
  }

  if (title) {
    heroTL.add(title, {
      opacity: [0, 1],
      translateY: [35, 0],
      duration: 700
    }, '-=350');
  }

  if (intro) {
    heroTL.add(intro, {
      opacity: [0, 1],
      translateY: [20, 0],
      duration: 550
    }, '-=400');
  }

  if (dirRows.length) {
    heroTL.add(dirRows, {
      opacity: [0, 1],
      translateY: [20, 0],
      delay: stagger(65),
      duration: 500
    }, '-=300');
  }

  if (enterAction) {
    heroTL.add(enterAction, {
      opacity: [0, 1],
      translateY: [15, 0],
      duration: 450
    }, '-=250');
  }

  if (arrow) {
    animate(arrow, {
      translateY: [0, 5, 0],
      duration: 1800,
      loop: true,
      ease: 'inOutSine'
    });
  }
};

// ═══════════════════════════════════════════════════════
// 10. SMART BACK BUTTON & INITIALIZATION
// ═══════════════════════════════════════════════════════
const backBtn = document.getElementById('back-btn');
if (backBtn) {
  backBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (document.referrer && new URL(document.referrer, location.href).origin === location.origin) {
      history.back();
    } else {
      location.href = backBtn.getAttribute('href') || '../';
    }
  });
}

const initPage = () => {
  initHeroAnimation();

  // Check initial hash
  const hash = window.location.hash;
  if (hash) {
    const idx = slides.findIndex(s => `#${s.id}` === hash);
    goToSlide(idx !== -1 ? idx : 0, true);
  } else {
    goToSlide(0, true);
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPage);
} else {
  initPage();
}