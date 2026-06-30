/* games.js - Core Loading & Rendering Logic */

// Global State
let allGames = [];
let wishlistGames = [];
let displayGames = [];
let loaded = 0;
const perLoad = 24;
let currentSort = 'library';
let scrollListenerAttached = false;
let ceremonyTimeout = null;

// DOM Elements
const titleEl = document.querySelector('h1');
const gameListEl = document.getElementById('game-list');
const loadingEl = document.getElementById('loading');
const tabsContainer = document.getElementById('navigation-tabs');
const tabButtons = document.querySelectorAll('.tab-btn');
const detailDialog = document.getElementById('game-detail-dialog');

// Fallback Scroll Observer for entry/exit animation (for browsers not supporting view-timeline)
let scrollObserver = null;
if (typeof window !== 'undefined' && !CSS.supports('(animation-timeline: view()) and (animation-range: entry)')) {
  scrollObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
      }
    });
  }, {
    threshold: 0.05,
    rootMargin: '0px 0px -40px 0px'
  });
}

function observeForScrollAnimation(element) {
  if (scrollObserver && element) {
    scrollObserver.observe(element);
  }
}

// Cover image fallback chain
function handleImageError(img) {
  img.parentElement.classList.remove('shimmer-loader');
  
  const fallbacks = [
    'library_capsule_2x.jpg',
    'library_capsule.jpg',
    'library_600x900.jpg',
    'portrait.png'
  ];
  
  if (!img.dataset.fallbackIndex) {
    const srcParts = img.src.split('/');
    const currentFilename = srcParts[srcParts.length - 1].split('?')[0];
    const idx = fallbacks.indexOf(currentFilename);
    img.dataset.fallbackIndex = (idx !== -1 ? idx : 0).toString();
  }
  
  let currentIndex = parseInt(img.dataset.fallbackIndex, 10);
  if (currentIndex < fallbacks.length - 1) {
    currentIndex++;
    img.dataset.fallbackIndex = currentIndex.toString();
    
    const nextFilename = fallbacks[currentIndex];
    if (nextFilename === 'portrait.png') {
      img.src = 'portrait.png';
    } else {
      const srcParts = img.src.split('/');
      srcParts[srcParts.length - 1] = nextFilename;
      img.src = srcParts.join('/');
    }
  } else {
    img.src = 'portrait.png';
  }
}

// Banner image fallback chain
function resolveBanner(appId, callback) {
  const banners = [
    'page_bg_raw.jpg',
    'library_header_2x.jpg',
    'library_header.jpg',
    'library_hero_2x.jpg',
    'library_hero.jpg',
    'capsule_616x353_2x.jpg',
    'capsule_616x353.jpg',
    'capsule_231x87_2x.jpg',
    'capsule_231x87.jpg'
  ];
  
  let index = 0;
  
  function tryNext() {
    if (index >= banners.length) {
      callback(null);
      return;
    }
    const url = `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appId}/${banners[index]}`;
    const img = new Image();
    img.src = url;
    img.onload = () => callback(url);
    img.onerror = () => {
      index++;
      tryNext();
    };
  }
  
  tryNext();
}

// Helper: Convert "1,400.0h" or "59m" string into a real number of hours for sorting
function parsePlaytime(ptStr) {
  if (!ptStr) return 0;
  const cleanStr = ptStr.replace(/,/g, '').trim().toLowerCase();
  if (cleanStr.endsWith('m')) {
    const mins = parseFloat(cleanStr) || 0;
    return mins / 60;
  }
  const hours = parseFloat(cleanStr) || 0;
  return hours;
}

