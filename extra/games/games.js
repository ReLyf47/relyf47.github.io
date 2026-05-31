let games = [];
let loaded = 0;
const perLoad = 25;


function createGameCard(game) {
  const card = document.createElement('a');
  card.className = 'game-card';
  card.href = game.review;
  card.target = '_blank';
  card.rel = 'noopener noreferrer';

  const img = document.createElement('img');
  img.src = game.image;

  const info = document.createElement('div');
  info.className = 'game-info';

  const title = document.createElement('h2');
  title.textContent = game.name;

  const hours = document.createElement('p');
  hours.textContent = `Playtime: ${game.hours}`;

  const genre = document.createElement('p');
  genre.textContent = `Genre: ${game.genre}`;

  const ach = document.createElement('p');
  ach.textContent = `Achievements: ${game.achievements}`;

  info.appendChild(title);
  info.appendChild(hours);
  info.appendChild(genre);
  info.appendChild(ach);

  card.appendChild(img);
  card.appendChild(info);

  return card;
}

function loadMore() {
  if (loaded >= games.length) return;

  const toLoad = games.slice(loaded, loaded + perLoad);
  toLoad.forEach(game => {
    const card = createGameCard(game);
    document.getElementById('game-list').appendChild(card);
  });

  loaded += toLoad.length;
}

function handleScroll() {
  if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) {
    loadMore();
  }
}

fetch('games.json') // change this to games.json if you rename the data
  .then(res => res.json())
  .then(data => {
    games = data;
    loadMore(); // initial load
    window.addEventListener('scroll', handleScroll);
  })
  .catch(err => {
    console.error('Failed to load games:', err);
    document.getElementById('loading').textContent = "Failed to load games.";
  });
