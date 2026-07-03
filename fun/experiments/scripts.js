// Load experiments dynamically
fetch('experiments.json')
    .then(res => res.json())
    .then(experiments => {
        const grid = document.getElementById('experiments-grid');
        
        // ResizeObserver to handle dynamic scaling of 1080p iframes
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                const wrapper = entry.target;
                const iframe = wrapper.querySelector('.preview-iframe');
                if (iframe) {
                    const scale = wrapper.clientWidth / 1920;
                    iframe.style.transform = `scale(${scale})`;
                }
            }
        });

        experiments.forEach(exp => {
            const card = document.createElement('a');
            card.href = `../experiments/${exp.id}/`;
            card.className = `card ${exp.colorClass || 'blog-card'}`;
            // Use data-src instead of src — iframe won't execute until hovered
            card.innerHTML = `
                <div class="card-glow"></div>
                <span class="card-badge">${exp.badge}</span>
                <div class="card-graphic-wrapper">
                    <iframe data-src="../experiments/${exp.id}/" class="preview-iframe" scrolling="no" tabindex="-1"></iframe>
                    <div class="preview-overlay"></div>
                </div>
                <div class="card-content">
                    <h2 class="card-title">${exp.title}</h2>
                    <p class="card-subtitle">${exp.subtitle}</p>
                    <p class="card-desc">${exp.description}</p>
                </div>
                <div class="card-footer">
                    <span class="action-btn">RUN EXPERIMENT</span>
                    <span class="action-arrow">→</span>
                </div>
            `;
            grid.appendChild(card);
            
            const wrapper = card.querySelector('.card-graphic-wrapper');
            resizeObserver.observe(wrapper);

            // Load iframe, let it run briefly to capture a live frame, then freeze it
            const iframe = wrapper.querySelector('.preview-iframe');
            iframe.src = iframe.dataset.src;
            iframe.addEventListener('load', () => {
                setTimeout(() => {
                    try {
                        iframe.contentWindow.stop();
                    } catch (e) {
                        // cross-origin fallback: just stop network-level loading
                        iframe.src = 'about:blank';
                    }
                }, 1000);
            }, { once: true });
        });
    })
    .catch(err => console.error("Failed to load experiments:", err));

document.getElementById("back-btn").addEventListener("click", (e) => {
    e.preventDefault();
    if (document.referrer && new URL(document.referrer).origin === location.origin) {
        history.back();
    } else {
        location.href = "../";
    }
});