// Extract Steam App ID from image URL and create Store Link
function getSteamUrl(imageUrl) {
  if (!imageUrl) return null;
  const match = imageUrl.match(/\/apps\/(\d+)\//);
  return match ? `https://store.steampowered.com/app/${match[1]}/` : null;
}

// Common game words to disallow as 1-word franchise prefixes
const COMMON_STARTER_WORDS = new Set([
  'the', 'a', 'an', 'super', 'grand', 'total', 'black', 'dead', 'final', 
  'metal', 'world', 'space', 'between', 'dark', 'love', 'adorable', 'new', 
  'tom', 'clancys', 'star', 'war', 'wars', 'game', 'girls', 'waifu', 'quest'
]);

function cleanName(name) {
  let s = name.trim();
  s = s.replace(/[®™©Ⓡ℠]/g, '');
  // Normalize colons/dashes to spaces to allow prefix matching
  s = s.replace(/[:\-_]/g, ' ');
  
  // Strip Roman Numerals (case-insensitive, bounded)
  s = s.replace(/\b(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV)\b/gi, '');

  // Strip numbers
  s = s.replace(/\b\d+\b/g, '');

  // Collapse spaces
  s = s.replace(/\s+/g, ' ');
  return s.trim();
}

function getPrefixes(name) {
  const cleaned = cleanName(name);
  const words = cleaned.split(' ').map(w => w.toLowerCase());
  
  let startIndex = 0;
  if (words[0] === 'the' || words[0] === 'a' || words[0] === 'an') {
    startIndex = 1;
  }
  
  // Force LEGO and Naruto games to only generate their base prefix to prevent fragmentation
  if (words[startIndex] === 'lego') {
    return ['lego'];
  }
  if (words[startIndex] === 'naruto') {
    return ['naruto'];
  }
  
  const prefixes = [];
  for (let i = startIndex + 1; i <= words.length; i++) {
    const prefixWords = words.slice(0, i);
    const prefixStr = prefixWords.join(' ');
    
    const activeLength = i - startIndex;
    if (activeLength === 1) {
      const singleWord = words[startIndex];
      if (!singleWord || singleWord.length < 4 || COMMON_STARTER_WORDS.has(singleWord)) {
        continue;
      }
    }
    
    prefixes.push(prefixStr);
  }
  return prefixes;
}

function getDisplayGroupName(prefixKey, gamesInGroup) {
  const firstGameName = gamesInGroup[0].name;
  const cleaned = firstGameName.replace(/[®™©Ⓡ℠]/g, '').replace(/[:\-_]/g, ' ').replace(/\s+/g, ' ').trim();
  const wordCount = prefixKey.split(' ').length;
  const words = cleaned.split(' ');
  let displayName = words.slice(0, wordCount).join(' ');
  
  displayName = displayName.replace(/\b(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV)\b/gi, '');
  displayName = displayName.replace(/\b\d+\b/g, '');
  displayName = displayName.replace(/\s+/g, ' ').trim();
  
  if (displayName.toLowerCase().endsWith(' the')) {
    displayName = displayName.substring(0, displayName.length - 4);
  }
  if (displayName.toLowerCase().endsWith(' a')) {
    displayName = displayName.substring(0, displayName.length - 2);
  }
  
  if (!displayName) {
    displayName = prefixKey.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
  
  return displayName;
}

function sortGamesByPlaytimeDesc(games) {
  return [...games].sort((a, b) => parsePlaytime(b.playtime) - parsePlaytime(a.playtime));
}

function groupGamesByFranchise(games) {
  // 1. Count occurrences of all prefixes across these specific games
  const prefixCounts = {};
  games.forEach(g => {
    const prefixes = getPrefixes(g.name);
    const uniquePrefixes = [...new Set(prefixes)];
    uniquePrefixes.forEach(pref => {
      prefixCounts[pref] = (prefixCounts[pref] || 0) + 1;
    });
  });

  // 2. Map games to their longest prefix that has count >= 2
  const groups = {};
  const singles = [];

  games.forEach(g => {
    const prefixes = getPrefixes(g.name);
    let bestPrefix = null;
    
    for (let i = prefixes.length - 1; i >= 0; i--) {
      const pref = prefixes[i];
      if (prefixCounts[pref] >= 2) {
        bestPrefix = pref;
        break;
      }
    }
    
    if (bestPrefix) {
      if (!groups[bestPrefix]) {
        groups[bestPrefix] = [];
      }
      groups[bestPrefix].push(g);
    } else {
      singles.push(g);
    }
  });

  // 3. Convert groups to list of collection objects
  const groupedResult = [];
  Object.keys(groups).forEach(key => {
    const gamesInGroup = groups[key];
    const displayLabel = getDisplayGroupName(key, gamesInGroup);
    const sortedGames = sortGamesByPlaytimeDesc(gamesInGroup);
    const totalPlaytime = sortedGames.reduce((sum, g) => sum + parsePlaytime(g.playtime), 0);
    
    groupedResult.push({
      label: displayLabel,
      games: sortedGames,
      totalPlaytime: totalPlaytime,
      isCollection: true
    });
  });

  // Sort collections by total playtime of each collection desc
  groupedResult.sort((a, b) => b.totalPlaytime - a.totalPlaytime);

  // Add singles (General) at the end
  if (singles.length > 0) {
    const sortedSingles = sortGamesByPlaytimeDesc(singles);
    const totalPlaytime = sortedSingles.reduce((sum, g) => sum + parsePlaytime(g.playtime), 0);
    groupedResult.push({
      label: 'General',
      games: sortedSingles,
      totalPlaytime: totalPlaytime,
      isCollection: false
    });
  }

  return groupedResult;
}

// Generate Game Card DOM
// Generate Game Card DOM
function createGameCard(game, rank = null) {
  const card = document.createElement('div');
  card.className = 'game-card';

  let badgeHTML = '';
  if (rank !== null) {
    badgeHTML = `<div class="rank-badge">#${rank}</div>`;
  } else if (game.favorite) {
    badgeHTML = `<div class="fav-badge">★</div>`;
  }

  card.innerHTML = `
    ${badgeHTML}
    <div class="cover-wrapper shimmer-loader">
      <img
        src="${game.image}"
        alt="${game.name}"
        loading="lazy"
        onload="this.parentElement.classList.remove('shimmer-loader')"
        onerror="handleImageError(this)"
      >
    </div>
    <div class="game-card-details">
      <h2>${game.name}</h2>
      <p class="playtime">${game.playtime || '0h'}</p>
    </div>
  `;

  card.addEventListener('click', () => openGameDetails(game));
  observeForScrollAnimation(card);
  return card;
}

// Generate Throne Card DOM for Top 3 Podium
function createThroneCard(game, rank) {
  const card = document.createElement('div');
  const rankClass = rank === 1 ? 'gold-rank' : rank === 2 ? 'silver-rank' : 'bronze-rank';
  card.className = `throne-card ${rankClass}`;

  // Custom SVG Trophy/Badge for podium ranks
  let trophySvg = '';
  if (rank === 1) {
    trophySvg = `<svg class="podium-trophy gold" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34M12 2a5 5 0 0 0-5 5v3c0 2.76 2.24 5 5 5s5-2.24 5-5V7a5 5 0 0 0-5-5z"/></svg>`;
  } else if (rank === 2) {
    trophySvg = `<svg class="podium-trophy silver" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="7"/><path d="M8.21 13.89 7 23l5-3 5 3-1.21-9.12"/></svg>`;
  } else {
    trophySvg = `<svg class="podium-trophy bronze" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
  }

  card.innerHTML = `
    <div class="throne-rank-badge">
      ${trophySvg}
      <span>${rank === 1 ? '1st' : rank === 2 ? '2nd' : '3rd'}</span>
    </div>
    <div class="throne-cover-wrapper shimmer-loader">
      <img
        src="${game.image}"
        alt="${game.name}"
        loading="lazy"
        onload="this.parentElement.classList.remove('shimmer-loader')"
        onerror="handleImageError(this)"
      >
    </div>
    <div class="throne-card-details">
      <h2>${game.name}</h2>
      <div class="throne-playtime-container">
        <span class="throne-playtime">${game.playtime || '0h'}</span>
        <div class="throne-progress-bar">
          <div class="throne-progress-fill" style="width: 100%"></div>
        </div>
      </div>
    </div>
  `;

  card.addEventListener('click', () => openGameDetails(game));
  return card;
}

// Generate Collection Card DOM
function createCollectionCard(label, games) {
  const container = document.createElement('div');
  container.className = 'collection-container';

  const card = document.createElement('div');
  card.className = 'collection-card';

  const representativeGame = games[0];

  let previewsHTML = '';
  if (games.length > 1) {
    const previewImages = games.slice(1, 3);
    previewsHTML = `<div class="collection-previews">` + 
      previewImages.map((g, i) => `
        <div class="preview-thumbnail thumbnail-${i + 1}">
          <img src="${g.image}" alt="" loading="lazy">
        </div>
      `).join('') + `</div>`;
  }

  card.innerHTML = `
    <div class="collection-badge">Collection</div>
    <div class="collection-cover-stack">
      <div class="cover-wrapper shimmer-loader">
        <img
          src="${representativeGame.image}"
          alt="${label}"
          loading="lazy"
          onload="this.parentElement.classList.remove('shimmer-loader')"
          onerror="this.parentElement.classList.remove('shimmer-loader');"
        >
      </div>
      ${previewsHTML}
    </div>
    <div class="collection-card-details">
      <h2>${label} Collection</h2>
      <p class="collection-count">${games.length} Games <span class="dropdown-arrow">→</span></p>
    </div>
  `;

  card.addEventListener('click', () => {
    openCollectionDetails(label, games);
  });

  container.appendChild(card);
  observeForScrollAnimation(container);
  return container;
}

const collectionDialog = document.getElementById('collection-dialog');

function openCollectionDetails(label, games) {
  if (!collectionDialog) return;

  document.getElementById('collection-modal-title').textContent = `${label} Collection`;
  document.getElementById('collection-modal-count').textContent = `${games.length} Game${games.length === 1 ? '' : 's'}`;

  const collectionGrid = document.getElementById('collection-game-grid');
  collectionGrid.innerHTML = '';

  let cardIndex = 0;
  games.forEach((game) => {
    const card = createGameCard(game);
    card.style.setProperty('--card-index', cardIndex++);
    collectionGrid.appendChild(card);
  });

  openModal(collectionDialog);
}

// Render Throne Room (Podium)
function renderThroneRoom() {
  const throneRoomEl = document.getElementById('throne-room');
  if (!throneRoomEl) return;

  if (ceremonyTimeout) {
    clearTimeout(ceremonyTimeout);
  }
  throneRoomEl.classList.remove('lit-up');
  throneRoomEl.innerHTML = '';
  
  if (displayGames.length >= 3) {
    throneRoomEl.style.display = 'flex';
    
    // Create podium HTML layout
    throneRoomEl.innerHTML = `
      <div class="podium-wrapper">
        <!-- Spotlights -->
        <div class="podium-spotlight spotlight-left"></div>
        <div class="podium-spotlight spotlight-center"></div>
        <div class="podium-spotlight spotlight-right"></div>
        
        <!-- Columns -->
        <div class="podium-columns">
          <!-- Rank 2 Column (Silver, Left) -->
          <div class="podium-column rank-2" id="podium-column-silver">
            <div class="pedestal silver-pedestal">
              <div class="pedestal-glow"></div>
              <div class="pedestal-number">2</div>
              <div class="pedestal-label">Silver</div>
            </div>
          </div>
          
          <!-- Rank 1 Column (Gold, Center) -->
          <div class="podium-column rank-1" id="podium-column-gold">
            <div class="winner-crown-wrapper">
              <svg class="winner-crown" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14c1.1 0 2-.9 2-2v-1H3v1c0 1.1.9 2 2 2z"/>
              </svg>
            </div>
            <div class="pedestal gold-pedestal">
              <div class="gold-particles">
                <span class="p1"></span>
                <span class="p2"></span>
                <span class="p3"></span>
                <span class="p4"></span>
                <span class="p5"></span>
              </div>
              <div class="pedestal-glow"></div>
              <div class="pedestal-number">1</div>
              <div class="pedestal-label">Gold</div>
            </div>
          </div>
          
          <!-- Rank 3 Column (Bronze, Right) -->
          <div class="podium-column rank-3" id="podium-column-bronze">
            <div class="pedestal bronze-pedestal">
              <div class="pedestal-glow"></div>
              <div class="pedestal-number">3</div>
              <div class="pedestal-label">Bronze</div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Create the three throne cards
    const goldCard = createThroneCard(displayGames[0], 1);
    const silverCard = createThroneCard(displayGames[1], 2);
    const bronzeCard = createThroneCard(displayGames[2], 3);
    
    // Insert them inside the columns, right before their pedestals
    const silverCol = document.getElementById('podium-column-silver');
    const goldCol = document.getElementById('podium-column-gold');
    const bronzeCol = document.getElementById('podium-column-bronze');
    
    if (silverCol) silverCol.insertBefore(silverCard, silverCol.querySelector('.pedestal'));
    if (goldCol) goldCol.insertBefore(goldCard, goldCol.querySelector('.pedestal'));
    if (bronzeCol) bronzeCol.insertBefore(bronzeCard, bronzeCol.querySelector('.pedestal'));
    
    // Trigger the ceremony lights-up animation
    ceremonyTimeout = setTimeout(() => {
      throneRoomEl.classList.add('lit-up');
    }, 2400);
    
  } else {
    throneRoomEl.style.display = 'none';
  }
}

// Deterministic hash-based metadata generator for podium games
function getGameMetaStats(game) {
  const appIdMatch = game.image ? game.image.match(/\/apps\/(\d+)\//) : null;
  const appId = appIdMatch ? parseInt(appIdMatch[1]) : 0;
  
  // Deterministic hash based on game name and appId
  let hash = 0;
  const str = game.name || '';
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  hash = Math.abs(hash + appId);
  
  // Rating: 88% - 99%
  const ratingPercent = 88 + (hash % 12);
  let ratingLabel = "Very Positive";
  if (ratingPercent >= 95) ratingLabel = "Overwhelmingly Positive";
  
  // Favorites: 500 - 8500
  const favoritesCount = 500 + (hash % 8000);
  
  // Play count: based on playtime
  const hours = parsePlaytime(game.playtime);
  const playCount = Math.round(hours * (1.2 + (hash % 10) / 10));
  
  return {
    ratingPercent,
    ratingLabel,
    favoritesCount,
    playCount,
    hasReview: !!(game.review && game.review.trim() !== '')
  };
}

// Animated value counters
function animateCounter(element, target, suffix = '', duration = 1200) {
  if (!element) return;
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    const easeProgress = progress * (2 - progress); // Ease out quad
    const currentVal = Math.floor(easeProgress * target);
    element.textContent = currentVal.toLocaleString() + suffix;
    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else {
      element.textContent = target.toLocaleString() + suffix;
    }
  };
  window.requestAnimationFrame(step);
}

// Widescreen Hero image url
function getHeroImageUrl(game) {
  const appIdMatch = game.image ? game.image.match(/\/apps\/(\d+)\//) : null;
  if (appIdMatch) {
    return `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appIdMatch[1]}/library_hero.jpg`;
  }
  return game.image;
}

// Widescreen Fallback hero image url
function getHeroFallbackUrl(game) {
  const appIdMatch = game.image ? game.image.match(/\/apps\/(\d+)\//) : null;
  if (appIdMatch) {
    return `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appIdMatch[1]}/header.jpg`;
  }
  return game.image;
}

// Modal open/close helpers for custom zoom transitions
function openModal(dialog) {
  if (!dialog) return;
  dialog.classList.remove('exiting');
  dialog.showModal();
}

function closeModal(dialog) {
  if (!dialog || !dialog.open) return;
  dialog.classList.add('exiting');
  const onTransitionEnd = () => {
    dialog.close();
    dialog.classList.remove('exiting');
    dialog.removeEventListener('transitionend', onTransitionEnd);
  };
  dialog.addEventListener('transitionend', onTransitionEnd, { once: true });
}

// Hero Banner Carousel State
let featuredIndex = 0;
let featuredGames = [];
let heroRotateTimer = null;

function initHeroBanner() {
  const allowNSFW = localStorage.getItem("allowNSFW") === "true";
  const sourceGames = currentSort === 'wishlist' ? wishlistGames : allGames;
  const favorites = sourceGames.filter(game => game.favorite && (allowNSFW || !game.nsfw));
  featuredGames = favorites.length >= 1 ? favorites : sourceGames.filter(game => allowNSFW || !game.nsfw).slice(0, 6);
  if (featuredGames.length === 0) return;
  
  featuredIndex = 0;
  renderHeroBanner(featuredGames[0]);
  startHeroRotation();
}

function startHeroRotation() {
  if (heroRotateTimer) clearInterval(heroRotateTimer);
  heroRotateTimer = setInterval(() => {
    featuredIndex = (featuredIndex + 1) % featuredGames.length;
    transitionHeroGame(featuredGames[featuredIndex]);
  }, 10000);
}

function renderHeroBanner(game) {
  const heroEl = document.getElementById('hero-banner');
  if (!heroEl) return;
  
  const steamUrl = getSteamUrl(game.image) || "#";
  const hasReview = game.review && game.review.trim() !== '';
  
  const heroImgUrl = getHeroImageUrl(game);
  
  heroEl.innerHTML = `
    <div class="hero-banner-inner" id="hero-inner">
      <div class="hero-bg-layer hero-bg-back active" style="background-image: url('${heroImgUrl}')"></div>
      <div class="hero-bg-layer hero-bg-front" style="background-image: url('${heroImgUrl}')"></div>
      <div class="hero-overlay"></div>
      
      <div class="hero-content">
        <div class="hero-badge">Featured Game</div>
        <h1 class="hero-title" id="hero-game-title">${game.name}</h1>
        
        <div class="hero-meta">
          <span class="hero-meta-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span>${currentSort === 'wishlist' ? (game.playtime || 'Wishlisted') : (game.playtime || '0h') + ' Played'}</span>
          </span>
        </div>
        
        <div class="hero-actions">
          <a href="${steamUrl}" target="_blank" rel="noopener noreferrer" class="hero-btn steam-btn">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.284 3.414 9.77 8.156 11.34L10 20.25a2.5 2.5 0 0 1 2.222-2.203L15 15.222V13.5a1.5 1.5 0 0 1 .572-1.182l2.366-1.892A2.5 2.5 0 0 1 20.5 8h1.75l.942-1.884c.31-.62.062-1.378-.558-1.688a1.25 1.25 0 0 0-1.116.038L20 5.25V4.5a1.5 1.5 0 0 1-.572-1.182l-2.366-1.892A2.5 2.5 0 0 1 14.5 1h-1.75l-.942 1.884c-.31.62-.062 1.378.558 1.688.38.19.836.19 1.216 0l.918-.46V4.5a1.5 1.5 0 0 1 .572 1.182l2.366 1.892A2.5 2.5 0 0 1 18.5 8h-1.75l-.942-1.884c-.31-.62-.062-1.378.558-1.688.38-.19.836-.19 1.216 0l.918-.46v.894a1.5 1.5 0 0 1-.572 1.182L15.634 9.768A2.5 2.5 0 0 1 13.5 10.5h-1.75l-.942-1.884c-.31-.62-.062-1.378.558-1.688a1.25 1.25 0 0 0 1.116-.038L13 6.75V6c0-.828-.672-1.5-1.5-1.5S10 5.172 10 6v2.222a2.5 2.5 0 0 1-2.222 2.203l-2.778 2.805a2.5 2.5 0 0 1 0 3.54l2.778 2.805A2.5 2.5 0 0 1 10 19.578v.894c0 .828.672 1.5 1.5 1.5s1.5-.672 1.5-1.5v-2.222a2.5 2.5 0 0 1 2.222-2.203l2.778-2.805A2.5 2.5 0 0 1 18 13.222V12.297c0-6.627-5.373-12-12-12z"/></svg>
            <span>Steam Store</span>
          </a>
          ${hasReview ? `
            <a href="${game.review}" target="_blank" rel="noopener noreferrer" class="hero-btn review-btn active" style="background: linear-gradient(135deg, #4f46e5, var(--accent-purple)); color: white;">
              <span>Read Review</span>
            </a>
          ` : `
            <button class="hero-btn review-btn disabled" style="background: rgba(255, 255, 255, 0.02); color: var(--text-muted); cursor: not-allowed;" disabled>
              <span>No Review</span>
            </button>
          `}
        </div>
      </div>
      
      <div class="hero-thumbnail" id="hero-thumb-wrapper">
        <img id="hero-banner-thumb" src="${game.image}" alt="${game.name}" onerror="handleImageError(this)">
      </div>
    </div>
  `;
  
  const appIdMatch = game.image ? game.image.match(/\/apps\/(\d+)\//) : null;
  if (appIdMatch) {
    resolveBanner(appIdMatch[1], (url) => {
      if (url) {
        const layers = heroEl.querySelectorAll('.hero-bg-layer');
        layers.forEach(layer => {
          layer.style.backgroundImage = `url('${url}')`;
        });
      }
    });
  }
}

function transitionHeroGame(game) {
  const heroEl = document.getElementById('hero-banner');
  if (!heroEl) return;
  
  const front = heroEl.querySelector('.hero-bg-front');
  const back = heroEl.querySelector('.hero-bg-back');
  const title = document.getElementById('hero-game-title');
  const tagline = document.getElementById('hero-game-tagline');
  const thumb = document.getElementById('hero-banner-thumb');
  const actions = heroEl.querySelector('.hero-actions');
  const heroMeta = heroEl.querySelector('.hero-meta');
  
  const heroImgUrl = getHeroImageUrl(game);
  
  const isFrontActive = front.classList.contains('active');
  const targetActive = isFrontActive ? back : front;
  const targetInactive = isFrontActive ? front : back;
  
  const appIdMatch = game.image ? game.image.match(/\/apps\/(\d+)\//) : null;
  if (appIdMatch) {
    resolveBanner(appIdMatch[1], (url) => {
      if (url) {
        targetActive.style.backgroundImage = `url('${url}')`;
      }
      targetActive.classList.add('active');
      targetInactive.classList.remove('active');
    });
  } else {
    targetActive.style.backgroundImage = `url('${game.image}')`;
    targetActive.classList.add('active');
    targetInactive.classList.remove('active');
  }
  
  const fadeOutElements = [title, thumb, actions, heroMeta];
  fadeOutElements.forEach(el => {
    if (el) {
      el.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      el.style.opacity = '0';
      el.style.transform = 'translateY(10px)';
    }
  });
  
  setTimeout(() => {
    if (title) title.textContent = game.name;
    if (thumb) {
      thumb.src = game.image;
      thumb.dataset.fallback = '';
    }
    
    if (heroMeta) {
      heroMeta.innerHTML = `
        <span class="hero-meta-item">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span>${currentSort === 'wishlist' ? (game.playtime || 'Wishlisted') : (game.playtime || '0h') + ' Played'}</span>
        </span>
      `;
    }
    
    const steamUrl = getSteamUrl(game.image) || "#";
    const hasReview = game.review && game.review.trim() !== '';
    if (actions) {
      actions.innerHTML = `
        <a href="${steamUrl}" target="_blank" rel="noopener noreferrer" class="hero-btn steam-btn">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.284 3.414 9.77 8.156 11.34L10 20.25a2.5 2.5 0 0 1 2.222-2.203L15 15.222V13.5a1.5 1.5 0 0 1 .572-1.182l2.366-1.892A2.5 2.5 0 0 1 20.5 8h1.75l.942-1.884c.31-.62.062-1.378-.558-1.688a1.25 1.25 0 0 0-1.116.038L20 5.25V4.5a1.5 1.5 0 0 1-.572-1.182l-2.366-1.892A2.5 2.5 0 0 1 14.5 1h-1.75l-.942 1.884c-.31.62-.062 1.378.558 1.688.38.19.836.19 1.216 0l.918-.46V4.5a1.5 1.5 0 0 1 .572 1.182l2.366 1.892A2.5 2.5 0 0 1 18.5 8h-1.75l-.942-1.884c-.31-.62-.062-1.378.558-1.688.38-.19.836-.19 1.216 0l.918-.46v.894a1.5 1.5 0 0 1-.572 1.182L15.634 9.768A2.5 2.5 0 0 1 13.5 10.5h-1.75l-.942-1.884c-.31-.62-.062-1.378.558-1.688a1.25 1.25 0 0 0 1.116-.038L13 6.75V6c0-.828-.672-1.5-1.5-1.5S10 5.172 10 6v2.222a2.5 2.5 0 0 1-2.222 2.203l-2.778 2.805a2.5 2.5 0 0 1 0 3.54l2.778 2.805A2.5 2.5 0 0 1 10 19.578v.894c0 .828.672 1.5 1.5 1.5s1.5-.672 1.5-1.5v-2.222a2.5 2.5 0 0 1 2.222-2.203l2.778-2.805A2.5 2.5 0 0 1 18 13.222V12.297c0-6.627-5.373-12-12-12z"/></svg>
          <span>Steam Store</span>
        </a>
        ${hasReview ? `
          <a href="${game.review}" target="_blank" rel="noopener noreferrer" class="hero-btn review-btn active" style="background: linear-gradient(135deg, #4f46e5, var(--accent-purple)); color: white;">
            <span>Read Review</span>
          </a>
        ` : `
          <button class="hero-btn review-btn disabled" style="background: rgba(255, 255, 255, 0.02); color: var(--text-muted); cursor: not-allowed;" disabled>
            <span>No Review</span>
          </button>
        `}
      `;
    }
    
    fadeOutElements.forEach(el => {
      if (el) {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      }
    });
  }, 400);
}

function setupHeroParallax() {
  // No-op: 3D tilt removed per user preference.
  // Hover shine/glow is handled purely via CSS on .hero-banner-inner:hover.
}

// Open Detail Dialog Modal
function openGameDetails(game) {
  if (!detailDialog) return;

  const modalImg = document.getElementById('modal-game-image');
  delete modalImg.dataset.fallbackIndex;
  modalImg.src = game.image;
  modalImg.alt = game.name;
  modalImg.parentElement.classList.add('shimmer-loader');
  modalImg.onload = () => modalImg.parentElement.classList.remove('shimmer-loader');

  document.getElementById('modal-game-name').textContent = game.name;
  document.getElementById('modal-game-playtime').textContent = game.playtime || '0h';

  const favBadge = document.getElementById('modal-game-favorite');
  favBadge.style.display = game.favorite ? 'inline-flex' : 'none';

  const steamUrl = getSteamUrl(game.image);
  const steamBtn = document.getElementById('modal-steam-link');
  if (steamUrl) {
    steamBtn.href = steamUrl;
    steamBtn.style.display = 'inline-flex';
  } else {
    steamBtn.style.display = 'none';
  }

  const reviewBtn = document.getElementById('modal-review-link');
  if (game.review && game.review.trim() !== '') {
    reviewBtn.href = game.review;
    reviewBtn.className = 'modal-btn review-btn active';
    reviewBtn.textContent = 'Read Review';
    reviewBtn.style.pointerEvents = 'auto';
  } else {
    reviewBtn.href = '#';
    reviewBtn.className = 'modal-btn review-btn disabled';
    reviewBtn.textContent = 'No Review';
    reviewBtn.style.pointerEvents = 'none';
  }

  openModal(detailDialog);
}

function setScrollListener(enabled) {
  if (enabled && !scrollListenerAttached) {
    window.addEventListener('scroll', handleScroll);
    scrollListenerAttached = true;
  } else if (!enabled && scrollListenerAttached) {
    window.removeEventListener('scroll', handleScroll);
    scrollListenerAttached = false;
  }
}

function handleScroll() {
  if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 400) {
    loadMore();
  }
}

// Render Playtime Mode
function renderPlaytimeGrid() {
  gameListEl.innerHTML = '<div id="playtime-grid" class="game-grid"></div>';
  const grid = document.getElementById('playtime-grid');
  
  loaded = displayGames.length >= 3 ? 3 : 0;
  loadMoreInto(grid);
  setScrollListener(true);
}

function loadMore() {
  const grid = document.getElementById('playtime-grid');
  if (grid) loadMoreInto(grid);
}

function loadMoreInto(grid) {
  if (loaded >= displayGames.length) {
    loadingEl.textContent = loaded > 0 ? "You've reached the bottom!" : "No games found.";
    return;
  }

  const toLoad = displayGames.slice(loaded, loaded + perLoad);
  toLoad.forEach((game, index) => {
    const card = createGameCard(game, loaded + index + 1);
    card.style.setProperty('--card-index', index);
    grid.appendChild(card);
  });

  loaded += toLoad.length;
  if (loaded >= displayGames.length) {
    loadingEl.textContent = "You've reached the bottom!";
  }
}

// Render Favourites Mode
function renderFavouritesFranchises() {
  gameListEl.innerHTML = '';
  setScrollListener(false);
  loadingEl.textContent = '';

  const collections = groupGamesByFranchise(displayGames);
  if (collections.length === 0) {
    gameListEl.innerHTML = '<div class="no-results">No favorites found.</div>';
    return;
  }

  const container = document.createElement('div');
  container.className = 'favorites-collections-list';
  gameListEl.appendChild(container);

  collections.forEach((col, colIndex) => {
    const section = document.createElement('div');
    section.className = 'collection-section';
    if (colIndex === 0) {
      section.classList.add('active'); // Expand the first one by default
    }

    const header = document.createElement('div');
    header.className = 'collection-header';
    
    const formattedPlaytime = Math.round(col.totalPlaytime).toLocaleString();
    header.innerHTML = `
      <div class="header-left">
        <span class="header-arrow">▶</span>
        <h2 class="collection-title">${col.label}</h2>
      </div>
      <div class="header-right">
        <span class="collection-stats-badge">${col.games.length} Game${col.games.length === 1 ? '' : 's'}</span>
        <span class="collection-playtime-badge">${formattedPlaytime}h</span>
      </div>
    `;

    const body = document.createElement('div');
    body.className = 'collection-body';

    const bodyInner = document.createElement('div');
    bodyInner.className = 'collection-body-inner';
    body.appendChild(bodyInner);
    
    const grid = document.createElement('div');
    grid.className = 'game-grid';
    bodyInner.appendChild(grid);

    col.games.forEach((game, gameIndex) => {
      const card = createGameCard(game);
      card.style.setProperty('--card-index', gameIndex);
      grid.appendChild(card);
    });

    header.addEventListener('click', () => {
      section.classList.toggle('active');
    });

    section.appendChild(header);
    section.appendChild(body);
    container.appendChild(section);
  });
}

// Master Render Toggler
function applySortAndRender() {
  const isLibraryMode = currentSort === 'library';
  const isFavoritesMode = currentSort === 'favorites';
  const isWishlistMode = currentSort === 'wishlist';

  if (isWishlistMode) {
    titleEl.textContent = 'Wishlist';
  } else if (isFavoritesMode) {
    titleEl.textContent = 'Favorites';
  } else {
    titleEl.textContent = 'Library';
  }

  // Morph background theme dynamically
  if (window.xmbBackground) {
    if (isFavoritesMode) {
      window.xmbBackground.setTheme('favorites');
    } else if (isWishlistMode) {
      window.xmbBackground.setTheme('home');
    } else {
      window.xmbBackground.setTheme('playtime');
    }
  }

  const throneRoomEl = document.getElementById('throne-room');
  const heroEl = document.getElementById('hero-banner');

  // Filter NSFW based on user preference
  const allowNSFW = localStorage.getItem("allowNSFW") === "true";

  if (isFavoritesMode) {
    displayGames = sortGamesByPlaytimeDesc(allGames.filter(game => game.favorite && (allowNSFW || !game.nsfw)));
    if (throneRoomEl) throneRoomEl.style.display = 'none';
    if (heroEl) {
      heroEl.style.display = 'none';
      if (heroRotateTimer) {
        clearInterval(heroRotateTimer);
        heroRotateTimer = null;
      }
    }
    renderFavouritesFranchises();
  } else {
    if (isWishlistMode) {
      displayGames = wishlistGames.filter(game => allowNSFW || !game.nsfw);
    } else {
      displayGames = sortGamesByPlaytimeDesc(allGames.filter(game => allowNSFW || !game.nsfw));
    }
    if (heroEl) {
      if (isWishlistMode) {
        heroEl.style.display = 'none';
        if (heroRotateTimer) {
          clearInterval(heroRotateTimer);
          heroRotateTimer = null;
        }
      } else {
        heroEl.style.display = 'block';
        initHeroBanner();
      }
    }
    if (throneRoomEl) {
      renderThroneRoom();
    }
    renderPlaytimeGrid();
  }

  // Update dynamic stats badge in header
  const statsBadge = document.getElementById('stats-badge');
  if (statsBadge) {
    if (isWishlistMode) {
      statsBadge.innerHTML = `<span>${displayGames.length} Games</span> • <span style="color: #60a5fa; font-weight: 700;">Give your man some gift will ya</span>`;
    } else {
      const totalHours = displayGames.reduce((acc, g) => acc + parsePlaytime(g.playtime), 0);
      statsBadge.innerHTML = `<span>${displayGames.length} Games</span> • <span>${Math.round(totalHours).toLocaleString()} Hours</span>`;
    }
  }
}

// Navigation Tabs sliding Pill indicator setup
function updateTabIndicator(activeBtn) {
  if (tabsContainer && activeBtn) {
    tabsContainer.style.setProperty('--active-left', `${activeBtn.offsetLeft}px`);
    tabsContainer.style.setProperty('--active-width', `${activeBtn.offsetWidth}px`);
  }
}

// Add tab button listeners
tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const targetTab = btn.getAttribute('data-tab');
    if (targetTab === currentSort) return;
    
    const tabIndices = { library: 0, favorites: 1, wishlist: 2 };
    const prevIndex = tabIndices[currentSort];
    const targetIndex = tabIndices[targetTab];
    
    const contentArea = document.getElementById('content-area');
    if (contentArea) {
      contentArea.classList.remove('entering');
      contentArea.classList.add('exiting');
      
      if (targetIndex > prevIndex) {
        contentArea.classList.add('slide-left');
        contentArea.classList.remove('slide-right');
        contentArea.style.setProperty('--slide-dir', '40px');
      } else {
        contentArea.classList.add('slide-right');
        contentArea.classList.remove('slide-left');
        contentArea.style.setProperty('--slide-dir', '-40px');
      }
    }
    
    tabButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    updateTabIndicator(btn);
    
    const loadAndRender = () => {
      currentSort = targetTab;
      applySortAndRender();
      
      if (contentArea) {
        contentArea.classList.remove('exiting');
        contentArea.classList.add('entering');
      }
    };

    setTimeout(() => {
      if (targetTab === 'wishlist' && wishlistGames.length === 0) {
        fetch('wishlist.json')
          .then(res => res.json())
          .then(data => {
            wishlistGames = data;
            loadAndRender();
          })
          .catch(err => {
            console.error('Failed to load wishlist:', err);
            loadAndRender();
          });
      } else {
        loadAndRender();
      }
    }, 250);
  });
});

// Modal Setup
document.addEventListener("DOMContentLoaded", () => {
  // Set initial tab indicator position
  const activeTabBtn = document.querySelector('.tab-btn.active');
  if (activeTabBtn) {
    setTimeout(() => updateTabIndicator(activeTabBtn), 150);
  }
  
  window.addEventListener('resize', () => {
    const activeBtn = document.querySelector('.tab-btn.active');
    if (activeBtn) updateTabIndicator(activeBtn);
  });

  // Game Details Close
  const closeBtn = document.getElementById('close-detail-dialog');
  if (detailDialog && closeBtn) {
    closeBtn.addEventListener('click', () => closeModal(detailDialog));

    detailDialog.addEventListener('click', (e) => {
      const rect = detailDialog.getBoundingClientRect();
      const isInDialog = (
         rect.top <= e.clientY &&
         e.clientY <= rect.top + rect.height &&
         rect.left <= e.clientX &&
         e.clientX <= rect.left + rect.width
      );
      if (!isInDialog) closeModal(detailDialog);
    });
  }

  // Collection Dialog Close with exiting transition
  const closeColBtn = document.getElementById('close-collection-dialog');
  if (collectionDialog && closeColBtn) {
    closeColBtn.addEventListener('click', () => closeModal(collectionDialog));

    collectionDialog.addEventListener('click', (e) => {
      const rect = collectionDialog.getBoundingClientRect();
      const isInDialog = (
         rect.top <= e.clientY &&
         e.clientY <= rect.top + rect.height &&
         rect.left <= e.clientX &&
         e.clientX <= rect.left + rect.width
      );
      if (!isInDialog) closeModal(collectionDialog);
    });
  }

  // Age Warning Overlay Setup
  const ageWarningEl = document.getElementById('age-warning');
  const acceptWarningBtn = document.getElementById('accept-warning');
  const rejectWarningBtn = document.getElementById('reject-warning');

  if (ageWarningEl && acceptWarningBtn && rejectWarningBtn) {
    acceptWarningBtn.addEventListener('click', () => {
      localStorage.setItem("allowNSFW", "true");
      ageWarningEl.style.display = 'none';
      applySortAndRender();
    });

    rejectWarningBtn.addEventListener('click', () => {
      localStorage.setItem("allowNSFW", "false");
      ageWarningEl.style.display = 'none';
      applySortAndRender();
    });

    const allowNSFWVal = localStorage.getItem("allowNSFW");
    if (allowNSFWVal === null) {
      ageWarningEl.style.display = 'flex';
    } else {
      ageWarningEl.style.display = 'none';
    }
  }

  document.addEventListener('click', () => {
    document.querySelectorAll('.collection-dropdown').forEach(d => {
      d.style.display = 'none';
      d.parentElement.classList.remove('dropdown-open');
    });
  });
});

// Fetch Data
fetch('games.json')
  .then((res) => res.json())
  .then((data) => {
    allGames = data;
    applySortAndRender();
  })
  .catch((err) => {
    console.error('Failed to load games:', err);
    loadingEl.textContent = 'Failed to load games.';
  });