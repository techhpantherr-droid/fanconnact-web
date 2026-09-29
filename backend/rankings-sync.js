const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const quota = require('./api-quota');

// Minimal .env loader (no external dep). Reads backend/.env (gitignored).
// The key is NEVER hardcoded in source and NEVER sent to the browser.
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  try {
    const txt = fs.readFileSync(envPath, 'utf8');
    txt.split('\n').forEach(line => {
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    });
  } catch { /* no .env — rely on process.env */ }
}
loadEnv();
const API_SPORTS_KEY = process.env.API_SPORTS_KEY || '';

const DATA_DIR = path.join(__dirname, '..', 'data');
const PLAYER_RANKINGS_PATH = path.join(DATA_DIR, 'player-rankings.json');
const TEAM_RANKINGS_PATH = path.join(DATA_DIR, 'team-rankings.json');

const CACHE_DURATION = 6 * 60 * 60 * 1000;
let lastSyncTime = null;
let syncInProgress = false;

function log(msg) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`[RankingsSync] ${ts} - ${msg}`);
}

function loadJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function saveJSON(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Quota-aware + cached fetch. Every outbound external request goes through
 * here so the daily 100-call budget is enforced and successful responses are
 * cached to disk (served to all users without touching the API again).
 */
async function fetchWithTimeout(url, opts = {}) {
  const { timeout = 10000, headers = {}, method = 'GET', params = null, ttlMs = CACHE_DURATION, cost = 1 } = opts;
  const result = await quota.cachedFetch(url, params, async () => {
    try {
      const res = await axios({ method, url, headers, timeout, params });
      return res.data;
    } catch {
      return null;
    }
  }, { ttlMs, cost });
  if (result.source === 'quota-exhausted') {
    log(`Quota exhausted — skipping ${url}`);
  } else if (result.source === 'cache') {
    log(`Cache hit for ${url} (age ${Math.round((result.ageMs || 0) / 1000)}s)`);
  } else if (result.source === 'live') {
    log(`Live fetch OK for ${url}`);
  }
  return result.data;
}

const CT_RANKINGS_BASE = 'https://www.crictracker.com/icc-rankings/';
const CT_TEAM_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  Referer: 'https://www.crictracker.com/icc-rankings/'
};
const CT_COUNTRY_MAP = {
  IND: 'India', NZ: 'New Zealand', AUS: 'Australia', ENG: 'England', RSA: 'South Africa', SA: 'South Africa',
  AFG: 'Afghanistan', PAK: 'Pakistan', SL: 'Sri Lanka', WI: 'West Indies', BAN: 'Bangladesh', IRE: 'Ireland',
  NED: 'Netherlands', ZIM: 'Zimbabwe', NAM: 'Namibia', SCO: 'Scotland', OMA: 'Oman', USA: 'United States',
  UGA: 'Uganda', NEP: 'Nepal', UAE: 'UAE', HK: 'Hong Kong', CAN: 'Canada', PNG: 'Papua New Guinea',
  MAL: 'Malaysia', NGA: 'Nigeria', BHR: 'Bahrain', KUW: 'Kuwait', QAT: 'Qatar', BHU: 'Bhutan', JER: 'Jersey'
};
function countryFromCode(code) {
  return CT_COUNTRY_MAP[String(code || '').toUpperCase()] || code || '';
}

/**
 * Real ICC player rankings (men + women, all formats + roles) via CricTracker,
 * which mirrors the ICC press tables in server-rendered HTML (no JS needed).
 * URLs: /icc-rankings/{women/}{batting|bowling|all-rounder}-{odi|t20i|test}/
 */
