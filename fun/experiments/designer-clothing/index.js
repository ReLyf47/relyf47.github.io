// =========================================================
// ATELIER NOIR — interactions
// =========================================================

// ----- custom cursor -----
const cursor = document.createElement('div');
cursor.className = 'cursor';
const cursorDot = document.createElement('div');
cursorDot.className = 'cursor-dot';
document.body.appendChild(cursor);
document.body.appendChild(cursorDot);

let mx = 0, my = 0, cx = 0, cy = 0;
document.addEventListener('mousemove', (e) => {
  mx = e.clientX;
  my = e.clientY;
  cursorDot.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -50%)`;
});
function loop() {
  cx += (mx - cx) * 0.18;
  cy += (my - cy) * 0.18;
  cursor.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
  requestAnimationFrame(loop);
}
loop();

// hover targets
document.querySelectorAll('.back-btn, .look, .index-table tbody tr').forEach(el => {
  el.addEventListener('mouseenter', () => cursor.classList.add('hover'));
  el.addEventListener('mouseleave', () => cursor.classList.remove('hover'));
});

// ----- reveal on scroll -----
const reveals = document.querySelectorAll('.reveal, .reveal-stagger');
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('in');
      io.unobserve(e.target);
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
reveals.forEach(el => io.observe(el));

// ----- look parallax on mouse (scroll-only site — subtle drift) -----
document.querySelectorAll('.look').forEach(look => {
  const img = look.querySelector('.look-img');
  look.addEventListener('mousemove', (e) => {
    const r = look.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    img.style.transform = `scale(1.04) translate(${x * -8}px, ${y * -8}px)`;
  });
  look.addEventListener('mouseleave', () => {
    img.style.transform = '';
  });
});

// ----- console signature -----
console.log('%c Atelier Noir %c— slow fashion since 2014',
  'background:#f4ede0;color:#0a0a0c;padding:4px 10px;font-family:serif;font-style:italic;font-size:14px;',
  'color:#8a8278;padding:4px 0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;');