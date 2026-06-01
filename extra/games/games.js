// games.js
let allGames = [];
let displayGames = [];
let loaded = 0;
const perLoad = 25;
let currentSort = 'playtime';
let scrollListenerAttached = false;
let playtimeGrid;

const titleEl = document.querySelector('h1');
const throneRoomEl = document.getElementById('throne-room');
const gameListEl = document.getElementById('game-list');
const loadingEl = document.getElementById('loading');
const sortToggleEl = document.getElementById('sort-toggle');

// Helper: Convert "1,400.0h" string into a real number (1400.0) for sorting
function parsePlaytime(ptStr) {
  if (!ptStr) return 0;
  return parseFloat(ptStr.replace(/,/g, '').replace('h', '')) || 0;
}

function getFallbackImage(url) {
  return url
    .replace('library_600x900.jpg', 'portrait.png')
    .replace('library_capsule.jpg', 'portrait.png');
}

// Extract Steam App ID from image URL and create Store Link
function getSteamUrl(imageUrl) {
  if (!imageUrl) return null;

  const match = imageUrl.match(/\/apps\/(\d+)\//);
  return match
    ? `https://store.steampowered.com/app/${match[1]}/`
    : null;
}

const FRANCHISE_RULES = [
  { label: 'Persona', pattern: /^Persona\b/i },
  { label: 'LEGO', pattern: /^(?:The\s+)?LEGO\b/i },
  { label: 'Naruto', pattern: /^NARUTO\b/i },
  { label: 'Final Fantasy', pattern: /^FINAL FANTASY\b/i },
  { label: 'Resident Evil', pattern: /^Resident Evil\b/i },
  { label: 'Metal Gear Solid', pattern: /^METAL GEAR SOLID\b/i },
  { label: 'Grand Theft Auto', pattern: /^Grand Theft Auto\b/i },
  { label: 'Watch Dogs', pattern: /^Watch_Dogs\b/i },
  { label: 'Dynasty Warriors', pattern: /^DYNASTY WARRIORS\b/i },
  { label: 'Mortal Kombat', pattern: /^Mortal Kombat\b/i },
  { label: 'HuniePop', pattern: /^HuniePop\b/i },
  { label: "AKIBA'S TRIP", pattern: /^AKIBA'S TRIP\b/i }
];

function getFranchiseLabel(gameName) {
  const cleanName = (gameName || '').trim();
  for (const rule of FRANCHISE_RULES) {
    if (rule.pattern.test(cleanName)) {
      return rule.label;
    }
  }
  return 'General';
}

function sortGamesByPlaytimeDesc(games) {
  return [...games].sort((a, b) => parsePlaytime(b.playtime) - parsePlaytime(a.playtime));
}

function sortFranchiseChronologically(games) {
  return [...games].sort((a, b) => {

    const aMatch = a.name.match(/\b(\d+)\b/);
    const bMatch = b.name.match(/\b(\d+)\b/);

    const aNum = aMatch ? parseInt(aMatch[1]) : 0;
    const bNum = bMatch ? parseInt(bMatch[1]) : 0;

    if (aNum !== bNum) {
      return aNum - bNum;
    }

    return a.name.localeCompare(b.name);
  });
}

function groupGamesByFranchise(games) {
  const groups = new Map();

  games.forEach((game) => {
    const label = getFranchiseLabel(game.name);
    if (!groups.has(label)) {
      groups.set(label, []);
    }
    groups.get(label).push(game);
  });

  const grouped = [...groups.entries()].map(([label, items]) => ({
    label,
    games:
    label === 'General'
      ? sortGamesByPlaytimeDesc(items)
      : sortFranchiseChronologically(items)
  }));

  grouped.sort((a, b) => {
    const aIsGeneral = a.label === 'General';
    const bIsGeneral = b.label === 'General';

    if (aIsGeneral && !bIsGeneral) return 1;
    if (bIsGeneral && !aIsGeneral) return -1;

    const maxA = Math.max(...a.games.map((game) => parsePlaytime(game.playtime)));
    const maxB = Math.max(...b.games.map((game) => parsePlaytime(game.playtime)));

    if (maxB !== maxA) return maxB - maxA;
    return a.label.localeCompare(b.label);
  });

  return grouped;
}

function attachSteamClick(card, game) {
  const steamUrl = getSteamUrl(game.image);
  if (!steamUrl) return;

  card.addEventListener('click', (e) => {
    if (e.target.closest('.review-btn')) return;
    window.open(steamUrl, '_blank', 'noopener,noreferrer');
  });
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

// Toggle Button Logic
sortToggleEl.addEventListener('click', (e) => {
  if (currentSort === 'playtime') {
    currentSort = 'favourites';
    e.target.textContent = 'Only Favourite';
  } else {
    currentSort = 'playtime';
    e.target.textContent = 'By Playtime';
  }
  applySortAndRender();
});

// Sorts data and resets the page
function applySortAndRender() {
  const isFavouritesMode = currentSort === 'favourites';

  titleEl.textContent = isFavouritesMode
    ? 'Favourite Games by Franchise'
    : 'Top 100 Playtime';

  sortToggleEl.textContent = isFavouritesMode
    ? 'Only Favourite'
    : 'By Playtime';

  if (isFavouritesMode) {
    displayGames = sortGamesByPlaytimeDesc(
      allGames.filter(game => game.favorite === true)
    );
  } else {
    displayGames = sortGamesByPlaytimeDesc(allGames);
  }

  loaded = 0;
  throneRoomEl.innerHTML = '';
  gameListEl.innerHTML = '';

  if (isFavouritesMode) {
    throneRoomEl.style.display = 'none';

    renderFavouriteFranchises(displayGames);

    loadingEl.textContent = displayGames.length
      ? `${displayGames.length} favourite games grouped by franchise.`
      : 'No favourite games found.';

    loadingEl.style.display = 'block';

    loaded = displayGames.length;
    setScrollListener(false);
    return;
  }

  throneRoomEl.style.display = 'flex';

  gameListEl.innerHTML = `
    <div id="playtime-grid" class="game-grid"></div>
  `;

  playtimeGrid = document.getElementById('playtime-grid');

  loadingEl.style.display = 'block';
  loadingEl.textContent = 'Scroll for more!';

  setScrollListener(true);

  if (displayGames.length >= 3) {
    renderThrone(displayGames.slice(0, 3));
    loaded = 3;
  }

  loadMore();
}

// Builds the visual Podium
function renderThrone(top3) {
  const rank2 = createThroneCard(top3[1], 2, '🥈');
  const rank1 = createThroneCard(top3[0], 1, '👑');
  const rank3 = createThroneCard(top3[2], 3, '🥉');

  throneRoomEl.appendChild(rank2);
  throneRoomEl.appendChild(rank1);
  throneRoomEl.appendChild(rank3);
}

// HTML Generator for Throne Cards
function createThroneCard(game, rank, emoji) {
  const card = document.createElement('div');
  card.className = `throne-card rank-${rank}`;

  card.innerHTML = `
    <div class="crown">${emoji}</div>
    <img
      src="${game.image}"
      alt="${game.name}"
      onerror="
        if (!this.dataset.fallback) {
          this.dataset.fallback = '1';
          this.src = this.src.replace('library_600x900.jpg', 'portrait.png').replace('library_capsule.jpg', 'portrait.png');
        }
      "
    >
    <div class="game-info">
      <div>
        <h2>${game.name}</h2>
        <p>${game.playtime}</p>
      </div>
      ${getReviewButtonHTML(game)}
    </div>
  `;

  attachSteamClick(card, game);
  return card;
}

// HTML Generator for Standard Grid Cards
function createGameCard(game, rank) {
  const card = document.createElement('div');
  card.className = 'game-card';

  let rankBadgeHTML = '';
  if (rank >= 4 && rank <= 10) {
    rankBadgeHTML = `<div class="rank-badge">#${rank}</div>`;
  }

  card.innerHTML = `
    ${rankBadgeHTML}
    <img
      src="${game.image}"
      alt="${game.name}"
      onerror="
        if (!this.dataset.fallback) {
          this.dataset.fallback = '1';
          this.src = this.src.replace('library_600x900.jpg', 'portrait.png').replace('library_capsule.jpg', 'portrait.png');
        }
      "
    >
    <div class="game-info">
      <div>
        <h2>${game.name}</h2>
        <p>Playtime: ${game.playtime}</p>
      </div>
      ${getReviewButtonHTML(game)}
    </div>
  `;

  attachSteamClick(card, game);
  return card;
}

// Reusable Review Button Logic
function getReviewButtonHTML(game) {
  if (game.review && game.review.trim() !== '') {
    return `<a href="${game.review}" target="_blank" rel="noopener noreferrer" class="review-btn active">Review</a>`;
  }
  return `<a class="review-btn disabled">Review</a>`;
}

function renderFavouriteFranchises(favourites) {
  const grouped = groupGamesByFranchise(favourites);

  if (grouped.length === 0) {
    gameListEl.innerHTML = '';
    return;
  }

  grouped.forEach(({ label, games }) => {
    const section = document.createElement('section');
    section.className = `franchise-section${label === 'General' ? ' general-section' : ''}`;

    section.innerHTML = `
      <div class="franchise-header">
        <span class="franchise-name">${label}</span>
        <span class="franchise-count">${games.length} game${games.length === 1 ? '' : 's'}</span>
      </div>
      <div class="game-grid franchise-grid"></div>
    `;

    const grid = section.querySelector('.franchise-grid');
    games.forEach((game) => {
      grid.appendChild(createGameCard(game));
    });

    gameListEl.appendChild(section);
  });
}

// Infinite Scroll Pagination
function loadMore() {
  if (loaded >= displayGames.length) {
    if (displayGames.length > 0) {
      loadingEl.textContent = "You've reached the bottom!";
    } else {
      loadingEl.textContent = 'No games found in this category.';
    }
    return;
  }

  const toLoad = displayGames.slice(loaded, loaded + perLoad);

  toLoad.forEach((game, index) => {
    const currentRank = loaded + index + 1;
    const card = createGameCard(game, currentRank);
    playtimeGrid.appendChild(card);
  });

  loaded += toLoad.length;
}

// Scroll detection
function handleScroll() {
  if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) {
    loadMore();
  }
}

// Initial Fetch
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

// ==========================================
// BACKGROUND WAVE ANIMATION
// ==========================================
const canvas = document.getElementById('wave-canvas');
const ctx = canvas.getContext('2d');

let width;
let height;

// Resize canvas dynamically to fit the window
function resize() {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;
}
window.addEventListener('resize', resize);
resize();

let time = 0;

function drawWaves() {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#121212';
  ctx.fillRect(0, 0, width, height);

  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(0, 255, 255, 0.15)';
  ctx.beginPath();
  for (let x = 0; x <= width; x += 10) {
    const y = (height / 2) + Math.sin((x * 0.005) + time) * 80;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.strokeStyle = 'rgba(0, 123, 255, 0.15)';
  ctx.beginPath();
  for (let x = 0; x <= width; x += 10) {
    const y = (height / 2) + Math.cos((x * 0.007) + (time * 1.2)) * 60;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  time += 0.015;
  requestAnimationFrame(drawWaves);
}

const bgm = document.getElementById('bgm');
const audioBtn = document.getElementById('audio-toggle');

let audioPlaying = false;

bgm.volume = 0.25;

audioBtn.addEventListener('click', async () => {
  try {
    if (!audioPlaying) {
      await bgm.play();

      audioPlaying = true;
      audioBtn.textContent = '🔊';
      audioBtn.classList.add('playing');

      localStorage.setItem('ambience-enabled', 'true');
    } else {
      bgm.pause();

      audioPlaying = false;
      audioBtn.textContent = '🔇';
      audioBtn.classList.remove('playing');

      localStorage.setItem('ambience-enabled', 'false');
    }
  } catch (err) {
    console.error(err);
  }
});

document.addEventListener('click', async () => {
  if (
    localStorage.getItem('ambience-enabled') === 'true' &&
    !audioPlaying
  ) {
    try {
      await bgm.play();

      audioPlaying = true;
      audioBtn.textContent = '🔊';
      audioBtn.classList.add('playing');
    } catch (err) {}
  }
}, { once: true });

drawWaves();