async function scrapeICCRankings(format, role, gender) {
  const slug = `${gender === 'women' ? 'women/' : ''}${role === 'bowl' ? 'bowling' : role === 'ar' ? 'all-rounder' : 'batting'}-${format === 'test' ? 'test' : format === 't20' ? 't20i' : 'odi'}/`;
  const url = CT_RANKINGS_BASE + slug;
  log(`Scraping ICC rankings (crictracker): ${gender} ${format} ${role}`);
  try {
    const html = await fetchWithTimeout(url, { timeout: 30000, headers: CT_TEAM_HEADERS });
    if (!html) return null;
    const $ = cheerio.load(html);
    const players = [];
    $('table tr').each((i, row) => {
      const tds = $(row).find('td');
      if (!tds.length) return;
      const cells = tds.map((_, t) => $(t).text().trim()).get();
      const name = cells[1] || '';
      const rating = parseInt(cells[3]) || 0;
      if (!name) return;
      players.push({
        rank: parseInt(cells[0]) || players.length + 1,
        name,
        team: cells[2] || '',
        country: countryFromCode(cells[2]),
        rating,
        matches: 0, runs: 0, wkts: 0, avg: 0, econ: 0,
        _source: 'icc'
      });
    });
    return players.length > 0 ? players : null;
  } catch (e) {
    log(`ICC scrape failed for ${url}: ${e.message}`);
    return null;
  }
}

async function scrapeFIFARankings() {
  log('Scraping FIFA rankings');
  try {
    const html = await fetchWithTimeout('https://www.fifa.com/fifa-world-ranking/men', { timeout: 15000 });
    if (!html) return null;
    const $ = cheerio.load(html);
    const teams = [];
    $('table tbody tr').each((i, row) => {
      if (teams.length >= 50) return false;
      const cols = $(row).find('td');
      if (cols.length < 5) return;
      const rank = parseInt($(cols[0]).text().trim()) || i + 1;
      const team = $(cols[1]).text().trim();
      const points = parseInt($(cols[3]).text().trim()) || 0;
      if (team) {
        teams.push({
          rank,
          team,
          code: team.slice(0, 3).toUpperCase(),
          flag: `https://flagcdn.com/${team.slice(0, 2).toLowerCase()}.svg`,
          points,
          previousRank: parseInt($(cols[2]).text().trim()) || rank,
          confederation: '',
          _source: 'fifa'
        });
      }
    });
    return teams.length > 0 ? teams : null;
  } catch (e) {
    log(`FIFA scrape failed: ${e.message}`);
    return null;
  }
}

async function fetchAPISportsRankings(sport, endpoint) {
  const bases = {
    cricket: 'https://api.cricket.api-sports.io',
    tennis: 'https://api.tennis.api-sports.io',
    hockey: 'https://api.hockey.api-sports.io',
  };
  const base = bases[sport];
  if (!base) return null;
  const url = `${base}${endpoint}`;
  log(`Fetching API-Sports ${sport}: ${url}`);
  try {
    const data = await fetchWithTimeout(url, {
      timeout: 10000,
      headers: { 'x-apisports-key': API_SPORTS_KEY }
    });
    return data;
  } catch (e) {
    log(`API-Sports ${sport} failed: ${e.message}`);
    return null;
  }
}

// Cricket "Live Line / Advance" via API-Sports — returns current teams/series.
// Routed through the quota+cache layer so the 100/day budget is protected.
async function fetchCricketFromAPISports() {
  if (!API_SPORTS_KEY) { log('No API-Sports key configured — skipping cricket API'); return null; }
  try {
    const res = await fetchAPISportsRankings('cricket', '/teams?search=');
    if (!res || !res.response) return null;
    return res.response.slice(0, 50).map((t, i) => ({
      rank: i + 1,
      name: t.name || t.team || 'Unknown',
      code: (t.code || t.id || '').toString().toUpperCase(),
      country: t.country || '',
      rating: t.rating != null ? t.rating : 0,
      _source: 'api-sports-cricket'
    }));
  } catch (e) {
    log(`Cricket API-Sports failed: ${e.message}`);
    return null;
  }
}

