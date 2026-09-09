// SECURITY: the API-Sports key lives ONLY in backend/.env (gitignored) and is
// NEVER exposed to the browser. All live-score calls go through the backend
// proxy (/api/matches/:sport) which enforces the 100/day quota + cache.
const API_PROXY_BASE = window.FC_API ? window.FC_API.api() : (location.origin.includes('localhost') ? 'http://localhost:5000/api' : location.origin);

const SPORT_APIS = {
  football: { base: 'https://v3.football.api-sports.io', endpoint: '/fixtures', dateParam: 'date', leagueParam: 'league' },
  basketball: { base: 'https://v1.basketball.api-sports.io', endpoint: '/games', dateParam: 'date', leagueParam: 'league' },
  baseball: { base: 'https://v1.baseball.api-sports.io', endpoint: '/games', dateParam: 'date', leagueParam: 'league' },
};

const SPORT_LEAGUES = {
  cricket: 10,
  football: 39,
  basketball: 12,
  baseball: 1,
  hockey: 153,
  tennis: 4,
  kabaddi: 0,
  'e-sports': 0,
  volleyball: 0,
  'table-tennis': 0,
};

function getTodayDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getYesterdayDate() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getLastWeekDates() {
  const dates = [];
  for (let i = 2; i <= 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  return dates;
}

async function fetchApiSports(sport, date) {
  const config = SPORT_APIS[sport];
  if (!config) return null;
  try {
    // Proxy through backend (key stays server-side, quota + cache applied)
    const url = `${API_PROXY_BASE}/api/matches/${sport}?date=${encodeURIComponent(date)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    return data.matches || [];
  } catch (e) {
    return null;
  }
}

async function fetchMatches(sport = 'football') {
  const today = getTodayDate();
  const yesterday = getYesterdayDate();

  let matches = [];
  if (SPORT_APIS[sport]) {
    const todayMatches = await fetchApiSports(sport, today) || [];
    const yesterdayMatches = await fetchApiSports(sport, yesterday) || [];
    matches = [...yesterdayMatches, ...todayMatches];
  }

  if (!matches.length) {
    matches = getFallbackMatches(sport);
  }

  return matches.slice(0, 8);
}

function getFallbackMatches(sport) {
  const timestamp = Date.now();
  const fallbacks = {
    cricket: [
      { fixture: { id: `${timestamp}1`, status: { short: 'FT' } }, league: { name: 'IPL 2025', logo: '' }, teams: { home: { name: 'Mumbai Indians', logo: '' }, away: { name: 'Chennai Super Kings', logo: '' } }, goals: { home: 187, away: 163 } },
      { fixture: { id: `${timestamp}2`, status: { short: 'FT' } }, league: { name: 'IPL 2025', logo: '' }, teams: { home: { name: 'Royal Challengers', logo: '' }, away: { name: 'Kolkata Knight Riders', logo: '' } }, goals: { home: 175, away: 178 } },
    ],
    football: [
      { fixture: { id: `${timestamp}3`, status: { short: 'FT' } }, league: { name: 'Premier League', logo: '' }, teams: { home: { name: 'Manchester City', logo: '' }, away: { name: 'Arsenal', logo: '' } }, goals: { home: 2, away: 1 } },
      { fixture: { id: `${timestamp}4`, status: { short: 'FT' } }, league: { name: 'La Liga', logo: '' }, teams: { home: { name: 'Real Madrid', logo: '' }, away: { name: 'Barcelona', logo: '' } }, goals: { home: 3, away: 2 } },
      { fixture: { id: `${timestamp}5`, status: { short: 'FT' } }, league: { name: 'UEFA Champions League', logo: '' }, teams: { home: { name: 'Bayern Munich', logo: '' }, away: { name: 'PSG', logo: '' } }, goals: { home: 1, away: 1 } },
    ],
    basketball: [
      { id: `${timestamp}6`, status: { short: 3 }, league: { name: 'NBA', logo: '' }, teams: { home: { name: 'Lakers', logo: '' }, away: { name: 'Celtics', logo: '' } }, scores: { home: { points: 112 }, away: { points: 108 } } },
      { id: `${timestamp}7`, status: { short: 3 }, league: { name: 'NBA', logo: '' }, teams: { home: { name: 'Warriors', logo: '' }, away: { name: 'Nuggets', logo: '' } }, scores: { home: { points: 98 }, away: { points: 105 } } },
    ],
    baseball: [
      { id: `${timestamp}8`, status: { short: 'FT' }, league: { name: 'MLB', logo: '' }, teams: { home: { name: 'Yankees', logo: '' }, away: { name: 'Red Sox', logo: '' } }, scores: { home: { runs: 6 }, away: { runs: 4 } } },
    ],
    tennis: [
      { fixture: { id: `${timestamp}9`, status: { short: 'FT' } }, league: { name: 'ATP Masters', logo: '' }, teams: { home: { name: 'Djokovic', logo: '' }, away: { name: 'Alcaraz', logo: '' } }, goals: { home: 2, away: 1 } },
    ],
    hockey: [
      { id: `${timestamp}10`, status: { short: 'FT' }, league: { name: 'NHL', logo: '' }, teams: { home: { name: 'Maple Leafs', logo: '' }, away: { name: 'Oilers', logo: '' } }, scores: { home: { goals: 4 }, away: { goals: 2 } } },
    ],
    kabaddi: [
      { fixture: { id: `${timestamp}11`, status: { short: 'FT' } }, league: { name: 'Pro Kabaddi', logo: '' }, teams: { home: { name: 'Patna Pirates', logo: '' }, away: { name: 'Bengal Warriors', logo: '' } }, goals: { home: 36, away: 28 } },
    ],
    'e-sports': [
      { fixture: { id: `${timestamp}12`, status: { short: 'FT' } }, league: { name: 'Valorant Champions', logo: '' }, teams: { home: { name: 'Sentinels', logo: '' }, away: { name: 'Fnatic', logo: '' } }, goals: { home: 2, away: 1 } },
    ],
    volleyball: [
      { fixture: { id: `${timestamp}13`, status: { short: 'FT' } }, league: { name: 'VNL', logo: '' }, teams: { home: { name: 'Brazil', logo: '' }, away: { name: 'Poland', logo: '' } }, goals: { home: 3, away: 1 } },
    ],
    'table-tennis': [
      { fixture: { id: `${timestamp}14`, status: { short: 'FT' } }, league: { name: 'WTT Champions', logo: '' }, teams: { home: { name: 'Fan Zhendong', logo: '' }, away: { name: 'Ma Long', logo: '' } }, goals: { home: 4, away: 2 } },
    ],
  };
  return fallbacks[sport] || fallbacks.football;
}

function getScore(match) {
  if (match.goals) return `${match.goals.home ?? 0} - ${match.goals.away ?? 0}`;
  if (match.scores) {
    const home = match.scores.home?.points ?? match.scores.home?.goals ?? match.scores.home?.runs ?? 0;
    const away = match.scores.away?.points ?? match.scores.away?.goals ?? match.scores.away?.runs ?? 0;
    return `${home} - ${away}`;
  }
  return 'vs';
}

function getHomeName(match) {
  return match.teams?.home?.name || 'Home Team';
}

function getAwayName(match) {
  return match.teams?.away?.name || 'Away Team';
}

function getStatus(match) {
  const s = match.fixture?.status?.short || match.status?.short || '';
  if (s === 'FT' || s === 3 || s === '3') return 'FT';
  if (s === 'LIVE' || s === 1 || s === '1') return 'LIVE';
  return s || 'Upcoming';
}

function getLeagueName(match) {
  return match.league?.name || 'League';
}

function getYouTubeSearchQuery(sport, match) {
  const home = getHomeName(match);
  const away = getAwayName(match);
  const league = getLeagueName(match);
  return `${home} vs ${away} ${league} highlights 2025`;
}

const style = document.createElement('style');
style.textContent = `
  .highlight-card {
    transition: all 0.3s ease;
  }
  .highlight-card:hover {
    transform: translateY(-4px);
  }
`;
document.head.appendChild(style);

function renderMatchCard(match, sport, sportName) {
  const home = getHomeName(match);
  const away = getAwayName(match);
  const score = getScore(match);
  const status = getStatus(match);
  const league = getLeagueName(match);
  const searchQuery = encodeURIComponent(getYouTubeSearchQuery(sport, match));
  const homeInitials = home.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const awayInitials = away.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const isLive = status === 'LIVE';

  return `
    <div class="bg-white dark:bg-brand-card rounded-xl border border-gray-200 dark:border-brand-border overflow-hidden highlight-card shadow-sm flex flex-col">
      <div class="p-4 flex-1 flex flex-col">
        <div class="flex items-center justify-between mb-3">
          <span class="text-[10px] font-bold uppercase tracking-wider text-brand-green">${sportName}</span>
          <span class="text-[10px] font-bold px-2 py-0.5 rounded ${isLive ? 'bg-red-500/20 text-red-500 animate-pulse' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}">${status}</span>
        </div>
        <p class="text-[10px] text-gray-500 dark:text-gray-500 font-medium mb-3 truncate">${league}</p>
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2 min-w-0 flex-1">
            <div class="w-8 h-8 rounded-full bg-brand-green/20 flex items-center justify-center shrink-0">
              <span class="text-xs font-bold text-brand-green">${homeInitials}</span>
            </div>
            <span class="text-xs font-bold dark:text-white text-gray-900 truncate">${home}</span>
          </div>
          <span class="text-lg font-black font-headline px-3 dark:text-white text-gray-900 shrink-0">${score}</span>
          <div class="flex items-center gap-2 min-w-0 flex-1 justify-end">
            <span class="text-xs font-bold dark:text-white text-gray-900 truncate">${away}</span>
            <div class="w-8 h-8 rounded-full bg-brand-green/20 flex items-center justify-center shrink-0">
              <span class="text-xs font-bold text-brand-green">${awayInitials}</span>
            </div>
          </div>
        </div>
        <div class="mt-auto pt-3">
          <a href="https://www.youtube.com/results?search_query=${searchQuery}" target="_blank" rel="noopener" class="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all">
            <span class="material-symbols-outlined text-sm" style="font-variation-settings:'FILL' 1">play_arrow</span>
            Watch Highlights
          </a>
        </div>
      </div>
    </div>`;
}

function renderSportTabs(sports, activeSport) {
  const labels = {
    cricket: 'Cricket', football: 'Football', basketball: 'Basketball', tennis: 'Tennis',
    hockey: 'Hockey', kabaddi: 'Kabaddi', 'e-sports': 'E-Sports', baseball: 'Baseball',
    volleyball: 'Volleyball', 'table-tennis': 'T Tennis', all: 'All Sports',
  };
  return sports.map(s => `
    <button class="highlight-tab px-3 py-1.5 text-xs font-bold rounded-full whitespace-nowrap transition-all ${s === activeSport ? 'bg-brand-green text-black shadow-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}" data-sport="${s}">
      ${labels[s] || s}
    </button>`).join('');
}

async function renderHighlights(container, activeSport = 'all') {
  if (!container) return;
  const tabsContainer = container.querySelector('#highlight-tabs');
  const gridContainer = container.querySelector('#highlight-grid');
  if (!tabsContainer || !gridContainer) return;

  const sports = ['football', 'cricket', 'basketball', 'baseball', 'tennis', 'hockey', 'kabaddi', 'volleyball', 'table-tennis'];

  const sportLabels = {
    football: 'Football', cricket: 'Cricket', basketball: 'Basketball', baseball: 'Baseball',
    tennis: 'Tennis', hockey: 'Hockey', kabaddi: 'Kabaddi', volleyball: 'Volleyball', 'table-tennis': 'Table Tennis',
  };

  tabsContainer.innerHTML = renderSportTabs(sports, activeSport);

  tabsContainer.addEventListener('click', async (e) => {
    const tab = e.target.closest('.highlight-tab');
    if (!tab) return;
    const sport = tab.dataset.sport;
    tabsContainer.innerHTML = renderSportTabs(sports, sport);
    gridContainer.innerHTML = '<div class="col-span-full flex justify-center py-10"><div class="w-7 h-7 border-2 border-brand-green border-t-transparent rounded-full animate-spin"></div></div>';
    const matches = await fetchMatches(sport);
    gridContainer.innerHTML = matches.length
      ? matches.map(m => renderMatchCard(m, sport, sportLabels[sport] || sport)).join('')
      : '<div class="col-span-full text-center py-8 text-gray-500 dark:text-gray-400"><span class="material-symbols-outlined text-3xl mb-2">sports</span><p class="text-sm">No recent matches found</p></div>';
  });

  gridContainer.innerHTML = '<div class="col-span-full flex justify-center py-10"><div class="w-7 h-7 border-2 border-brand-green border-t-transparent rounded-full animate-spin"></div></div>';
  const matches = await fetchMatches(activeSport);
  gridContainer.innerHTML = matches.length
    ? matches.map(m => renderMatchCard(m, activeSport, sportLabels[activeSport] || activeSport)).join('')
    : '<div class="col-span-full text-center py-8 text-gray-500 dark:text-gray-400"><span class="material-symbols-outlined text-3xl mb-2">sports</span><p class="text-sm">No recent matches found</p></div>';
}

export { fetchMatches, renderMatchCard, renderHighlights, renderSportTabs, SPORT_APIS, getTodayDate };
