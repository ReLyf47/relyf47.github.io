  // -----------------------------------------------------------------
  // 1. DATA STATE & STORE
  // -----------------------------------------------------------------
  const allBooths = window.BOOTHS_DATA || [];
  const samplesByName = window.COMIFURO_SAMPLES_BY_NAME || {};
  
  let currentFilter = {
    rating: 'ALL',
    day: 'ALL',
    block: 'ALL',
    samplesOnly: false,
    search: '',
    sort: 'booth_asc',
    wishlistOnly: false
  };

  let wishlist = new Set();
  try {
    const saved = localStorage.getItem('cf_catalog_wishlist') || localStorage.getItem('cf23_catalog_wishlist');
    if (saved) wishlist = new Set(JSON.parse(saved));
  } catch(e) {}

  let filteredBooths = [];
  let renderedCount = 0;
  const CHUNK_SIZE = 48;
  let currentLayout = 'grid'; // 'grid' | 'table'

  // Global flag to keep Floor Map purely as a zoom/pan interactive map without clicking elements
  window.MAP_CLICK_DISABLED = true;

  // Pre-extract unique blocks for dropdown
  const allBlocks = new Set();
  allBooths.forEach(b => {
    const code = (b.circle_code || '').trim();
    const m = /^([A-Z]+\d?)-/i.exec(code);
    if (m) allBlocks.add(m[1].toUpperCase());
  });
  const sortedBlocks = Array.from(allBlocks).sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));

  // -----------------------------------------------------------------
  // 1.2 DYNAMIC EVENT BRANDING (GENERIC COMIFURO OR CONFIGURED EDITION)
  // -----------------------------------------------------------------
  function applyEventInfo() {
    const info = window.EVENT_INFO || {};
    const edition = (info.edition !== undefined && info.edition !== null) ? String(info.edition).trim() : '';
    const brandTitleEl = document.getElementById('brandMainTitle');
    const welcomeBadgeEl = document.getElementById('welcomeBadge');
    const canvasMapEl = document.getElementById('map');

    if (edition) {
      if (brandTitleEl) brandTitleEl.textContent = `COMIFURO ${edition}`;
      document.title = `Comifuro ${edition} Catalog & Floor Map — Curated Circle Archive`;
      if (welcomeBadgeEl) welcomeBadgeEl.textContent = `✨ Comic Frontier ${edition} (CF${edition}) Circle Archive`;
      if (canvasMapEl) canvasMapEl.setAttribute('aria-label', `Peta lantai Comifuro ${edition}`);
    } else {
      if (brandTitleEl) brandTitleEl.textContent = 'COMIFURO';
      document.title = 'Comifuro Catalog & Floor Map — Curated Circle Archive';
      if (welcomeBadgeEl) welcomeBadgeEl.textContent = '✨ Comic Frontier Circle Archive';
      if (canvasMapEl) canvasMapEl.setAttribute('aria-label', 'Peta lantai Comifuro');
    }
  }

  // -----------------------------------------------------------------
  // 1.5 THEME MANAGEMENT (DARK / LIGHT MODE)
  // -----------------------------------------------------------------
  function initTheme() {
    let t = 'dark';
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlTheme = urlParams.get('theme');
      if (urlTheme === 'light' || urlTheme === 'dark') {
        t = urlTheme;
      } else {
        const saved = localStorage.getItem('cf_catalog_theme') || localStorage.getItem('cf23h.theme');
        if (saved === 'light' || saved === 'dark') {
          t = saved;
        }
      }
    } catch(e) {}
    setTheme(t, true);
  }

  function setTheme(theme, save = true) {
    const t = theme === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = t;
    document.documentElement.setAttribute('data-theme', t);
    if (save) {
      try {
        localStorage.setItem('cf_catalog_theme', t);
        localStorage.setItem('cf23h.theme', t);
      } catch(e) {}
    }
    const icon = document.getElementById('themeToggleIcon');
    const btn = document.getElementById('btnThemeToggle');
    if (icon) {
      icon.textContent = t === 'dark' ? '☀️' : '🌙';
    }
    if (btn) {
      btn.title = t === 'dark' ? 'Ganti ke Tema Terang (Light)' : 'Ganti ke Tema Gelap (Dark)';
      btn.setAttribute('aria-label', btn.title);
    }
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.content = t === 'dark' ? '#0C0D14' : '#FAF6EE';
    }
    if (typeof window.dispatchEvent === 'function') {
      try {
        window.dispatchEvent(new CustomEvent('cf-theme-change', { detail: { theme: t } }));
        window.dispatchEvent(new CustomEvent('cf23-theme-change', { detail: { theme: t } }));
      } catch(e) {}
    }
    if (typeof window.refreshMapTheme === 'function') {
      try { window.refreshMapTheme(); } catch(e) {}
    }
  }

  window.toggleTheme = function() {
    const cur = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
    const next = cur === 'dark' ? 'light' : 'dark';
    setTheme(next, true);
  };
  window.setTheme = setTheme;

  // Run initial theme & branding check immediately
  initTheme();
  applyEventInfo();

  // -----------------------------------------------------------------
  // 2. INITIALIZATION
  // -----------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    applyEventInfo();
    populateBlockOptions();
    initWelcomeDisclaimer();
    updateWishlistBadge();
    applyFilters();
    setupInfiniteScroll();

    // Check URL query parameters for deep linking (?circle=11286 or ?circle=ichigowarano or ?booth=AA-01)
    const urlParams = new URLSearchParams(window.location.search);
    const viewParam = urlParams.get('view') || urlParams.get('tab');
    if (viewParam === 'map') {
      switchMainView('map');
    }
    const circleParam = urlParams.get('circle') || urlParams.get('booth') || urlParams.get('c');
    if (circleParam) {
      setTimeout(() => {
        const idNum = parseInt(circleParam, 10);
        if (!isNaN(idNum)) {
          openCircleDetail(idNum);
        } else {
          openCircleDetail(circleParam);
        }
      }, 50);
    }

    // Search input listener
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      const searchParam = urlParams.get('q') || urlParams.get('search');
      if (searchParam) {
        searchInput.value = searchParam;
        currentFilter.search = searchParam.trim().toLowerCase();
        applyFilters();
      }
      searchInput.addEventListener('input', (e) => {
        currentFilter.search = e.target.value.trim().toLowerCase();
        applyFilters();
      });
    }

    // Keyboard shortcuts: '/' to search, 'Escape' to close, Arrows for theater navigation
    document.addEventListener('keydown', (e) => {
      const detailModal = document.getElementById('circleDetailModal');
      if (detailModal && detailModal.classList.contains('open')) {
        if (e.key === 'ArrowLeft' || e.key === 'Left' || e.key === 'a' || e.key === 'A') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          detailTheaterPrev();
          return;
        }
        if (e.key === 'ArrowRight' || e.key === 'Right' || e.key === 'd' || e.key === 'D') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          detailTheaterNext();
          return;
        }
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          closeCircleDetail();
          return;
        }
      }

      const igModal = document.getElementById('igPostModal');
      if (igModal && igModal.classList.contains('open')) {
        if (e.key === 'ArrowLeft' || e.key === 'Left' || e.key === 'a' || e.key === 'A') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          igPrevSample();
          return;
        }
        if (e.key === 'ArrowRight' || e.key === 'Right' || e.key === 'd' || e.key === 'D') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          igNextSample();
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          closeIgPostModal();
          return;
        }
      }

      if (e.key === '/' && document.activeElement !== searchInput) {
        e.preventDefault();
        if (searchInput) searchInput.focus();
      } else if (e.key === 'Escape') {
        const welcomeModal = document.getElementById('welcomeModal');
        if (welcomeModal && welcomeModal.classList.contains('open')) {
          dismissWelcomeModal();
          return;
        }
        const mapWrapper = document.getElementById('mapViewWrapper');
        if (mapWrapper && (mapWrapper.classList.contains('spotlight-mode') || mapWrapper.classList.contains('active'))) {
          switchMainView('catalog');
          return;
        }
      }
    }, true);
  });

  function populateBlockOptions() {
    const sel = document.getElementById('blockSelect');
    if (!sel) return;
    sortedBlocks.forEach(blk => {
      const opt = document.createElement('option');
      opt.value = blk;
      opt.textContent = `Blok ${blk}`;
      sel.appendChild(opt);
    });
  }

  // -----------------------------------------------------------------
  // 3. FILTERING & SORTING LOGIC
  // -----------------------------------------------------------------
  function setFilterRating(rating) {
    currentFilter.rating = rating;
    // Update pills active state
    document.querySelectorAll('#navRatingPills .rating-pill-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.rating === rating);
    });
    applyFilters();
  }

  function setFilterDay(day) {
    currentFilter.day = day;
    document.querySelectorAll('.day-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.day === day);
    });
    applyFilters();
  }

  function setFilterBlock(blk) {
    currentFilter.block = blk;
    applyFilters();
  }

  function toggleSamplesOnly() {
    currentFilter.samplesOnly = !currentFilter.samplesOnly;
    const btn = document.getElementById('btnSamplesOnly');
    if (btn) btn.classList.toggle('active', currentFilter.samplesOnly);
    applyFilters();
  }

  function setSortOrder(order) {
    currentFilter.sort = order;
    applyFilters();
  }

  function toggleWishlistOnly() {
    currentFilter.wishlistOnly = !currentFilter.wishlistOnly;
    const btn = document.getElementById('btnWishlist');
    if (btn) btn.style.borderColor = currentFilter.wishlistOnly ? '#ec4899' : '';
    applyFilters();
  }

  function setCatalogLayout(layout) {
    currentLayout = layout;
    document.getElementById('btnViewGrid').classList.toggle('active', layout === 'grid');
    document.getElementById('btnViewTable').classList.toggle('active', layout === 'table');
    document.getElementById('boothGrid').style.display = layout === 'grid' ? 'grid' : 'none';
    document.getElementById('boothTableContainer').classList.toggle('active', layout === 'table');
    renderBooths();
  }

  function applyFilters() {
    const q = currentFilter.search;
    const r = currentFilter.rating;
    const d = currentFilter.day;
    const b = currentFilter.block;
    const so = currentFilter.samplesOnly;
    const wo = currentFilter.wishlistOnly;

    filteredBooths = allBooths.filter(item => {
      // Rating filter
      if (r !== 'ALL' && item.rating !== r) return false;

      // Day filter
      if (d !== 'ALL') {
        const itemDay = item.day || 'Both Days';
        if (itemDay !== 'Both Days' && itemDay !== d) return false;
      }

      // Block filter
      if (b !== 'ALL') {
        const code = (item.circle_code || '').trim().toUpperCase();
        if (!code.startsWith(b + '-')) return false;
      }

      // Samples only
      const sData = samplesByName[item.name.toLowerCase()];
      const hasSamples = (sData && sData.has_samples) || (item.sampleworks_images && item.sampleworks_images.length > 0);
      if (so && !hasSamples) return false;

      // Wishlist only
      if (wo && !wishlist.has(item.id)) return false;

      // Search query
      if (q) {
        const nameMatch = item.name.toLowerCase().includes(q);
        const codeMatch = (item.circle_code || '').toLowerCase().includes(q);
        const fandomMatch = (item.fandom || '').toLowerCase().includes(q) || (item.other_fandom || '').toLowerCase().includes(q);
        if (!nameMatch && !codeMatch && !fandomMatch) return false;
      }

      return true;
    });

    // Sorting
    filteredBooths.sort((x, y) => {
      if (currentFilter.sort === 'booth_asc') {
        return (x.circle_code || '').localeCompare(y.circle_code || '', undefined, {numeric: true});
      } else if (currentFilter.sort === 'name_asc') {
        return x.name.localeCompare(y.name);
      } else if (currentFilter.sort === 'samples_desc') {
        const sX = (x.sampleworks_images ? x.sampleworks_images.length : 0);
        const sY = (y.sampleworks_images ? y.sampleworks_images.length : 0);
        return sY - sX;
      }
      return 0;
    });

    // Update status text
    const countEl = document.getElementById('resultsCountText');
    if (countEl) {
      countEl.textContent = `Menampilkan ${filteredBooths.length.toLocaleString('id-ID')} dari ${allBooths.length.toLocaleString('id-ID')} circle`;
    }

    renderedCount = 0;
    document.getElementById('boothGrid').innerHTML = '';
    document.getElementById('boothTableBody').innerHTML = '';
    loadMoreBooths();
    setupInfiniteScroll();
  }

  // -----------------------------------------------------------------
  // 4. RENDERING CARDS & TABLE ROWS (ENDLESS SCROLL & PRELOAD)
  // -----------------------------------------------------------------
  let isLoadingMore = false;
  let infiniteScrollObserver = null;

  function setupInfiniteScroll() {
    const sentinel = document.getElementById('loadMoreWrap');
    if (!sentinel) return;
    if (infiniteScrollObserver) infiniteScrollObserver.disconnect();

    if ('IntersectionObserver' in window) {
      infiniteScrollObserver = new IntersectionObserver((entries) => {
        const entry = entries[0];
        if (entry && entry.isIntersecting && !isLoadingMore && renderedCount < filteredBooths.length) {
          loadMoreBooths();
        }
      }, {
        rootMargin: '600px 0px 600px 0px'
      });
      infiniteScrollObserver.observe(sentinel);
    }
  }

  // Preload upcoming booth images (avatar cuts and first sampleworks)
  function preloadNextChunk(startIndex) {
    const nextChunk = filteredBooths.slice(startIndex, startIndex + 32);
    nextChunk.forEach(b => {
      if (b.circle_cut) {
        const img = new Image();
        img.src = b.circle_cut;
      }
      const sData = samplesByName[b.name.toLowerCase()];
      const sList = (sData && sData.sampleworks) ? sData.sampleworks : b.sampleworks_images;
      if (sList && sList.length > 0) {
        const sImg = new Image();
        sImg.src = sList[0];
      }
    });
  }

  function loadMoreBooths() {
    if (isLoadingMore || renderedCount >= filteredBooths.length) return;
    isLoadingMore = true;

    const btnMore = document.getElementById('btnLoadMore');
    if (btnMore) {
      btnMore.classList.add('is-loading');
      btnMore.innerHTML = `<span>⏳</span><span>Memuat circle berikutnya...</span>`;
    }

    const start = renderedCount;
    const end = Math.min(filteredBooths.length, start + CHUNK_SIZE);
    const chunk = filteredBooths.slice(start, end);

    if (currentLayout === 'grid') {
      const grid = document.getElementById('boothGrid');
      const fragment = document.createDocumentFragment();
      chunk.forEach(b => {
        fragment.appendChild(createBoothCard(b));
      });
      grid.appendChild(fragment);
    } else {
      const tbody = document.getElementById('boothTableBody');
      const fragment = document.createDocumentFragment();
      chunk.forEach(b => {
        fragment.appendChild(createTableRow(b));
      });
      tbody.appendChild(fragment);
    }

    renderedCount = end;
    isLoadingMore = false;

    if (btnMore) {
      btnMore.classList.remove('is-loading');
      if (renderedCount >= filteredBooths.length) {
        btnMore.classList.add('is-end');
        btnMore.innerHTML = `<span>🎉</span><span>Semua ${filteredBooths.length.toLocaleString('id-ID')} circle telah ditampilkan</span>`;
      } else {
        btnMore.classList.remove('is-end');
        btnMore.innerHTML = `<span>Tampilkan Lebih Banyak (${renderedCount.toLocaleString('id-ID')}/${filteredBooths.length.toLocaleString('id-ID')}) ↓</span>`;
      }
    }

    // Preload next batch in background for instant scrolling
    setTimeout(() => {
      preloadNextChunk(end);
    }, 120);
  }

  // Fallback scroll listener for infinite scrolling
  window.addEventListener('scroll', () => {
    if (isLoadingMore || renderedCount >= filteredBooths.length) return;
    const scrollBottom = window.innerHeight + window.scrollY;
    if (scrollBottom >= document.documentElement.scrollHeight - 700) {
      loadMoreBooths();
    }
  }, { passive: true });

  function createBoothCard(b) {
    const card = document.createElement('div');
    card.className = 'booth-card';

    const sData = samplesByName[b.name.toLowerCase()] || {};
    const samples = (sData.sampleworks && sData.sampleworks.length > 0) ? sData.sampleworks : (b.sampleworks_images || []);
    const hasSamples = samples.length > 0;
    const isBookmarked = wishlist.has(b.id);
    const mapCode = sData.map_code || resolveMapCode(b.circle_code);

    // Hover preload: when user hovers or touches a card, preload its sample images immediately
    card.addEventListener('pointerenter', () => {
      if (hasSamples) {
        samples.slice(0, 4).forEach(u => {
          const p = new Image();
          p.src = u;
        });
      }
    }, { once: true });

    const r = b.rating || 'GA';
    const rText = r === 'M' ? 'M (18+)' : r;

    // Fandom pills
    let fandomsList = [];
    if (b.fandom) fandomsList.push(b.fandom);
    if (b.other_fandom && b.other_fandom !== '-') fandomsList.push(b.other_fandom);
    const fandomText = fandomsList.join(', ');

    // Works
    const worksList = sData.works || [];

    // Media HTML
    let mediaHtml = '';
    if (hasSamples) {
      const displaySamples = samples.slice(0, 4);
      const remaining = samples.length - displaySamples.length;
      mediaHtml = `
        <div class="sampleworks-strip">
          ${displaySamples.map((url, i) => `
            <div class="sample-thumb-item" onclick="openSampleLightbox('${escapeJs(url)}', '${escapeJs(b.name)}', ${i+1}, ${samples.length})" title="Perbesar karya ${i+1}">
              <img src="${escapeHtml(url)}" loading="lazy" alt="Sample Work ${i+1}">
              ${(i === displaySamples.length - 1 && remaining > 0) ? `<div class="sample-more-overlay">+${remaining}</div>` : ''}
            </div>
          `).join('')}
        </div>
      `;
    } else if (sData.x_post && sData.x_post.text) {
      mediaHtml = `
        <div class="x-post-fallback-card">
          <div class="x-post-header">
            <span class="badge-x"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> DARI POSTINGAN X CIRCLE</span>
          </div>
          <div class="x-post-quote">"${escapeHtml(sData.x_post.text)}"</div>
          <div class="x-post-links">
            ${sData.x_post.url ? `<a href="${escapeHtml(sData.x_post.url)}" target="_blank" rel="noopener noreferrer" class="x-link-btn">Lihat Post di X ↗</a>` : ''}
            ${sData.x_post.po_link ? `<a href="${escapeHtml(sData.x_post.po_link)}" target="_blank" rel="noopener noreferrer" class="x-link-btn" style="color:#a5b4fc;">Form Pre-Order ↗</a>` : ''}
          </div>
        </div>
      `;
    } else {
      mediaHtml = `
        <div style="font-size:0.78rem; color:#64748b; text-align:center; padding:0.5rem;">
          Portfolio &amp; catalog belum diunggah circle
        </div>
      `;
    }

    card.innerHTML = `
      <div class="card-top-row">
        <div class="card-top-left">
          <button class="booth-code-pill" onclick="openCircleDetail(${b.id})" title="Lihat detail circle ${escapeHtml(b.name)} (${escapeHtml(b.circle_code || 'TBA')})">
            <span class="pin-icon">📍</span>
            <span>${escapeHtml(b.circle_code || 'TBA')}</span>
          </button>
          <span class="rating-badge rating-${r}">${rText}</span>
          <span class="day-badge">${escapeHtml(b.day || 'Both Days')}</span>
        </div>
        <button class="card-star-btn ${isBookmarked ? 'bookmarked' : ''}" onclick="toggleBookmark(${b.id}, this)" title="Simpan Circle">
          ★
        </button>
      </div>

      <div class="circle-identity-row">
        ${b.circle_cut ? 
          `<img src="${escapeHtml(b.circle_cut)}" class="circle-avatar" loading="lazy" alt="${escapeHtml(b.name)}">` : 
          `<div class="circle-avatar-placeholder">${escapeHtml(b.name.charAt(0).toUpperCase())}</div>`
        }
        <div class="circle-name-wrap">
          <div class="circle-name" title="${escapeHtml(b.name)}">${escapeHtml(b.name)}</div>
          <div class="circle-space-info">${escapeHtml(b.Space || 'Booth')} • ICE BSD</div>
        </div>
      </div>

      <div class="card-media-section">
        ${mediaHtml}
      </div>

      <div class="card-tags-row">
        ${fandomText ? `<span class="fandom-tag" title="${escapeHtml(fandomText)}">#${escapeHtml(fandomText)}</span>` : '<span class="fandom-tag" style="opacity:0.5;">#Original</span>'}
        ${worksList.slice(0, 3).map(w => `<span class="work-pill">${escapeHtml(w)}</span>`).join('')}
      </div>

      <div class="card-actions-row">
        <button class="action-map-btn is-unified" onclick="openCircleDetail(${b.id})">
          <span>📍</span>
          <span>Lihat Detail ${hasSamples ? `· 📸 ${samples.length} Karya` : ''}</span>
        </button>
        <a href="https://catalog.comifuro.net/circle/${b.id}" target="_blank" rel="noopener noreferrer" class="action-link-icon" title="Buka Katalog Resmi Comifuro">
          ↗
        </a>
      </div>
    `;

    return card;
  }

  function createTableRow(b) {
    const tr = document.createElement('tr');
    const sData = samplesByName[b.name.toLowerCase()] || {};
    const samples = (sData.sampleworks && sData.sampleworks.length > 0) ? sData.sampleworks : (b.sampleworks_images || []);
    const r = b.rating || 'GA';

    tr.innerHTML = `
      <td>
        <button class="booth-code-pill" onclick="openCircleDetail(${b.id})">
          📍 ${escapeHtml(b.circle_code || 'TBA')}
        </button>
      </td>
      <td>
        <strong style="color:var(--text-primary);">${escapeHtml(b.name)}</strong>
      </td>
      <td><span class="rating-badge rating-${r}">${r}</span></td>
      <td><span class="day-badge">${escapeHtml(b.day || 'Both')}</span></td>
      <td style="max-width: 280px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
        ${escapeHtml(b.fandom || '-')}
      </td>
      <td>
        ${samples.length > 0 ? 
          `<span style="background:var(--memphis-pink); color:#FFFFFF; font-weight:800; font-size:0.75rem; padding:3px 8px; border-radius:6px; border:1.5px solid #08090D; display:inline-block;">📸 ${samples.length} Karya</span>` : 
          `<span style="color:#64748b; font-size:0.78rem;">𝕏 Post</span>`
        }
      </td>
      <td>
        <button class="action-map-btn" style="padding:0.35rem 0.65rem; font-size:0.75rem;" onclick="openCircleDetail(${b.id})">
          📍 Lihat Detail
        </button>
      </td>
    `;
    return tr;
  }

  // -----------------------------------------------------------------
  // 5. "CLICK BOOTH P-12 ITLL SHOW THE MAP ON WHERE IT IS"
  // -----------------------------------------------------------------

  // -----------------------------------------------------------------
  // 5. CIRCLE & BOOTH DETAIL MODAL (SPOTLIGHT THEATER VIEW)
  // -----------------------------------------------------------------
  let currentDetailBooth = null;
  let currentDetailSamples = [];
  let currentDetailSampleIndex = 0;

  function openCircleDetail(boothId, initialSampleIndex = 0) {
    let b = null;
    if (typeof boothId === 'number') {
      b = allBooths.find(item => item.id === boothId);
    } else if (typeof boothId === 'string') {
      b = allBooths.find(item => item.name.toLowerCase() === boothId.toLowerCase() || (item.circle_code && item.circle_code.toLowerCase() === boothId.toLowerCase()));
    }
    if (!b) return;
    currentDetailBooth = b;

    const sData = samplesByName[b.name.toLowerCase()] || {};
    const samples = (sData.sampleworks && sData.sampleworks.length > 0) ? sData.sampleworks : (b.sampleworks_images || []);
    const r = b.rating || 'GA';
    const rText = r === 'GA' ? 'Rating GA' : (r === 'PG' ? 'Rating PG' : 'Rating M (18+)');

    // 1. Poster / Avatar
    const posterHeader = document.getElementById('detailPosterHeader');
    const posterImg = document.getElementById('detailPosterImg');
    if (posterHeader) posterHeader.textContent = b.name;
    if (posterImg) {
      posterImg.src = b.circle_cut || 'data:image/svg+xml;charset=utf-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="240" viewBox="0 0 200 240"%3E%3Crect width="100%25" height="100%25" fill="%23222538"/%3E%3Ctext x="50%25" y="50%25" font-family="sans-serif" font-weight="bold" font-size="28" fill="%23818cf8" text-anchor="middle" dominant-baseline="middle"%3E' + encodeURIComponent(b.name.charAt(0).toUpperCase()) + '%3C/text%3E%3C/svg%3E';
      posterImg.alt = b.name;
    }

    // 2. Identification
    document.getElementById('detailBoothCode').textContent = b.circle_code || 'TBA';
    document.getElementById('detailCircleName').textContent = b.name;
    document.getElementById('detailDayBadge').textContent = `Day: ${b.day || 'Both Days'}`;
    document.getElementById('detailSpaceBadge').textContent = `Space: ${b.Space || 'Booth'}`;
    
    const rEl = document.getElementById('detailRatingBadge');
    rEl.className = `rating-badge rating-${r}`;
    rEl.textContent = rText;

    // 3. Fandoms
    const fandomParts = [];
    if (b.fandom && b.fandom !== '-') fandomParts.push(b.fandom);
    if (b.other_fandom && b.other_fandom !== '-' && b.other_fandom !== b.fandom) fandomParts.push(b.other_fandom);
    document.getElementById('detailFandoms').textContent = fandomParts.length > 0 ? fandomParts.join(' • ') : 'Original Work / Various';

    // 4. Works offered
    const worksList = [];
    if (b.SellsArtbook) worksList.push('Artbook');
    if (b.SellsGoods) worksList.push('Goods');
    if (b.SellsComic) worksList.push('Comic');
    if (b.SellsNovel) worksList.push('Novel');
    if (b.SellsGame) worksList.push('Game');
    if (b.SellsMusic) worksList.push('Music');
    if (b.SellsHandmadeCrafts) worksList.push('Handmade Crafts');
    if (b.SellsCommision) worksList.push('Commission');
    if (b.SellsPhotobookCosplay || b.SellsPhotobookGeneral) worksList.push('Photobook');
    if (b.SellsMagazine) worksList.push('Magazine');
    if (worksList.length === 0 && sData.works && sData.works.length > 0) {
      worksList.push(...sData.works);
    }
    const worksContainer = document.getElementById('detailWorks');
    if (worksList.length > 0) {
      worksContainer.innerHTML = worksList.map(w => `<span class="detail-work-pill">${escapeHtml(w)}</span>`).join('');
    } else {
      worksContainer.innerHTML = `<span class="detail-work-pill" style="opacity:0.6;">Goods</span>`;
    }

    // 5. Links & Socials (Multi-Account & Enriched Profiles)
    const socialsContainer = document.getElementById('detailSocials');
    const socialLinks = [];
    const seenTwitterHandles = new Set();

    // Collect all Twitter handles (from circle_twitter + sData.x_handles)
    const twHandles = [];
    if (b.circle_twitter && b.circle_twitter !== '-') {
      let h = '';
      const m = b.circle_twitter.match(/(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})/i);
      if (m) h = m[1];
      else if (b.circle_twitter.startsWith('@')) h = b.circle_twitter.slice(1).trim();
      else if (/^[A-Za-z0-9_]{1,15}$/.test(b.circle_twitter.trim())) h = b.circle_twitter.trim();
      if (h) twHandles.push(h);
    }
    if (Array.isArray(sData.x_handles)) {
      for (const h of sData.x_handles) {
        if (h && typeof h === 'string') twHandles.push(h);
      }
    }

    if (twHandles.length > 0) {
      for (const h of twHandles) {
        const lowerH = h.toLowerCase();
        if (seenTwitterHandles.has(lowerH)) continue;
        seenTwitterHandles.add(lowerH);
        socialLinks.push(`<a href="https://x.com/${escapeHtml(h)}" target="_blank" rel="noopener noreferrer" class="detail-social-btn x-btn"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> @${escapeHtml(h)}</a>`);
      }
    } else if (b.circle_twitter && b.circle_twitter !== '-') {
      socialLinks.push(`<a href="${escapeHtml(b.circle_twitter)}" target="_blank" rel="noopener noreferrer" class="detail-social-btn x-btn"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> Twitter / 𝕏</a>`);
    }

    const seenUrls = new Set();
    const normalizeSocialUrl = (u) => (u || '').toLowerCase().trim().replace(/^https?:\/\/(?:www\.)?/, '').replace(/\/+$/, '');

    if (b.circle_instagram && b.circle_instagram !== '-') {
      seenUrls.add(normalizeSocialUrl(b.circle_instagram));
      socialLinks.push(`<a href="${escapeHtml(b.circle_instagram)}" target="_blank" rel="noopener noreferrer" class="detail-social-btn ig-btn">📷 Instagram</a>`);
    }
    if (b.circle_facebook && b.circle_facebook !== '-') {
      seenUrls.add(normalizeSocialUrl(b.circle_facebook));
      socialLinks.push(`<a href="${escapeHtml(b.circle_facebook)}" target="_blank" rel="noopener noreferrer" class="detail-social-btn">📘 Facebook</a>`);
    }
    if (b.circle_youtube && b.circle_youtube !== '-') {
      seenUrls.add(normalizeSocialUrl(b.circle_youtube));
      socialLinks.push(`<a href="${escapeHtml(b.circle_youtube)}" target="_blank" rel="noopener noreferrer" class="detail-social-btn">▶ YouTube</a>`);
    }

    // Extra socials (Carrd, Linktree, etc.)
    if (Array.isArray(sData.extra_socials)) {
      for (const es of sData.extra_socials) {
        if (!es) continue;
        const u = typeof es === 'string' ? es : es.url;
        const t = typeof es === 'object' && es.type ? es.type : 'Link';
        if (!u) continue;
        const norm = normalizeSocialUrl(u);
        if (seenUrls.has(norm)) continue;
        seenUrls.add(norm);
        const icon = t.toLowerCase().includes('insta') ? '📷' : (t.toLowerCase().includes('you') ? '▶' : '🔗');
        socialLinks.push(`<a href="${escapeHtml(u)}" target="_blank" rel="noopener noreferrer" class="detail-social-btn">${icon} ${escapeHtml(t)}</a>`);
      }
    }

    if (socialLinks.length === 0) {
      socialLinks.push(`<span style="color:#64748b; font-size:0.8rem;">Tidak ada tautan sosial tercatat</span>`);
    }
    socialsContainer.innerHTML = socialLinks.join('');

    // 6. X-Post Snippet Box (Multiple Posts Carousel / Tabs)
    currentDetailXPosts = (Array.isArray(sData.x_posts) && sData.x_posts.length > 0)
      ? sData.x_posts
      : (sData.x_post ? [sData.x_post] : []);
    currentDetailXIndex = 0;
    renderDetailXPost(b, sData);

    // 7. Footer Bar Links & Wishlist
    const officialBtn = document.getElementById('detailOfficialBtn');
    officialBtn.href = `https://catalog.comifuro.net/circle/${b.id}`;

    updateDetailWishlistButton();

    // 8. Mount Floor Map in Mini Map Container with Direct Canvas Target
    const mapWrapper = document.getElementById('mapViewWrapper');
    const miniMapBox = document.getElementById('miniMapContainer');
    const boothLabel = document.getElementById('minimapBoothLabel');
    
    if (boothLabel) boothLabel.textContent = b.circle_code || 'TBA';

    if (mapWrapper && miniMapBox) {
      miniMapBox.appendChild(mapWrapper);
      mapWrapper.classList.add('detail-minimap-mode');
      mapWrapper.classList.remove('active');
      mapWrapper.classList.remove('spotlight-mode');
    }

    // Directly highlight booth on the map canvas
    const triggerMapFocus = () => {
      const codeToUse = b.circle_code || resolveMapCode(b.circle_code);
      if (codeToUse) {
        window._pendingBooth = codeToUse;
        if (typeof window.highlightBooth === 'function') {
          window.highlightBooth(codeToUse);
        }
      }
    };
    triggerMapFocus();

    // 9. Right Panel Facebook Media Theater Setup
    currentDetailSamples = samples;
    currentDetailSampleIndex = (typeof initialSampleIndex === 'number' && initialSampleIndex >= 0 && initialSampleIndex < samples.length) ? initialSampleIndex : 0;
    renderDetailTheater();

    // Open Modal
    document.getElementById('circleDetailModal').classList.add('open');
    document.body.style.overflow = 'hidden';

    // Trigger map canvas re-render/resize & focus
    setTimeout(() => {
      triggerMapFocus();
      window.dispatchEvent(new Event('resize'));
    }, 120);
  }

  function renderDetailTheater() {
    const stage = document.getElementById('detailTheaterStage');
    const imgEl = document.getElementById('detailTheaterImg');
    const counterEl = document.getElementById('detailTheaterCounter');
    const prevBtn = document.getElementById('detailTheaterPrevBtn');
    const nextBtn = document.getElementById('detailTheaterNextBtn');
    const emptyEl = document.getElementById('detailTheaterEmpty');
    const thumbsWrap = document.getElementById('detailTheaterThumbsWrap');
    const thumbsEl = document.getElementById('detailTheaterThumbs');
    const fallbackCut = document.getElementById('detailTheaterFallbackCut');

    if (!currentDetailSamples || currentDetailSamples.length === 0) {
      // Empty state
      if (imgEl) imgEl.style.display = 'none';
      if (prevBtn) prevBtn.style.display = 'none';
      if (nextBtn) nextBtn.style.display = 'none';
      if (thumbsWrap) thumbsWrap.style.display = 'none';
      if (emptyEl) emptyEl.style.display = 'flex';
      if (counterEl) counterEl.textContent = 'Karya: 0';
      if (fallbackCut && currentDetailBooth) {
        fallbackCut.src = currentDetailBooth.circle_cut || 'favicon-32.png';
      }
      if (stage) stage.classList.remove('is-loading');
      return;
    }

    if (emptyEl) emptyEl.style.display = 'none';
    if (imgEl) imgEl.style.display = 'block';

    const total = currentDetailSamples.length;
    if (counterEl) counterEl.textContent = `Karya ${currentDetailSampleIndex + 1} / ${total}`;

    // Arrows
    if (prevBtn) prevBtn.style.display = total > 1 ? 'flex' : 'none';
    if (nextBtn) nextBtn.style.display = total > 1 ? 'flex' : 'none';

    // Loading indicator
    if (stage) stage.classList.add('is-loading');

    const currentUrl = currentDetailSamples[currentDetailSampleIndex];
    const loader = new Image();
    loader.onload = () => {
      if (currentDetailSamples[currentDetailSampleIndex] === currentUrl) {
        imgEl.src = currentUrl;
        if (stage) stage.classList.remove('is-loading');
      }
    };
    loader.onerror = () => {
      if (currentDetailSamples[currentDetailSampleIndex] === currentUrl) {
        imgEl.src = currentUrl;
        if (stage) stage.classList.remove('is-loading');
      }
    };
    loader.src = currentUrl;

    // Preload adjacent images
    [currentDetailSampleIndex + 1, currentDetailSampleIndex + 2, currentDetailSampleIndex + 3, currentDetailSampleIndex - 1].forEach(idx => {
      if (idx >= 0 && idx < total) {
        const p = new Image();
        p.src = currentDetailSamples[idx];
      }
    });

    // Render thumbnail strip
    if (thumbsWrap) thumbsWrap.style.display = total > 1 ? 'flex' : 'none';
    if (thumbsEl && total > 1) {
      thumbsEl.innerHTML = currentDetailSamples.map((u, i) => `
        <div class="theater-thumb-item ${i === currentDetailSampleIndex ? 'active' : ''}" onclick="goToDetailSample(${i})" title="Karya ${i+1}">
          <img src="${escapeHtml(u)}" loading="lazy" alt="Thumbnail ${i+1}">
        </div>
      `).join('');

      const activeThumb = thumbsEl.children[currentDetailSampleIndex];
      if (activeThumb) {
        activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }

  function detailTheaterPrev() {
    if (!currentDetailSamples || currentDetailSamples.length <= 1) return;
    currentDetailSampleIndex = (currentDetailSampleIndex - 1 + currentDetailSamples.length) % currentDetailSamples.length;
    renderDetailTheater();
  }

  function detailTheaterNext() {
    if (!currentDetailSamples || currentDetailSamples.length <= 1) return;
    currentDetailSampleIndex = (currentDetailSampleIndex + 1) % currentDetailSamples.length;
    renderDetailTheater();
  }

  function goToDetailSample(idx) {
    if (!currentDetailSamples || idx < 0 || idx >= currentDetailSamples.length) return;
    currentDetailSampleIndex = idx;
    renderDetailTheater();
  }

  function closeCircleDetail() {
    const modal = document.getElementById('circleDetailModal');
    if (!modal) return;
    modal.classList.remove('open');
    document.body.style.overflow = '';

    // Move map wrapper back to root
    const mapWrapper = document.getElementById('mapViewWrapper');
    if (mapWrapper && mapWrapper.parentElement !== document.body) {
      document.body.appendChild(mapWrapper);
      mapWrapper.classList.remove('detail-minimap-mode');
      window.dispatchEvent(new Event('resize'));
    }
  }

  function handleDetailBackdropClick(e) {
    if (e.target.id === 'circleDetailModal') {
      closeCircleDetail();
    }
  }

  function openFullMapFromDetail() {
    if (!currentDetailBooth) return;
    const b = currentDetailBooth;
    closeCircleDetail();
    switchToFullMapMode();
    const mapCode = resolveMapCode(b.circle_code);
    if (mapCode) location.hash = '#' + mapCode;
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 100);
  }

  function toggleDetailWishlist() {
    if (!currentDetailBooth) return;
    toggleBookmark(currentDetailBooth.id);
    updateDetailWishlistButton();
  }

  function updateDetailWishlistButton() {
    if (!currentDetailBooth) return;
    const btn = document.getElementById('detailWishlistBtn');
    const text = document.getElementById('detailWishlistText');
    const isSaved = wishlist.has(currentDetailBooth.id);
    if (btn && text) {
      if (isSaved) {
        btn.classList.add('bookmarked');
        text.textContent = 'Wishlisted';
      } else {
        btn.classList.remove('bookmarked');
        text.textContent = 'Add to Wishlist';
      }
    }
  }

  let currentDetailXPosts = [];
  let currentDetailXIndex = 0;

  function renderDetailXPost(b, sData) {
    b = b || currentDetailBooth;
    sData = sData || (b ? (samplesByName[b.name.toLowerCase()] || {}) : {});
    const xBox = document.getElementById("detailXBox");
    const xQuote = document.getElementById("detailXQuote");
    const xAuthor = document.getElementById("detailXAuthor");
    const xLink = document.getElementById("detailXLink");
    const xPoWrap = document.getElementById("detailXPoWrap");
    const xPoLink = document.getElementById("detailXPoLink");
    const xToggle = document.getElementById("detailXToggle");
    const xNav = document.getElementById("detailXNav");
    const xCounter = document.getElementById("detailXCounter");
    const xTabs = document.getElementById("detailXTabs");

    if (!xBox || !xQuote) return;

    if (currentDetailXPosts && currentDetailXPosts.length > 0) {
      xBox.style.display = "block";
      const totalPosts = currentDetailXPosts.length;
      if (currentDetailXIndex >= totalPosts) currentDetailXIndex = 0;
      if (currentDetailXIndex < 0) currentDetailXIndex = totalPosts - 1;

      const p = currentDetailXPosts[currentDetailXIndex];

      if (totalPosts > 1) {
        if (xNav) {
          xNav.style.display = "inline-flex";
          if (xCounter) xCounter.textContent = `${currentDetailXIndex + 1} / ${totalPosts}`;
        }
        if (xTabs) {
          xTabs.style.display = "flex";
          xTabs.innerHTML = currentDetailXPosts.map((post, idx) => {
            const authorTag = post.author ? `@${post.author}` : `Post ${idx + 1}`;
            return `<button type="button" class="detail-x-tab-btn ${idx === currentDetailXIndex ? "active" : ""}" onclick="selectDetailXPost(${idx})">${escapeHtml(authorTag)}</button>`;
          }).join("");
        }
      } else {
        if (xNav) xNav.style.display = "none";
        if (xTabs) xTabs.style.display = "none";
      }

      xQuote.textContent = `"${p.text}"`;
      let authorHandle = p.author ? `@${p.author}` : (b ? `@${b.name}` : "");
      xAuthor.textContent = authorHandle ? `𝕏 ${authorHandle}` : "";

      if (p.url) {
        xLink.href = p.url;
        if (p.url.includes("instagram.com")) {
          xLink.innerHTML = "Buka postingan IG ↗";
        } else {
          xLink.innerHTML = "Buka postingan X ↗";
        }
        xLink.style.display = "inline-flex";
      } else {
        xLink.style.display = "none";
      }

      const po = p.po_link || (sData ? sData.po_link : "");
      if (po) {
        xPoWrap.style.display = "block";
        xPoLink.href = po;
      } else {
        xPoWrap.style.display = "none";
      }

      if (p.text.length > 180) {
        xToggle.style.display = "block";
        xToggle.textContent = "Tampilkan postingan lengkap ⌵";
        xQuote.classList.add("collapsed");
      } else {
        xToggle.style.display = "none";
        xQuote.classList.remove("collapsed");
      }
    } else {
      if (xNav) xNav.style.display = "none";
      if (xTabs) xTabs.style.display = "none";
      xQuote.innerHTML = `<span style="color:#64748b; font-style:italic;">Belum ada postingan X atau info pre-order yang terdeteksi untuk circle ini.</span>`;
      xAuthor.textContent = "";
      xLink.style.display = "none";
      xPoWrap.style.display = "none";
      xToggle.style.display = "none";
    }
  }

  function detailXPrev() {
    if (currentDetailXPosts.length <= 1) return;
    currentDetailXIndex = (currentDetailXIndex - 1 + currentDetailXPosts.length) % currentDetailXPosts.length;
    renderDetailXPost();
  }

  function detailXNext() {
    if (currentDetailXPosts.length <= 1) return;
    currentDetailXIndex = (currentDetailXIndex + 1) % currentDetailXPosts.length;
    renderDetailXPost();
  }

  function selectDetailXPost(idx) {
    if (typeof idx === "number" && idx >= 0 && idx < currentDetailXPosts.length) {
      currentDetailXIndex = idx;
      renderDetailXPost();
    }
  }

  window.detailXPrev = detailXPrev;
  window.detailXNext = detailXNext;
  window.selectDetailXPost = selectDetailXPost;

  function toggleDetailXText() {
    const q = document.getElementById('detailXQuote');
    const t = document.getElementById('detailXToggle');
    if (!q || !t) return;
    if (q.classList.contains('collapsed')) {
      q.classList.remove('collapsed');
      t.textContent = 'Tutup cuitan ▴';
    } else {
      q.classList.add('collapsed');
      t.textContent = 'Tampilkan 1 postingan lagi ⌵';
    }
  }

  function showBoothOnMap(rawCode, circleName, rating) {
    let b = null;
    if (circleName) {
      b = allBooths.find(item => item.name.toLowerCase() === circleName.toLowerCase());
    }
    if (!b && rawCode) {
      b = allBooths.find(item => (item.circle_code || '').toLowerCase() === rawCode.toLowerCase());
    }
    if (b) {
      openCircleDetail(b.id);
      return;
    }

    const mapCode = resolveMapCode(rawCode);
    if (!mapCode) {
      alert(`Booth code "${rawCode}" tidak ditemukan di peta.`);
      return;
    }

    const mapWrapper = document.getElementById('mapViewWrapper');
    if (!mapWrapper) return;
    mapWrapper.classList.add('spotlight-mode');
    mapWrapper.classList.remove('active');

    document.getElementById('spotlightCode').textContent = rawCode || mapCode.toUpperCase();
    document.getElementById('spotlightSub').textContent = `Circle: ${circleName || 'Participating Circle'} • Hall 9 ICE BSD`;
    
    const rEl = document.getElementById('spotlightRating');
    const r = rating || 'GA';
    rEl.className = `rating-badge rating-${r}`;
    rEl.textContent = r;

    location.hash = '#' + mapCode;
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 100);
  }

  function closeMapSpotlight() {
    const mapWrapper = document.getElementById('mapViewWrapper');
    if (mapWrapper) {
      mapWrapper.classList.remove('spotlight-mode');
    }
  }

  function switchToFullMapMode() {
    const mapWrapper = document.getElementById('mapViewWrapper');
    if (mapWrapper) {
      mapWrapper.classList.remove('spotlight-mode');
      mapWrapper.classList.add('active');
    }
    document.getElementById('btnModeCatalog').classList.remove('active');
    document.getElementById('btnModeMap').classList.add('active');
  }

  function switchMainView(mode) {
    const mapWrapper = document.getElementById('mapViewWrapper');
    const catalog = document.getElementById('catalogView');
    const btnCat = document.getElementById('btnModeCatalog');
    const btnMap = document.getElementById('btnModeMap');

    if (mode === 'map') {
      if (mapWrapper) {
        mapWrapper.classList.remove('spotlight-mode');
        mapWrapper.classList.add('active');
      }
      if (btnCat) btnCat.classList.remove('active');
      if (btnMap) btnMap.classList.add('active');
      setTimeout(() => { window.dispatchEvent(new Event('resize')); }, 100);
    } else {
      if (mapWrapper) {
        mapWrapper.classList.remove('spotlight-mode');
        mapWrapper.classList.remove('active');
      }
      if (btnCat) btnCat.classList.add('active');
      if (btnMap) btnMap.classList.remove('active');
    }
  }

  function resolveMapCode(raw) {
    if (!raw) return '';
    const clean = raw.toLowerCase().replace(/\s*\([^)]*\)/g, '').trim();
    const parts = clean.split(/[/,]+/);
    for (let p of parts) {
      p = p.trim();
      if (!p) continue;
      // Single letter block like p-12, a-01
      const isSingleLetter = /^[a-z]-\d+/.test(p);
      if (isSingleLetter) {
        if (p.endsWith('ab')) return p.slice(0, -2) + 'a';
        if (!p.endsWith('a') && !p.endsWith('b')) return p + 'a';
        return p;
      }
      // Double letter block like aa-01, ab-02
      if (p.endsWith('a') || p.endsWith('b')) {
        return p.slice(0, -1);
      }
      return p;
    }
    return clean;
  }

  // -----------------------------------------------------------------
  // 6. WISHLIST BOOKMARK SYSTEM
  // -----------------------------------------------------------------
  function toggleBookmark(id, btnEl) {
    if (wishlist.has(id)) {
      wishlist.delete(id);
      if (btnEl) btnEl.classList.remove('bookmarked');
    } else {
      wishlist.add(id);
      if (btnEl) btnEl.classList.add('bookmarked');
    }
    try {
      const serialized = JSON.stringify(Array.from(wishlist));
      localStorage.setItem('cf_catalog_wishlist', serialized);
      localStorage.setItem('cf23_catalog_wishlist', serialized);
    } catch(e) {}
    updateWishlistBadge();
    if (currentFilter.wishlistOnly) applyFilters();
  }

  function updateWishlistBadge() {
    const badge = document.getElementById('wishlistBadge');
    if (badge) {
      badge.textContent = wishlist.size;
      badge.style.display = wishlist.size > 0 ? 'flex' : 'none';
    }
  }

  // -----------------------------------------------------------------
  // 7. INSTAGRAM-STYLE ZOOMED POST MODAL
  // -----------------------------------------------------------------
  let currentIgPost = {
    samples: [],
    currentIndex: 0,
    circleName: '',
    boothCode: '',
    rating: '',
    day: '',
    circleCut: '',
    fandoms: [],
    works: [],
    officialUrl: ''
  };

  window.openSampleLightbox = function(url, circleName, currentIdx, totalCount) {
    const cleanName = (circleName || '').trim().toLowerCase();
    const b = allBooths.find(item => item.name && item.name.trim().toLowerCase() === cleanName);
    if (b) {
      const sData = samplesByName[b.name.toLowerCase()] || {};
      const samplesList = (sData && sData.sampleworks && sData.sampleworks.length > 0) 
        ? sData.sampleworks 
        : ((b.sampleworks_images && b.sampleworks_images.length > 0) ? b.sampleworks_images : [url]);
      const initialIndex = Math.max(0, (currentIdx ? currentIdx - 1 : samplesList.indexOf(url)));
      openCircleDetail(b.id, initialIndex);
      return;
    }

    let sDataFallback = null;
    if (window.COMIFURO_SAMPLES_BY_NAME && cleanName) {
      sDataFallback = window.COMIFURO_SAMPLES_BY_NAME[cleanName];
    }
    const boothFallback = allBooths.find(item => item.name && item.name.trim().toLowerCase() === cleanName) || {};

    const samplesList = (sDataFallback && sDataFallback.sampleworks && sDataFallback.sampleworks.length > 0) 
      ? sDataFallback.sampleworks 
      : ((boothFallback.sampleworks_images && boothFallback.sampleworks_images.length > 0) ? boothFallback.sampleworks_images : [url]);

    const initialIndex = Math.max(0, (currentIdx ? currentIdx - 1 : samplesList.indexOf(url)));

    currentIgPost = {
      samples: samplesList,
      currentIndex: initialIndex >= 0 ? initialIndex : 0,
      circleName: circleName || sDataFallback?.name || boothFallback.name || 'Participating Circle',
      boothCode: sDataFallback?.circle_code || boothFallback.circle_code || '',
      rating: sDataFallback?.rating || boothFallback.rating || 'GA',
      day: sDataFallback?.day || boothFallback.day || 'Both Days',
      circleCut: sDataFallback?.circle_cut || boothFallback.circle_cut || '',
      officialUrl: sDataFallback?.official_url || (boothFallback.id ? `https://catalog.comifuro.net/circle/${boothFallback.id}` : 'https://catalog.comifuro.net/catalog'),
      fandoms: (sDataFallback && sDataFallback.fandom) ? [sDataFallback.fandom, sDataFallback.other_fandom].filter(Boolean) : (boothFallback.fandom ? [boothFallback.fandom] : []),
      works: (sDataFallback && sDataFallback.works) ? sDataFallback.works : (boothFallback.Works ? boothFallback.Works.split(',').map(s=>s.trim()) : ['Artbook', 'Goods'])
    };

    renderIgModal();
    const modal = document.getElementById('igPostModal');
    if (modal) modal.classList.add('open');
  };

  function renderIgModal() {
    const post = currentIgPost;
    const curImgUrl = post.samples[post.currentIndex] || '';

    // Immediate count and position indicator updates
    const badgeEl = document.getElementById('igBadgeIndex');
    if (badgeEl) {
      badgeEl.textContent = `${post.currentIndex + 1} / ${post.samples.length}`;
      badgeEl.style.display = post.samples.length > 1 ? 'flex' : 'none';
    }
    const counterEl = document.getElementById('igCounter');
    if (counterEl) {
      counterEl.textContent = `Contoh ${post.currentIndex + 1} dari ${post.samples.length}`;
    }

    // Smooth loading stage & indicator
    const stage = document.getElementById('igMediaStage');
    const imgEl = document.getElementById('igPostImg');
    const loader = document.getElementById('igMediaLoader');

    if (stage && loader && imgEl) {
      stage.classList.add('is-loading');
      loader.style.display = 'flex';

      const targetSrc = curImgUrl;
      const tempImg = new Image();
      
      const onDone = () => {
        if (currentIgPost.samples[currentIgPost.currentIndex] === targetSrc) {
          imgEl.src = targetSrc;
          stage.classList.remove('is-loading');
          loader.style.display = 'none';
        }
      };

      tempImg.onload = onDone;
      tempImg.onerror = onDone;
      tempImg.src = targetSrc;

      if (tempImg.complete) {
        onDone();
      }
    } else if (imgEl) {
      imgEl.src = curImgUrl;
    }

    // Preload next and previous images ahead of time
    if (post.samples.length > 1) {
      const offsets = [1, 2, 3, -1, -2];
      offsets.forEach(off => {
        const idx = (post.currentIndex + off + post.samples.length) % post.samples.length;
        const u = post.samples[idx];
        if (u) {
          const pre = new Image();
          pre.src = u;
        }
      });
    }

    // Arrows
    const prevBtn = document.getElementById('igPrevBtn');
    const nextBtn = document.getElementById('igNextBtn');
    if (prevBtn) prevBtn.style.display = post.samples.length > 1 ? 'flex' : 'none';
    if (nextBtn) nextBtn.style.display = post.samples.length > 1 ? 'flex' : 'none';

    // Dots
    const dotsWrap = document.getElementById('igDotsWrap');
    if (dotsWrap) {
      if (post.samples.length > 1 && post.samples.length <= 16) {
        dotsWrap.style.display = 'flex';
        dotsWrap.innerHTML = post.samples.map((_, i) => 
          `<div class="ig-dot ${i === post.currentIndex ? 'active' : ''}" onclick="goToIgSample(${i})" title="Karya ${i+1}"></div>`
        ).join('');
      } else {
        dotsWrap.style.display = 'none';
      }
    }

    // Header info
    const edBooth = (window.EVENT_INFO && window.EVENT_INFO.edition) ? `CF${window.EVENT_INFO.edition} Booth` : 'Comifuro Booth';
    document.getElementById('igCircleName').textContent = post.circleName;
    document.getElementById('igBoothCode').textContent = post.boothCode || edBooth;
    document.getElementById('igDay').textContent = post.day || 'Both Days';
    
    const avatarEl = document.getElementById('igAvatar');
    if (post.circleCut) {
      avatarEl.src = post.circleCut;
      avatarEl.style.display = 'block';
    } else {
      avatarEl.src = 'favicon-32.png';
    }

    // Rating Tag
    const rEl = document.getElementById('igRatingTag');
    const r = post.rating || 'GA';
    const rText = r === 'M' ? 'Mature (18+)' : r === 'PG' ? 'Parental Guidance' : 'General Audience';
    rEl.innerHTML = `<span class="ig-tag rating-${r}">Rating ${r} • ${rText}</span>`;

    // Fandoms
    const fEl = document.getElementById('igFandomTags');
    if (post.fandoms && post.fandoms.length > 0) {
      fEl.innerHTML = post.fandoms.map(f => `<span class="ig-tag">#${escapeHtml(f)}</span>`).join('');
    } else {
      fEl.innerHTML = '<span class="ig-tag" style="opacity: 0.6;">Original Works</span>';
    }

    // Works
    const wEl = document.getElementById('igWorksTags');
    wEl.innerHTML = post.works.map(w => `<span class="ig-tag">${escapeHtml(w)}</span>`).join('');

    // Socials & Links
    const sEl = document.getElementById('igSocialLinks');
    sEl.innerHTML = `
      <a href="${escapeHtml(post.officialUrl)}" target="_blank" class="ig-social-btn" rel="noopener noreferrer">
        🌐 Katalog Resmi Comifuro ↗
      </a>
      <a href="${escapeHtml(curImgUrl)}" target="_blank" class="ig-social-btn" rel="noopener noreferrer">
        🔍 Buka Resolusi Penuh ↗
      </a>
    `;

    // Footer Counter
    document.getElementById('igCounter').textContent = `Contoh ${post.currentIndex + 1} dari ${post.samples.length}`;
    document.getElementById('igOfficialLink').href = post.officialUrl;
  }

  function igNextSample() {
    if (currentIgPost.samples.length <= 1) return;
    currentIgPost.currentIndex = (currentIgPost.currentIndex + 1) % currentIgPost.samples.length;
    renderIgModal();
  }

  function igPrevSample() {
    if (currentIgPost.samples.length <= 1) return;
    currentIgPost.currentIndex = (currentIgPost.currentIndex - 1 + currentIgPost.samples.length) % currentIgPost.samples.length;
    renderIgModal();
  }

  function goToIgSample(idx) {
    if (!currentIgPost.samples || idx < 0 || idx >= currentIgPost.samples.length) return;
    currentIgPost.currentIndex = idx;
    renderIgModal();
  }

  function closeIgPostModal() {
    const modal = document.getElementById('igPostModal');
    if (modal) modal.classList.remove('open');
  }

  function handleIgBackdropClick(e) {
    if (e.target.id === 'igPostModal') closeIgPostModal();
  }

  // -----------------------------------------------------------------
  // 8. FIRST-VISIT DISCLAIMER MODAL
  // -----------------------------------------------------------------
  const DISCLAIMER_STORAGE_KEY = 'cf_vibecoded_disclaimer_seen';

  function initWelcomeDisclaimer() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('circle') || urlParams.get('booth') || urlParams.get('c') || urlParams.get('view') === 'map') return;
    try {
      const hasSeen = localStorage.getItem(DISCLAIMER_STORAGE_KEY);
      if (!hasSeen) {
        setTimeout(() => {
          const m = document.getElementById('welcomeModal');
          if (m) m.classList.add('open');
        }, 400);
      }
    } catch(e) {}
  }

  function dismissWelcomeModal() {
    const m = document.getElementById('welcomeModal');
    if (m) m.classList.remove('open');
    const chk = document.getElementById('dontShowAgainCheck');
    if (!chk || chk.checked) {
      try {
        localStorage.setItem(DISCLAIMER_STORAGE_KEY, 'true');
      } catch(e) {}
    }
  }

  function handleWelcomeBackdropClick(e) {
    if (e.target.id === 'welcomeModal') dismissWelcomeModal();
  }

  window.openDisclaimerModal = function() {
    const m = document.getElementById('welcomeModal');
    if (m) m.classList.add('open');
  };

  // -----------------------------------------------------------------
  // 9. STRING HELPERS
  // -----------------------------------------------------------------
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeJs(str) {
    if (!str) return '';
    return String(str)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"');
  }


  // -----------------------------------------------------------------
  // 12. EXPORT & TOAST NOTIFICATIONS (Merged from catalog.html)
  // -----------------------------------------------------------------
  function exportData(format) {
    const dataToExport = filteredBooths.length > 0 ? filteredBooths : allBooths;
    const count = dataToExport.length;
    const ratingSuffix = currentFilter.rating !== 'ALL' ? '_' + currentFilter.rating : '';

    if (format === 'json') {
      const jsonStr = JSON.stringify(dataToExport, null, 2);
      downloadFile(jsonStr, 'comifuro_booths' + ratingSuffix + '_' + count + '.json', 'application/json');
      showToast('Berhasil mengekspor ' + count.toLocaleString() + ' booth ke format JSON');
    } else if (format === 'csv') {
      const headers = [
        'id', 'circle_code', 'name', 'rating', 'day', 'fandom', 'other_fandom',
        'Space', 'circle_cut', 'circle_twitter', 'circle_instagram',
        'circle_facebook', 'circle_youtube', 'circle_other_socials', 'marketplace_link',
        'SellsComic', 'SellsArtbook', 'SellsNovel', 'SellsGoods', 'SellsGame',
        'SellsMusic', 'SellsCommision', 'SellsHandmadeCrafts', 'SellsMagazine', 'SellsPhotobookCosplay'
      ];
      const csvRows = [headers.join(',')];
      
      dataToExport.forEach(b => {
        const row = headers.map(h => {
          const val = b[h] !== undefined && b[h] !== null ? String(b[h]) : '';
          return '"' + val.replace(/"/g, '""') + '"';
        });
        csvRows.push(row.join(','));
      });

      downloadFile(csvRows.join('\n'), 'comifuro_booths' + ratingSuffix + '_' + count + '.csv', 'text/csv');
      showToast('Berhasil mengekspor ' + count.toLocaleString() + ' booth ke format CSV');
    }
  }

  function downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  let toastTimeout = null;
  function showToast(msg) {
    let t = document.getElementById('toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      t.className = 'toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      t.classList.remove('show');
    }, 2800);
  }

  // -----------------------------------------------------------------
  // 10. EXPOSE CONTROLLER METHODS TO GLOBAL WINDOW
  // -----------------------------------------------------------------
  window.openCircleDetail = openCircleDetail;
  window.closeCircleDetail = closeCircleDetail;
  window.detailTheaterPrev = detailTheaterPrev;
  window.detailTheaterNext = detailTheaterNext;
  window.goToDetailSample = goToDetailSample;
  window.switchMainView = switchMainView;
  window.setFilterRating = setFilterRating;
  window.setFilterDay = setFilterDay;
  window.setFilterBlock = setFilterBlock;
  window.toggleSamplesOnly = toggleSamplesOnly;
  window.setSortOrder = setSortOrder;
  window.toggleWishlistOnly = toggleWishlistOnly;
  window.loadMoreBooths = loadMoreBooths;
  window.openFullMapFromDetail = openFullMapFromDetail;
  window.toggleDetailWishlist = toggleDetailWishlist;
  window.toggleDetailXText = toggleDetailXText;
  window.igNextSample = igNextSample;
  window.igPrevSample = igPrevSample;
  window.goToIgSample = goToIgSample;
  window.closeIgPostModal = closeIgPostModal;
  window.toggleBookmark = toggleBookmark;
  window.setCatalogLayout = setCatalogLayout;
  window.dismissWelcomeModal = dismissWelcomeModal;
  window.exportData = exportData;