async function fetchESPNRankings(sport, category) {
  const endpoints = {
    basketball: {
      url: `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete?season=2026&seasontype=2&limit=100`,
      parse: (data) => {
        if (!data.athletes) return null;
        return data.athletes.map((a, i) => {
          const ath = a.athlete;
          const o = a.categories?.[1]?.values || [];
          const g = a.categories?.[0]?.values || [];
          return {
            rank: i + 1,
            name: ath.displayName || '',
            team: ath.teamShortName || '',
            position: ath.position?.abbreviation || '',
            points: parseFloat(o[0]) || 0,
            rebounds: parseFloat(g[11]) || 0,
            assists: parseFloat(o[10]) || 0,
            fg_pct: parseFloat(o[3]) || 0,
            rating: 0,
            _source: 'espn'
          };
        });
      }
    },
    baseball: {
      url: `https://site.web.api.espn.com/apis/common/v3/sports/baseball/mlb/statistics/byathlete?category=batting&season=2026&seasontype=2&limit=100`,
      parse: (data) => {
        if (!data.athletes) return null;
        return data.athletes.map((a, i) => {
          const ath = a.athlete;
          const batting = a.categories?.find(c => c.name === 'batting');
          const v = batting?.values || [];
          return {
            rank: i + 1,
            name: ath.displayName || '',
            team: ath.teamShortName || '',
            position: ath.position?.abbreviation || '',
            hr: parseInt(v[7]) || 0,
            avg: parseFloat(v[4]) || 0,
            rbi: parseInt(v[8]) || 0,
            ops: parseFloat(v[15]) || 0,
            games: parseInt(v[0]) || 0,
            _source: 'espn'
          };
        });
      }
    }
  };
  const config = endpoints[sport];
  if (!config) return null;
  try {
    const data = await fetchWithTimeout(config.url, { timeout: 10000 });
    if (!data) return null;
    return config.parse(data);
  } catch (e) {
    log(`ESPN ${sport} failed: ${e.message}`);
    return null;
  }
}

function initializeDefaultData() {
  let playerData = loadJSON(PLAYER_RANKINGS_PATH);
  let teamData = loadJSON(TEAM_RANKINGS_PATH);

  if (!playerData) {
    log('Creating default player-rankings.json');
    playerData = {};
    saveJSON(PLAYER_RANKINGS_PATH, playerData);
  }
  if (!teamData) {
    log('Creating default team-rankings.json');
    teamData = {};
    saveJSON(TEAM_RANKINGS_PATH, teamData);
  }

  return { playerData, teamData };
}

async function syncPlayerRankings() {
  log('Starting player rankings sync...');
  const { playerData, teamData } = initializeDefaultData();

  const updates = [];

  // ICC cricket player rankings — every format × role × gender the UI exposes.
  // (ICC has no women's Test ranking, so women get ODI + T20I only.)
  for (const gender of ['men', 'women']) {
    const formats = gender === 'women' ? ['odi', 't20'] : ['odi', 't20', 'test'];
    for (const format of formats) {
      for (const role of ['bat', 'bowl', 'ar']) {
        const key = `${format}_${role}_${gender}`;
        updates.push(
          scrapeICCRankings(format, role, gender).then(data => {
            if (data && data.length) {
              if (!playerData.cricket) playerData.cricket = {};
              playerData.cricket[key] = data;
              log(`Updated ICC ${format} ${role} (${gender}): ${data.length} players`);
            }
          }).catch(() => {})
        );
      }
    }
  }

  // Cricket via API-Sports (live line / rankings) — budgeted + cached.
  updates.push(
    fetchCricketFromAPISports().then(data => {
      if (data && data.length) {
        if (!playerData.cricket) playerData.cricket = {};
        playerData.cricket.api_sports = data;
        log(`Updated cricket (API-Sports): ${data.length} teams/players`);
      }
    }).catch(() => {})
  );

  updates.push(
    fetchESPNRankings('basketball', 'points').then(data => {
      if (data) {
        if (!playerData.basketball) playerData.basketball = {};
        playerData.basketball.points = data;
        log(`Updated NBA scoring: ${data.length} players`);
      }
    }).catch(() => {})
  );

  updates.push(
    fetchESPNRankings('baseball', 'hr').then(data => {
      if (data) {
        if (!playerData.baseball) playerData.baseball = {};
        playerData.baseball.hr = data;
        log(`Updated MLB HR: ${data.length} players`);
      }
    }).catch(() => {})
  );

  updates.push(
    scrapeFIFARankings().then(data => {
      if (data) {
        if (!playerData.football) playerData.football = {};
        playerData.football.fifa_rankings = data;
        log(`Updated FIFA rankings: ${data.length} teams`);
        if (teamData.football) {
          teamData.football.rankings.fifa_men = data.map(t => ({
            rank: t.rank,
            team: t.team,
            code: t.code,
            flag: t.flag,
            points: t.points,
            previousRank: t.previousRank,
            trend: t.rank < t.previousRank ? 'up' : t.rank > t.previousRank ? 'down' : 'neutral',
            trendVal: Math.abs(t.rank - t.previousRank)
          }));
        }
      }
    }).catch(() => {})
  );

  await Promise.allSettled(updates);

  const lastUpdated = new Date().toISOString();
  if (!playerData._meta) playerData._meta = {};
  playerData._meta.lastSync = lastUpdated;
  playerData._meta.syncInterval = `${CACHE_DURATION / 1000 / 60 / 60}h`;

  saveJSON(PLAYER_RANKINGS_PATH, playerData);

  if (teamData._meta) teamData._meta.lastSync = lastUpdated;
  saveJSON(TEAM_RANKINGS_PATH, teamData);

  lastSyncTime = Date.now();
  log(`Player rankings sync complete. Next sync in ${CACHE_DURATION / 1000 / 60 / 60}h`);
}

async function syncTeamRankings() {
  log('Starting team rankings sync...');
  const teamData = loadJSON(TEAM_RANKINGS_PATH);
  if (!teamData) {
    log('No team rankings file found, creating default');
    return;
  }

  // ICC team rankings are curated in team-rankings.json (Men/Women sections).
  // Player rankings are refreshed by syncPlayerRankings(); nothing to scrape here.
  saveJSON(TEAM_RANKINGS_PATH, teamData);
  log('Team rankings sync complete');
}

async function fullSync() {
  if (syncInProgress) {
    log('Sync already in progress, skipping');
    return;
  }
  syncInProgress = true;
  try {
    await syncPlayerRankings();
    await syncTeamRankings();
    log('Full sync cycle completed');
  } catch (e) {
    log(`Sync error: ${e.message}`);
  } finally {
    syncInProgress = false;
  }
}

function getLastSyncTime() {
  return lastSyncTime;
}

function startAutoSync(intervalMs = CACHE_DURATION) {
  log(`Starting auto-sync every ${intervalMs / 1000 / 60 / 60}h`);
  fullSync();
  setInterval(() => fullSync(), intervalMs);
}

function getSyncStatus() {
  return {
    lastSync: lastSyncTime ? new Date(lastSyncTime).toISOString() : null,
    inProgress: syncInProgress,
    cacheDuration: CACHE_DURATION,
    nextSync: lastSyncTime ? new Date(lastSyncTime + CACHE_DURATION).toISOString() : 'pending',
    quota: quota.quotaStatus()
  };
}

module.exports = {
  fullSync,
  startAutoSync,
  getSyncStatus,
  getLastSyncTime,
  syncPlayerRankings,
  syncTeamRankings,
  CACHE_DURATION
};

// Manual run: `node rankings-sync.js` performs one full sync and exits.
if (require.main === module) {
  fullSync()
    .then(() => { log('Manual sync finished'); process.exit(0); })
    .catch(e => { log('Manual sync failed: ' + e.message); process.exit(1); });
}
