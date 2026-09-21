// ============================================================================
//  match-center-engine.js
//  Data-driven Match Center. Reads URL params (sport, home, away, state, match)
//  and renders ALL panels (score header, match info, summary, scorecard,
//  commentary, squads, graph, news) for ANY sport / match / state.
//  State: upcoming | live | finished
// ============================================================================
(function () {
  'use strict';
  window.__MC_ENGINE__ = true;

  // ------------------------------------------------------------------ params
  const params = new URLSearchParams(location.search);
  const SPORT = (params.get('sport') || 'cricket').toLowerCase();
  const HOME = (params.get('home') || '').toLowerCase();
  const AWAY = (params.get('away') || '').toLowerCase();
  // Match ID is the only authoritative match selector. URL hs/as values are ignored.
  const MATCHID = params.get('id') || params.get('match') || '';

  window.__MC_MATCH_ID__ = MATCHID;

  // Prediction navigation: redirect to app (Play Store).
  function setupPredictionLink() {
    const link = document.getElementById('prediction-link');
    if (!link) return;
    const sport = String(SPORT || 'cricket').toLowerCase();
    if (MATCHID) {
      try {
        sessionStorage.setItem('predictionMatchId', MATCHID);
        sessionStorage.setItem('predictionSport', sport);
      } catch (_) {}
    }
    link.href = 'https://play.google.com/store/apps';
    link.target = '_blank';
    link.rel = 'noopener';
  }

  const FORMAT_PARAM = params.get('format') || '';

  // Match ID is authoritative; no static matches-data lookup is used.

  // Backend proxy base (same as highlights.js) for real team rankings
  // Backend proxy. Prefer the local Node server; if the page is opened from a LAN
  // address, also try that host. No static/mock match source is used.
  const API_BASES = [window.FC_API ? window.FC_API.api() : (location.origin.includes('localhost') ? 'http://localhost:5000/api' : location.origin)];
  const API_PROXY = API_BASES[0];

  // ============================================================================
  // FANCONNECT API MANAGER (PART-1)
  // ============================================================================

  const API = {

    async request(url) {
      if (!MATCHID && url.indexOf('/matches/') === 0) {
        throw new Error('Match ID is required');
      }

      let lastError = null;
      for (const base of API_BASES) {
        const fullUrl = base + url;
        try {
          console.log('FETCH =>', fullUrl);
          const res = await fetch(fullUrl, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            cache: 'no-store'
          });
          console.log('STATUS =>', res.status);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const text = await res.text();
          let json;
          try {
            json = text ? JSON.parse(text) : null;
          } catch (e) {
            throw new Error(`Non-JSON response from ${fullUrl}`);
          }
          console.log('FETCH JSON =>', json);
          return json;
        } catch (err) {
          lastError = err;
          console.warn('API TRY FAILED:', fullUrl, err);
        }
      }
      throw lastError || new Error('Match API unavailable');
    },


    async getMatch() {

      return await this.request(
        `/matches/${MATCHID}`
      );

    },



    async getScorecard() {

      return await this.request(
        `/matches/${MATCHID}/scorecard`
      );

    },



    async getCommentary(iid = 1) {
      return await this.request(`/matches/${MATCHID}/commentary?iid=${encodeURIComponent(iid)}`);
    },

    async getHCommentary(iid = 1) {
      return await this.request(`/matches/${MATCHID}/hcommentary?iid=${encodeURIComponent(iid)}`);
    },

    async getScorecard() {
      return await this.request(`/matches/${MATCHID}/scorecard`);
    },

    async getSquads() {
      return await this.request(`/matches/${MATCHID}/squads`);
    },

    async getOvers(iid = 1) {
      return await this.request(`/matches/${MATCHID}/overs?iid=${encodeURIComponent(iid)}`);
    },

    async getOverDetails(iid = 1) {
      return await this.request(`/matches/${MATCHID}/overs/details?iid=${encodeURIComponent(iid)}`);
    },

    async getHighlights() {
      return await this.request(`/matches/${MATCHID}/highlights`);
    },

    async getMatchNews() {
      return await this.request(`/matches/${MATCHID}/news`);
    },

    async getNews(lastId = 0) {
      return await this.request(`/news${lastId ? `?lastId=${encodeURIComponent(lastId)}` : ''}`);
    },

    async getOversGraph() {
      return await this.request(`/matches/${MATCHID}/oversGraph`);
    },

    async getBallsGraph(iid = 1) {
      return await this.request(`/matches/${MATCHID}/ballsGraph?iid=${encodeURIComponent(iid)}`);
    },

    async getPartnershipGraph() {
      return await this.request(`/matches/${MATCHID}/partnershipGraph`);
    },

    async getAllSportsDetail(sport, rawId) {
      const s = encodeURIComponent(String(sport || 'basketball').toLowerCase());
      const id = encodeURIComponent(String(rawId || MATCHID || '').replace(/^as_/, ''));
      return await this.request(`/all-sports/match/${s}/${id}`);
    }

  };


  // ============================================================================
  // GLOBAL MATCH DATA
  // ============================================================================

  let REAL_DATA = {

    match: null,

    scorecard: null,

    commentary: null,

    squads: null,

    overs: null,

    highlights: null

  };

  function buildMatchFromScorecard() {
    const raw = REAL_DATA.scorecard?.data || REAL_DATA.scorecard || {};
    const headers = raw.matchheaders || raw.matchHeaders || raw.matchheader || {};
    const innings = safeArray(raw.scorecard || raw.innings || raw.data);
    if (!innings.length && !Object.keys(headers).length && !raw.status) return null;

    const teamObject = value => {
      if (!value) return {};
      if (typeof value === 'string') return { teamname: value };
      return value;
    };
    const getTeamName = value => safeLabel(
      value?.teamname || value?.teamName || value?.name || value?.team_name || value?.displayName
    );
    const getTeamShort = value => safeLabel(
      value?.teamsname || value?.teamSName || value?.short || value?.abbreviation || value?.teamCode || value?.teamshortname
    );

    const hHeader = teamObject(headers.team1 || headers.homeTeam || headers.home || raw.team1 || raw.homeTeam || raw.home);
    const aHeader = teamObject(headers.team2 || headers.awayTeam || headers.away || raw.team2 || raw.awayTeam || raw.away);
    const first = innings[0] || {};
    const second = innings[1] || {};

    const hName = getTeamName(hHeader) || safeString(first.batteamname || first.teamname || first.batteam);
    const aName = getTeamName(aHeader) || safeString(second.batteamname || second.teamname || second.batteam);
    const hShort = getTeamShort(hHeader) || safeString(first.batteamsname || first.batteamshortname || first.teamshortname);
    const aShort = getTeamShort(aHeader) || safeString(second.batteamsname || second.batteamshortname || second.teamshortname);

    const status = safeString(headers.state || headers.status || raw.state || raw.status);
    const statusText = safeString(headers.statusText || headers.statusline || headers.status || raw.statusText || raw.statusline || raw.result || raw.status);
    const format = safeString(headers.matchformat || headers.matchFormat || raw.matchformat || raw.matchFormat) ||
      (innings.length > 2 ? 'TEST' : '');
    const series = safeString(headers.seriesname || headers.seriesName || raw.seriesname || raw.seriesName);
    const venueName = safeString(headers.venueinfo?.ground || headers.venueInfo?.ground || raw.venueinfo?.ground || raw.venueInfo?.ground);
    const venueCity = safeString(headers.venueinfo?.city || headers.venueInfo?.city || raw.venueinfo?.city || raw.venueInfo?.city);

    return {
      id: MATCHID,
      series,
      matchType: format,
      status,
      statusText,
      result: safeString(headers.result || raw.result || ''),
      winner: headers.winner || headers.winningTeam || raw.winner || raw.winningTeam || '',
      startTime: headers.matchstarttimestamp || headers.startTime || raw.startdate || raw.startTime,
      venue: venueName ? { name: venueName, city: venueCity } : '',
      teams: {
        home: hName ? { teamname: hName, teamName: hName, teamsname: hShort } : null,
        away: aName ? { teamname: aName, teamName: aName, teamsname: aShort } : null
      },
      toss: safeString(headers.tossstatus || headers.toss || raw.tossstatus || raw.toss),
      score: raw.scoreCard || raw.scorecard || {},
      innings
    };
  }

// ============================================================================
  // LOAD REAL MATCH DATA
  // ============================================================================

  function extractInnings(rawScorecard) {
    const raw = rawScorecard?.data || rawScorecard || {};
    const candidates = [
      raw.scorecard,
      raw.scoreCard,
      raw.innings,
      raw.data,
      raw?.scorecard?.scoreCard,
      raw?.data?.scorecard,
      raw?.data?.scoreCard
    ];
    for (const c of candidates) if (Array.isArray(c) && c.length) return c;
    return [];
  }

  function getCurrentInningsId() {
    const innings = extractInnings(REAL_DATA.scorecard);
    if (!innings.length) return 1;

    const current = innings.find(i => {
      const sd = i?.scoreDetails || i?.scoredetails || {};
      return !!(
        i?.iscurrentinnings || i?.isCurrent || i?.current || i?.currentinnings ||
        sd?.isCurrentInnings || sd?.isCurrent || sd?.current || sd?.currentInnings
      );
    });
    const currentId = current?.inningsid ?? current?.inningsId ?? current?.iid ??
      current?.scoreDetails?.inningsId ?? current?.scoreDetails?.inningsid;
    if (currentId != null && Number.isFinite(Number(currentId))) return Number(currentId);

    // In a live limited-overs match the newest populated innings is the active
    // innings when the provider omits an explicit current flag.
    const last = innings[innings.length - 1];
    const lastId = last?.inningsid ?? last?.inningsId ?? last?.iid ??
      last?.scoreDetails?.inningsId ?? last?.scoreDetails?.inningsid;
    if (lastId != null && Number.isFinite(Number(lastId))) return Number(lastId);

    return innings.length;
  }

  async function getTimedClientCache(key, ttlMs, loader) {
    const storageKey = 'fanconnact:mc-cache:' + MATCHID + ':' + key;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.savedAt && Date.now() - parsed.savedAt < ttlMs && parsed.value) return parsed.value;
      }
    } catch (_) {}
    const value = await loader();
    if (value) {
      try { localStorage.setItem(storageKey, JSON.stringify({ savedAt: Date.now(), value })); } catch (_) {}
    }
    return value;
  }

  async function loadAllSportsMatchData(sport, rawId) {
    // Resolve sport when the link lacks ?sport=: dashboard MATCHES first,
    // then try every supported sport until one returns real teams.
    const candidates = [];
    if (sport) candidates.push(sport);
    if (!sport) {
      try {
        const ms = window.FANCONNECT_MATCHES && window.FANCONNECT_MATCHES.MATCHES;
        const found = ms && ms.find(x => String(x.id) === String(rawId || MATCHID));
        if (found && found.sport) candidates.push(String(found.sport).toLowerCase());
      } catch (_) {}
    }
    for (const s of ["basketball", "baseball", "volleyball", "handball", "esport", "kabaddi", "football", "hockey", "tennis"]) {
      if (!candidates.includes(s)) candidates.push(s);
    }
    for (const s of candidates) {
      let detail = null;
      try {
        detail = await API.getAllSportsDetail(s, rawId || MATCHID);
      } catch (err) {
        console.warn("[Match Center] AllSports detail unavailable:", s, err);
        continue;
      }
      if (await applyAllSportsDetail(detail, s)) return;
    }
    BACKEND_READY = false;
    setUnavailableModel("Real match data is not available");
  }

  async function applyAllSportsDetail(detail, sport) {
    const norm = detail?.match || detail?.data?.match || null;
    const evt = detail?.events || detail?.event || detail?.data?.event || null;
    // Reject empty shells (wrong sport tried): need real team names.
    const hasTeams = !!(norm?.homeTeam?.name || evt?.homeTeam?.name);
    if (!hasTeams) return false;
    const incidents = Array.isArray(detail?.incidents) ? detail.incidents
      : Array.isArray(detail?.data?.incidents) ? detail.data.incidents : [];
    const lineups = detail?.lineups || detail?.data?.lineups || null;
    const homeStats = detail?.homeStats || evt?.homeStatistics || [];
    const awayStats = detail?.awayStats || evt?.awayStatistics || [];

    const homeName = norm?.homeTeam?.name || evt?.homeTeam?.name || HOME_T.name || 'Home';
    const awayName = norm?.awayTeam?.name || evt?.awayTeam?.name || AWAY_T.name || 'Away';
    const homeScore = norm?.score?.home ?? evt?.homeScore?.current ?? '';
    const awayScore = norm?.score?.away ?? evt?.awayScore?.current ?? '';
    const statusText = norm?.statusText || evt?.status?.description || norm?.result || '';
    const status = norm?.status || (/finish|result|won|full/i.test(statusText) ? 'finished'
      : (/1st|2nd|3rd|4th|quarter|half|inning|set|game|live|in progress/i.test(statusText) ? 'live' : 'upcoming'));

    Object.assign(HOME_T, { name: homeName, img: HOME_T.img });
    Object.assign(AWAY_T, { name: awayName, img: AWAY_T.img });
    M.home = HOME_T; M.away = AWAY_T;
    M.sport = sport;
    M.state = status;
    M.meta.title = homeName + ' vs ' + awayName;
    M.meta.sub = norm?.series || evt?.tournament?.name || '';
    M.meta.series = M.meta.sub;
    M.meta.venue = evt?.venue?.name || '';
    M.meta.format = sport;
    M.meta.date = norm?.date ? (norm.date + (norm?.time ? ' · ' + norm.time : '')) : '';
    M.score = {
      status,
      resultText: status === 'finished' ? (norm?.result || statusText || 'Full Time')
        : status === 'live' ? (statusText || 'Live') : (norm?.date ? (norm.date + (norm?.time ? ' · ' + norm.time : '')) : 'Upcoming'),
      subText: M.meta.sub,
      icon: SC.icon || '🏟️',
      home: { score: String(homeScore ?? ''), sub: '', detail: statusText },
      away: { score: String(awayScore ?? ''), sub: '', detail: '' }
    };
    const statRows = [];
    const maxStats = Math.max(Array.isArray(homeStats) ? homeStats.length : 0, Array.isArray(awayStats) ? awayStats.length : 0);
    for (let i = 0; i < Math.min(maxStats, 12); i++) {
      const h = Array.isArray(homeStats) ? homeStats[i] : null;
      const a = Array.isArray(awayStats) ? awayStats[i] : null;
      const key = h?.name || h?.type || a?.name || a?.type || ('Stat ' + (i + 1));
      statRows.push({ k: String(key), h: h?.value ?? h?.stat ?? '—', a: a?.value ?? a?.stat ?? '—' });
    }
    M.scorecard = statRows.length
      ? { type: sport, stats: statRows, home: { code: 'HOME' }, away: { code: 'AWAY' } }
      : { type: 'cricket', innings: [] };
    M.comm = {
      label: 'Match Events',
      items: incidents.slice(0, 100).map((ev, i) => {
        const h = ev?.homeScore, a = ev?.awayScore;
        const snap = (h != null && a != null && h !== '' && a !== '') ? ' (' + h + '-' + a + ')' : '';
        const base = ev?.text || ev?.comment || ev?.description || (ev?.player?.name ? ev.player.name + ' — ' + (ev?.type || 'event') : (ev?.type || 'Event'));
        return {
          over: ev?.time ?? ev?.minute ?? ('#' + (i + 1)),
          text: base + snap,
          type: /goal|score|win|point/i.test(ev?.type || ev?.text || '') ? 'four' : 'info',
          timestamp: ev?.timeStamp || Date.now()
        };
      })
    };
    const lineupToPlayers = (arr) => (Array.isArray(arr) ? arr.slice(0, 18).map(p => ({
      n: p?.player?.name || p?.name || 'Player', r: p?.position || p?.role || '', id: p?.player?.id || p?.id || ''
    })) : []);
    const homeXI = lineupToPlayers(lineups?.home?.players || lineups?.homeTeam?.players || lineups?.home);
    const awayXI = lineupToPlayers(lineups?.away?.players || lineups?.awayTeam?.players || lineups?.away);
    M.squads = { home: { xi: homeXI, bench: [], staff: [] }, away: { xi: awayXI, bench: [], staff: [] } };
    // Real summary + team-filtered news + weather, same builders as cricket.
    applyRealSummaryData();
    try {
      const rawNews = await API.getNews().catch(() => null);
      REAL_DATA.news = rawNews;
      applyRealNewsData();
      const hn = (HOME_T.name || '').toLowerCase(), an = (AWAY_T.name || '').toLowerCase();
      M.news.articles = (M.news.articles || []).filter(a =>
        (hn && (((a.title || '') + ' ' + (a.desc || '')).toLowerCase().includes(hn))) ||
        (an && (((a.title || '') + ' ' + (a.desc || '')).toLowerCase().includes(an))));
      M.news.source = 'Live backend';
    } catch (_) { M.news = { source: 'Live backend', articles: [] }; }
    // Score progression for the Graph tab, from incident scorelines.
    M.graph.timeline = incidents
      .filter(ev => ev && ev.homeScore != null && ev.awayScore != null && ev.homeScore !== '' && ev.awayScore !== '')
      .map(ev => ({ t: String(ev.time ?? ev.minute ?? ''), h: Number(ev.homeScore), a: Number(ev.awayScore) }))
      .filter(p => Number.isFinite(p.h) && Number.isFinite(p.a))
      .slice(0, 60);
    try { await loadRealWeather(); } catch (_) {}
    BACKEND_READY = true;
    return true;
  }

  async function loadRealMatchData() {
    setupPredictionLink();
    // Non-cricket (AllSports/ESPN/PKL) matches use a dedicated real-data path.
    const sportParam = String(SPORT || '').toLowerCase();
    const isAllSportsId = /^(as_|espn_|pkl_)/i.test(String(MATCHID || ''));
    const isAllSportsSport = sportParam && sportParam !== 'cricket';
    if (isAllSportsId || isAllSportsSport) {
      const sport = isAllSportsSport ? sportParam : null;
      console.log('Loading REAL AllSports match data:', MATCHID, sport || '(auto-detect)');
      if (!MATCHID) { BACKEND_READY = false; setUnavailableModel('Match ID is missing'); return; }
      await loadAllSportsMatchData(sport, MATCHID);
      return;
    }
  console.log('Loading REAL match data:', MATCHID);
    if (!MATCHID) {
      BACKEND_READY = false;
      setUnavailableModel('Match ID is missing');
      return;
    }

    REAL_DATA = {
      match: null,
      scorecard: null,
      commentary: null,
      historicalCommentary: null,
      squads: null,
      overs: null,
      overDetails: null,
      highlights: null,
      news: null,
      oversGraph: null,
      ballsGraph: null,
      partnershipGraph: null
    };

    // Match + scorecard are the source of truth for state, format and current innings.
    // Load the same dynamic International / League / Domestic / Women team
    // registry used by the homepage before resolving the Match Center logos.
    await loadDynamicTeamRegistry().catch(err => console.warn('[Match Center] team registry unavailable:', err));

    const [match, scorecard] = await Promise.all([
      API.getMatch().catch(() => null),
      API.getScorecard().catch(() => null)
    ]);
    REAL_DATA.match = match;
    REAL_DATA.scorecard = scorecard;

    if (!REAL_DATA.match && REAL_DATA.scorecard) {
      REAL_DATA.match = buildMatchFromScorecard();
    }
    BACKEND_READY = !!REAL_DATA.match || !!REAL_DATA.scorecard;
    if (!BACKEND_READY) {
      setUnavailableModel('Real match data is not available');
      return;
    }

    updateTeamsFromBackend();
    const innings = extractInnings(REAL_DATA.scorecard);
    const inningsIds = [...new Set(innings.map((inn, i) => Number(inn?.inningsid ?? inn?.inningsId ?? inn?.iid ?? inn?.id ?? i + 1)).filter(Number.isFinite))];
    const currentIid = getCurrentInningsId();
    const backendFormat = safeString(
      getMatchData()?.matchType || getMatchData()?.matchformat || getMatchData()?.format || FORMAT_PARAM
    ).toLowerCase();
    const isTestMatch = /test/.test(backendFormat) || innings.length > 2;
    // Test matches can have four innings. Fetch all four IDs when the scorecard
    // is incomplete so the graph can discover later innings as they become available.
    const idsToFetch = isTestMatch
      ? [...new Set([1, 2, 3, 4, ...inningsIds].filter(Number.isFinite))]
      : (inningsIds.length ? inningsIds : [currentIid]);

    const fetchManyRaw = async fn => {
      const values = await Promise.all(idsToFetch.map(iid => fn(iid).catch(() => null)));
      return values.filter(Boolean);
    };
    const fetchManyTagged = async fn => {
      const values = await Promise.all(idsToFetch.map(async iid => {
        try {
          const value = await fn(iid);
          return value ? { iid, value } : null;
        } catch (_) {
          return null;
        }
      }));
      return values.filter(Boolean);
    };
    const jobs = [
      ['commentary', () => fetchManyRaw(iid => API.getCommentary(iid))],
      ['historicalCommentary', () => fetchManyRaw(iid => API.getHCommentary(iid))],
      ['squads', () => getTimedClientCache('squads', 6 * 60 * 60 * 1000, () => API.getSquads())],
      ['overs', () => fetchManyTagged(iid => API.getOvers(iid))],
      ['overDetails', () => fetchManyRaw(iid => API.getOverDetails(iid))],
      ['highlights', () => API.getHighlights()],
      ['news', async () => {
        const matchNews = await API.getMatchNews().catch(() => null);
        const matchList = matchNews?.data || matchNews;
        const hasMatchNews = Array.isArray(matchList) ? matchList.length > 0 : !!(matchList?.storyList?.length || matchList?.storylist?.length || matchList?.items?.length || matchList?.news?.length || matchList?.data?.length);
        if (hasMatchNews) return matchNews;
        return await API.getNews().catch(() => null);
      }],
      ['oversGraph', () => API.getOversGraph()],
      ['ballsGraph', async () => {
        const values = await Promise.all(idsToFetch.map(iid =>
          API.getBallsGraph(iid).then(value => ({ iid, value })).catch(() => null)
        ));
        return values.filter(Boolean);
      }],
      ['partnershipGraph', () => API.getPartnershipGraph()]
    ];
    const settled = await Promise.all(jobs.map(async ([key, fn]) => {
      try { return [key, await fn()]; } catch (err) { console.warn(`REAL ${key} unavailable`, err); return [key, null]; }
    }));
    settled.forEach(([key, value]) => { REAL_DATA[key] = value; });
    updateTeamsFromBackend();
    applyNormalizedModel(normalizeBackendData());
    applyHeroBackendData();
    await loadRealWeather();
    applyRealSummaryData();
    applyRealNewsData();
  }

  function setUnavailableModel(message) {
    M.state = 'unknown';
    M.score = {
      status: 'unknown',
      resultText: message || 'Real data unavailable',
      subText: '',
      icon: '⏳',
      home: { score: '', sub: '', detail: '' },
      away: { score: '', sub: '', detail: '' }
    };
    M.scorecard = { type: 'cricket', innings: [] };
    M.comm = { items: [], label: 'Ball-by-Ball Commentary' };
    M.graph = emptyGraph();
    M.squads = emptySquads();
    M.players = { home: [], away: [] };
    M.news = { source: 'Live backend', articles: [] };
  }

  let BACKEND_READY = false;

  // ============================================================================
// MATCH NORMALIZER
// PART 1.1
// ============================================================================

function getMatchData() {
    const root = REAL_DATA.match;
    if (!root) return {};

    const candidates = [
      root?.data,
      root?.match,
      root?.matchInfo,
      root?.matchHeader,
      root?.matchheader,
      root?.matchheaders,
      root
    ];

    for (const value of candidates) {
      if (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length) {
        return value;
      }
    }
    return {};
}

function safeArray(value) {

    return Array.isArray(value)
        ? value
        : [];

}

function safeString(value) {
    return value == null ? "" : String(value);
}

function safeLabel(value) {
    if (value == null) return "";
    if (typeof value === 'object') {
        return safeString(value.name || value.teamname || value.teamName || value.label || value.title || value.text || value.value);
    }
    return safeString(value);
}

function safeNumber(value, fallback = 0) {

    const n = Number(value);

    return Number.isFinite(n)
        ? n
        : fallback;

}

function firstNonEmpty(...values) {
    return values.find(v => v != null && v !== '') ?? '';
}

function normalizeMatchState(data) {
    const raw = safeString(
      data?.state ?? data?.status ?? data?.matchState ?? data?.matchstate
    ).toLowerCase().trim();
    const text = safeString(
      data?.statusText ?? data?.result ?? data?.statusline ?? data?.status
    ).toLowerCase().trim();
    const combined = (raw + ' ' + text).trim();

    if (/(complete|completed|finished|result|won|draw|tie|no result|abandon|abandoned|cancel|cancelled)/i.test(combined)) {
      return 'finished';
    }
    if (/(live|in progress|innings break|stumps|lunch|tea|day\s*[1-5]|session|drinks|rain delay|delayed)/i.test(combined)) {
      return 'live';
    }
    if (/(upcoming|scheduled|not started|preview|fixture|yet to start|match starts|starts at)/i.test(combined)) {
      return 'upcoming';
    }

    const start = data?.startTime ?? data?.starttime ?? data?.startdate ?? data?.startDate;
    const t = parseDateValue(start);
    if (t && t.getTime() > Date.now()) return 'upcoming';

    return 'unknown';
}

function normalizeHeader(data, innings) {
    const currentInnings = innings.find(i => i && (i.iscurrentinnings || i.isCurrent || i.current || i.currentinnings)) || innings[innings.length - 1] || null;
    const rawState = normalizeMatchState(data);
    const statusText = safeLabel(data?.statusText || data?.statusline || data?.result || data?.status || '');
    const sessionTextRaw = safeLabel(data?.session || data?.sessionName || data?.matchSession || currentInnings?.session || currentInnings?.sessionName || '');
    const dayTextRaw = safeLabel(data?.day || data?.matchDay || data?.dayNumber || currentInnings?.day || currentInnings?.dayNumber || '');
    const inferredDay = dayTextRaw || ((statusText.match(/\bday\s*([1-5])\b/i) || [])[1] ? 'Day ' + (statusText.match(/\bday\s*([1-5])\b/i) || [])[1] : '');
    const inferredSession = sessionTextRaw || (/(lunch|tea|stumps|innings break|drinks|rain delay|delayed start|play suspended|play resumed)/i.test(statusText) ? statusText : '');
    return {
      status: rawState,
      result: statusText,
      innings,
      currentInnings,
      session: inferredSession,
      day: inferredDay,
      playState: safeLabel(data?.playState || data?.playstate || data?.stateText || statusText)
    };
}

// ============================================================================
// SCORE NORMALIZER
// PART 1.2
// ============================================================================

function normalizeScore(data, header) {
    const score = {
      status: header.status,
      resultText: header.result,
      subText: '',
      home: { score: '', sub: '', detail: '' },
      away: { score: '', sub: '', detail: '' },
      current: header.currentInnings || null,
      target: null,
      requiredRuns: null,
      requiredBalls: null,
      currentRunRate: null,
      requiredRunRate: null,
      day: header.day,
      session: header.session,
      playState: header.playState
    };
    const matchNames = (inn, side) => {
      const name = safeString(inn?.batteamname || inn?.teamname || inn?.team_name || '').toLowerCase();
      const code = safeLabel(inn?.batteamshortname || inn?.batteamcode || inn?.teamshortname || '').toLowerCase();
      const candidates = side === 'home' ? [HOME_T.name, HOME_CODE, HOME] : [AWAY_T.name, AWAY_CODE, AWAY];
      return candidates.filter(Boolean).some(v => String(v).toLowerCase() === name || String(v).toLowerCase() === code);
    };
    header.innings.forEach(inn => {
      const side = matchNames(inn, 'home') ? 'home' : matchNames(inn, 'away') ? 'away' : null;
      if (!side) return;
      const raw = safeString(inn?.score || '');
      const parts = raw.match(/^(\d+)\s*\/\s*(\d+)/);
      const runs = parts ? parts[1] : safeString(inn?.runs ?? raw);
      const wkts = parts ? parts[2] : safeString(inn?.wickets ?? inn?.wkts ?? '');
      score[side].score = runs;
      score[side].sub = wkts ? '/' + wkts : '';
      score[side].detail = safeString(inn?.overs ?? inn?.ov ?? '') ? safeString(inn.overs ?? inn.ov) + ' Overs' : '';
      score[side].inningsId = inn?.inningsid ?? inn?.inningsId ?? inn?.iid ?? null;
    });
    const cur = header.currentInnings || {};
    const crr = data?.currentRunRate ?? data?.currentrunrate ?? cur?.currentRunRate ?? cur?.currentrunrate ?? cur?.runrate ?? cur?.crr;
    const rrr = data?.requiredRunRate ?? data?.requiredrunrate ?? cur?.requiredRunRate ?? cur?.requiredrunrate ?? cur?.rrr;
    score.target = data?.target ?? data?.targetscore ?? cur?.target ?? cur?.targetscore ?? null;
    score.requiredRuns = data?.requiredRuns ?? data?.requiredruns ?? cur?.requiredRuns ?? cur?.requiredruns ?? null;
    score.requiredBalls = data?.requiredBalls ?? data?.requiredballs ?? cur?.requiredBalls ?? cur?.requiredballs ?? null;
    score.currentRunRate = crr;
    score.requiredRunRate = rrr;
    const bits = [];
    if (header.day) bits.push(header.day);
    if (header.session) bits.push(header.session);
    if (header.playState && !bits.some(x => x.toLowerCase() === header.playState.toLowerCase())) bits.push(header.playState);
    if (crr != null && crr !== '') bits.push('CRR ' + crr);
    if (rrr != null && rrr !== '') bits.push('RRR ' + rrr);
    if (score.target != null && score.target !== '') bits.push('Target ' + score.target);
    if (score.requiredRuns != null && score.requiredRuns !== '') bits.push('Need ' + score.requiredRuns + (score.requiredBalls ? ' from ' + score.requiredBalls + ' balls' : ''));
    score.subText = bits.join(' · ');
    return score;
}

// ============================================================================
// SCORECARD NORMALIZER
// PART 1.4
// ============================================================================

function normalizeScorecard() {
    const innings = extractInnings(REAL_DATA.scorecard);
    const ordinal = n => n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : n + 'th';
    const isTest = /test/i.test(safeString(getMatchData()?.matchType || getMatchData()?.matchformat || getMatchData()?.format || FORMAT_PARAM)) || innings.length > 2;

    // Cricbuzz scorecard-v2 commonly returns each innings as:
    // { batTeamDetails:{ batsmenData:[] }, bowlTeamDetails:{ bowlersData:[] },
    //   scoreDetails:{runs,wickets,overs,runRate,...}, wicketsData:[], ... }
    // Older/alternate providers use flat batsman/bowler arrays. Support both.
    const batDetails = inn => inn?.batTeamDetails || inn?.batteamdetails || inn?.batTeam || inn?.batteam || {};
    const bowlDetails = inn => inn?.bowlTeamDetails || inn?.bowlteamdetails || inn?.bowlTeam || inn?.bowlteam || {};
    const scoreDetails = inn => inn?.scoreDetails || inn?.scoredetails || inn?.scoreDetail || inn?.score || {};
    const batRawFor = inn => {
      const d = batDetails(inn);
      const arr = d?.batsmenData || d?.batsmanData || d?.batsmen || d?.batter || d?.batters;
      return Array.isArray(arr) ? arr : safeArray(inn?.batsman || inn?.batsmen || inn?.batting || inn?.bat);
    };
    const bowlRawFor = inn => {
      const d = bowlDetails(inn);
      const arr = d?.bowlersData || d?.bowlerData || d?.bowlers || d?.bowler;
      return Array.isArray(arr) ? arr : safeArray(inn?.bowler || inn?.bowlers || inn?.bowling || inn?.bowl);
    };
    const nameFromTeam = (value) => safeLabel(
      value?.batTeamName || value?.batteamname || value?.teamname || value?.teamName ||
      value?.name || value?.shortName || value?.batTeamShortName || value?.batteamshortname
    );

    const teamFromInn = (inn, index) => {
      const sd = scoreDetails(inn);
      const bd = batDetails(inn);
      const name = nameFromTeam(sd) || nameFromTeam(bd) ||
        safeLabel(inn?.batteamname || inn?.teamname || inn?.team_name || inn?.batteam);
      const code = safeLabel(
        sd?.batTeamShortName || sd?.batteamshortname || bd?.batTeamShortName ||
        bd?.batteamshortname || inn?.batteamshortname || inn?.batteamcode ||
        inn?.teamshortname || inn?.batteamsname
      ).toLowerCase();
      const home = [HOME_T.name, HOME_CODE, HOME].filter(Boolean).some(v =>
        String(v).toLowerCase() === name.toLowerCase() || String(v).toLowerCase() === code
      );
      const away = [AWAY_T.name, AWAY_CODE, AWAY].filter(Boolean).some(v =>
        String(v).toLowerCase() === name.toLowerCase() || String(v).toLowerCase() === code
      );
      if (home) return { ...HOME_T, name: name || HOME_T.name, code: code || HOME_T.code };
      if (away) return { ...AWAY_T, name: name || AWAY_T.name, code: code || AWAY_T.code };
      if (index === 0 && name) return { ...HOME_T, name, code: code || HOME_T.code };
      if (index === 1 && name) return { ...AWAY_T, name, code: code || AWAY_T.code };
      return { ...HOME_T, name: name || 'Unknown team', code: code || '' };
    };

    const numberOrBlank = v => (v == null || v === '' ? '' : safeNumber(v));
    const firstNonEmpty = (...vals) => vals.find(v => v != null && v !== '') ?? '';

    return {
      type: 'cricket',
      innings: innings.map((inn, index) => {
        const sd = scoreDetails(inn);
        const bd = batDetails(inn);
        const rawScore = safeString(
          typeof inn?.score === 'string' ? inn.score :
          firstNonEmpty(sd?.score, sd?.scoreString, '')
        );
        const scoreParts = rawScore.match(/^(\d+)\s*\/\s*(\d+)/);
        const total = scoreParts ? scoreParts[1] : firstNonEmpty(
          sd?.runs, sd?.score, inn?.runs, inn?.total, rawScore
        );
        const wkts = scoreParts ? scoreParts[2] : firstNonEmpty(
          sd?.wickets, sd?.wkts, inn?.wickets, inn?.wkts, ''
        );

        const batRaw = batRawFor(inn);
        const bowlRaw = bowlRawFor(inn);

        const bat = batRaw.map(p => {
          const dismissal = firstNonEmpty(
            p?.outDesc, p?.outdesc, p?.outdec, p?.dismissal, p?.out, p?.batStatus, ''
          );
          const status = safeString(p?.batStatus || p?.status || '').toLowerCase();
          const out = !!safeString(dismissal) &&
            !/not\s*out|batting|yet\s*to\s*bat|did\s*not\s*bat|retired\s*hurt/i.test(status + ' ' + safeString(dismissal));
          return {
            n: safeLabel(p?.batName || p?.name || p?.batsmanName || p?.playerName || p?.player),
            r: numberOrBlank(firstNonEmpty(p?.batRuns, p?.runs, p?.r)),
            b: numberOrBlank(firstNonEmpty(p?.batBalls, p?.balls, p?.b)),
            f: numberOrBlank(firstNonEmpty(p?.batFours, p?.fours, p?.f)),
            sx: numberOrBlank(firstNonEmpty(p?.batSixes, p?.sixes, p?.sx)),
            sr: safeString(firstNonEmpty(p?.batStrikeRate, p?.strkrate, p?.strikerate, p?.sr, '')),
            isStriker: !!(p?.isStriker || p?.striker || p?.isOnStrike || p?.onStrike || p?.batIsStriker),
            out,
            dismissal: safeString(dismissal)
          };
        }).filter(p => p.n);

        const bowl = bowlRaw.map(p => ({
          n: safeLabel(p?.bowlName || p?.name || p?.bowlerName || p?.playerName || p?.player),
          o: safeString(firstNonEmpty(p?.bowlOvs, p?.overs, p?.o, '')),
          m: numberOrBlank(firstNonEmpty(p?.bowlMaidens, p?.maidens, p?.m)),
          r: numberOrBlank(firstNonEmpty(p?.bowlRuns, p?.runs, p?.r)),
          w: numberOrBlank(firstNonEmpty(p?.bowlWkts, p?.wickets, p?.w)),
          econ: safeString(firstNonEmpty(p?.bowlEcon, p?.economy, p?.econ, '')),
          isCurrent: !!(p?.isCurrent || p?.current || p?.isCurrentBowler || p?.isBowler)
        })).filter(p => p.n);

        const extrasRaw = inn?.extras || inn?.extra || inn?.extrasData || {};
        const fowRaw = inn?.fallOfWickets || inn?.fallofwickets || inn?.fow ||
          inn?.fall_of_wickets || inn?.wicketsData || [];
        const partnershipRaw = inn?.partnerships || inn?.partnership ||
          sd?.partnership || sd?.partnerships || inn?.partnershipData || [];
        const partnerships = Array.isArray(partnershipRaw) ? partnershipRaw : Object.values(partnershipRaw || {});
        const fow = Array.isArray(fowRaw) ? fowRaw : Object.values(fowRaw || {});
        const declared = !!(inn?.declared || inn?.isDeclared || sd?.declared || /\bd\b/i.test(rawScore));
        const followOn = !!(inn?.followon || inn?.followOn || inn?.isFollowOn || inn?.follow_on);

        const team = teamFromInn(inn, index);
        const side = teamForInnings(inn);
        const inningsNumber = isTest ? testInningsNumber(innings, index, side) : index + 1;
        const shortLabel = isTest
          ? shortTestTeamLabel(team, firstNonEmpty(sd?.batTeamShortName, bd?.batTeamShortName, inn?.batteamshortname, inn?.batteamname)) +
            ' (' + (inningsNumber === 1 ? '1st' : '2nd') + ' Inn)'
          : (team.name || '') + ' ' + ordinal(index + 1) + ' Innings';

        const currentFlag = !!(
          inn?.iscurrentinnings || inn?.isCurrent || inn?.current || inn?.currentinnings ||
          sd?.isCurrentInnings || sd?.isCurrent || sd?.current || sd?.currentInnings
        );

        return {
          id: inn?.inningsid ?? inn?.inningsId ?? inn?.iid ?? sd?.inningsId ?? index + 1,
          inningsNumber,
          isTest,
          shortLabel,
          label: shortLabel + (followOn && isTest ? ' · FOLLOW-ON' : ''),
          isCurrent: currentFlag,
          team,
          total: safeString(total),
          wkts: safeString(wkts),
          ov: safeString(firstNonEmpty(sd?.overs, sd?.ov, inn?.overs, inn?.ov, '')),
          crr: safeString(firstNonEmpty(sd?.runRate, sd?.runrate, sd?.crr, inn?.runrate, inn?.crr, inn?.currentRunRate, '')),
          declared,
          target: safeString(firstNonEmpty(sd?.target, inn?.target, inn?.targetscore, '')),
          revisedTarget: safeString(firstNonEmpty(sd?.revisedTarget, sd?.revisedtarget, inn?.revisedTarget, inn?.revisedtarget, '')),
          lead: safeString(firstNonEmpty(sd?.lead, inn?.lead, '')),
          trail: safeString(firstNonEmpty(sd?.trail, inn?.trail, '')),
          followOn,
          powerplays: Array.isArray(inn?.powerplays || inn?.powerplay) ? (inn.powerplays || inn.powerplay) : [],
          extras: extrasRaw && typeof extrasRaw === 'object' ? extrasRaw : {},
          fow: fow.map(x => ({
            wicket: safeString(firstNonEmpty(x?.wicketNum, x?.wicket, x?.wicketNo, x?.number, '')),
            score: safeString(firstNonEmpty(x?.wktRuns, x?.score, x?.runs, '')),
            player: safeLabel(x?.wktName || x?.wicketName || x?.player || x?.batsman || x?.name),
            over: safeString(firstNonEmpty(x?.wktOver, x?.over, x?.overs, x?.overNumber, '')),
            dismissal: safeString(firstNonEmpty(x?.wktDesc, x?.dismissal, x?.outDesc, x?.outdesc, ''))
          })).filter(x => x.player || x.score || x.over),
          partnerships: partnerships.map(x => ({
            player1: safeLabel(firstNonEmpty(x?.player1, x?.batsman1, x?.batter1, x?.name1, x?.p1, x?.bat1, '')),
            player2: safeLabel(firstNonEmpty(x?.player2, x?.batsman2, x?.batter2, x?.name2, x?.p2, x?.bat2, '')),
            runs: numberOrBlank(firstNonEmpty(x?.runs, x?.score, x?.stand, x?.partnershipRuns, x?.partnership, '')),
            balls: numberOrBlank(firstNonEmpty(x?.balls, x?.deliveries, x?.partnershipBalls, '')),
            out: safeLabel(firstNonEmpty(x?.dismissed, x?.outBatsman, x?.outPlayer, x?.out, ''))
          })).filter(x => x.player1 || x.player2 || x.runs !== ''),
          bat, bowl,
          rawCurrent: inn
        };
      })
    };
}

// ============================================================================
// COMMENTARY NORMALIZER
// PART 2.4
// ============================================================================

function normalizeCommentary() {
    const unwrap = raw => {
      const x = raw?.data || raw || {};
      if (Array.isArray(x)) return x.flatMap(v => unwrap(v));
      const arr = x.comwrapper || x.commentary || x.comments || x.items || x.balls || x.ballByBall || x.data || [];
      return Array.isArray(arr) ? arr : [];
    };
    const mapOne = item => {
      const c = item?.commentary || item?.comment || item || {};
      const text = safeString(c.commtxt || c.commentary || c.comment || c.text || c.desc || c.description || '');
      if (!text) return null;
      const event = safeString(c.eventtype || c.eventType || c.type || '').toUpperCase();
      const low = text.toLowerCase();
      let type = 'normal', badge = '•', runs = 0;
      const numericRun = Number(firstNonEmpty(
        c.runs, c.run, c.totalRuns, c.totalruns, c.batsmanRuns, c.batterRuns, c.r
      ));
      if (event.includes('WICKET') || /\bwicket\b|\bout\b/.test(low)) {
        type = 'wicket'; badge = 'W'; runs = Number.isFinite(numericRun) ? numericRun : 0;
      } else if (event.includes('SIX') || /\bsix\b/.test(low)) {
        type = 'six'; badge = '6'; runs = 6;
      } else if (event.includes('FOUR') || /\bfour\b|boundary/.test(low)) {
        type = 'four'; badge = '4'; runs = 4;
      } else if (/\bfifty\b|\bcentury\b|milestone/.test(low)) {
        type = 'milestone'; badge = '★'; runs = Number.isFinite(numericRun) ? numericRun : 0;
      } else if (/\bwide\b/.test(low)) {
        type = 'wide'; badge = 'Wd'; runs = Number.isFinite(numericRun) ? numericRun : 1;
      } else if (/\bno[- ]?ball\b/.test(low)) {
        type = 'noball'; badge = 'Nb'; runs = Number.isFinite(numericRun) ? numericRun : 1;
      } else {
        // Cricbuzz commentary text commonly contains "1 run", "2 runs", etc.
        const m = low.match(/(?:^|\s)(\d+)\s+runs?\b/);
        runs = Number.isFinite(numericRun) ? numericRun : (m ? Number(m[1]) : 0);
        badge = runs > 0 ? String(runs) : '•';
      }
      const ts = c.timestamp ?? c.time ?? c.pubTime ?? c.pubtime;
      return {
        over: safeString(c.overnum ?? c.overNumber ?? c.over ?? c.ball ?? ''),
        type, runs, badge, text,
        striker: safeString(c.batsmanName || c.strikerName || c.striker || c.batsman || c.batter || ''),
        nonstriker: safeString(c.nonStrikerName || c.nonstriker || c.nonStriker || ''),
        bowler: safeString(c.bowlerName || c.bowler || ''),
        newBatsman: safeString(c.newBatsmanName || c.newBatsman || c.new_batsman || ''),
        time: ts ? formatCommentaryTime(ts) : '',
        timestamp: Number(ts) || 0,
        inningsId: Number(c.inningsid ?? c.inningsId ?? c.iid ?? 0) || 0
      };
    };
    const all = [...unwrap(REAL_DATA.historicalCommentary), ...unwrap(REAL_DATA.commentary)].map(mapOne).filter(Boolean);
    const seen = new Set();
    const deduped = all.filter(x => {
      const key = [x.inningsId, x.over, x.text, x.timestamp].join('|');
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
    // Provider commentary is not guaranteed to contain timestamps, and some feeds
    // return balls newest-first. Sorting only by timestamp (0/0) can therefore make
    // an OLDER ball become the "latest" item. That directly affects current bowler.
    const overBallKey = item => {
      const raw = safeString(item?.over || '').trim();
      const m = raw.match(/(\d+)\s*[.:-]\s*(\d+)/);
      if (m) return Number(m[1]) * 1000 + Number(m[2]);
      const n = Number(raw);
      return Number.isFinite(n) ? n * 1000 : -1;
    };
    deduped.sort((a, b) => {
      const at = Number(a?.timestamp) || 0;
      const bt = Number(b?.timestamp) || 0;
      if (at > 0 && bt > 0 && at !== bt) return at - bt;
      const ao = overBallKey(a), bo = overBallKey(b);
      if (ao !== bo) return ao - bo;
      return 0;
    });
    return deduped;
}

function formatCommentaryTime(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return safeString(value);
    const ms = String(Math.trunc(n)).length <= 10 ? n * 1000 : n;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? safeString(value) : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

// ============================================================================
// SQUADS NORMALIZER
// PART 2.5
// ============================================================================

function normalizeSquads() {
    const squadsRaw = REAL_DATA.squads?.data || REAL_DATA.squads || {};
    const home = squadsRaw.team1 || squadsRaw.home;
    const away = squadsRaw.team2 || squadsRaw.away;
    if (!home || !away) return null;

    const playersFor = team => {
      const raw = team.players;
      if (!Array.isArray(raw)) return [];
      const direct = [];
      raw.forEach(group => {
        const groupCategory = safeString(group?.category || group?.type || '').toLowerCase();
        if (Array.isArray(group?.player)) {
          group.player.forEach(player => direct.push({ ...player, __category: groupCategory }));
        } else if (group?.name || group?.playerName) {
          direct.push({ ...group, __category: groupCategory });
        }
      });
      return direct;
    };

    const make = team => {
      const all = playersFor(team);
      const staff = all.filter(p => /support\s*staff|staff|coach|manager|physio|trainer/i.test(safeString(p.__category) + ' ' + safeString(p.role || p.playingRole)));
      const players = all.filter(p => !staff.includes(p));
      const toPlayer = p => ({
        id: safeString(p.id || p.playerId || p.playerid || p.profile?.id || ''),
        n: safeString(p.name || p.playerName),
        r: safeString(p.role || p.playingRole) || 'Player',
        c: !!(p.captain || p.isCaptain),
        wk: !!(p.keeper || p.isKeeper || p.wicketkeeper)
      });
      return {
        xi: players.slice(0, 11).map(toPlayer).filter(p => p.n),
        bench: players.slice(11).map(toPlayer).filter(p => p.n),
        staff: staff.map(p => ({
          id: safeString(p.id || p.playerId || p.playerid || p.profile?.id || ''),
          n: safeString(p.name || p.playerName),
          r: safeString(p.role || p.playingRole) || 'Support Staff'
        })).filter(p => p.n)
      };
    };

    return { home: make(home), away: make(away) };
}

// ============================================================================
// GRAPH NORMALIZER
// PART 2.6
// ============================================================================

function graphRawCandidates(raw) {
    if (raw == null) return [];
    const out = [];
    const walk = (x, depth = 0, iidHint = null) => {
      if (x == null || depth > 8) return;
      if (Array.isArray(x)) {
        x.forEach(v => walk(v, depth + 1, iidHint));
        return;
      }
      if (typeof x !== 'object') return;

      const iid = Number(x?.iid ?? x?.inningsid ?? x?.inningsId ?? x?.inningsID ?? iidHint);
      const nextIid = Number.isFinite(iid) ? iid : iidHint;

      // Keep objects that look like an over / ball / graph point.
      const looksPoint =
        x.over != null || x.overNumber != null || x.overnum != null ||
        x.ball != null || x.ballNumber != null ||
        x.runs != null || x.totalRuns != null || x.score != null ||
        x.runrate != null || x.runRate != null ||
        x.winProbability != null || x.winprobability != null ||
        x.winProb != null || x.winprob != null ||
        x.partnership != null || x.stand != null;

      if (looksPoint) out.push({ ...x, __graphIid: nextIid });

      Object.entries(x).forEach(([k, v]) => {
        if (v == null || v === x) return;
        const key = String(k).toLowerCase();
        if ([
          'data','innings','inning','overs','over','balls','ballbyball','ballbyballcommentary',
          'items','list','graph','graphs','points','winprobability','winprobabilities',
          'partnership','partnerships','score','scores','response','result'
        ].some(token => key.includes(token))) {
          walk(v, depth + 1, nextIid);
        }
      });
    };
    walk(raw);
    return out;
}

function extractGraphIid(obj, fallback = 1) {
    const iid = Number(obj?.__graphIid ?? obj?.iid ?? obj?.inningsid ?? obj?.inningsId ?? obj?.inningsID);
    return Number.isFinite(iid) && iid > 0 ? iid : fallback;
}

function normalizeOvers() {
    const sources = [];
    const add = (value, iidHint = null) => {
      if (value == null) return;
      sources.push({ value, iidHint });
    };

    add(REAL_DATA.overs);
    add(REAL_DATA.oversGraph);

    const overs = [];
    sources.forEach(source => {
      graphRawCandidates(source.value).forEach((o, i) => {
        const iid = extractGraphIid(o, source.iidHint || 1);
        const over = Number(o?.over ?? o?.overNumber ?? o?.overnum ?? o?.overNo ?? o?.over_no);
        const runsRaw = o?.runs ?? o?.totalRuns ?? o?.r;
        const runs = Number(
          runsRaw && typeof runsRaw === 'object'
            ? (runsRaw.total ?? runsRaw.totalRuns ?? runsRaw.runs ?? runsRaw.batter ?? 0)
            : runsRaw
        );
        if (!Number.isFinite(over) || !Number.isFinite(runs)) return;

        const wickets = Number(o?.wickets ?? o?.wkts ?? o?.wicket ?? 0);
        const score = safeString(o?.score ?? o?.totalScore ?? '');
        const suppliedTotalRaw = o?.total ?? o?.totalScore ?? o?.cumulativeRuns ?? o?.cumulative ?? (score.match(/^\s*(\d+)/)?.[1]);
        const suppliedTotal = Number(suppliedTotalRaw);
        const rate = Number(o?.rate ?? o?.runrate ?? o?.runRate ?? o?.run_rate);

        overs.push({
          iid, over, runs,
          wickets: Number.isFinite(wickets) ? wickets : 0,
          score,
          total: Number.isFinite(suppliedTotal) ? suppliedTotal : null,
          rate: Number.isFinite(rate) ? rate : null
        });
      });
    });

    // De-duplicate the same over coming from /overs and /oversGraph.
    const unique = new Map();
    overs.forEach(o => unique.set(`${o.iid}:${o.over}`, o));
    return [...unique.values()].sort((a,b) => a.iid - b.iid || a.over - b.over);
}

function normalizeWinProbability(raw) {
    const points = graphRawCandidates(raw);
    return points.map((o, i) => {
      const over = Number(o?.over ?? o?.overNumber ?? o?.overnum ?? o?.ball ?? o?.ballNumber ?? i + 1);
      const iid = extractGraphIid(o, 1);
      let home = o?.home ?? o?.homeWin ?? o?.homeWinProbability ?? o?.team1 ?? o?.team1Win ?? o?.team1WinProbability;
      let away = o?.away ?? o?.awayWin ?? o?.awayWinProbability ?? o?.team2 ?? o?.team2Win ?? o?.team2WinProbability;
      const wp = o?.winProbability ?? o?.winprobability ?? o?.winProb ?? o?.winprob;

      if (wp && typeof wp === 'object') {
        home = home ?? wp.home ?? wp.team1 ?? wp.team1Win ?? wp.homeWin;
        away = away ?? wp.away ?? wp.team2 ?? wp.team2Win ?? wp.awayWin;
      } else if (wp != null && home == null && away == null) {
        // A scalar is only useful when the API explicitly labels it as a team probability.
        home = wp;
      }

      const h = Number(home), a = Number(away);
      if (!Number.isFinite(over) || (!Number.isFinite(h) && !Number.isFinite(a))) return null;
      return {
        iid,
        over,
        home: Number.isFinite(h) ? h : null,
        away: Number.isFinite(a) ? a : null
      };
    }).filter(Boolean);
}

function normalizeRealOversGraph(overs) {
    const groups = new Map();
    safeArray(overs).forEach(o => {
      const iid = Number(o?.iid || 1);
      if (!groups.has(iid)) groups.set(iid, []);
      groups.get(iid).push(o);
    });

    const innings = [...groups.entries()].sort((a,b)=>a[0]-b[0]).map(([iid, list]) => {
      const wagon = [], runrate = [];
      list.sort((a,b)=>Number(a.over)-Number(b.over)).forEach(o => {
        const over = Number(o.over);
        const runs = Number(o.runs);
        const total = Number(o.total);
        const rr = Number(o.rate);
        wagon.push({ over, runs, total: Number.isFinite(total) ? total : null });
        runrate.push({ over, rr: Number.isFinite(rr) ? rr : null });
      });
      return { iid, overs: list, wagon, runrate, partnership: [], winProbability: [] };
    });

    return {
      wagon: innings[0]?.wagon || [],
      runrate: innings[0]?.runrate || [],
      partnership: [],
      innings
    };
}

function normalizeGraphEndpoint(raw) {
    return graphRawCandidates(raw);
}

function normalizePartnershipGraph(raw) {
    return normalizeGraphEndpoint(raw).map((o, i) => {
      const iid = extractGraphIid(o, 1);
      const over = Number(o?.over ?? o?.overNumber ?? o?.overnum ?? i + 1);
      const stand = Number(o?.partnership ?? o?.stand ?? o?.runs ?? o?.score);
      return Number.isFinite(over) && Number.isFinite(stand) ? { iid, over, stand } : null;
    }).filter(Boolean);
}

// ============================================================================
// HIGHLIGHTS NORMALIZER
// PART 2.7
// ============================================================================

function normalizeHighlights() {
    const raw = REAL_DATA.highlights?.data || REAL_DATA.highlights || {};
    const list = Array.isArray(raw) ? raw : safeArray(raw.storyList || raw.highlights || raw.items || raw.data);
    return list.map(item => ({

        title:

            safeString(
                item.title
            ),

        text:

            safeString(
                item.text
            ),

        image:

            safeString(
                item.image
            ),

        time:

            safeString(
                item.time
            ),

        type:

            safeString(
                item.type
            ) || "news"

    }));

}

// Minimal compatibility normalizers: the renderer already builds the
// detailed match/summary models elsewhere. These keep the backend pipeline
// from throwing ReferenceError when those optional normalizers are absent.
function normalizeMatchInfo(data) {
    return (data && typeof data === 'object' && !Array.isArray(data)) ? data : {};
}

function normalizeSummary(data) {
    return {};
}

function flattenGraphBalls(raw, iidHint = null) {
  const out = [];
  const walk = (x, depth = 0, hint = iidHint) => {
    if (x == null || depth > 8) return;
    if (Array.isArray(x)) { x.forEach(v => walk(v, depth + 1, hint)); return; }
    if (typeof x !== 'object') return;

    const ownIid = Number(x?.iid ?? x?.inningsId ?? x?.inningsid ?? x?.inningsID);
    const nextIid = Number.isFinite(ownIid) ? ownIid : hint;
    const looksBall =
      x.over != null || x.overNumber != null || x.overnum != null ||
      x.ball != null || x.ballNumber != null ||
      x.runs != null || x.totalRuns != null || x.batterRuns != null;

    if (looksBall) out.push({ ...x, __iid: nextIid });

    Object.entries(x).forEach(([k,v]) => {
      if (v == null || v === x) return;
      const key = String(k).toLowerCase();
      if (['data','innings','inning','overs','over','balls','ballbyball','commentary','items','list','response'].some(t => key.includes(t))) {
        walk(v, depth + 1, nextIid);
      }
    });
  };
  walk(raw, 0, iidHint);
  return out;
}

function normalizeBallsGraphInnings(raw) {
  const groups = new Map();
  const sources = Array.isArray(raw) ? raw : (raw ? [raw] : []);

  sources.forEach((source, sourceIndex) => {
    const sourceIid = Number(source?.iid ?? source?.inningsId ?? source?.inningsid ?? sourceIndex + 1);
    const iidHint = Number.isFinite(sourceIid) ? sourceIid : sourceIndex + 1;
    const payload = source?.value ?? source;
    const balls = flattenGraphBalls(payload, iidHint);

    balls.forEach(b => {
      const iid = Number(b?.__iid ?? iidHint);
      const key = Number.isFinite(iid) ? iid : iidHint;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(b);
    });
  });

  return [...groups.entries()].map(([iid, balls]) => {
    const byOver = new Map();
    balls.forEach((b, idx) => {
      let ov = Number(b?.overNumber ?? b?.over ?? b?.overnum ?? b?.overNo ?? b?.over_no);
      if (!Number.isFinite(ov)) {
        const ballNo = Number(b?.ballNumber ?? b?.ball);
        ov = Number.isFinite(ballNo) ? Math.floor(ballNo / 6) + 1 : Math.floor(idx / 6) + 1;
      }
      if (!Number.isInteger(ov)) ov = Math.floor(ov) + 1;

      const ro = b?.runs;
      const runs = Number(
        b?.totalRuns ?? b?.score ?? b?.r ?? b?.batterRuns ??
        (ro && typeof ro === 'object' ? (ro.total ?? ro.totalRuns ?? ro.runs ?? ro.batter ?? 0) : ro)
      );
      const safeRuns = Number.isFinite(runs) ? runs : 0;
      byOver.set(ov, (byOver.get(ov) || 0) + safeRuns);
    });

    return {
      iid,
      overs: [...byOver.entries()]
        .sort((a,b)=>a[0]-b[0])
        .map(([over,runs]) => ({ iid, over, runs, rate: null }))
    };
  }).filter(g => g.overs.length);
}

function normalizeBackendData() {

    const data = getMatchData();

    const scorecardRaw = REAL_DATA.scorecard?.data || REAL_DATA.scorecard || {};
    const innings = safeArray(scorecardRaw.scorecard || scorecardRaw.innings || scorecardRaw);

const header =
    normalizeHeader(
        data,
        innings
    );

const scorecard = normalizeScorecard();
    let overs = normalizeOvers();
    const ballInnings = normalizeBallsGraphInnings(REAL_DATA.ballsGraph);
    if (!overs.length && ballInnings.length) {
      overs = ballInnings.flatMap(g => g.overs);
    } else if (ballInnings.length) {
      const existingIids = new Set(overs.map(o => Number(o.iid)));
      ballInnings.forEach(g => { if (!existingIids.has(Number(g.iid))) overs.push(...g.overs); });
    }
    const baseGraph = normalizeRealOversGraph(overs);
    const balls = normalizeGraphEndpoint(REAL_DATA.ballsGraph);
    const partnerships = normalizePartnershipGraph(REAL_DATA.partnershipGraph);
    const winProbability = normalizeWinProbability([
      REAL_DATA.match,
      REAL_DATA.scorecard,
      REAL_DATA.oversGraph,
      REAL_DATA.ballsGraph,
      REAL_DATA.partnershipGraph
    ]);

    const graphInnings = baseGraph.innings.map(g => ({
      ...g,
      partnership: partnerships.filter(p => Number(p.iid) === Number(g.iid)),
      winProbability: winProbability.filter(p => Number(p.iid) === Number(g.iid))
    }));

    // If the API's graph endpoint contains win-probability points but /overs did
    // not carry an innings entry, keep that real innings visible as a graph tab.
    winProbability.forEach(w => {
      if (!graphInnings.some(g => Number(g.iid) === Number(w.iid))) {
        graphInnings.push({
          iid: Number(w.iid),
          overs: [],
          wagon: [],
          runrate: [],
          partnership: partnerships.filter(p => Number(p.iid) === Number(w.iid)),
          winProbability: winProbability.filter(p => Number(p.iid) === Number(w.iid))
        });
      }
    });
    graphInnings.sort((a,b)=>Number(a.iid)-Number(b.iid));

    return {
      header,
      match: normalizeMatchInfo(data),
      score: normalizeScore(data, header),
      summary: normalizeSummary(data),
      scorecard,
      commentary: normalizeCommentary(),
      squads: normalizeSquads(),
      overs,
      highlights: normalizeHighlights(),
      graph: {
        ...baseGraph,
        partnership: partnerships.length ? partnerships : baseGraph.partnership,
        winProbability,
        balls,
        innings: graphInnings
      }
    };
}

  
// ============================================================================
// APPLY NORMALIZED MODEL
// PART 2.1
// ============================================================================

function applyNormalizedModel(model) {

    if (!model) return;

    // ------------------------------------------------
    // SCORE
    // ------------------------------------------------

    if (model.score) {

        M.score.status =
            model.score.status;

        M.score.resultText =
            model.score.resultText;

        M.score.subText = model.score.subText;
        M.score.current = model.score.current;
        M.score.currentRunRate = model.score.currentRunRate;
        M.score.requiredRunRate = model.score.requiredRunRate;
        M.score.target = model.score.target;
        M.score.requiredRuns = model.score.requiredRuns;
        M.score.requiredBalls = model.score.requiredBalls;
        M.score.day = model.score.day;
        M.score.session = model.score.session;
        M.score.playState = model.score.playState;
        M.score.currentOvers = safeString(model.score.current?.overs ?? model.score.current?.ov ?? '');

        Object.assign(
            M.score.home,
            model.score.home
        );

        Object.assign(
            M.score.away,
            model.score.away
        );

    }

    // ------------------------------------------------
    // SUMMARY
    // ------------------------------------------------

    if (model.summary) {
      M.summary = { ...M.summary, ...model.summary };
    }
    if (model.header) {
      M.meta.day = model.header.day || '';
      M.meta.session = model.header.session || '';
      M.meta.playState = model.header.playState || '';
    }

    // ------------------------------------------------
    // SCORECARD
    // ------------------------------------------------

   if (

    model.scorecard &&

    model.scorecard.innings?.length

){

    M.scorecard =

        model.scorecard;

}

    // ------------------------------------------------
    // COMMENTARY
    // ------------------------------------------------

   if (Array.isArray(model.commentary)) {
    M.comm = {
      items: model.commentary,
      label: 'Ball-by-Ball Commentary'
    };
}

    // ------------------------------------------------
    // SQUADS
    // ------------------------------------------------

   if (model.squads) {
    M.squads = model.squads;
    M.players = {
      home: (M.squads.home?.xi || []).map(p => p.n),
      away: (M.squads.away?.xi || []).map(p => p.n)
    };
}

    // ------------------------------------------------
    // GRAPH
    // ------------------------------------------------
if (Array.isArray(model.overs) && model.overs.length) {
    const graph = model.graph || normalizeRealOversGraph(model.overs);
    M.graph = { ...M.graph, ...graph, xMax: M.graph.xMax };
}

    // ------------------------------------------------
    // HIGHLIGHTS
    // ------------------------------------------------

    if (

    model.highlights?.length

){

    M.news =

        model.highlights;

}

}


  // ============================================================================
  // APPLY BACKEND DATA TO MATCH MODEL
  // ============================================================================

  function applyBackendMatchData() {

    /*if (!REAL_DATA.match) return;

    const data =
      REAL_DATA.match.data ||
      REAL_DATA.match.match ||
      REAL_DATA.match;

    if (!data) return;

    */
    
   
   

  }


  // ============================================================================
  // HERO / SCORE HEADER — REAL BACKEND DATA ONLY
  // ============================================================================

  function parseDateValue(value) {
    if (value == null || value === "") return null;
    if (typeof value === 'string' && /[A-Za-z-]/.test(value) && Number.isNaN(Number(value))) {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    const ms = String(Math.trunc(n)).length <= 10 ? n * 1000 : n;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function formatStartTime(value) {
    const d = parseDateValue(value);
    if (!d) return "";
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  function formatStartDate(value) {
    const d = parseDateValue(value);
    if (!d) return "";
    return formatDate(d.toISOString().slice(0, 10));
  }

  function displayFormatLabel(value) {
    const f = safeString(value).toUpperCase();
    if (f.indexOf("TEST") >= 0) return "Test";
    if (f.indexOf("ODI") >= 0 || f.indexOf("ONE DAY") >= 0 || f === "50") return "ODI";
    if (f.indexOf("T20") >= 0 || f.indexOf("TWENTY") >= 0) return "T20I";
    return safeString(value) || SC.label;
  }

  function computeTestContext(innings, currentTeamName = '') {
    const totals = {};
    innings.forEach(inn => {
      const team = safeLabel(inn?.batteamname || inn?.teamname || inn?.team_name || '');
      const runs = Number.parseInt(safeString(inn?.score || inn?.runs || '').split('/')[0], 10);
      if (team && Number.isFinite(runs)) {
        if (!totals[team]) totals[team] = [];
        totals[team].push(runs);
      }
    });
    const teams = Object.keys(totals);
    if (teams.length !== 2) return '';
    const sum = t => totals[t].reduce((a,b) => a+b, 0);
    const current = teams.find(t => t.toLowerCase() === String(currentTeamName).toLowerCase()) || currentTeamName;
    if (!current || !totals[current]) return '';
    const other = teams.find(t => t !== current);
    const diff = sum(current) - sum(other);
    if (diff > 0) return current + ' lead by ' + diff + ' runs';
    if (diff < 0) return current + ' trail by ' + Math.abs(diff) + ' runs';
    return 'Scores level';
  }

  function extractOfficials(data, extraSources = []) {
    const found = [], seen = new Set();
    const addName = value => {
      if (value == null) return;
      if (Array.isArray(value)) { value.forEach(addName); return; }
      if (typeof value === 'object') {
        const name = safeLabel(value.name || value.officialName || value.umpireName || value.displayName || value.text || value.label);
        if (name && !seen.has(name)) { seen.add(name); found.push(name); }
      } else {
        const name = safeString(value).trim();
        if (name && !seen.has(name)) { seen.add(name); found.push(name); }
      }
    };
    const scan = (obj, depth=0) => {
      if (!obj || depth>5) return;
      if (Array.isArray(obj)) { obj.forEach(v=>scan(v,depth+1)); return; }
      if (typeof obj !== 'object') return;
      Object.entries(obj).forEach(([key,value]) => {
        const k=String(key).toLowerCase().replace(/[^a-z]/g,'');
        if (k.includes('umpire') || k.includes('official') || k.includes('referee')) addName(value);
        if (value && typeof value==='object') scan(value,depth+1);
      });
    };
    [data,...extraSources].forEach(scan);
    // Cricbuzz match-info responses commonly expose these fields directly.
    // Keep this explicit fallback because the normalizer may place officials
    // under a single object instead of separate umpire keys.
    [
      data?.umpires, data?.umpire, data?.umpire1, data?.umpire2,
      data?.thirdUmpire, data?.thirdumpire, data?.third_umpire,
      data?.referee, data?.matchReferee,
      data?.officials?.umpires, data?.officials?.umpire1, data?.officials?.umpire2,
      data?.officials?.thirdUmpire, data?.officials?.thirdumpire,
      data?.officials?.referee, data?.officials?.matchReferee
    ].forEach(addName);
    return found.join(' · ');
  }
  function normalizeTeamToken(value) {
    return safeString(value)
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  function teamAliases(team) {
    return [
      team?.name,
      team?.code,
      team?.short,
      team?.teamSName,
      team?.teamsname,
      team?.rankName
    ].map(normalizeTeamToken).filter(Boolean);
  }

  function teamForInnings(inn) {
    const name = normalizeTeamToken(inn?.batteamname || inn?.teamname || inn?.team_name || inn?.batteam);
    const code = normalizeTeamToken(inn?.batteamshortname || inn?.batteamcode || inn?.teamshortname || inn?.batteamsname);
    const tokens = [name, code].filter(Boolean);
    if (tokens.some(t => teamAliases(HOME_T).includes(t))) return 'home';
    if (tokens.some(t => teamAliases(AWAY_T).includes(t))) return 'away';
    return null;
  }

  function scoreTextForInn(inn) {
    if (!inn) return '';
    const raw = safeString(inn.score || inn.runs || '');
    const parts = raw.match(/^(\d+)\s*\/\s*(\d+)/);
    const runs = parts ? parts[1] : safeString(inn.runs ?? raw);
    const wkts = parts ? parts[2] : safeString(inn.wickets ?? inn.wkts ?? '');
    if (!runs) return '';
    return runs + (wkts !== '' ? '/' + wkts : '') + (inn.declared || inn.isDeclared ? ' d' : '');
  }

  function teamInningsTexts(innings) {
    const grouped = { home: [], away: [] };
    innings.forEach(inn => { const side = teamForInnings(inn); const txt = scoreTextForInn(inn); if (side && txt) grouped[side].push(txt); });
    return grouped;
  }

  // Test cricket has two innings per team. Keep team identity attached to the
  // innings number so every Test surface uses the same Cricbuzz-style labels.
  function testInningsNumber(innings, index, side) {
    const effectiveSide = side || (index % 2 === 0 ? 'home' : 'away');
    let count = 0;
    for (let i = 0; i <= index; i++) if (teamForInnings(innings[i]) === effectiveSide) count++;
    if (!count) count = effectiveSide === 'home' ? (index % 2 === 0 ? 1 : 2) : (index % 2 === 1 ? 1 : 2);
    return Math.max(1, count);
  }

  function shortTestTeamLabel(team, fallback) {
    const code = safeLabel(team?.code || team?.teamSName || team?.teamsname || team?.short || '');
    return code ? code.toUpperCase() : safeLabel(team?.name || fallback || '');
  }

  function testInningsLabel(innings, index, team) {
    const side = teamForInnings(innings[index] || {});
    const n = testInningsNumber(innings, index, side);
    const teamObj = team || (side === 'home' ? HOME_T : side === 'away' ? AWAY_T : null);
    return shortTestTeamLabel(teamObj, innings[index]?.batteamshortname || innings[index]?.batteamname) + ' (' + (n === 1 ? '1st' : '2nd') + ' Inn)';
  }

  // Graphs use the normalized scorecard model. In some provider responses the
  // raw innings object does not repeat the team name, even though normalizeScorecard()
  // has already attached the real team object. Use that model team for Test labels;
  // this also keeps follow-on order correct (A 1st, B 1st, B 2nd, A 2nd).
  function modelTeamSide(inn) {
    const team = inn?.team || {};
    const tokens = [
      team?.name, team?.code, team?.teamName, team?.teamSName, team?.teamsname,
      inn?.batteamname, inn?.batteamshortname, inn?.batteamcode, inn?.teamname
    ].map(normalizeTeamToken).filter(Boolean);
    if (tokens.some(t => teamAliases(HOME_T).includes(t))) return 'home';
    if (tokens.some(t => teamAliases(AWAY_T).includes(t))) return 'away';
    return null;
  }

  function testInningsNumberFromModel(scoreInnings, index) {
    const side = modelTeamSide(scoreInnings[index]);
    if (side) {
      let count = 0;
      for (let i = 0; i <= index; i++) if (modelTeamSide(scoreInnings[i]) === side) count++;
      if (count) return Math.min(2, count);
    }
    // Last-resort fallback only when the provider omitted team identity entirely.
    return Math.min(2, Math.floor(index / 2) + 1);
  }

  function testInningsLabelById(scoreInnings, iid) {
    const idx = scoreInnings.findIndex((inn, i) => Number(inn?.id ?? inn?.iid ?? inn?.inningsid ?? i + 1) === Number(iid));
    if (idx < 0) return 'Innings ' + iid;
    const inn = scoreInnings[idx] || {};
    const n = testInningsNumberFromModel(scoreInnings, idx);
    const team = inn.team || {};
    const label = shortTestTeamLabel(team, inn.batteamshortname || inn.batteamname || team.name);
    return label + ' (' + (n === 1 ? '1st' : '2nd') + ' Inn)';
  }

  // Provider-owned result parser. The engine never invents a result, margin,
  // DLS target, reduced-over message or winner from the score itself.
  function resultCandidate(value) {
    const text = safeLabel(value).replace(/\s+/g, ' ').trim();
    return text && text.length <= 500 ? text : '';
  }

  function outcomeTextIsAuthoritative(text) {
    const s = resultCandidate(text);
    return !!s && /(won(?:\s+by)?|lost(?:\s+by)?|match\s+drawn|match\s+tied|no\s+result|abandon(?:ed)?|cancel(?:led|ed)?|postpon(?:ed)?|conced(?:ed)?|super\s+over|dls|duckworth|vjd|revised\s+target|target\s+revised|innings\s*(?:&|and)\s*\d+)/i.test(s);
  }

  function exactProviderResult(sources) {
    // The normalized match endpoint is authoritative and should win over a
    // generic status field. Keep this order deliberately narrow.
    const directKeys = ['result', 'resultText', 'resulttext', 'statusText', 'statusline', 'statusLine', 'outcome', 'status'];
    for (const source of sources) {
      if (!source || typeof source !== 'object') continue;
      for (const key of directKeys) {
        const value = resultCandidate(source[key]);
        if (outcomeTextIsAuthoritative(value)) return value;
      }
    }

    // If the backend wraps match info/header, inspect those known containers.
    for (const source of sources) {
      if (!source || typeof source !== 'object') continue;
      const nested = [source.match, source.matchInfo, source.matchinfo, source.matchHeader, source.matchheader, source.matchheaders, source.outcome, source.result];
      for (const obj of nested) {
        if (!obj || typeof obj !== 'object') continue;
        for (const key of directKeys) {
          const value = resultCandidate(obj[key]);
          if (outcomeTextIsAuthoritative(value)) return value;
        }
      }
    }
    return '';
  }

  function explicitProviderWinner(sources) {
    const keys = ['winner', 'winningTeam', 'winningteam', 'winnerTeam', 'winnerteam'];
    for (const source of sources) {
      if (!source || typeof source !== 'object') continue;
      for (const key of keys) {
        const value = resultCandidate(source[key]);
        if (value) return value;
      }
      const nested = [source.match, source.matchInfo, source.matchinfo, source.matchHeader, source.matchheader, source.matchheaders, source.outcome];
      for (const obj of nested) {
        if (!obj || typeof obj !== 'object') continue;
        for (const key of keys) {
          const value = resultCandidate(obj[key]);
          if (value) return value;
        }
      }
    }
    return '';
  }

  function teamMentioned(text, team) {
    const source = normalizeTeamToken(text);
    if (!source) return false;
    return teamAliases(team).some(alias => source.split(' ').join(' ').includes(alias));
  }

  function teamIsExplicitWinner(text, team) {
    const source = resultCandidate(text).toLowerCase();
    if (!source || !teamMentioned(source, team)) return false;
    const aliases = teamAliases(team);
    return aliases.some(alias => {
      const idx = normalizeTeamToken(source).indexOf(alias);
      if (idx < 0) return false;
      const tail = normalizeTeamToken(source).slice(idx + alias.length, idx + alias.length + 80);
      return /\bwon\b/.test(tail);
    });
  }

  function winnerFromAuthoritativeResult(resultText, explicitWinner) {
    const homeExplicit = explicitWinner && teamMentioned(explicitWinner, HOME_T);
    const awayExplicit = explicitWinner && teamMentioned(explicitWinner, AWAY_T);
    if (homeExplicit !== awayExplicit) return homeExplicit ? 'home' : 'away';

    const homeWon = teamIsExplicitWinner(resultText, HOME_T);
    const awayWon = teamIsExplicitWinner(resultText, AWAY_T);
    if (homeWon !== awayWon) return homeWon ? 'home' : 'away';

    // Provider result text can use "X lost" instead of "Y won". In that case
    // the other team is the winner, but only when the result explicitly names
    // the loser. This is still provider text, not a score calculation.
    const normalized = normalizeTeamToken(resultText);
    const homeLost = teamAliases(HOME_T).some(a => normalized.includes(a + ' lost'));
    const awayLost = teamAliases(AWAY_T).some(a => normalized.includes(a + ' lost'));
    if (homeLost !== awayLost) return homeLost ? 'away' : 'home';
    return '';
  }

  function extractAuthoritativeOutcome(data, rawScorecard) {
    const sources = [data, data?.match, data?.matchInfo, data?.matchHeader, data?.matchheader, data?.matchheaders,
      rawScorecard, rawScorecard?.matchheaders, rawScorecard?.matchHeaders, rawScorecard?.matchheader,
      rawScorecard?.result, rawScorecard?.outcome].filter(Boolean);
    const text = exactProviderResult(sources);
    const explicitWinner = explicitProviderWinner(sources);
    const winnerSide = winnerFromAuthoritativeResult(text, explicitWinner);

    const findDirect = keys => {
      for (const source of sources) {
        if (!source || typeof source !== 'object') continue;
        for (const key of keys) {
          const value = resultCandidate(source[key]);
          if (value) return value;
        }
      }
      return '';
    };

    return {
      text,
      winner: winnerSide === 'home' ? HOME_T.name : winnerSide === 'away' ? AWAY_T.name : '',
      winnerSide,
      method: findDirect(['method', 'resultMethod']),
      reducedOvers: findDirect(['revisedOvers', 'revisedovers', 'reducedOvers', 'reducedovers', 'oversReduced', 'oversreduced']),
      revisedTarget: findDirect(['revisedTarget', 'revisedtarget', 'dlsTarget', 'dlstarget', 'parScore', 'parscore'])
    };
  }

  function extractMatchConditions(data, rawScorecard) {
    const sources = [data, data?.match, data?.matchInfo, data?.matchHeader, data?.matchheaders,
      rawScorecard, rawScorecard?.matchheaders, rawScorecard?.matchHeaders].filter(Boolean);
    const values = [];
    const addKnown = source => {
      if (!source || typeof source !== 'object') return;
      ['rain', 'weather', 'wetOutfield', 'badLight', 'suspension', 'playSuspended', 'delay', 'reducedOvers', 'revisedOvers', 'revisedTarget', 'targetRevised', 'abandonment', 'abandoned', 'cancelled', 'postponed', 'noResult'].forEach(k => {
        const v = resultCandidate(source[k]);
        if (v) values.push(v);
      });
    };
    sources.forEach(addKnown);
    const find = re => values.find(v => re.test(v)) || '';
    return {
      rain: find(/rain|weather|wet\s+outfield|bad\s+light/i),
      reduced: find(/reduced\s+(?:to|from)|overs\s+reduced|revised\s+overs/i),
      target: find(/revised\s+target|target\s+revised|dls\s+target|par\s+score/i),
      suspension: find(/rain\s+delay|play\s+suspended|bad\s+light|light\s+stoppage|delayed/i),
      abandonment: find(/abandon|no\s+result|cancel|postpon/i)
    };
  }

  function applyHeroBackendData() {
    const data = getMatchData();
    if (!data || !Object.keys(data).length) { setUnavailableModel('Real match data is not available'); return; }
    const innings = extractInnings(REAL_DATA.scorecard);
    const header = normalizeHeader(data, innings);
    const state = header.status;
    M.state = state;
    M.score.status = state;

    const start = data.startTime || data.starttime || data.startdate || data.startDate || data.matchstarttimestamp;
    const startDate = formatStartDate(start), startTime = formatStartTime(start);
    const format = data.matchType || data.matchtype || data.matchformat || data.format || FORMAT_PARAM || '';
    M.meta.format = displayFormatLabel(format);
    M.meta.series = safeLabel(data.series || data.seriesname || data.tournament || data.tournamentName);
    M.meta.sub = M.meta.series || M.meta.format;
    M.meta.venue = safeLabel(data.venue?.name || data.venue?.ground || data.venue || data.venueinfo?.ground);
    M.meta.toss = typeof data.toss === 'object' ? safeString(data.toss.text || data.toss.result || data.toss.status) : safeString(data.toss || data.tossstatus);
    const scoreRawForOfficials = REAL_DATA.scorecard?.data || REAL_DATA.scorecard || {};
    const scoreHeadersForOfficials = scoreRawForOfficials.matchheaders || scoreRawForOfficials.matchHeaders || scoreRawForOfficials.matchheader || {};
    M.meta.umpires = extractOfficials(data, [scoreRawForOfficials, scoreHeadersForOfficials]);
    const women = data?.teams?.home?.iswomenteam || data?.teams?.away?.iswomenteam || data?.team1?.iswomenteam || data?.team2?.iswomenteam;
    M.meta.gender = (women === true || women === 1 || String(women).toLowerCase() === 'true' || /women/i.test(M.meta.series)) ? 'Women' : 'Men';
    M.meta.realResult = safeLabel(data.result || data.statusText || data.status);
    M.meta.winner = safeLabel(data.winner || data.winningTeam || data.winnerTeam || '');
    M.meta.realStatusLine = safeLabel(data.statusText || data.statusline || data.status);
    M.meta.day = header.day; M.meta.session = header.session; M.meta.playState = header.playState;
    if (startDate) M.meta.date = state === 'upcoming' ? startDate + (startTime ? ' · ' + startTime : '') : (state === 'live' ? startDate : 'Played ' + startDate);

    if (state === 'upcoming') {
      M.score.home = { score: '', sub: '', detail: '', won:false };
      M.score.away = { score: '', sub: '', detail: '', won:false };
      M.score.resultText = startTime ? 'Match starts at' : 'Upcoming';
      M.score.subText = startDate ? startDate + (startTime ? ' · ' + startTime : '') : '';
      M.score.icon = '⏳'; return;
    }

    const grouped = teamInningsTexts(innings);
    const isTest = /test/i.test(M.meta.format) || innings.length > 2;
    const setScore = (side, texts, latest) => {
      const txts = texts || [];
      const display = isTest ? txts.slice(0,2).join(' & ') : (txts[txts.length - 1] || scoreTextForInn(latest));
      const last = latest || null;
      const raw = safeString(last?.score || last?.runs || '');
      const parts = raw.match(/^(\d+)\s*\/\s*(\d+)/);
      M.score[side].score = display ? display.split('/')[0] : (parts ? parts[1] : '');
      M.score[side].sub = display.includes('/') ? '/' + display.split('/').slice(1).join('/') : '';
      // Keep Test's full "366/8 & 200/6" together; renderScoreHeader uses score + sub.
      if (isTest && display) { M.score[side].score = display; M.score[side].sub = ''; }
      const overs = safeString(last?.overs ?? last?.ov ?? '');
      M.score[side].detail = overs ? overs + ' Overs' : '';
    };
    const latest = { home:null, away:null };
    innings.forEach(inn => { const side=teamForInnings(inn); if(side) latest[side]=inn; });
    setScore('home', grouped.home, latest.home); setScore('away', grouped.away, latest.away);

    if (state === 'live') {
      const current = header.currentInnings || innings[innings.length-1] || {};
      const battingTeam = safeLabel(current.batteamname || current.teamname || current.team_name || '');
      const battingSide = teamForInnings(current);
      const bowlingSide = battingSide === 'home' ? 'away' : battingSide === 'away' ? 'home' : null;
      const battingName = battingSide === 'home' ? HOME_T.name : battingSide === 'away' ? AWAY_T.name : battingTeam;
      const bowlingName = bowlingSide === 'home' ? HOME_T.name : bowlingSide === 'away' ? AWAY_T.name : '';
      const crr = data.currentRunRate ?? data.currentrunrate ?? current.currentRunRate ?? current.currentrunrate ?? current.runrate ?? current.crr;
      const rrr = data.requiredRunRate ?? data.requiredrunrate ?? current.requiredRunRate ?? current.requiredrunrate ?? current.rrr;
      const target = Number(data.target ?? data.targetscore ?? current.target ?? current.targetscore);
      let reqRuns = data.requiredRuns ?? data.requiredruns ?? current.requiredRuns ?? current.requiredruns;
      let reqBalls = data.requiredBalls ?? data.requiredballs ?? current.requiredBalls ?? current.requiredballs;
      // Required runs/balls are shown only when supplied by the API.
      // Never derive them from format/overs because DLS/VJD can change the target.
      const chaseText = (reqRuns != null && reqRuns !== '' && reqBalls != null && reqBalls !== '')
        ? battingName + ' need ' + reqRuns + ' runs in ' + reqBalls + ' balls'
        : (battingName ? (bowlingName ? bowlingName + ' opt to bowl · ' + battingName + ' opt to bat' : battingName + ' batting') : 'Live');
      M.score.resultText = chaseText;
      const parts = [];
      if (bowlingName && battingName) parts.push(bowlingName + ' opt to bowl');
      if (battingName) parts.push(battingName + ' opt to bat');
      if (crr != null && crr !== '') parts.push('CRR ' + crr);
      if (rrr != null && rrr !== '') parts.push('RRR ' + rrr);
      if (target != null && Number.isFinite(target)) parts.push('Target ' + target);
      M.score.subText = parts.join(' · ');
      M.score.icon = '🔴';
      M.score.currentOvers = safeString(current.overs ?? current.ov ?? '');
      return;
    }

    const rawScorecard = REAL_DATA.scorecard?.data || REAL_DATA.scorecard || {};
    const outcome = extractAuthoritativeOutcome(REAL_DATA.match || data, rawScorecard);
    const conditions = extractMatchConditions(REAL_DATA.match || data, rawScorecard);
    const resultText = outcome.text || '';

    // Finished results are API-owned. Do not manufacture a result from scores,
    // overs, targets or a local winner calculation.
    M.score.resultText = resultText;
    M.score.subText = [
      outcome.reducedOvers || conditions.reduced || '',
      outcome.revisedTarget || conditions.target || ''
    ].filter(Boolean).join(' · ');
    M.score.icon = /abandon|no\s+result|cancel|postpon|rain/i.test(M.score.resultText) ? '🌧️' : '🏆';

    const winnerSide = outcome.winnerSide || '';
    M.meta.winner = outcome.winner || '';
    M.score.home.won = state === 'finished' && winnerSide === 'home';
    M.score.away.won = state === 'finished' && winnerSide === 'away';
    M.meta.reduction = {
      rain: conditions.rain || '',
      reduced: outcome.reducedOvers || conditions.reduced || '',
      target: outcome.revisedTarget || conditions.target || '',
      suspension: conditions.suspension || '',
      abandonment: conditions.abandonment || ''
    };
  }

  // Result margins are never calculated locally; provider result fields are authoritative.

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
    if (isNaN(d.getTime())) return iso;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
  }

  // ------------------------------------------------------------------ helpers
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  // ------------------------------------------------------------------ teams
  const TEAM_REGISTRY = {
    ind: { name: 'India', flag: '🇮🇳', cc: 'in', color: '#2196F3' },
    eng: { name: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', cc: 'gb-eng', color: '#D32F2F' },
    aus: { name: 'Australia', flag: '🇦🇺', cc: 'au', color: '#1B5E20' },
    sa: { name: 'South Africa', flag: '🇿🇦', cc: 'za', color: '#0E7490' },
    nz: { name: 'New Zealand', flag: '🇳🇿', cc: 'nz', color: '#1D4ED8' },
    pak: { name: 'Pakistan', flag: '🇵🇰', cc: 'pk', color: '#16A34A' },
    sl: { name: 'Sri Lanka', flag: '🇱🇰', cc: 'lk', color: '#9333EA' },
    ban: { name: 'Bangladesh', flag: '🇧🇩', cc: 'bd', color: '#C026D3' },
    wi: { name: 'West Indies', flag: '🏝️', cc: 'ag', color: '#DC2626' },
    'wi-w': { name: 'WI Women', flag: '🏝️', cc: 'ag', color: '#DC2626', rankName: 'West Indies Women' },
    'ire-w': { name: 'IRE Women', cc: 'ie', color: '#169B62', flag: '🇮🇪', rankName: 'Ireland Women' },
    afg: { name: 'Afghanistan', flag: '🇦🇫', cc: 'af', color: '#2563EB' },
    mi: { name: 'Mumbai Indians', flag: '🦁', cc: null, color: '#045093' },
    csk: { name: 'Chennai Super Kings', flag: '🦁', cc: null, color: '#F9CD05' },
    rcb: { name: 'Royal Challengers Bengaluru', flag: '🦁', cc: null, color: '#EC1C24' },
    kkr: { name: 'Kolkata Knight Riders', flag: '🦁', cc: null, color: '#3B2A7E' },
    liv: { name: 'Liverpool', flag: '🔴', cc: null, color: '#C8102E' },
    mci: { name: 'Manchester City', flag: '🔵', cc: null, color: '#6CABDD' },
    mun: { name: 'Manchester United', flag: '🔴', cc: null, color: '#DA291C' },
    che: { name: 'Chelsea', flag: '🔵', cc: null, color: '#034694' },
    ars: { name: 'Arsenal', flag: '🔴', cc: null, color: '#EF0107' },
    real: { name: 'Real Madrid', flag: '👑', cc: null, color: '#FEBE10' },
    bar: { name: 'Barcelona', flag: '🔵', cc: null, color: '#A50044' },
    lal: { name: 'Los Angeles Lakers', flag: '🟣', cc: null, color: '#552583', rankName: 'Los Angeles Lakers' },
    gsw: { name: 'Golden State Warriors', flag: '🌉', cc: null, color: '#1D428A', rankName: 'Golden State Warriors' },
    bos: { name: 'Boston Celtics', flag: '🍀', cc: null, color: '#007A33', rankName: 'Boston Celtics' },
    alc: { name: 'Carlos Alcaraz', flag: '🇪🇸', cc: 'es', color: '#C60B1E' },
    djo: { name: 'Novak Djokovic', flag: '🇷🇸', cc: 'rs', color: '#C09A2E' },
    lad: { name: 'LA Dodgers', flag: '🔵', cc: null, color: '#005A9C' },
    nyy: { name: 'NY Yankees', flag: '🔹', cc: null, color: '#0C2340' },
    wsh: { name: 'Washington Capitals', flag: '🔴', cc: null, color: '#C8102E' },
    vgk: { name: 'Vegas Golden Knights', flag: '⚔️', cc: null, color: '#B4975A' },
    // ---- Football (soccer) national teams ----
    fra: { name: 'France', flag: '🇫🇷', cc: 'fr', color: '#0055A4', rankName: 'France' },
    bra: { name: 'Brazil', flag: '🇧🇷', cc: 'br', color: '#009C3B', rankName: 'Brazil' },
    arg: { name: 'Argentina', flag: '🇦🇷', cc: 'ar', color: '#75AADB', rankName: 'Argentina' },
    ger: { name: 'Germany', flag: '🇩🇪', cc: 'de', color: '#111111', rankName: 'Germany' },
    esp: { name: 'Spain', flag: '🇪🇸', cc: 'es', color: '#AA151B', rankName: 'Spain' },
    por: { name: 'Portugal', flag: '🇵🇹', cc: 'pt', color: '#006600', rankName: 'Portugal' },
    ned: { name: 'Netherlands', flag: '🇳🇱', cc: 'nl', color: '#FF7A00', rankName: 'Netherlands' },
    ita: { name: 'Italy', flag: '🇮🇹', cc: 'it', color: '#009246', rankName: 'Italy' },
    bel: { name: 'Belgium', flag: '🇧🇪', cc: 'be', color: '#E30613', rankName: 'Belgium' },
    'eng_f': { name: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', cc: 'gb-eng', color: '#D32F2F', rankName: 'England' },
    // ---- Basketball national teams ----
    'usa-bb': { name: 'USA', flag: '🇺🇸', cc: 'us', color: '#002868' },
    'fra-bb': { name: 'France', flag: '🇫🇷', cc: 'fr', color: '#0055A4' }
  };

  // Player data is always taken from the current match squads endpoint.
  const REAL_PLAYERS = {};

  // ------------------------------------------------------------------
  // DYNAMIC CRICBUZZ TEAM REGISTRY
  // Keep the Match Center on the same backend-driven team mapping used by
  // matches-data.js. This is intentionally local to this engine so the
  // Match Center does not depend on a static/mock match file being loaded.
  // ------------------------------------------------------------------
  const TEAM_ID_META = Object.create(null);
  const DYNAMIC_TEAMS = Object.create(null);

  function teamLogoUrl(imageId) {
    if (!imageId) return '';
    const value = String(imageId).trim();
    if (!value) return '';
    if (/^https?:\/\//i.test(value)) return value;
    return 'https://static.cricbuzz.com/a/img/v1/i1/c' + encodeURIComponent(value) + '/i.jpg';
  }

  function dynamicTeamKey(value) {
    return safeString(value).toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  const DYNAMIC_COUNTRY_CODES = {
    india:'in', pakistan:'pk', australia:'au', england:'gb-eng', 'south africa':'za',
    'new zealand':'nz', 'sri lanka':'lk', bangladesh:'bd', afghanistan:'af',
    ireland:'ie', zimbabwe:'zw', 'west indies':'ag', nepal:'np', scotland:'gb-sct',
    namibia:'na', oman:'om', 'united arab emirates':'ae', 'hong kong':'hk',
    'papua new guinea':'pg', canada:'ca', 'united states':'us', usa:'us',
    malaysia:'my', germany:'de', denmark:'dk', singapore:'sg', kuwait:'kw',
    vanuatu:'vu', jersey:'je', fiji:'fj', italy:'it', belgium:'be', uganda:'ug',
    kenya:'ke', tanzania:'tz', rwanda:'rw', nigeria:'ng', botswana:'bw',
    malawi:'mw', zambia:'zm', ghana:'gh', 'sierra leone':'sl', thailand:'th',
    bhutan:'bt', indonesia:'id', cambodia:'kh', japan:'jp', 'south korea':'kr',
    philippines:'ph', qatar:'qa', bahrain:'bh', saudi:'sa', france:'fr', spain:'es',
    portugal:'pt', netherlands:'nl', austria:'at', switzerland:'ch', romania:'ro',
    croatia:'hr', serbia:'rs', greece:'gr', cyprus:'cy', estonia:'ee', latvia:'lv',
    lithuania:'lt', luxembourg:'lu', sweden:'se', norway:'no', finland:'fi',
    iceland:'is', argentina:'ar', brazil:'br', chile:'cl', peru:'pe', mexico:'mx',
    costa:'cr', 'costa rica':'cr', panama:'pa', colombia:'co', bahamas:'bs',
    jamaica:'jm', guyana:'gy', suriname:'sr', 'trinidad and tobago':'tt',
    barbados:'bb', 'british virgin islands':'vg'
  };

  function dynamicCountryCode(value) {
    const n = dynamicTeamKey(value);
    if (!n) return '';
    const direct = DYNAMIC_COUNTRY_CODES[n];
    if (direct) return direct;
    const key = Object.keys(DYNAMIC_COUNTRY_CODES).find(k => dynamicTeamKey(k) === n);
    return key ? DYNAMIC_COUNTRY_CODES[key] : '';
  }

  function extractDynamicTeamList(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.list)) return payload.list;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.data?.list)) return payload.data.list;
    if (Array.isArray(payload?.teams)) return payload.teams;
    if (Array.isArray(payload?.data?.teams)) return payload.data.teams;
    return [];
  }

  function registerDynamicTeam(raw, category) {
    if (!raw || typeof raw !== 'object') return;
    const name = raw.teamName || raw.name || raw.team || '';
    const short = raw.teamSName || raw.shortName || raw.teamShortName || raw.code || '';
    const id = raw.teamId ?? raw.id ?? '';
    if (!name && !short) return;

    const countryName = raw.countryName || raw.country || raw.nation || '';
    const cc = dynamicCountryCode(countryName || name);
    const imageId = raw.imageId || raw.imageID || raw.logoId || '';
    const isNational = category === 'international' || !!countryName;
    const logo = teamLogoUrl(imageId);
    const meta = {
      name: name || short,
      short: short || '',
      cc: cc || '',
      color: '#2563eb',
      flag: cc ? (cc === 'in' ? '🇮🇳' : cc === 'pk' ? '🇵🇰' : '🌐') : '🏏',
      logo: logo || null,
      imageId: imageId || null,
      teamId: id || null,
      category: category || 'unknown',
      countryName: countryName || null,
      isNational
    };

    const keys = new Set([dynamicTeamKey(short), dynamicTeamKey(name)].filter(Boolean));
    keys.forEach(key => { DYNAMIC_TEAMS[key] = { ...(DYNAMIC_TEAMS[key] || {}), ...meta }; });
    if (id !== '') TEAM_ID_META[String(id)] = meta;
  }

  async function loadDynamicTeamRegistry() {
    const categories = ['international', 'league', 'domestic', 'women'];
    const results = await Promise.allSettled(categories.map(async category => {
      const res = await fetch(API_BASES[0] + '/teams/' + category, {
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      });
      if (!res.ok) throw new Error(category + ' teams: HTTP ' + res.status);
      return { category, payload: await res.json() };
    }));

    results.forEach(result => {
      if (result.status !== 'fulfilled') return;
      extractDynamicTeamList(result.value.payload).forEach(team => registerDynamicTeam(team, result.value.category));
    });

    console.log('[Match Center] Dynamic Cricbuzz teams loaded:', Object.keys(TEAM_ID_META).length);
  }


  function flagCodeForTeam(team) {
    // Prefer an explicit provider country/ISO code. If it is missing, resolve
    // the country name against a comprehensive ISO-3166 registry. This keeps
    // international, women's, league and domestic teams covered without
    // changing the backend/provider structure.
    const rawCountry = safeLabel(
      team?.countrycode || team?.countryCode || team?.country_code ||
      team?.country?.code || team?.country?.countryCode ||
      team?.countryname || team?.countryName || team?.country ||
      team?.nationality || team?.nation || ''
    ).trim();

    const explicit = rawCountry.toLowerCase().replace(/_/g, '-');
    const explicitMap = {
      eng: 'gb-eng', england: 'gb-eng',
      sco: 'gb-sct', scotland: 'gb-sct',
      wal: 'gb-wls', wales: 'gb-wls',
      nir: 'gb-nir', 'northern ireland': 'gb-nir',
      wi: 'ag', 'west indies': 'ag'
    };

    if (/^[a-z]{2}$/.test(explicit)) return explicit;
    if (/^[a-z]{3}$/.test(explicit)) {
      const byAlpha3 = {
        'abw': 'aw',
        'afg': 'af',
        'ago': 'ao',
        'aia': 'ai',
        'ala': 'ax',
        'alb': 'al',
        'and': 'ad',
        'are': 'ae',
        'arg': 'ar',
        'arm': 'am',
        'asm': 'as',
        'ata': 'aq',
        'atf': 'tf',
        'atg': 'ag',
        'aus': 'au',
        'aut': 'at',
        'aze': 'az',
        'bdi': 'bi',
        'bel': 'be',
        'ben': 'bj',
        'bes': 'bq',
        'bfa': 'bf',
        'bgd': 'bd',
        'bgr': 'bg',
        'bhr': 'bh',
        'bhs': 'bs',
        'bih': 'ba',
        'blm': 'bl',
        'blr': 'by',
        'blz': 'bz',
        'bmu': 'bm',
        'bol': 'bo',
        'bra': 'br',
        'brb': 'bb',
        'brn': 'bn',
        'btn': 'bt',
        'bvt': 'bv',
        'bwa': 'bw',
        'caf': 'cf',
        'can': 'ca',
        'cck': 'cc',
        'che': 'ch',
        'chl': 'cl',
        'chn': 'cn',
        'civ': 'ci',
        'cmr': 'cm',
        'cod': 'cd',
        'cog': 'cg',
        'cok': 'ck',
        'col': 'co',
        'com': 'km',
        'cpv': 'cv',
        'cri': 'cr',
        'cub': 'cu',
        'cuw': 'cw',
        'cxr': 'cx',
        'cym': 'ky',
        'cyp': 'cy',
        'cze': 'cz',
        'deu': 'de',
        'dji': 'dj',
        'dma': 'dm',
        'dnk': 'dk',
        'dom': 'do',
        'dza': 'dz',
        'ecu': 'ec',
        'egy': 'eg',
        'eri': 'er',
        'esh': 'eh',
        'esp': 'es',
        'est': 'ee',
        'eth': 'et',
        'fin': 'fi',
        'fji': 'fj',
        'flk': 'fk',
        'fra': 'fr',
        'fro': 'fo',
        'fsm': 'fm',
        'gab': 'ga',
        'gbr': 'gb',
        'geo': 'ge',
        'ggy': 'gg',
        'gha': 'gh',
        'gib': 'gi',
        'gin': 'gn',
        'glp': 'gp',
        'gmb': 'gm',
        'gnb': 'gw',
        'gnq': 'gq',
        'grc': 'gr',
        'grd': 'gd',
        'grl': 'gl',
        'gtm': 'gt',
        'guf': 'gf',
        'gum': 'gu',
        'guy': 'gy',
        'hkg': 'hk',
        'hmd': 'hm',
        'hnd': 'hn',
        'hrv': 'hr',
        'hti': 'ht',
        'hun': 'hu',
        'idn': 'id',
        'imn': 'im',
        'ind': 'in',
        'iot': 'io',
        'irl': 'ie',
        'irn': 'ir',
        'irq': 'iq',
        'isl': 'is',
        'isr': 'il',
        'ita': 'it',
        'jam': 'jm',
        'jey': 'je',
        'jor': 'jo',
        'jpn': 'jp',
        'kaz': 'kz',
        'ken': 'ke',
        'kgz': 'kg',
        'khm': 'kh',
        'kir': 'ki',
        'kna': 'kn',
        'kor': 'kr',
        'kwt': 'kw',
        'lao': 'la',
        'lbn': 'lb',
        'lbr': 'lr',
        'lby': 'ly',
        'lca': 'lc',
        'lie': 'li',
        'lka': 'lk',
        'lso': 'ls',
        'ltu': 'lt',
        'lux': 'lu',
        'lva': 'lv',
        'mac': 'mo',
        'maf': 'mf',
        'mar': 'ma',
        'mco': 'mc',
        'mda': 'md',
        'mdg': 'mg',
        'mdv': 'mv',
        'mex': 'mx',
        'mhl': 'mh',
        'mkd': 'mk',
        'mli': 'ml',
        'mlt': 'mt',
        'mmr': 'mm',
        'mne': 'me',
        'mng': 'mn',
        'mnp': 'mp',
        'moz': 'mz',
        'mrt': 'mr',
        'msr': 'ms',
        'mtq': 'mq',
        'mus': 'mu',
        'mwi': 'mw',
        'mys': 'my',
        'myt': 'yt',
        'nam': 'na',
        'ncl': 'nc',
        'ner': 'ne',
        'nfk': 'nf',
        'nga': 'ng',
        'nic': 'ni',
        'niu': 'nu',
        'nld': 'nl',
        'nor': 'no',
        'npl': 'np',
        'nru': 'nr',
        'nzl': 'nz',
        'omn': 'om',
        'pak': 'pk',
        'pan': 'pa',
        'pcn': 'pn',
        'per': 'pe',
        'phl': 'ph',
        'plw': 'pw',
        'png': 'pg',
        'pol': 'pl',
        'pri': 'pr',
        'prk': 'kp',
        'prt': 'pt',
        'pry': 'py',
        'pse': 'ps',
        'pyf': 'pf',
        'qat': 'qa',
        'reu': 're',
        'rou': 'ro',
        'rus': 'ru',
        'rwa': 'rw',
        'sau': 'sa',
        'sdn': 'sd',
        'sen': 'sn',
        'sgp': 'sg',
        'sgs': 'gs',
        'shn': 'sh',
        'sjm': 'sj',
        'slb': 'sb',
        'sle': 'sl',
        'slv': 'sv',
        'smr': 'sm',
        'som': 'so',
        'spm': 'pm',
        'srb': 'rs',
        'ssd': 'ss',
        'stp': 'st',
        'sur': 'sr',
        'svk': 'sk',
        'svn': 'si',
        'swe': 'se',
        'swz': 'sz',
        'sxm': 'sx',
        'syc': 'sc',
        'syr': 'sy',
        'tca': 'tc',
        'tcd': 'td',
        'tgo': 'tg',
        'tha': 'th',
        'tjk': 'tj',
        'tkl': 'tk',
        'tkm': 'tm',
        'tls': 'tl',
        'ton': 'to',
        'tto': 'tt',
        'tun': 'tn',
        'tur': 'tr',
        'tuv': 'tv',
        'twn': 'tw',
        'tza': 'tz',
        'uga': 'ug',
        'ukr': 'ua',
        'umi': 'um',
        'ury': 'uy',
        'usa': 'us',
        'uzb': 'uz',
        'vat': 'va',
        'vct': 'vc',
        'ven': 've',
        'vgb': 'vg',
        'vir': 'vi',
        'vnm': 'vn',
        'vut': 'vu',
        'wlf': 'wf',
        'wsm': 'ws',
        'yem': 'ye',
        'zaf': 'za',
        'zmb': 'zm',
        'zwe': 'zw',
      };
      if (byAlpha3[explicit]) return byAlpha3[explicit];
    }
    if (explicitMap[explicit]) return explicitMap[explicit];

    const countryMap = {
  "afghanistan": "af",
  "albania": "al",
  "algeria": "dz",
  "american samoa": "as",
  "andorra": "ad",
  "angola": "ao",
  "anguilla": "ai",
  "antarctica": "aq",
  "antigua and barbuda": "ag",
  "arab republic of egypt": "eg",
  "argentina": "ar",
  "argentine republic": "ar",
  "armenia": "am",
  "aruba": "aw",
  "australia": "au",
  "austria": "at",
  "azerbaijan": "az",
  "bahamas": "bs",
  "bahrain": "bh",
  "bangladesh": "bd",
  "barbados": "bb",
  "belarus": "by",
  "belgium": "be",
  "belize": "bz",
  "benin": "bj",
  "bermuda": "bm",
  "bhutan": "bt",
  "bolivarian republic of venezuela": "ve",
  "bolivia": "bo",
  "bolivia, plurinational state of": "bo",
  "bonaire, sint eustatius and saba": "bq",
  "bosnia and herzegovina": "ba",
  "botswana": "bw",
  "bouvet island": "bv",
  "brazil": "br",
  "british indian ocean territory": "io",
  "british virgin islands": "vg",
  "brunei": "bn",
  "brunei darussalam": "bn",
  "bulgaria": "bg",
  "burkina faso": "bf",
  "burma": "mm",
  "burundi": "bi",
  "cabo verde": "cv",
  "cambodia": "kh",
  "cameroon": "cm",
  "canada": "ca",
  "cape verde": "cv",
  "cayman islands": "ky",
  "central african republic": "cf",
  "chad": "td",
  "chile": "cl",
  "china": "cn",
  "christmas island": "cx",
  "cocos (keeling) islands": "cc",
  "colombia": "co",
  "commonwealth of dominica": "dm",
  "commonwealth of the bahamas": "bs",
  "commonwealth of the northern mariana islands": "mp",
  "comoros": "km",
  "congo": "cg",
  "congo, the democratic republic of the": "cd",
  "cook islands": "ck",
  "costa rica": "cr",
  "cote d'ivoire": "ci",
  "croatia": "hr",
  "cuba": "cu",
  "curacao": "cw",
  "curaçao": "cw",
  "cyprus": "cy",
  "czech republic": "cz",
  "czechia": "cz",
  "côte d'ivoire": "ci",
  "côte d’ivoire": "ci",
  "democratic people's republic of korea": "kp",
  "democratic republic of sao tome and principe": "st",
  "democratic republic of timor-leste": "tl",
  "democratic socialist republic of sri lanka": "lk",
  "denmark": "dk",
  "djibouti": "dj",
  "dominica": "dm",
  "dominican republic": "do",
  "eastern republic of uruguay": "uy",
  "ecuador": "ec",
  "egypt": "eg",
  "el salvador": "sv",
  "eng": "gb-eng",
  "england": "gb-eng",
  "equatorial guinea": "gq",
  "eritrea": "er",
  "estonia": "ee",
  "eswatini": "sz",
  "ethiopia": "et",
  "falkland islands (malvinas)": "fk",
  "faroe islands": "fo",
  "federal democratic republic of ethiopia": "et",
  "federal democratic republic of nepal": "np",
  "federal republic of germany": "de",
  "federal republic of nigeria": "ng",
  "federal republic of somalia": "so",
  "federated states of micronesia": "fm",
  "federative republic of brazil": "br",
  "fiji": "fj",
  "finland": "fi",
  "france": "fr",
  "french guiana": "gf",
  "french polynesia": "pf",
  "french republic": "fr",
  "french southern territories": "tf",
  "gabon": "ga",
  "gabonese republic": "ga",
  "gambia": "gm",
  "georgia": "ge",
  "germany": "de",
  "ghana": "gh",
  "gibraltar": "gi",
  "grand duchy of luxembourg": "lu",
  "greece": "gr",
  "greenland": "gl",
  "grenada": "gd",
  "guadeloupe": "gp",
  "guam": "gu",
  "guatemala": "gt",
  "guernsey": "gg",
  "guinea": "gn",
  "guinea-bissau": "gw",
  "guyana": "gy",
  "haiti": "ht",
  "hashemite kingdom of jordan": "jo",
  "heard island and mcdonald islands": "hm",
  "hellenic republic": "gr",
  "holy see (vatican city state)": "va",
  "honduras": "hn",
  "hong kong": "hk",
  "hong kong special administrative region of china": "hk",
  "hungary": "hu",
  "iceland": "is",
  "independent state of papua new guinea": "pg",
  "independent state of samoa": "ws",
  "india": "in",
  "indonesia": "id",
  "iran": "ir",
  "iran, islamic republic of": "ir",
  "iraq": "iq",
  "ireland": "ie",
  "islamic republic of afghanistan": "af",
  "islamic republic of iran": "ir",
  "islamic republic of mauritania": "mr",
  "islamic republic of pakistan": "pk",
  "isle of man": "im",
  "israel": "il",
  "italian republic": "it",
  "italy": "it",
  "ivory coast": "ci",
  "jamaica": "jm",
  "japan": "jp",
  "jersey": "je",
  "jordan": "jo",
  "kazakhstan": "kz",
  "kenya": "ke",
  "kingdom of bahrain": "bh",
  "kingdom of belgium": "be",
  "kingdom of bhutan": "bt",
  "kingdom of cambodia": "kh",
  "kingdom of denmark": "dk",
  "kingdom of eswatini": "sz",
  "kingdom of lesotho": "ls",
  "kingdom of morocco": "ma",
  "kingdom of norway": "no",
  "kingdom of saudi arabia": "sa",
  "kingdom of spain": "es",
  "kingdom of sweden": "se",
  "kingdom of thailand": "th",
  "kingdom of the netherlands": "nl",
  "kingdom of tonga": "to",
  "kiribati": "ki",
  "korea republic": "kr",
  "korea, democratic people's republic of": "kp",
  "korea, republic of": "kr",
  "kosovo": "xk",
  "kuwait": "kw",
  "kyrgyz republic": "kg",
  "kyrgyzstan": "kg",
  "lao people's democratic republic": "la",
  "laos": "la",
  "latvia": "lv",
  "lebanese republic": "lb",
  "lebanon": "lb",
  "lesotho": "ls",
  "liberia": "lr",
  "libya": "ly",
  "liechtenstein": "li",
  "lithuania": "lt",
  "luxembourg": "lu",
  "macao": "mo",
  "macao special administrative region of china": "mo",
  "macau": "mo",
  "madagascar": "mg",
  "malawi": "mw",
  "malaysia": "my",
  "maldives": "mv",
  "mali": "ml",
  "malta": "mt",
  "marshall islands": "mh",
  "martinique": "mq",
  "mauritania": "mr",
  "mauritius": "mu",
  "mayotte": "yt",
  "mexico": "mx",
  "micronesia, federated states of": "fm",
  "moldova": "md",
  "moldova, republic of": "md",
  "monaco": "mc",
  "mongolia": "mn",
  "montenegro": "me",
  "montserrat": "ms",
  "morocco": "ma",
  "mozambique": "mz",
  "myanmar": "mm",
  "namibia": "na",
  "nauru": "nr",
  "nepal": "np",
  "netherlands": "nl",
  "new caledonia": "nc",
  "new zealand": "nz",
  "nicaragua": "ni",
  "niger": "ne",
  "nigeria": "ng",
  "nir": "gb-nir",
  "niue": "nu",
  "norfolk island": "nf",
  "north korea": "kp",
  "north macedonia": "mk",
  "northern ireland": "gb-nir",
  "northern mariana islands": "mp",
  "norway": "no",
  "oman": "om",
  "pakistan": "pk",
  "palau": "pw",
  "palestine": "ps",
  "palestine, state of": "ps",
  "panama": "pa",
  "papua new guinea": "pg",
  "paraguay": "py",
  "people's democratic republic of algeria": "dz",
  "people's republic of bangladesh": "bd",
  "people's republic of china": "cn",
  "peru": "pe",
  "philippines": "ph",
  "pitcairn": "pn",
  "plurinational state of bolivia": "bo",
  "poland": "pl",
  "portugal": "pt",
  "portuguese republic": "pt",
  "principality of andorra": "ad",
  "principality of liechtenstein": "li",
  "principality of monaco": "mc",
  "puerto rico": "pr",
  "qatar": "qa",
  "republic of albania": "al",
  "republic of angola": "ao",
  "republic of armenia": "am",
  "republic of austria": "at",
  "republic of azerbaijan": "az",
  "republic of belarus": "by",
  "republic of benin": "bj",
  "republic of bosnia and herzegovina": "ba",
  "republic of botswana": "bw",
  "republic of bulgaria": "bg",
  "republic of burundi": "bi",
  "republic of cabo verde": "cv",
  "republic of cameroon": "cm",
  "republic of chad": "td",
  "republic of chile": "cl",
  "republic of colombia": "co",
  "republic of costa rica": "cr",
  "republic of croatia": "hr",
  "republic of cuba": "cu",
  "republic of cyprus": "cy",
  "republic of côte d'ivoire": "ci",
  "republic of djibouti": "dj",
  "republic of ecuador": "ec",
  "republic of el salvador": "sv",
  "republic of equatorial guinea": "gq",
  "republic of estonia": "ee",
  "republic of fiji": "fj",
  "republic of finland": "fi",
  "republic of ghana": "gh",
  "republic of guatemala": "gt",
  "republic of guinea": "gn",
  "republic of guinea-bissau": "gw",
  "republic of guyana": "gy",
  "republic of haiti": "ht",
  "republic of honduras": "hn",
  "republic of iceland": "is",
  "republic of india": "in",
  "republic of indonesia": "id",
  "republic of iraq": "iq",
  "republic of kazakhstan": "kz",
  "republic of kenya": "ke",
  "republic of kiribati": "ki",
  "republic of korea": "kr",
  "republic of latvia": "lv",
  "republic of liberia": "lr",
  "republic of lithuania": "lt",
  "republic of madagascar": "mg",
  "republic of malawi": "mw",
  "republic of maldives": "mv",
  "republic of mali": "ml",
  "republic of malta": "mt",
  "republic of mauritius": "mu",
  "republic of moldova": "md",
  "republic of mozambique": "mz",
  "republic of myanmar": "mm",
  "republic of namibia": "na",
  "republic of nauru": "nr",
  "republic of nicaragua": "ni",
  "republic of north macedonia": "mk",
  "republic of palau": "pw",
  "republic of panama": "pa",
  "republic of paraguay": "py",
  "republic of peru": "pe",
  "republic of poland": "pl",
  "republic of san marino": "sm",
  "republic of senegal": "sn",
  "republic of serbia": "rs",
  "republic of seychelles": "sc",
  "republic of sierra leone": "sl",
  "republic of singapore": "sg",
  "republic of slovenia": "si",
  "republic of south africa": "za",
  "republic of south sudan": "ss",
  "republic of suriname": "sr",
  "republic of tajikistan": "tj",
  "republic of the congo": "cg",
  "republic of the gambia": "gm",
  "republic of the marshall islands": "mh",
  "republic of the niger": "ne",
  "republic of the philippines": "ph",
  "republic of the sudan": "sd",
  "republic of trinidad and tobago": "tt",
  "republic of tunisia": "tn",
  "republic of türkiye": "tr",
  "republic of uganda": "ug",
  "republic of uzbekistan": "uz",
  "republic of vanuatu": "vu",
  "republic of yemen": "ye",
  "republic of zambia": "zm",
  "republic of zimbabwe": "zw",
  "romania": "ro",
  "russia": "ru",
  "russian federation": "ru",
  "rwanda": "rw",
  "rwandese republic": "rw",
  "réunion": "re",
  "saint barthélemy": "bl",
  "saint helena, ascension and tristan da cunha": "sh",
  "saint kitts and nevis": "kn",
  "saint lucia": "lc",
  "saint martin (french part)": "mf",
  "saint pierre and miquelon": "pm",
  "saint vincent and the grenadines": "vc",
  "samoa": "ws",
  "san marino": "sm",
  "sao tome and principe": "st",
  "saudi arabia": "sa",
  "sco": "gb-sct",
  "scotland": "gb-sct",
  "senegal": "sn",
  "serbia": "rs",
  "seychelles": "sc",
  "sierra leone": "sl",
  "singapore": "sg",
  "sint maarten (dutch part)": "sx",
  "slovak republic": "sk",
  "slovakia": "sk",
  "slovenia": "si",
  "socialist republic of viet nam": "vn",
  "solomon islands": "sb",
  "somalia": "so",
  "south africa": "za",
  "south georgia and the south sandwich islands": "gs",
  "south korea": "kr",
  "south sudan": "ss",
  "spain": "es",
  "sri lanka": "lk",
  "state of israel": "il",
  "state of kuwait": "kw",
  "state of qatar": "qa",
  "sudan": "sd",
  "sultanate of oman": "om",
  "suriname": "sr",
  "svalbard and jan mayen": "sj",
  "swaziland": "sz",
  "sweden": "se",
  "swiss confederation": "ch",
  "switzerland": "ch",
  "syria": "sy",
  "syrian arab republic": "sy",
  "taiwan": "tw",
  "taiwan, province of china": "tw",
  "tajikistan": "tj",
  "tanzania": "tz",
  "tanzania, united republic of": "tz",
  "thailand": "th",
  "the state of eritrea": "er",
  "the state of palestine": "ps",
  "timor-leste": "tl",
  "togo": "tg",
  "togolese republic": "tg",
  "tokelau": "tk",
  "tonga": "to",
  "trinidad and tobago": "tt",
  "tunisia": "tn",
  "turkey": "tr",
  "turkmenistan": "tm",
  "turks and caicos islands": "tc",
  "tuvalu": "tv",
  "türkiye": "tr",
  "u.a.e.": "ae",
  "u.s.a.": "us",
  "uae": "ae",
  "uganda": "ug",
  "ukraine": "ua",
  "union of the comoros": "km",
  "united arab emirates": "ae",
  "united kingdom": "gb",
  "united kingdom of great britain and northern ireland": "gb",
  "united mexican states": "mx",
  "united republic of tanzania": "tz",
  "united states": "us",
  "united states minor outlying islands": "um",
  "united states of america": "us",
  "uruguay": "uy",
  "usa": "us",
  "uzbekistan": "uz",
  "vanuatu": "vu",
  "venezuela": "ve",
  "venezuela, bolivarian republic of": "ve",
  "viet nam": "vn",
  "vietnam": "vn",
  "virgin islands of the united states": "vi",
  "virgin islands, british": "vg",
  "virgin islands, u.s.": "vi",
  "wal": "gb-wls",
  "wales": "gb-wls",
  "wallis and futuna": "wf",
  "west indies": "ag",
  "western sahara": "eh",
  "yemen": "ye",
  "zambia": "zm",
  "zimbabwe": "zw",
  "åland islands": "ax"
};
    const normalized = explicit
      .replace(/[’']/g, "'")
      .replace(/\s+/g, ' ');
    if (countryMap[normalized]) return countryMap[normalized];

    // Some feeds omit country fields for domestic teams. In that case infer
    // only from an unmistakable team/country name; otherwise keep the real
    // team logo/avatar rather than guessing.
    const teamName = safeLabel(
      team?.teamname || team?.teamName || team?.name || team?.displayName || ''
    ).toLowerCase();
    const nameAliases = {
      singapore: 'sg', italy: 'it', india: 'in', england: 'gb-eng',
      australia: 'au', 'south africa': 'za', 'new zealand': 'nz',
      pakistan: 'pk', 'sri lanka': 'lk', bangladesh: 'bd',
      afghanistan: 'af', ireland: 'ie', zimbabwe: 'zw',
      nepal: 'np', scotland: 'gb-sct', 'united arab emirates': 'ae',
      namibia: 'na', oman: 'om', 'united states': 'us', canada: 'ca',
      netherlands: 'nl', france: 'fr', germany: 'de', spain: 'es',
      brazil: 'br', argentina: 'ar', japan: 'jp', china: 'cn',
      'south korea': 'kr', 'hong kong': 'hk', 'west indies': 'ag'
    };
    if (nameAliases[teamName]) return nameAliases[teamName];

    return '';
  }

  function teamMeta(code) {
    const normalized = safeString(code).toLowerCase();
    const key = dynamicTeamKey(code);
    const dynamic = DYNAMIC_TEAMS[key] || {};
    const t = TEAM_REGISTRY[normalized] || dynamic;
    if (t && Object.keys(t).length) {
      const cc = t.cc || '';
      const color = t.color || '#6B7280';
      const img = t.logo || (cc
        ? 'https://flagcdn.com/w80/' + cc + '.png'
        : 'https://ui-avatars.com/api/?name=' + encodeURIComponent(normalized.toUpperCase()) + '&background=' + color.replace('#', '') + '&color=ffffff&size=64&bold=true');
      return {
        code: normalized,
        name: t.name || '',
        flag: t.flag || (cc ? '🌐' : '🏏'),
        cc,
        color,
        img,
        rankName: t.rankName || '',
        imageId: t.imageId || '',
        category: t.category || '',
        isNational: !!t.isNational
      };
    }
    return { code: normalized, name: '', flag: '🏳️', cc: '', color: '#6B7280', img: 'https://ui-avatars.com/api/?name=' + encodeURIComponent(normalized.toUpperCase() || 'TEAM') + '&background=6B7280&color=ffffff&size=64&bold=true', imageId: '', category: '', isNational: false };
  }

  const HOME_T = teamMeta(HOME);
  const AWAY_T = teamMeta(AWAY);

  let HOME_CODE = HOME;
  let AWAY_CODE = AWAY;

  function updateTeamsFromBackend() {
    const data = getMatchData();
    if (!data || !Object.keys(data).length) return;

    const home = data.teams?.home || data.team1 || data.homeTeam || {};
    const away = data.teams?.away || data.team2 || data.awayTeam || {};

    const scorecardRaw = REAL_DATA.scorecard?.data || REAL_DATA.scorecard || {};
    const innings = safeArray(scorecardRaw.scorecard || scorecardRaw.innings);
    const homeFromInnings = innings[0] || {};
    const awayFromInnings = innings[1] || {};
    const resolvedHome = Object.keys(home).length ? home : homeFromInnings;
    const resolvedAway = Object.keys(away).length ? away : awayFromInnings;

    const homeName = safeLabel(resolvedHome.teamname || resolvedHome.teamName || resolvedHome.name || resolvedHome.team_name || resolvedHome.batteamname);
    const awayName = safeLabel(resolvedAway.teamname || resolvedAway.teamName || resolvedAway.name || resolvedAway.team_name || resolvedAway.batteamname);
    const homeShort = safeLabel(resolvedHome.teamsname || resolvedHome.teamSName || resolvedHome.short || resolvedHome.abbreviation || resolvedHome.teamCode || resolvedHome.batteamsname).toLowerCase();
    const awayShort = safeLabel(resolvedAway.teamsname || resolvedAway.teamSName || resolvedAway.short || resolvedAway.abbreviation || resolvedAway.teamCode || resolvedAway.batteamsname).toLowerCase();

    HOME_CODE = homeShort || HOME_CODE || '';
    AWAY_CODE = awayShort || AWAY_CODE || '';

    const homeId = resolvedHome.teamId ?? resolvedHome.teamid ?? resolvedHome.id ?? '';
    const awayId = resolvedAway.teamId ?? resolvedAway.teamid ?? resolvedAway.id ?? '';
    const hDynamic = TEAM_ID_META[String(homeId)] || DYNAMIC_TEAMS[dynamicTeamKey(homeShort)] || DYNAMIC_TEAMS[dynamicTeamKey(homeName)] || {};
    const aDynamic = TEAM_ID_META[String(awayId)] || DYNAMIC_TEAMS[dynamicTeamKey(awayShort)] || DYNAMIC_TEAMS[dynamicTeamKey(awayName)] || {};
    const hMeta = { ...teamMeta(HOME_CODE), ...hDynamic };
    const aMeta = { ...teamMeta(AWAY_CODE), ...aDynamic };
    const hFlagCode = flagCodeForTeam({ ...hDynamic, ...resolvedHome });
    const aFlagCode = flagCodeForTeam({ ...aDynamic, ...resolvedAway });

    const homeImageId = resolvedHome.imageId || resolvedHome.imageID || resolvedHome.logoId || hDynamic.imageId || hMeta.imageId || '';
    const awayImageId = resolvedAway.imageId || resolvedAway.imageID || resolvedAway.logoId || aDynamic.imageId || aMeta.imageId || '';
    const homeLogo = safeLabel(resolvedHome.imageurl || resolvedHome.imageUrl || resolvedHome.teamImage || resolvedHome.logo || resolvedHome.logoUrl || resolvedHome.teamLogo || resolvedHome.image) || teamLogoUrl(homeImageId);
    const awayLogo = safeLabel(resolvedAway.imageurl || resolvedAway.imageUrl || resolvedAway.teamImage || resolvedAway.logo || resolvedAway.logoUrl || resolvedAway.teamLogo || resolvedAway.image) || teamLogoUrl(awayImageId);

    // Country teams use the real country flag. League/domestic teams use the
    // provider logo/imageId. Unknown teams keep the existing safe fallback.
    const hUseFlag = !!hFlagCode && (hDynamic.isNational || !homeLogo);
    const aUseFlag = !!aFlagCode && (aDynamic.isNational || !awayLogo);

    Object.assign(HOME_T, hMeta, {
      code: HOME_CODE,
      name: homeName || hMeta.name || 'Unavailable',
      flag: hUseFlag ? '🏳️' : (hMeta.flag || '🏏'),
      img: hUseFlag ? 'https://flagcdn.com/w80/' + hFlagCode + '.png' : (homeLogo || hMeta.img)
    });
    Object.assign(AWAY_T, aMeta, {
      code: AWAY_CODE,
      name: awayName || aMeta.name || 'Unavailable',
      flag: aUseFlag ? '🏳️' : (aMeta.flag || '🏏'),
      img: aUseFlag ? 'https://flagcdn.com/w80/' + aFlagCode + '.png' : (awayLogo || aMeta.img)
    });

    M.home = HOME_T;
    M.away = AWAY_T;
  }

  // ------------------------------------------------------------------ sport config
  const SPORTS = {
    cricket: { label: 'Cricket', xUnit: 'Overs', xMax: 50, icon: '🏏', isCricket: true },
    football: { label: 'Football', xUnit: 'Min', xMax: 90, icon: '⚽', isBall: false },
    basketball: { label: 'Basketball', xUnit: 'Min', xMax: 48, icon: '🏀', isBall: false },
    tennis: { label: 'Tennis', xUnit: 'Games', xMax: 40, icon: '🎾', isBall: false },
    baseball: { label: 'Baseball', xUnit: 'Inn', xMax: 9, icon: '⚾', isBall: false },
    hockey: { label: 'Hockey', xUnit: 'Min', xMax: 60, icon: '🏒', isBall: false },
    kabaddi: { label: 'Kabaddi', xUnit: 'Min', xMax: 40, icon: '🤼', isKabaddi: true },
    'e-sports': { label: 'E-Sports', xUnit: 'Min', xMax: 60, icon: '🎮', isKabaddi: true },
    tabletennis: { label: 'Table Tennis', xUnit: 'Games', xMax: 11, icon: '🏓', isBall: false },
    volleyball: { label: 'Volleyball', xUnit: 'Sets', xMax: 5, icon: '🏐', isBall: false }
  };
  const SC = SPORTS[SPORT] || SPORTS.cricket;

  // Format-aware overs: ODI=50, T20=20, Test=unlimited (cap at 90 for the clock)
  function formatOvers() {
    const f = (FORMAT_PARAM || '').toUpperCase();
    if (f.indexOf('T20') >= 0 || f.indexOf('TWENTY') >= 0) return 20;
    if (f.indexOf('TEST') >= 0) return 90; // effectively unlimited
    if (f.indexOf('ODI') >= 0 || f.indexOf('ONE DAY') >= 0 || f.indexOf('50') >= 0) return 50;
    if (f.indexOf('100') >= 0) return 100;
    if (SC.isCricket) return 50; // default ODI
    return SC.xMax;
  }
  const FORMAT_OVERS = SC.isCricket ? formatOvers() : SC.xMax;

  // ------------------------------------------------------------------ rules & regulations (sport-aware, proper for ALL games)
  const RULES = {
    cricket: {
      title: 'Cricket — Rules & Regulations',
      points: [
        'Two teams of 11 players; the side batting tries to score runs while the other bowls and fields.',
        'A match is split into innings; each innings ends when 10 batters are out or the allotted overs are bowled.',
        'Runs are scored by running between the wickets (1 per run) or by hitting boundaries (4 for ground, 6 over the rope).',
        'The bowling side dismisses batters via bowled, caught, LBW, run-out, stumped or hit-wicket.',
        'Overs = 6 legal deliveries. No-balls and wides concede extra runs and a free hit may apply.',
        'Limited-overs (ODI/T20): most runs wins. Test: win by runs or wickets; a draw is possible.'
      ]
    },
    football: {
      title: 'Football — Rules & Regulations',
      points: [
        'Two teams of 11 players aim to score by putting the ball into the opponent’s goal.',
        'A standard match is 90 minutes (two 45-minute halves) plus stoppage time.',
        'Goals scored with any part of the body except the hands/arms (goalkeepers excluded in their box).',
        'Fouls and handballs are penalised with free-kicks; serious offences earn yellow/red cards.',
        'Offside: an attacker ahead of the ball and second-last defender when the ball is played.',
        'Most goals at full time wins; draws stand in league play, extra time/penalties in knockouts.'
      ]
    },
    basketball: {
      title: 'Basketball — Rules & Regulations',
      points: [
        'Two teams of five score by shooting the ball through the opponent’s hoop (2 or 3 points).',
        'NBA games are 48 minutes (four 12-minute quarters); FIBA uses four 10-minute quarters.',
        'A shot inside the arc is worth 2, beyond the three-point line is worth 3; free throws are 1 each.',
        'Players may dribble, pass or shoot; travelling and double-dribble are violations.',
        'Personal fouls (5–6) send opponents to the free-throw line; team fouls trigger bonus shots.',
        'The team with the most points when time expires wins; ties go to overtime.'
      ]
    },
    tennis: {
      title: 'Tennis — Rules & Regulations',
      points: [
        'Singles or doubles; players score points to win games, games to win sets, sets to win the match.',
        'Points run 0 (love), 15, 30, 40; deuce at 40–40 needs two clear points to win the game.',
        'A set is won by the first player to 6 games (with a 2-game margin) or via a tiebreak at 6–6.',
        'Serve must land in the diagonal service box; two faults concede the point (double fault).',
        'Ball may bounce once before a return; touching the net or out-of-bounds loses the point.',
        'Best-of-3 (WTA/most ATP) or best-of-5 (Grand Slam men) sets decides the winner.'
      ]
    },
    baseball: {
      title: 'Baseball — Rules & Regulations',
      points: [
        'Two teams of nine; the batting side scores runs by circling the four bases without being out.',
        'A game is nine innings; the home team bats in the bottom half and wins if ahead after the top of the 9th.',
        'Three outs end a half-inning via strikeout, fly-out or force/tag out on the bases.',
        'A batter gets three strikes (a walk on four balls); a home run scores all runners on base.',
        'Pitchers must deliver from the rubber; balks and illegal pitches advance runners.',
        'If tied after nine innings, extra innings are played until a winner emerges.'
      ]
    },
    hockey: {
      title: 'Hockey — Rules & Regulations',
      points: [
        'Two teams of six (including a goalie) score by putting the puck in the opponent’s net with a stick.',
        'NHL games are 60 minutes (three 20-minute periods); ties go to overtime then a shootout.',
        'Goals count only if struck with the stick below the crossbar and inside the posts.',
        'Body-checking, high-sticking and tripping draw penalties (2, 4 or 5 minutes in the box).',
        'Offside and icing stop play; the offending team faces a face-off in their zone.',
        'Power plays award a man-advantage when a player is serving a penalty.'
      ]
    },
    tabletennis: {
      title: 'Table Tennis — Rules & Regulations',
      points: [
        'Singles or doubles rally using paddles; the ball must bounce once on each side.',
        'A game is won at 11 points (by 2); matches are best-of-5 or best-of-7 games.',
        'Serve alternates every 2 points; the ball must be tossed at least 16 cm straight up.',
        'A let is called if the serve clips the net but still lands in play.',
        'Double hits, failure to return, or hitting the ball off the table loses the point.',
        'In doubles, partners must alternate hits and serve diagonally.'
      ]
    },
    volleyball: {
      title: 'Volleyball — Rules & Regulations',
      points: [
        'Two teams of six rally to ground the ball on the opponent’s court.',
        'A match is best-of-5 sets; sets are to 25 (by 2), the decider to 15.',
        'Three touches per side max (usually bump, set, spike); the same player may not touch twice consecutively.',
        'The ball must cross the net within the antennae and not be caught or thrown.',
        'Rotations move players clockwise after winning a serve from the opponent.',
        'Back-row players may not attack the ball above the net from in front of the attack line.'
      ]
    },
    kabaddi: {
      title: 'Kabaddi — Rules & Regulations',
      points: [
        'Two teams of seven; a “raider” crosses to tag defenders and return without taking a breath.',
        'The raider must chant “kabaddi” continuously while in the opponent’s half.',
        'Tagged defenders are out; a successful raid scores a point and revives prior out teammates.',
        'Defenders earn a point by stopping the raider before they return to their side.',
        'Bonus line gives an extra point when 6+ defenders are on the court.',
        'A match has two 20-minute halves; the side with the most points wins.'
      ]
    },
    'e-sports': {
      title: 'E-Sports — Rules & Regulations',
      points: [
        'Team-based competitive gaming; formats vary by title (5v5, battle royale, 1v1).',
        'Matches are played on official patches with approved hardware and settings.',
        'Objectives differ by game (destroy base, eliminate opponents, capture control points).',
        'Pauses require an admin; intentional disconnects are penalised.',
        'Behavioural rules forbid cheating, scripting, toxicity and collusion.',
        'Series are best-of-3/5; the bracket or league table decides the champion.'
      ]
    }
  };
  const RULE_SET = RULES[SPORT] || RULES.cricket;

  // ------------------------------------------------------------------ model
  // IMPORTANT: this model contains no seeded/random/mock match data.
  // It is populated only after the backend responses arrive.
  function emptySquads() {
    return { home: { xi: [], bench: [], staff: [] }, away: { xi: [], bench: [], staff: [] } };
  }

  function emptyGraph() {
    return {
      filters: [
        { key: 'wagon', label: 'Runs / Over' },
        { key: 'runrate', label: 'Run Rate' },
        { key: 'partnership', label: 'Partnership' }
      ],
      active: 'wagon',
      home: [],
      away: [],
      wagon: [],
      runrate: [],
      partnership: [],
      xMax: FORMAT_OVERS,
      xUnit: SC.xUnit
    };
  }

  const M = {
    sport: SPORT,
    state: 'upcoming',
    home: HOME_T,
    away: AWAY_T,
    meta: {
      title: '',
      sub: '',
      venue: '',
      series: '',
      date: '',
      format: '',
      toss: '',
      umpires: '',
      gender: '',
      realResult: '',
      realStatusLine: ''
    },
    score: {
      status: 'upcoming',
      resultText: 'Loading real match data…',
      subText: '',
      icon: '⏳',
      home: { score: '', sub: '', detail: '' },
      away: { score: '', sub: '', detail: '' }
    },
    squads: emptySquads(),
    players: { home: [], away: [] },
    summary: {
      resultLine: '',
      sub: '',
      points: [],
      performers: [],
      potm: null
    },
    scorecard: { type: 'cricket', innings: [] },
    comm: { items: [], label: 'Ball-by-Ball Commentary' },
    graph: emptyGraph(),
    news: { source: 'Live backend', articles: [] },
    info: {
      formHome: [],
      formAway: [],
      h2h: null,
      realRank: { home: null, away: null },
      weather: null,
      pace: null
    }
  };
  // Real result text is applied by applyHeroBackendData() from the backend.

  // ============================================================ builders
  function buildScorecard() { return { type: 'cricket', innings: [] }; }

  function buildCommentary() { return { items: [], label: 'Ball-by-Ball Commentary' }; }

  function buildGraph() { return emptyGraph(); }

  function buildNews() { return { source: 'Live backend', articles: [] }; }

  async function loadRealWeather() {
    const venue = safeString(M.meta.venue || '');
    const city = safeString(getMatchData()?.venue?.city || '').trim();
    const query = city || venue;
    if (!query) return;
    const cacheKey = 'fanconnact:weather:' + query.toLowerCase();
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.savedAt && Date.now() - parsed.savedAt < 15 * 60 * 1000 && parsed.weather) {
          M.info.weather = parsed.weather;
          M.info.weatherFetchedAt = parsed.savedAt;
          return;
        }
      }
    } catch (_) {}
    try {
      const geoRes = await fetch('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(query) + '&count=1&language=en&format=json', { headers: { Accept: 'application/json' } });
      if (!geoRes.ok) return;
      const geo = await geoRes.json();
      const place = geo?.results?.[0];
      if (!place) return;
      const start = parseDateValue(getMatchData()?.startTime || getMatchData()?.startdate);
      const date = start ? start.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
      const now = Date.now();
      const finished = M.score.status === 'finished' && start && start.getTime() < now;
      const url = finished
        ? 'https://archive-api.open-meteo.com/v1/archive?latitude=' + place.latitude + '&longitude=' + place.longitude + '&start_date=' + date + '&end_date=' + date + '&hourly=temperature_2m,relative_humidity_2m,precipitation,rain,weather_code&timezone=auto'
        : 'https://api.open-meteo.com/v1/forecast?latitude=' + place.latitude + '&longitude=' + place.longitude + '&current=temperature_2m,relative_humidity_2m,precipitation,rain,weather_code&hourly=precipitation_probability&forecast_days=2&timezone=auto';
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) return;
      const data = await res.json();
      const codeText = code => ({0:'Clear',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Rime fog',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',71:'Light snow',73:'Snow',75:'Heavy snow',80:'Rain showers',81:'Rain showers',82:'Heavy rain showers',95:'Thunderstorm',96:'Thunderstorm with hail',99:'Thunderstorm with hail'}[Number(code)] || 'Weather data available');
      let weather;
      if (finished) {
        const h = data?.hourly || {};
        const idx = h.time?.length ? Math.max(0, h.time.findIndex(t => t.slice(0,10) === date)) : 0;
        weather = { temp: h.temperature_2m?.[idx] ?? '', hum: h.relative_humidity_2m?.[idx] ?? '', rain: h.rain?.[idx] ?? '', cond: codeText(h.weather_code?.[idx]), place: place.name, source: 'Open-Meteo historical weather' };
      } else {
        const c = data?.current || {};
        weather = { temp: c.temperature_2m ?? '', hum: c.relative_humidity_2m ?? '', rain: c.rain ?? c.precipitation ?? '', cond: codeText(c.weather_code), place: place.name, source: 'Open-Meteo weather' };
      }
      if (weather && weather.temp !== '') {
        M.info.weather = weather;
        M.info.weatherFetchedAt = Date.now();
        try { localStorage.setItem(cacheKey, JSON.stringify({ savedAt: M.info.weatherFetchedAt, weather })); } catch (_) {}
      }
    } catch (_) {}
  }

  function weatherReportHtml() {
    const w = M.info.weather;
    if (!w) return '<p class="text-xs text-gray-500 dark:text-gray-400 mb-6">Real weather data is not available for this venue.</p><div class="bg-blue-50/50 dark:bg-white/5 rounded-xl p-6 flex items-center justify-center"><span class="text-sm text-gray-400">Real weather data not available.</span></div>';
    return '<p class="text-xs text-gray-500 dark:text-gray-400 mb-6">' + esc(w.source || 'Real weather feed') + ' · ' + esc(w.place || M.meta.venue) + '</p><div class="bg-blue-50/50 dark:bg-white/5 rounded-xl p-6 flex flex-wrap items-center justify-between"><div class="flex items-center space-x-4"><div class="w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center text-2xl">🌤️</div><div><p class="text-xs text-gray-500 dark:text-gray-400 font-medium">' + esc(w.place || M.meta.venue) + '</p><h4 class="text-3xl font-bold">' + esc(w.temp) + ' °C</h4></div></div><div class="flex items-center space-x-8 text-sm"><div><span class="mr-2">💧</span><span class="text-gray-500 dark:text-gray-400">' + esc(w.hum) + '% Humidity</span></div><div><span class="mr-2">🌧️</span><span class="text-gray-500 dark:text-gray-400">' + esc(w.rain) + ' mm Rain</span></div><div><p class="text-xs text-gray-400">' + esc(w.cond) + '</p></div></div></div>';
  }

  function applyRealSummaryData() {
    const score = M.score;
    const innings = Array.isArray(M.scorecard?.innings) ? M.scorecard.innings : [];
    const points = [];
    if (M.meta.toss) points.push({ i: '🪙', t: '<b>Toss:</b> ' + esc(M.meta.toss) });
    if (score.home.score) points.push({ i: SC.icon, t: '<b>' + esc(HOME_T.name) + ':</b> ' + esc(score.home.score + score.home.sub) + (score.home.detail ? ' · ' + esc(score.home.detail) : '') });
    if (score.away.score) points.push({ i: SC.icon, t: '<b>' + esc(AWAY_T.name) + ':</b> ' + esc(score.away.score + score.away.sub) + (score.away.detail ? ' · ' + esc(score.away.detail) : '') });
    if (score.resultText) points.push({ i: '🏆', t: '<b>Result:</b> ' + esc(score.resultText) });

    const performers = [];
    innings.forEach(inn => {
      const top = (inn.bat || []).slice().sort((a,b) => Number(b.r||0) - Number(a.r||0))[0];
      if (top && top.n) performers.push({ flag: inn.team?.flag || '🏏', label: 'Top scorer · ' + (inn.team?.name || ''), name: top.n + ' · ' + top.r + ' runs' });
      const bow = (inn.bowl || []).slice().sort((a,b) => Number(b.w||0) - Number(a.w||0))[0];
      if (bow && bow.n && Number(bow.w||0) > 0) performers.push({ flag: '🎯', label: 'Top bowler · ' + (inn.team?.name || ''), name: bow.n + ' · ' + bow.w + ' wickets' });
    });

    let potm = null;
    const raw = getMatchData();
    const pom = raw.playerOfMatch || raw.playerOfTheMatch || raw.potm;
    if (pom) {
      const n = typeof pom === 'object' ? (pom.name || pom.playerName) : pom;
      if (n) potm = { name: String(n), desc: 'Player of the Match' };
    }

    M.summary = {
      resultLine: score.resultText || '',
      sub: [M.meta.series, M.meta.venue].filter(Boolean).join(' · '),
      points,
      performers: performers.slice(0, 4),
      potm
    };
  }

  function applyRealNewsData() {
    const collect = raw => {
      const x = raw?.data || raw || {};
      const list = Array.isArray(x) ? x : safeArray(x.storyList || x.storylist || x.highlights || x.items || x.news || x.data);
      return list.map(item => {
        const story = item?.story || item;
        return {
          title: safeString(story.title || story.hline || story.headline || story.seoHeadline || ''),
          desc: safeString(story.text || story.intro || story.desc || story.description || ''),
          time: formatCommentaryTime(story.pubTime || story.time || story.timestamp || ''),
          image: safeString(story.image || story.imageUrl || story.coverImage?.url || '')
        };
      }).filter(a => a.title);
    };
    const highlights = collect(REAL_DATA.highlights);
    const news = collect(REAL_DATA.news);
    const seen = new Set();
    const articles = [...highlights, ...news].filter(a => {
      const key = a.title.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key); return true;
    }).slice(0, 20);
    M.news = { source: articles.length ? (news && news !== REAL_DATA.highlights ? 'Match / Cricket News Feed' : 'Cricket Highlights') : 'Live cricket feed', articles };
  }

  function badgeClass(type) {
    if (type === 'wicket' || type === 'six' || type === 'out') return 'bg-red-500 text-white';
    if (type === 'four') return 'bg-crexGold text-white';
    if (type === 'milestone') return 'bg-emerald-500 text-white';
    if (type === 'goal' || type === 'hit') return 'bg-emerald-500 text-white';
    if (type === 'three') return 'bg-purple-500 text-white';
    if (type === 'var' || type === 'challenge') return 'bg-amber-500 text-white';
    if (type === 'card') return 'bg-red-600 text-white';
    if (type === 'touch' || type === 'bonus' || type === 'raid') return 'bg-crexGold text-white';
    if (type === 'save' || type === 'pts') return 'bg-sky-500 text-white';
    return 'bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-200';
  }
  // ---- Real player photos from Wikipedia (cached, graceful fallback) ----
  const _wikiCache = {};
  function _wikiImg(name) {
    return Object.prototype.hasOwnProperty.call(_wikiCache, name) ? _wikiCache[name] : null;
  }
  // Fetches the Wikipedia thumbnail for a player name and swaps the <img> once
  // it resolves. Falls back silently (cached as null) if offline / blocked.
  function loadWikiImage(name, teamCode, imgEl) {
    if (!name) return;
    if (Object.prototype.hasOwnProperty.call(_wikiCache, name)) {
      if (_wikiCache[name] && imgEl) imgEl.src = _wikiCache[name];
      return;
    }
    const variants = [name, name.replace(/\s+Jr\.?$/, ''), name.replace(/'/g, ''), name.replace(/\s+Jr$/, '')];
    const tryFetch = (i) => {
      if (i >= variants.length) { _wikiCache[name] = null; return; }
      const title = (variants[i] || '').trim();
      if (!title) { tryFetch(i + 1); return; }
      fetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title))
        .then(r => (r && r.ok ? r.json() : null))
        .then(d => {
          if (d && d.thumbnail && d.thumbnail.source) {
            _wikiCache[name] = d.thumbnail.source;
            if (imgEl) imgEl.src = d.thumbnail.source;
          } else { tryFetch(i + 1); }
        })
        .catch(() => tryFetch(i + 1));
    };
    tryFetch(0);
  }
  // avatar for a player name — uses a real Wikipedia photo when cached,
  // otherwise falls back to a team-coloured initials avatar.
  function avatarFor(name, teamCode) {

    name = String(name || "Player");

    const cached = _wikiImg(name);

    if (cached) return cached;

    const tm = teamMeta(teamCode);

    const initials = name
      .split(" ")
      .map(w => w[0] || "")
      .join("")
      .slice(0, 2)
      .toUpperCase();

    return "https://ui-avatars.com/api/?name=" +
      encodeURIComponent(initials) +
      "&background=" +
      tm.color.replace("#", "") +
      "&color=ffffff&size=64&bold=true&format=png";

  }
  function nowStr() {
    const d = new Date(), p = n => String(n).padStart(2, '0');
    return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }
  // crex-style commentary item with avatars + new-batsman on wicket
  function commItemHtml(it) {
    // Generic match events (non-cricket feeds have no striker/bowler avatars).
    if (!it.striker && !it.bowler) {
      return '<div class="comm-item flex gap-3 p-4" data-type="' + it.type + '">' +
        '<span class="shrink-0 w-12 text-right text-xs font-bold text-crexGold mt-1">' + esc(it.over) + '</span>' +
        '<div class="flex-1 min-w-0"><div class="text-sm text-gray-700 dark:text-gray-200">' + esc(it.text) + '</div>' +
        (it.time ? '<div class="mt-1 text-[10px] text-gray-400">⏱ ' + esc(it.time) + '</div>' : '') + '</div></div>';
    }
    const cls = it.type === 'wicket' ? 'text-red-500' : (it.type === 'four' || it.type === 'six' ? 'text-gray-900 dark:text-white' : '');
    const av = (nm, teamCode, z) => '<a href="player.html" class="relative z-' + z + '"><img alt="' + esc(nm) + '" title="' + esc(nm) + '" class="w-9 h-9 rounded-full border-2 border-white dark:border-[#12172D] cursor-pointer hover:ring-2 hover:ring-crexGold transition" src="' + avatarFor(nm, teamCode) + '"></a>';
    const strikerTeam = M.players.home.indexOf(it.striker) >= 0 ? HOME_CODE : (M.players.away.indexOf(it.striker) >= 0 ? AWAY_CODE : '');
    const bowlerTeam = it.bowler && it.bowler !== '—' && it.bowler !== 'Serve' ? (M.players.home.indexOf(it.bowler) >= 0 ? HOME_CODE : (M.players.away.indexOf(it.bowler) >= 0 ? AWAY_CODE : '')) : '';
    let avatars = '';
    if (it.bowler && it.bowler !== '—' && it.bowler !== 'Serve') {
      avatars = '<div class="comm-avatars shrink-0 flex items-center -space-x-2">' + av(it.striker, strikerTeam, 30) + av(it.bowler, bowlerTeam, 20) + (it.nonstriker ? av(it.nonstriker, strikerTeam, 10) : '') + '</div>';
    } else {
      avatars = '<div class="comm-avatars shrink-0 flex items-center -space-x-2">' + av(it.striker, strikerTeam, 30) + '</div>';
    }
    const newBat = it.type === 'wicket' && it.newBatsman
      ? '<div class="mt-1 text-[11px] text-crexGold font-semibold">🏏 New batsman: ' + esc(it.newBatsman) + '</div>' : '';
    return '<div class="comm-item flex gap-3 p-4" data-type="' + it.type + '">' +
      '<span class="shrink-0 w-12 text-right text-xs font-bold ' + (it.type === 'wicket' ? 'text-red-500' : 'text-crexGold') + ' mt-1">' + esc(it.over) + '</span>' +
      avatars +
      '<div class="flex-1 min-w-0"><div class="flex items-center gap-2 mb-1 flex-wrap"><span class="text-xs font-semibold text-gray-800 dark:text-white">' + esc(it.striker) + '</span>' +
      (it.bowler && it.bowler !== '—' && it.bowler !== 'Serve' ? '<span class="text-[10px] text-gray-400">v</span><span class="text-xs font-semibold text-gray-800 dark:text-white">' + esc(it.bowler) + '</span>' : '') +
      '<span class="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full ' + badgeClass(it.type) + ' text-xs font-bold">' + esc(it.badge) + '</span></div>' +
      '<div class="text-sm text-gray-700 dark:text-gray-200 ' + cls + '">' + esc(it.text) + '</div>' + newBat +
      (it.time ? '<div class="mt-1 text-[10px] text-gray-400">⏱ ' + esc(it.time) + '</div>' : '') + '</div></div>';
  }

  function renderScoreHeader() {
    const sec = $('score-header'); if (!sec) return;
    const st = M.score;
    const statusBadge = st.status === 'live'
      ? '<span class="inline-flex items-center gap-1.5 self-start sm:self-auto px-3 py-1 rounded-full bg-red-500/20 text-red-300 text-[11px] font-semibold border border-red-500/30"><span class="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"></span> Live</span>'
      : st.status === 'upcoming'
        ? '<span class="inline-flex items-center gap-1.5 self-start sm:self-auto px-3 py-1 rounded-full bg-blue-500/15 text-blue-300 text-[11px] font-semibold border border-blue-500/30">Upcoming</span>'
        : st.status === 'finished'
          ? '<span class="inline-flex items-center gap-1.5 self-start sm:self-auto px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 text-[11px] font-semibold border border-emerald-500/30"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Result</span>'
          : '<span class="inline-flex items-center gap-1.5 self-start sm:self-auto px-3 py-1 rounded-full bg-gray-500/15 text-gray-300 text-[11px] font-semibold border border-gray-500/30">Data unavailable</span>';

    const teamPanel = (tm, sc, reverse) => {
      const won = !!sc.won;
      const hasWinner = st.status === 'finished' && !!M.meta.winner;
      const resBadge = hasWinner
        ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full ' + (won ? 'bg-emerald-500/15 dark:text-emerald-300' : 'bg-red-500/15 text-red-600 dark:text-red-300') + ' text-[10px] font-bold uppercase tracking-wide">' + (won ? 'Won' : 'Lost') + '</span>'
        : '';
      return '<div class="flex items-center gap-4 p-5 md:p-6 ' + (reverse ? 'md:flex-row-reverse md:text-right' : '') + '">' +
        '<img alt="' + esc(tm.name) + '" class="w-14 h-14 md:w-16 md:h-16 rounded-full border-2 border-slate-200 dark:border-white/20 shadow-lg shrink-0" src="' + tm.img + '" onerror="this.src=\'https://ui-avatars.com/api/?name=' + encodeURIComponent(tm.code.toUpperCase()) + '&background=6B7280&color=fff&size=64\'">' +
        '<div class="min-w-0">' +
        '<div class="flex items-center gap-2 ' + (reverse ? 'md:justify-end' : '') + '"><p class="text-base font-semibold text-slate-900 dark:text-white">' + esc(tm.name) + '</p>' + resBadge + '</div>' +
        (st.status === 'upcoming'
          ? '<div class="flex items-center gap-2 mt-2 ' + (reverse ? 'md:justify-end' : '') + '"><span class="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-500 dark:text-gray-300">VS</span></div>'
          : '<div class="flex items-baseline gap-1.5 mt-1 ' + (reverse ? 'md:justify-end' : '') + '"><span class="score-flash text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">' + esc(sc.score) + '</span><span class="text-xl font-semibold text-slate-500 dark:text-gray-300">' + esc(sc.sub) + '</span></div>' +
             '<p class="text-xs text-slate-500 dark:text-gray-400 mt-1 ' + (reverse ? 'md:text-right' : '') + '">' + esc(sc.detail || '') + '</p>') +
        '</div></div>';
    };

    const clockHtml = st.status === 'live'
      ? '<div id="live-clock" class="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/15 text-red-300 text-[11px] font-bold border border-red-500/30"><span class="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"></span><span id="live-clock-text">' + esc(SC.isCricket ? ((st.currentOvers ? st.currentOvers + ' ov' : '') || 'LIVE') : (st.subText || 'LIVE')) + '</span></div>'
      : '';
    const center = '<div class="relative flex flex-col items-center justify-center px-4 py-4 md:py-0 md:px-8 border-y md:border-y-0 md:border-x border-gray-200 dark:border-gray-800 bg-slate-50 dark:bg-white/5">' +
      '<div id="center-anim-host" class="pointer-events-none absolute inset-0 flex items-center justify-center z-10"></div>' +
      '<div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-crexGold/20 mb-2"><span class="text-2xl">' + st.icon + '</span></div>' +
      '<h2 class="text-crexGold text-center text-lg md:text-xl font-bold leading-tight">' + esc(st.resultText) + '</h2>' +
      '<p class="text-[11px] text-slate-500 dark:text-gray-400 mt-1 text-center">' + esc(st.subText || '') + '</p>' + clockHtml + '</div>';

    sec.innerHTML =
      '<div class="max-w-7xl mx-auto">' +
      '<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-5">' +
      '<p class="text-xs text-gray-300">' + esc(M.meta.gender ? M.meta.gender + ' · ' : '') + esc(M.meta.format || '') + ' · ' + esc(M.meta.sub) + ' · ' + esc(M.meta.venue) + '</p>' + statusBadge +
      '</div>' +
      '<div class="rounded-2xl bg-white text-slate-900 dark:bg-[#12172D] dark:text-white border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">' +
      '<div class="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-stretch">' +
      teamPanel(HOME_T, st.home, false) + center + teamPanel(AWAY_T, st.away, true) +
      '</div></div>' +
      '<div id="current-players" class="max-w-7xl mx-auto mt-4 flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-white"></div>' +
      '</div>';

    renderCurrentPlayers();
  }

  function renderCurrentPlayers() {
    const el = $('current-players'); if (!el) return;
    if (M.score?.status !== 'live') { el.innerHTML = ''; return; }
    // Current players come only from the real backend match/commentary feed.
    if (SC.isCricket) {
      const raw = getMatchData();
      const current = raw.currentInnings || raw.score?.currentInnings || {};
      const comments = Array.isArray(M.comm) ? M.comm : (M.comm?.items || []);
      const latestComment = comments.slice().reverse().find(x => safeString(x?.striker || x?.nonstriker || x?.bowler).trim()) || null;
      const batters = Array.isArray(raw.currentBatters) ? raw.currentBatters : (Array.isArray(raw.batsmen) ? raw.batsmen : []);
      const bowlers = Array.isArray(raw.currentBowlers) ? raw.currentBowlers : (Array.isArray(raw.bowlers) ? raw.bowlers : []);
      const pickName = p => p?.name || p?.batsmanName || p?.bowlerName || p?.playerName || p?.player || '';
      const flaggedStriker = batters.find(p => p?.isStriker || p?.striker || p?.isOnStrike || p?.onStrike);
      const flaggedNon = batters.find(p => p !== flaggedStriker && (p?.isNonStriker || p?.nonstriker || p?.nonStriker));
      const flaggedBowler = bowlers.find(p => p?.isCurrent || p?.current || p?.isCurrentBowler || p?.isBowler);
      const striker = latestComment?.striker || pickName(flaggedStriker);
      const nonstriker = latestComment?.nonstriker || pickName(flaggedNon);
      const bowler = pickName(flaggedBowler) || latestComment?.bowler || '';
      const battingTeam = safeLabel(current.batteamname || current.teamname || current.team_name || '');
      if (striker || nonstriker || bowler) {
        const battingCode = battingTeam && normalizeTeamToken(battingTeam) === normalizeTeamToken(AWAY_T.name) ? AWAY_CODE : HOME_CODE;
        el.innerHTML = (striker ? mkPlayer(striker, 'Striker · ' + (battingTeam || 'Current innings'), battingCode, nonstriker || null) : '') + (bowler ? mkPlayer(bowler, 'Bowler', battingCode === HOME_CODE ? AWAY_CODE : HOME_CODE, null) : '');
      } else {
        el.innerHTML = '<p class="text-xs text-gray-400">Current batter/bowler data not available from the live feed.</p>';
      }
      return;
    }
    const homeXI = M.squads.home.xi, awayXI = M.squads.away.xi;
    homePlayer = homeXI.length ? homeXI[0].n : (M.players.home.length ? M.players.home[0] : '');
    awayPlayer = awayXI.length ? awayXI[0].n : (M.players.away.length ? M.players.away[0] : '');
    if (!homePlayer && !awayPlayer) { el.innerHTML = ''; return; }
    roleHome = 'Striker'; roleAway = 'Bowler';
    if (SPORT === 'football' || SPORT === 'hockey') { roleHome = 'On Ball'; roleAway = 'Defending'; }
    else if (SPORT === 'basketball') { roleHome = 'With Ball'; roleAway = 'Guarding'; }
    else if (SPORT === 'tennis' || SPORT === 'tabletennis' || SPORT === 'volleyball') { roleHome = 'Serving'; roleAway = 'Receiving'; }
    else if (SPORT === 'kabaddi' || SPORT === 'e-sports') { roleHome = 'Raider'; roleAway = 'Cover'; }
    else if (SPORT === 'baseball') { roleHome = 'At Bat'; roleAway = 'Pitching'; }
    el.innerHTML = mkPlayer(homePlayer, roleHome + ' · ' + HOME_T.name, HOME, null) + mkPlayer(awayPlayer, roleAway + ' · ' + AWAY_T.name, AWAY, null);
  }
  // Player card with a real Wikipedia photo (loaded async) + optional partner label
  function mkPlayer(nm, role, team, partnerName) {
    const tm = teamMeta(team);
    const img = avatarFor(nm, team);
    const partner = partnerName ? '<p class="text-[10px] text-gray-400">with ' + esc(partnerName) + '</p>' : '';
    return '<div class="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 backdrop-blur"><img alt="' + esc(nm) + '" class="w-9 h-9 rounded-full border border-white/20" src="' + img + '" data-wiki-name="' + esc(nm) + '" data-wiki-team="' + esc(team) + '"><div class="text-left leading-tight"><p class="text-xs font-semibold">' + esc(nm) + '</p><p class="text-[10px] text-gray-300">' + esc(role) + '</p>' + partner + '</div></div>';
  }

  // ---- Real team rankings (from backend team-rankings.json) ----
  function rankingCategoryFor(sport, format) {
    if (sport === 'cricket') {
      const f = (format || '').toUpperCase();
      if (f.indexOf('TEST') >= 0) return 'test';
      if (f.indexOf('T20') >= 0 || f.indexOf('TWENTY') >= 0) return 't20';
      return 'odi';
    }
    if (sport === 'football') return 'FIFA';
    if (sport === 'basketball') return 'NBA';
    return null;
  }
  function genderFor(code, name) {
    if ((code || '').indexOf('-w') >= 0 || /women/i.test(name || '')) return 'Women';
    return 'Men';
  }
  function rankFormStrip(winPct) {
    if (winPct == null || winPct === '') return '<span class="text-[10px] text-gray-400">Form unavailable</span>';
    return '<span class="text-[10px] text-gray-400">Win % ' + esc(winPct) + '</span>';
  }

  function formRowReal(tm, rank, fallbackArr) {
    if (!rank) {
      return '<div class="flex items-center justify-between"><div class="flex items-center space-x-3"><img alt="' + esc(tm.name) + '" class="w-6 h-6 rounded-full" src="' + tm.img + '"><span class="font-medium text-gray-700 dark:text-gray-200">' + esc(tm.name) + '</span></div><span class="text-xs text-gray-400">Real ranking/form unavailable</span></div>';
    }
    return '<div class="flex items-center justify-between"><div class="flex items-center space-x-3"><img alt="' + esc(tm.name) + '" class="w-6 h-6 rounded-full" src="' + tm.img + '"><span class="font-medium text-gray-700 dark:text-gray-200">' + esc(tm.name) + '</span></div><div class="flex items-center space-x-2"><span class="text-[10px] text-gray-400">#' + rank.rank + ' · ' + rank.rating + '</span><div class="flex space-x-1">' + rankFormStrip(rank.winPct) + '</div></div></div>';
  }
  function rankingsCompareHtml() {
    // Only cricket uses real rankings for now (API provided is cricket only).
    // No static H2H fallback — if the real ranking isn't available we show a
    // clean "loading / unavailable" state instead of fake data.
    if (!SC.isCricket) return '';
    const h = M.info.realRank.home, a = M.info.realRank.away;
    if (!h && !a) {
      return '<section class="bg-white dark:bg-[#12172D] rounded-lg shadow-sm p-6"><div class="flex justify-between items-center mb-6"><h3 class="font-bold text-gray-800 dark:text-white uppercase text-sm tracking-wide">' + esc(HOME_T.code.toUpperCase()) + ' vs ' + esc(AWAY_T.code.toUpperCase()) + ' Team Ranking</h3><span class="text-xs text-gray-400">Real ratings</span></div>' +
        '<p class="text-sm text-gray-400">Real team rankings are loading from the live data feed…</p></section>';
    }
    const cell = (tm, r) => '<div class="flex flex-col items-center"><img class="w-10 h-10 rounded-full mb-1" src="' + tm.img + '"><span class="font-bold text-gray-800 dark:text-white text-sm">' + esc(tm.code.toUpperCase()) + '</span><span class="text-[10px] text-gray-400">' + (r ? ('#' + r.rank + ' · ' + r.rating) : 'N/A') + '</span></div>';
    const hr = h ? h.rating : null, ar = a ? a.rating : null;
    const hp = (hr != null && ar != null && (hr + ar)) ? Math.round(hr / (hr + ar) * 100) : null;
    const bar = hp == null ? '<div class="w-full h-2 bg-gray-100 dark:bg-white/10 rounded-full"></div>' : '<div class="w-full h-2 bg-gray-100 dark:bg-white/10 rounded-full flex overflow-hidden"><div class="bg-blue-300" style="width:' + hp + '%"></div><div class="bg-blue-600 flex-1"></div></div>';
    return '<section class="bg-white dark:bg-[#12172D] rounded-lg shadow-sm p-6"><div class="flex justify-between items-center mb-6"><h3 class="font-bold text-gray-800 dark:text-white uppercase text-sm tracking-wide">' + esc(HOME_T.code.toUpperCase()) + ' vs ' + esc(AWAY_T.code.toUpperCase()) + ' Team Ranking</h3><span class="text-xs text-gray-400">Real ratings</span></div>' +
      '<div class="flex items-center justify-between mb-8">' + cell(HOME_T, h) + '<div class="flex-1 px-8"><div class="flex justify-between mb-1 text-2xl font-bold"><span class="text-blue-500">' + (h ? h.rating : '—') + '</span><span class="text-gray-300">vs</span><span class="text-blue-500">' + (a ? a.rating : '—') + '</span></div>' + bar + '</div>' + cell(AWAY_T, a) + '</div>' +
      '<div class="grid grid-cols-3 gap-2 text-center text-xs"><div><p class="text-gray-400">Win %</p><p class="font-bold text-gray-800 dark:text-white">' + (h ? h.winPct + '%' : '—') + '</p></div><div><p class="text-gray-400">Matches</p><p class="font-bold text-gray-800 dark:text-white">' + (h ? h.matches : '—') + '</p></div><div><p class="text-gray-400">Win %</p><p class="font-bold text-gray-800 dark:text-white">' + (a ? a.winPct + '%' : '—') + '</p></div></div></section>';
  }
  // ---- Cricket Live Line Advance API (RapidAPI, via backend proxy) ----
  // Replaces the static scorecard / commentary / wagon-wheel / graph with the
  // real feed for cricket. If the provider is unreachable we keep the
  // already-built (real-data) panels — never random data.
  async function fetchCricketApi() {
    if (!SC.isCricket || !MATCHID) return;
    try {
      const [scorecard, commentary, overs] = await Promise.all([
        API.getScorecard().catch(() => null),
        API.getCommentary().catch(() => null),
        API.getOvers().catch(() => null)
      ]);
      if (scorecard) REAL_DATA.scorecard = scorecard;
      if (commentary) REAL_DATA.commentary = commentary;
      if (overs) REAL_DATA.overs = overs;
      if (!REAL_DATA.match) REAL_DATA.match = await API.getMatch().catch(() => null);
      if (!REAL_DATA.match) return;
      updateTeamsFromBackend();
      applyNormalizedModel(normalizeBackendData());
      applyHeroBackendData();
      applyRealSummaryData();
      applyRealNewsData();
      renderScoreHeader(); renderSummary(); renderScorecard(); renderCommentary(); renderGraph(); renderNews();
    } catch (e) {
      console.warn('Real cricket API refresh failed', e);
    }
  }

  async function fetchTeamRankings() {
    if (!SC.isCricket || !MATCHID) return;
    const cat = rankingCategoryFor(SPORT, M.meta.format || FORMAT_PARAM);
    if (!cat) return;
    const women = genderFor(HOME_CODE, HOME_T.name) === 'Women';
    const key = 'fanconnact:ranking:v3:' + (women ? 'women' : 'men') + ':' + cat;
    const applyRankings = list => {
      const hName = (teamMeta(HOME_CODE).rankName) || HOME_T.name;
      const aName = (teamMeta(AWAY_CODE).rankName) || AWAY_T.name;
      const norm = safeArray(list).map(t => ({
        ...t,
        team: safeLabel(t.team || t.name || t.teamName || t.teamname),
        rank: t.rank ?? t.position ?? t.rankPosition ?? t.rank_position,
        rating: t.rating ?? t.points ?? t.ratingPoints ?? t.point ?? t.pts,
        points: t.points ?? t.rating ?? t.pts,
        winPct: t.winPct ?? t.winPercentage ?? t.win_percent ?? t.winPercent
      })).filter(t => t.team);
      const find = name => {
        const n = normalizeTeamToken(name);
        return norm.find(t => normalizeTeamToken(t.team) === n) ||
          norm.find(t => normalizeTeamToken(t.team).includes(n) || n.includes(normalizeTeamToken(t.team)));
      };
      M.info.realRank.home = find(hName) || null;
      M.info.realRank.away = find(aName) || null;
      renderMatchInfo();
    };

    try {
      const cached = localStorage.getItem(key);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.savedAt && Date.now() - parsed.savedAt < 60 * 60 * 1000 && Array.isArray(parsed.rankings)) {
          applyRankings(parsed.rankings);
          return;
        }
      }
    } catch (_) {}

    // One real endpoint only. No invalid /leaderboard fallback request.
    const url = API_PROXY + '/matches/' + encodeURIComponent(MATCHID) + '/rankings?format=' + encodeURIComponent(cat) + '&women=' + (women ? 'true' : 'false');
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000), headers: { Accept: 'application/json' }, cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data) ? data : (Array.isArray(data.rankings) ? data.rankings : Array.isArray(data.data) ? data.data : Array.isArray(data.teams) ? data.teams : []);
      if (!list.length) return;
      try { localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), rankings: list })); } catch (_) {}
      applyRankings(list);
    } catch (_) {}
  }

  function renderMatchInfo() {
    const p = $('panel-match-info'); if (!p) return;
    const formRow = (tm, form) => '<div class="flex items-center justify-between"><div class="flex items-center space-x-3"><img alt="' + esc(tm.name) + '" class="w-6 h-6 rounded-full" src="' + tm.img + '"><span class="font-medium text-gray-700 dark:text-gray-200">' + esc(tm.name) + '</span></div><div class="flex space-x-1">' + form.map(f => '<span class="w-6 h-6 rounded flex items-center justify-center text-[10px] text-white ' + (f === 'W' ? 'bg-green-500' : f === 'L' ? 'bg-red-500' : 'bg-gray-400') + '">' + f + '</span>').join('') + '</div></div>';
    const h2hTotal = M.info.h2h ? (M.info.h2h.home + M.info.h2h.away) : 0;
    const h2hPct = h2hTotal ? Math.round(M.info.h2h.home / h2hTotal * 100) : 0;
    p.innerHTML =
      '<div class="col-span-12 lg:col-span-8 space-y-6">' +
      '<section class="bg-white dark:bg-[#12172D] rounded-lg shadow-sm p-5 flex items-start space-x-6"><div class="w-16 h-16 bg-gray-100 dark:bg-white/5 rounded-lg flex items-center justify-center border text-3xl">' + SC.icon + '</div>' +
      '<div class="flex-1"><div class="flex items-center justify-between"><span class="text-xs text-gray-500 dark:text-gray-400">' + esc(M.meta.format) + '</span><span class="text-xs text-blue-600 font-medium">' + esc(HOME_T.code.toUpperCase()) + ' vs ' + esc(AWAY_T.code.toUpperCase()) + ' &gt;</span></div>' +
      '<div class="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-300"><div class="flex items-center space-x-3"><span class="w-4">📅</span><span>' + esc(M.meta.date) + '</span></div>' +
      '<div class="flex items-center space-x-3"><span class="w-4">📍</span><span class="text-blue-500">' + esc(M.meta.venue) + '</span></div>' +
      '<div class="flex items-center space-x-3"><span class="w-4">📺</span><span>' + esc(M.meta.broadcast || 'Broadcast data not available') + '</span></div></div></div></section>' +
      '<section class="bg-white dark:bg-[#12172D] rounded-lg shadow-sm p-6"><div class="flex justify-between items-center mb-6"><h3 class="font-bold text-gray-800 dark:text-white">' + esc(HOME_T.code.toUpperCase()) + ' &amp; ' + esc(AWAY_T.code.toUpperCase()) + ' Team Form</h3><span class="text-xs text-gray-400">' + (M.info.realRank.home || M.info.realRank.away ? 'Real ranking' : 'Real form unavailable') + '</span></div><div class="space-y-4">' + formRowReal(HOME_T, M.info.realRank.home, M.info.formHome) + formRowReal(AWAY_T, M.info.realRank.away, M.info.formAway) + '</div></section>' +
      rankingsCompareHtml() +
      '<section class="bg-white dark:bg-[#12172D] rounded-lg shadow-sm p-6"><h3 class="font-bold text-gray-800 dark:text-white text-sm uppercase mb-2">' + esc(HOME_T.code.toUpperCase()) + ' vs ' + esc(AWAY_T.code.toUpperCase()) + ' Weather &amp; Pitch Report</h3>' + weatherReportHtml() + '</section>' +
      '</div>' +
      '<aside class="col-span-12 lg:col-span-4 space-y-6">' +
      '<section class="bg-white dark:bg-[#12172D] rounded-xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-800"><div class="aspect-video w-full overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center"><span class="text-sm text-gray-400">Real venue image not available</span></div>' +
      '<div class="p-5 space-y-4"><h3 class="font-bold text-gray-800 dark:text-white uppercase tracking-wide text-sm">Toss &amp; Report</h3>' +
      '<div class="space-y-3"><div class="flex items-start space-x-3 bg-gray-50 dark:bg-white/5 p-3 rounded-lg"><span class="text-crexGold mt-0.5 text-lg">🪙</span><div><p class="text-[11px] font-semibold text-crexGold mb-1 uppercase tracking-wide">Toss Result</p><p class="text-sm text-gray-700 dark:text-gray-200">' + esc(M.meta.toss) + '.</p></div></div>' +
      '<div class="flex items-start space-x-3 bg-gray-50 dark:bg-white/5 p-3 rounded-lg"><span class="text-blue-500 mt-0.5 text-lg">📊</span><div><p class="text-[11px] font-semibold text-blue-500 mb-1 uppercase tracking-wide">Match Context</p><p class="text-sm text-gray-600 dark:text-gray-300">' + esc(M.meta.series) + ' · ' + esc(M.meta.venue) + '</p></div></div></div></div></section>' +
      '<section class="bg-white dark:bg-[#12172D] rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-800"><h3 class="font-bold text-gray-800 dark:text-white text-sm uppercase tracking-wide mb-4">Match Info</h3><div class="space-y-3 text-sm">' +
      '<div class="flex justify-between"><span class="text-gray-500 dark:text-gray-400">Format</span><span class="font-bold text-gray-800 dark:text-white">' + esc(M.meta.format) + '</span></div>' +
      (M.meta.day ? '<div class="flex justify-between"><span class="text-gray-500 dark:text-gray-400">Day</span><span class="font-bold text-gray-800 dark:text-white text-right">' + esc(M.meta.day) + '</span></div>' : '') +
      (M.meta.session ? '<div class="flex justify-between"><span class="text-gray-500 dark:text-gray-400">Session</span><span class="font-bold text-gray-800 dark:text-white text-right">' + esc(M.meta.session) + '</span></div>' : '') +
      '<div class="flex justify-between"><span class="text-gray-500 dark:text-gray-400">Series</span><span class="font-bold text-gray-800 dark:text-white text-right">' + esc(M.meta.series) + '</span></div>' +
      '<div class="flex justify-between"><span class="text-gray-500 dark:text-gray-400">Venue</span><span class="font-bold text-gray-800 dark:text-white text-right">' + esc(M.meta.venue) + '</span></div>' +
      '<div class="flex justify-between"><span class="text-gray-500 dark:text-gray-400">Umpires</span><span class="font-bold text-gray-800 dark:text-white text-right">' + esc(M.meta.umpires) + '</span></div></div></section>' +
      '</aside>';
  }

  function renderSummary() {
    const p = $('panel-summary'); if (!p) return;
    const st = M.score;
    if (!M.summary.points) {
      M.summary.points = [];
    }

    if (!M.summary.performers) {
      M.summary.performers = [];
    }
    const resBadge = st.status === 'finished'
      ? '<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-semibold border border-emerald-500/30"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Result</span>'
      : st.status === 'live' ? '<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 text-red-300 text-[11px] font-semibold border border-red-500/30"><span class="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"></span> Live</span>'
        : st.status === 'upcoming' ? '<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/15 text-blue-300 text-[11px] font-semibold border border-blue-500/30">Upcoming</span>'
        : '<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-500/15 text-gray-300 text-[11px] font-semibold border border-gray-500/30">Data unavailable</span>';
    const points = (M.summary.points || []).map(pt => '<li class="flex items-start gap-3"><span class="text-xl mt-0.5">' + pt.i + '</span><span>' + pt.t + '</span></li>').join('');
    const perf = (M.summary.performers || []).map(pf => '<div class="flex items-center gap-3 bg-gray-50 dark:bg-white/5 rounded-lg p-3"><span class="text-2xl">' + pf.flag + '</span><div><p class="text-xs text-gray-400">' + esc(pf.label) + '</p><p class="font-bold text-gray-800 dark:text-white">' + esc(pf.name) + '</p></div></div>').join('');
    p.innerHTML =
      '<div class="col-span-12 lg:col-span-8 space-y-6">' +
      '<section class="rounded-2xl overflow-hidden shadow-lg bg-white dark:bg-[#12172D] border border-gray-200 dark:border-gray-800"><div class="bg-gradient-to-r from-[#0b1626] to-[#1c2e4a] px-6 py-5 flex items-center justify-between"><div class="flex items-center gap-3"><span class="text-3xl">' + st.icon + '</span><div><h2 class="text-white text-xl font-bold leading-tight">' + esc(st.resultText) + '</h2><p class="text-gray-300 text-xs mt-0.5">' + esc(M.summary.sub) + '</p></div></div>' + resBadge + '</div>' +
      '<div class="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200 dark:divide-gray-800">' +
      teamSummaryCard(HOME_T, st.home) + teamSummaryCard(AWAY_T, st.away) + '</div></section>' +
      '<section class="bg-white dark:bg-[#12172D] rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-800"><h3 class="font-bold text-gray-800 dark:text-white text-sm uppercase tracking-wide mb-4">Match Summary</h3><ul class="space-y-3 text-sm text-gray-600 dark:text-gray-300">' + points + '</ul></section>' +
      '<section class="bg-white dark:bg-[#12172D] rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-800"><h3 class="font-bold text-gray-800 dark:text-white text-sm uppercase tracking-wide mb-4">Key Performers</h3><div class="grid grid-cols-1 sm:grid-cols-2 gap-4">' + perf + '</div></section>' +
      (st.status === 'finished' && M.summary.potm ? '<section class="bg-gradient-to-r from-crexGold/10 to-transparent rounded-lg shadow-sm p-6 border border-crexGold/30"><div class="flex items-center justify-between mb-3"><h3 class="font-bold text-gray-800 dark:text-white text-sm uppercase tracking-wide">Player of the Match</h3><span class="text-2xl">🏆</span></div><div class="flex items-center gap-4"><div class="w-14 h-14 rounded-full bg-crexGold/20 flex items-center justify-center text-2xl">⭐</div><div><p class="font-bold text-gray-800 dark:text-white">' + esc(M.summary.potm.name) + '</p><p class="text-xs text-gray-500 dark:text-gray-400">' + esc(M.summary.potm.desc) + '</p></div></div></section>' : '') +
      '</div>' +
      '<aside class="col-span-12 lg:col-span-4 space-y-6">' +
      '<section class="bg-white dark:bg-[#12172D] rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-800"><h3 class="font-bold text-gray-800 dark:text-white text-sm uppercase tracking-wide mb-4">Result Detail</h3><div class="space-y-3 text-sm">' +
      '<div class="flex justify-between"><span class="text-gray-500 dark:text-gray-400">Result</span><span class="font-bold ' + (st.status === 'finished' ? 'text-emerald-600 dark:text-emerald-400' : 'text-crexGold') + '">' + esc(st.resultText) + '</span></div>' +
      '<div class="flex justify-between"><span class="text-gray-500 dark:text-gray-400">Status</span><span class="font-bold text-gray-800 dark:text-white">' + (st.status === 'live' ? 'In Progress' : st.status === 'upcoming' ? 'Not Started' : st.status === 'finished' ? 'Completed' : 'Unavailable') + '</span></div>' +
      '<div class="flex justify-between"><span class="text-gray-500 dark:text-gray-400">Toss</span><span class="font-bold text-gray-800 dark:text-white text-right">' + esc(M.meta.toss) + '</span></div></div></section>' +
      '<section class="bg-white dark:bg-[#12172D] rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-800"><h3 class="font-bold text-gray-800 dark:text-white text-sm uppercase tracking-wide mb-4">Match Info</h3><div class="space-y-3 text-sm">' +
      '<div class="flex justify-between"><span class="text-gray-500 dark:text-gray-400">Format</span><span class="font-bold text-gray-800 dark:text-white">' + esc(M.meta.format) + '</span></div>' +
      '<div class="flex justify-between"><span class="text-gray-500 dark:text-gray-400">Series</span><span class="font-bold text-gray-800 dark:text-white text-right">' + esc(M.meta.series) + '</span></div>' +
      '<div class="flex justify-between"><span class="text-gray-500 dark:text-gray-400">Venue</span><span class="font-bold text-gray-800 dark:text-white text-right">' + esc(M.meta.venue) + '</span></div></div></section>' +
      '<section class="bg-white dark:bg-[#12172D] rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-800"><h3 class="font-bold text-gray-800 dark:text-white text-sm uppercase tracking-wide mb-4">About the Teams</h3><div class="space-y-4 text-sm text-gray-600 dark:text-gray-300">' +
      '<div class="flex gap-3"><span class="text-2xl shrink-0">' + HOME_T.flag + '</span><div><p class="font-bold text-gray-800 dark:text-white mb-1">' + esc(HOME_T.name) + '</p><p>Team information is shown only when supplied by the live backend.</p></div></div>' +
      '<div class="flex gap-3"><span class="text-2xl shrink-0">' + AWAY_T.flag + '</span><div><p class="font-bold text-gray-800 dark:text-white mb-1">' + esc(AWAY_T.name) + '</p><p>Team information is shown only when supplied by the live backend.</p></div></div>' +
      '</div></section></aside>';
  }

  function teamSummaryCard(tm, sc) {
    const won = !!sc.won;
    const hasWinner = M.score.status === 'finished' && !!M.meta.winner;
    return '<div class="p-6 flex items-center gap-4"><img alt="' + esc(tm.name) + '" class="w-14 h-14 rounded-full border-2 border-slate-200 dark:border-white/20 shadow" src="' + tm.img + '">' +
      '<div><div class="flex items-center gap-2"><p class="text-base font-semibold text-slate-900 dark:text-white">' + esc(tm.name) + '</p>' +
      (hasWinner ? '<span class="px-2 py-0.5 rounded-full ' + (won ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300' : 'bg-red-500/15 text-red-600 dark:text-red-300') + ' text-[10px] font-bold uppercase">' + (won ? 'Won' : 'Lost') + '</span>' : '') + '</div>' +
      '<div class="flex items-baseline gap-1.5 mt-1"><span class="text-3xl font-extrabold text-slate-900 dark:text-white">' + esc(sc.score) + '</span><span class="text-lg font-semibold text-slate-500 dark:text-gray-300">' + esc(sc.sub) + '</span></div>' +
      '<p class="text-xs text-slate-500 dark:text-gray-400 mt-1">' + esc(sc.detail || '') + '</p></div></div>';
  }

  function renderScorecard() {
    const p = $('panel-scorecard'); if (!p) return;
    const sc = M.scorecard;
    // ======================================================
    // USE REAL BACKEND SCORECARD
    // ======================================================

    let html = '<div class="col-span-12 space-y-6">';
    if (REAL_DATA.scorecard && sc.innings) {

      console.log("Using Backend Scorecard");

    }
    if (!sc || !Array.isArray(sc.innings) || !sc.innings.length) {
      // Non-cricket: no innings model — show the real final/live score instead.
      if (!SC.isCricket && M.score && (M.score.home.score !== '' || M.score.away.score !== '')) {
        html += '<section class="rounded-2xl overflow-hidden shadow-lg bg-white dark:bg-[#12172D] border border-gray-200 dark:border-gray-800"><div class="bg-[#0b1626] px-5 py-4"><h3 class="font-bold text-white text-sm uppercase tracking-wide">Match Score · ' + esc(SC.label) + '</h3></div><div class="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200 dark:divide-gray-800">' +
          teamSummaryCard(HOME_T, M.score.home) + teamSummaryCard(AWAY_T, M.score.away) + '</div>' +
          (M.score.home.detail || M.score.away.detail ? '<div class="px-5 py-4 border-t border-gray-200 dark:border-gray-800"><p class="text-sm text-gray-600 dark:text-gray-300">' + esc([M.score.home.detail, M.score.away.detail].filter(Boolean).join(' · ')) + '</p></div>' : '') + '</section></div>';
        p.innerHTML = html;
        return;
      }
      html += '<section class="bg-white dark:bg-[#12172D] rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-800"><p class="text-sm text-gray-400">Real scorecard data is not available from the live feed.</p></section></div>';
      p.innerHTML = html;
      return;
    }
    if (sc.type === 'cricket') {
      const activeInn = sc.innings.findIndex(i => i.isCurrent);
      const defaultInn = activeInn >= 0 ? activeInn : Math.max(0, sc.innings.length - 1);
      if (sc.innings.length > 1) {
          html += '<section class="bg-white dark:bg-[#12172D] rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-3"><div id="scorecard-innings-tabs" class="flex gap-2 overflow-x-auto">' + sc.innings.map((inn, i) => { const tabLabel = inn.isTest ? (inn.shortLabel || (shortTestTeamLabel(inn.team, inn.team?.name) + ' (' + (inn.inningsNumber === 1 ? '1st' : '2nd') + ' Inn)')) : (inn.team.name + ' (' + (i===0?'1st':i===1?'2nd':i===2?'3rd':(i+1)+'th') + ' Innings)'); return '<button type="button" data-inn-index="' + i + '" class="scorecard-inn-tab px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap ' + (i === defaultInn ? 'bg-crexGold text-white' : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300') + '">' + esc(tabLabel) + '</button>'; }).join('') + '</div></section>';
      }
      sc.innings.forEach((inn, index) => {
        const currentComments = Array.isArray(M.comm) ? M.comm : (M.comm?.items || []);
        const latestComment = currentComments.length ? currentComments[currentComments.length - 1] : null;
        const liveStrikerName = inn.isCurrent ? ((inn.bat || []).find(b => b.isStriker)?.n || latestComment?.striker || '') : '';
        const batRows = (inn.bat || []).map(b => {
          const isStriker = !!liveStrikerName && String(b.n).trim().toLowerCase() === String(liveStrikerName).trim().toLowerCase();
          const displayName = esc(b.n) + (isStriker ? ' <span class="text-crexGold font-extrabold ml-1">*</span>' : '');
          return '<tr class="border-b border-gray-100 dark:border-gray-800"><td class="py-2 pr-4"><div class="font-medium">' + displayName + '</div>' + (b.dismissal ? '<div class="text-[10px] text-gray-400 mt-0.5">' + esc(b.dismissal) + '</div>' : (b.out ? '' : '<span class="text-emerald-600 dark:text-emerald-400 text-xs font-semibold">NOT OUT</span>')) + '</td><td class="py-2 px-2 text-right font-semibold">' + esc(b.r) + '</td><td class="py-2 px-2 text-right">' + esc(b.b) + '</td><td class="py-2 px-2 text-right">' + esc(b.f) + '</td><td class="py-2 px-2 text-right">' + esc(b.sx) + '</td><td class="py-2 px-2 text-right">' + esc(b.sr) + '</td></tr>';
        }).join('');
        const bowlRows = (inn.bowl || []).map(b => '<tr class="border-b border-gray-100 dark:border-gray-800"><td class="py-2 pr-4">' + esc(b.n) + '</td><td class="py-2 px-2 text-right">' + esc(b.o) + '</td><td class="py-2 px-2 text-right">' + esc(b.m) + '</td><td class="py-2 px-2 text-right">' + esc(b.r) + '</td><td class="py-2 px-2 text-right font-semibold text-emerald-600 dark:text-emerald-400">' + esc(b.w) + '</td><td class="py-2 px-2 text-right">' + esc(b.econ) + '</td></tr>').join('');
        const extras = inn.extras && Object.keys(inn.extras).length ? Object.entries(inn.extras).map(([k,v]) => '<span class="text-xs text-gray-500 dark:text-gray-400 mr-4">' + esc(k) + ': <b>' + esc(v) + '</b></span>').join('') : '';
        const fow = (inn.fow || []).map(x => '<span class="inline-flex items-center gap-1 text-xs mr-3 mb-1"><b>' + esc(x.wicket || '') + '</b> ' + esc(x.player || '') + (x.score ? ' (' + esc(x.score) + ')' : '') + (x.over ? ' · ' + esc(x.over) : '') + '</span>').join('');
        const partnerships = (inn.partnerships || []).map(x => '<tr class="border-b border-gray-100 dark:border-gray-800"><td class="py-2 px-3">' + esc(x.player1 || '') + ' &amp; ' + esc(x.player2 || '') + '</td><td class="py-2 px-3 text-right font-semibold">' + esc(x.runs) + '</td><td class="py-2 px-3 text-right">' + esc(x.balls) + '</td></tr>').join('');
        const metaBits = [inn.total !== '' ? inn.total + (inn.wkts !== '' ? '/' + inn.wkts : '') : '', inn.ov ? '(' + inn.ov + ')' : '', inn.crr ? 'CRR ' + inn.crr : '', inn.declared ? 'declared' : '', inn.followOn ? 'FOLLOW-ON' : '', inn.revisedTarget ? 'revised target ' + inn.revisedTarget : ''].filter(Boolean).join(' ');
        html += '<section data-scorecard-inn="' + index + '" class="scorecard-inn-section bg-white dark:bg-[#12172D] rounded-lg shadow-sm overflow-hidden border border-gray-200 dark:border-gray-800" style="' + (sc.innings.length > 1 && index !== defaultInn ? 'display:none;' : '') + '">' +
          '<div class="flex items-center justify-between px-5 py-4 bg-[#0b1626] text-white"><div class="flex items-center gap-3"><img alt="' + esc(inn.team.name) + '" class="w-8 h-8 rounded-full" src="' + esc(inn.team.img) + '"><div><h3 class="font-bold text-lg leading-none">' + esc(inn.team.code.toUpperCase()) + '</h3><p class="text-xs text-gray-300 mt-1">' + esc(metaBits) + '</p></div></div><span class="text-xs text-gray-300">' + esc(inn.label) + '</span></div>' +
          '<div class="p-5"><h4 class="font-bold text-gray-800 dark:text-white text-sm uppercase tracking-wide mb-3">Batting</h4><div class="overflow-x-auto"><table class="w-full text-sm text-left"><thead><tr class="text-gray-400 text-xs uppercase border-b border-gray-200 dark:border-gray-700"><th class="py-2 pr-4 font-medium">Batter</th><th class="py-2 px-2 font-medium text-right">R</th><th class="py-2 px-2 font-medium text-right">B</th><th class="py-2 px-2 font-medium text-right">4s</th><th class="py-2 px-2 font-medium text-right">6s</th><th class="py-2 px-2 font-medium text-right">SR</th></tr></thead><tbody class="text-gray-700 dark:text-gray-200">' + (batRows || '<tr><td colspan="6" class="py-4 text-center text-sm text-gray-400">Batting data not available.</td></tr>') + '</tbody></table></div></div>' +
          '<div class="p-5 border-t border-gray-200 dark:border-gray-800"><h4 class="font-bold text-gray-800 dark:text-white text-sm uppercase tracking-wide mb-3">Bowling</h4><div class="overflow-x-auto"><table class="w-full text-sm text-left"><thead><tr class="text-gray-400 text-xs uppercase border-b border-gray-200 dark:border-gray-700"><th class="py-2 pr-4 font-medium">Bowler</th><th class="py-2 px-2 font-medium text-right">O</th><th class="py-2 px-2 font-medium text-right">M</th><th class="py-2 px-2 font-medium text-right">R</th><th class="py-2 px-2 font-medium text-right">W</th><th class="py-2 px-2 font-medium text-right">Econ</th></tr></thead><tbody class="text-gray-700 dark:text-gray-200">' + (bowlRows || '<tr><td colspan="6" class="py-4 text-center text-sm text-gray-400">Bowling data not available.</td></tr>') + '</tbody></table></div></div>' +
          (inn.powerplays && inn.powerplays.length ? '<div class="px-5 py-4 border-t border-gray-200 dark:border-gray-800"><h4 class="font-bold text-gray-800 dark:text-white text-sm uppercase tracking-wide mb-2">Powerplays</h4><div class="flex flex-wrap gap-2">' + inn.powerplays.map(pp => '<span class="text-xs rounded-lg bg-gray-100 dark:bg-white/5 px-2.5 py-1.5 text-gray-600 dark:text-gray-300">' + esc(pp.name || pp.type || 'Powerplay') + (pp.runs != null ? ' · ' + esc(pp.runs) + ' runs' : '') + (pp.overs ? ' · ' + esc(pp.overs) + ' overs' : '') + '</span>').join('') + '</div></div>' : '') +
          (extras ? '<div class="px-5 py-4 border-t border-gray-200 dark:border-gray-800"><h4 class="font-bold text-gray-800 dark:text-white text-sm uppercase tracking-wide mb-2">Extras</h4>' + extras + '</div>' : '') +
          (fow ? '<div class="px-5 py-4 border-t border-gray-200 dark:border-gray-800"><h4 class="font-bold text-gray-800 dark:text-white text-sm uppercase tracking-wide mb-2">Fall of Wickets</h4>' + fow + '</div>' : '') +
          (partnerships ? '<div class="px-5 py-4 border-t border-gray-200 dark:border-gray-800"><h4 class="font-bold text-gray-800 dark:text-white text-sm uppercase tracking-wide mb-2">Partnerships</h4><div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="text-gray-400 text-xs uppercase"><th class="py-2 px-3 text-left">Batters</th><th class="py-2 px-3 text-right">Runs</th><th class="py-2 px-3 text-right">Balls</th></tr></thead><tbody>' + partnerships + '</tbody></table></div></div>' : '') +
          '</section>';
      });
    } else if (sc.type === 'tennis') {
      const rows = sc.rows.map(r => '<tr class="border-b border-gray-100 dark:border-gray-800"><td class="py-2 px-4 font-semibold">' + r.set + '</td><td class="py-2 px-4 text-right">' + r.home + '</td><td class="py-2 px-4 text-right">' + r.away + '</td><td class="py-2 px-4 text-right text-gray-400">' + (r.tb != null ? ('TB ' + r.tb) : '—') + '</td></tr>').join('');
      html += '<section class="bg-white dark:bg-[#12172D] rounded-lg shadow-sm overflow-hidden border border-gray-200 dark:border-gray-800"><div class="p-5"><h4 class="font-bold text-gray-800 dark:text-white text-sm uppercase tracking-wide mb-3">' + esc(sc.home.name) + ' vs ' + esc(sc.away.name) + ' — Set Scores</h4><div class="overflow-x-auto"><table class="w-full text-sm text-left"><thead><tr class="text-gray-400 text-xs uppercase border-b border-gray-200 dark:border-gray-700"><th class="py-2 px-4 font-medium">Set</th><th class="py-2 px-4 font-medium text-right">' + esc(sc.home.code.toUpperCase()) + '</th><th class="py-2 px-4 font-medium text-right">' + esc(sc.away.code.toUpperCase()) + '</th><th class="py-2 px-4 font-medium text-right">Tiebreak</th></tr></thead><tbody class="text-gray-700 dark:text-gray-200">' + rows + '</tbody></table></div></div></section>';
    } else if (sc.type === 'baseball') {
      const rows = sc.innings.map(r => '<tr class="border-b border-gray-100 dark:border-gray-800"><td class="py-2 px-4 font-semibold">' + r.n + '</td><td class="py-2 px-4 text-right">' + r.home + '</td><td class="py-2 px-4 text-right">' + r.away + '</td></tr>').join('');
      html += '<section class="bg-white dark:bg-[#12172D] rounded-lg shadow-sm overflow-hidden border border-gray-200 dark:border-gray-800"><div class="p-5"><h4 class="font-bold text-gray-800 dark:text-white text-sm uppercase tracking-wide mb-3">Innings Breakdown</h4><div class="overflow-x-auto"><table class="w-full text-sm text-left"><thead><tr class="text-gray-400 text-xs uppercase border-b border-gray-200 dark:border-gray-700"><th class="py-2 px-4 font-medium">Inn</th><th class="py-2 px-4 font-medium text-right">' + esc(sc.home.code.toUpperCase()) + '</th><th class="py-2 px-4 font-medium text-right">' + esc(sc.away.code.toUpperCase()) + '</th></tr></thead><tbody class="text-gray-700 dark:text-gray-200">' + rows + '</tbody></table></div></div></section>';
    } else {
      const rows = sc.stats.map(s => {
        const hp = Math.round(s.h / (s.h + s.a) * 100);
        return '<tr class="border-b border-gray-100 dark:border-gray-800"><td class="py-2 px-4 text-right font-semibold text-gray-800 dark:text-white">' + s.h + '</td><td class="py-2 px-4 text-center text-xs text-gray-400 uppercase">' + s.k + '</td><td class="py-2 px-4 text-right font-semibold text-gray-800 dark:text-white">' + s.a + '</td></tr>' +
          '<tr><td colspan="3" class="py-1"><div class="w-full h-2 bg-gray-100 dark:bg-white/10 rounded-full flex overflow-hidden"><div class="bg-' + sc.home.code + ' h-full" style="width:' + hp + '%"></div><div class="bg-' + sc.away.code + ' h-full" style="width:' + (100 - hp) + '%"></div></div></td></tr>';
      }).join('');
      html += '<section class="bg-white dark:bg-[#12172D] rounded-lg shadow-sm overflow-hidden border border-gray-200 dark:border-gray-800"><div class="p-5"><h4 class="font-bold text-gray-800 dark:text-white text-sm uppercase tracking-wide mb-3">Match Stats</h4><div class="overflow-x-auto"><table class="w-full text-sm text-left"><thead><tr class="text-gray-400 text-xs uppercase border-b border-gray-200 dark:border-gray-700"><th class="py-2 px-4 font-medium text-right">' + esc(sc.home.code.toUpperCase()) + '</th><th class="py-2 px-4"></th><th class="py-2 px-4 font-medium text-right">' + esc(sc.away.code.toUpperCase()) + '</th></tr></thead><tbody>' + rows + '</tbody></table></div></div></section>';
    }
    html += '</div>';
    p.innerHTML = html;
    const innTabs = p.querySelectorAll('.scorecard-inn-tab');
    innTabs.forEach(tab => tab.addEventListener('click', () => {
      const idx = Number(tab.dataset.innIndex);
      p.querySelectorAll('.scorecard-inn-section').forEach(sec => { sec.style.display = Number(sec.dataset.scorecardInn) === idx ? '' : 'none'; });
      innTabs.forEach(t => { const on = t === tab; t.classList.toggle('bg-crexGold', on); t.classList.toggle('text-white', on); t.classList.toggle('bg-gray-100', !on); t.classList.toggle('dark:bg-white/5', !on); t.classList.toggle('text-gray-600', !on); t.classList.toggle('dark:text-gray-300', !on); });
    }));
  }

  function renderSquads() {

    if (REAL_DATA.squads) {
      console.log("Using Backend Squads");
    }
    const p = $('panel-squads'); if (!p) return;
    const playerLink = (player, tm) => {
      const badges = (player.c ? '<span class="text-[10px] font-bold text-crexGold border border-crexGold/40 rounded px-1">C</span>' : '') + (player.wk ? '<span class="text-[10px] font-bold text-blue-500 border border-blue-500/40 rounded px-1">WK</span>' : '');
      return '<a href="player.html" class="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group" data-pname="' + esc(player.n) + '" data-pcountry="' + esc(tm.name) + '" data-pid="' + esc(player.id || '') + '"><img alt="' + esc(player.n) + '" class="w-8 h-8 rounded-full border border-gray-200 dark:border-white/10 shrink-0" src="https://ui-avatars.com/api/?name=' + encodeURIComponent(player.n.split(' ').map(w => w[0]).join('')) + '&background=' + tm.color.replace('#', '') + '&color=fff&size=64"><div class="min-w-0 flex-1"><div class="flex items-center gap-1.5"><span class="text-sm font-medium text-gray-800 dark:text-white group-hover:text-crexGold truncate">' + esc(player.n) + '</span>' + badges + '</div><p class="text-[11px] text-gray-400 truncate">' + esc(player.r) + '</p></div></a>';
    };
    const squadCol = (tm, key) => {
      const squad = M.squads[key] || { xi: [], bench: [], staff: [] };
      const xi = squad.xi.map(player => playerLink(player, tm)).join('');
      const bench = squad.bench.map(player => playerLink(player, tm)).join('');
      const staff = (squad.staff || []).map(staffMember => '<div class="flex items-center gap-3 px-3 py-2"><img alt="' + esc(staffMember.n) + '" class="w-8 h-8 rounded-full border border-gray-200 dark:border-white/10 shrink-0" src="https://ui-avatars.com/api/?name=' + encodeURIComponent(staffMember.n.split(' ').map(w => w[0]).join('')) + '&background=' + tm.color.replace('#', '') + '&color=fff&size=64"><div class="min-w-0 flex-1"><div class="text-sm font-medium text-gray-800 dark:text-white truncate">' + esc(staffMember.n) + '</div><p class="text-[11px] text-gray-400 truncate">' + esc(staffMember.r) + '</p></div></div>').join('');
      return '<div><p class="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">' + esc(tm.name) + '</p><div class="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden divide-y divide-gray-100 dark:divide-gray-800">' + xi + '</div>' + (bench ? '<div class="mt-3"><p class="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Bench</p><div class="rounded-lg border border-dashed border-gray-200 dark:border-gray-700 overflow-hidden divide-y divide-gray-100 dark:divide-gray-800">' + bench + '</div></div>' : '') + '</div>';
    };
    const staffCol = (tm, key) => {
      const staff = (M.squads[key]?.staff || []);
      if (!staff.length) return '';
      return '<div><p class="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">' + esc(tm.name) + '</p><div class="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden divide-y divide-gray-100 dark:divide-gray-800">' + staff.map(s => '<div class="flex items-center gap-3 px-3 py-2"><img alt="' + esc(s.n) + '" class="w-8 h-8 rounded-full border border-gray-200 dark:border-white/10 shrink-0" src="https://ui-avatars.com/api/?name=' + encodeURIComponent(s.n.split(' ').map(w => w[0]).join('')) + '&background=' + tm.color.replace('#', '') + '&color=fff&size=64"><div class="min-w-0 flex-1"><div class="text-sm font-medium text-gray-800 dark:text-white truncate">' + esc(s.n) + '</div><p class="text-[11px] text-gray-400 truncate">' + esc(s.r) + '</p></div></div>').join('') + '</div></div>';
    };
    const noSquads = !(M.squads.home.xi.length || M.squads.away.xi.length);
    p.innerHTML = '<div class="col-span-12 bg-white dark:bg-[#12172D] rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-800"><h3 class="font-bold text-gray-800 dark:text-white text-sm uppercase tracking-wide mb-6">Squads</h3>' + (noSquads ? '<p class="text-sm text-gray-400 mb-6">Squad lists have not been published by the live feed for this match.</p>' : '') + '<div id="squads" class="grid grid-cols-1 md:grid-cols-2 gap-8">' + squadCol(HOME_T, 'home') + squadCol(AWAY_T, 'away') + '</div><div class="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800"><h3 class="font-bold text-gray-800 dark:text-white text-sm uppercase tracking-wide mb-4">Coaches &amp; Support Staff</h3><div class="grid grid-cols-1 md:grid-cols-2 gap-8">' + staffCol(HOME_T, 'home') + staffCol(AWAY_T, 'away') + '</div></div></div>';
    p.querySelectorAll('a[data-pname]').forEach(a => a.addEventListener('click', () => {
      sessionStorage.setItem('playerSport', SC.label);
      sessionStorage.setItem('playerView', JSON.stringify({ player: { id: a.dataset.pid || '', name: a.dataset.pname, country: a.dataset.pcountry }, sport: SC.label }));
    }));
  }

  function renderRealOverWidgets() {
    const comments = Array.isArray(M.comm) ? M.comm : (M.comm?.items || []);
    const ordered = comments.slice().sort((a,b) => (a.timestamp || 0) - (b.timestamp || 0));
    const current = ordered.length ? ordered[ordered.length - 1] : null;
    const overKey = current?.over || '';
    const currentOver = ordered.filter(x => String(x.over) === String(overKey)).slice(-6);
    const lastSix = ordered.slice(-6);
    const ballLabel = x => x.type === 'wicket' ? 'W' : x.type === 'four' ? '4' : x.type === 'six' ? '6' : x.badge || '•';

    const widget = $('this-over-widget');
    if (widget) {
      const total = currentOver.reduce((sum, x) => sum + (Number.isFinite(Number(x.runs)) ? Number(x.runs) : 0), 0);
      widget.innerHTML = '<div class="flex items-center justify-between text-sm mb-2"><span class="text-gray-500 dark:text-gray-400">Over ' + esc(overKey || '—') + '</span><span class="font-mono text-emerald-600 dark:text-emerald-400 font-bold">' + (currentOver.length ? currentOver.map(ballLabel).join(' ') : '—') + ' = ' + total + '</span></div><div class="flex gap-1.5 flex-wrap">' + (currentOver.length ? currentOver.map(x => '<span class="over-ball ' + esc(x.type) + '">' + esc(ballLabel(x)) + '</span>').join('') : '<span class="text-xs text-gray-400">No over data available.</span>') + '</div><div class="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800"><p class="text-[10px] uppercase tracking-wide text-gray-400 mb-1">Last 6 balls</p><div class="flex gap-1.5 flex-wrap">' + (lastSix.length ? lastSix.map(x => '<span class="over-ball ' + esc(x.type) + '">' + esc(ballLabel(x)) + '</span>').join('') : '<span class="text-xs text-gray-400">No ball history available.</span>') + '</div></div>';
    }

    const partnershipEl = $('current-partnership');
    if (partnershipEl) {
      const raw = getMatchData() || {};
      const rawInnings = extractInnings(REAL_DATA.scorecard);
      const currentIid = getCurrentInningsId();
      const rawCurrent = rawInnings.find(i => {
        const id = i?.inningsid ?? i?.inningsId ?? i?.iid ?? i?.scoreDetails?.inningsId;
        return Number(id) === Number(currentIid);
      }) || rawInnings.find(i => i?.iscurrentinnings || i?.isCurrent || i?.current) || rawInnings[rawInnings.length - 1] || {};
      const scoreInnings = Array.isArray(M.scorecard?.innings) ? M.scorecard.innings : [];
      const modelCurrent = scoreInnings.find(i => Number(i?.id) === Number(currentIid) || i.isCurrent) || scoreInnings[scoreInnings.length - 1] || {};

      const rawP = rawCurrent?.partnership || rawCurrent?.currentPartnership ||
        rawCurrent?.scoreDetails?.partnership || rawCurrent?.scoreDetails?.currentPartnership ||
        raw?.partnership || raw?.currentPartnership || raw?.current_partnership || {};
      const rawPList = rawCurrent?.partnerships || rawCurrent?.partnershipData || [];
      const latestRawP = Array.isArray(rawPList) && rawPList.length ? rawPList[rawPList.length - 1] : {};
      const modelPList = Array.isArray(modelCurrent.partnerships) ? modelCurrent.partnerships : [];
      const latestModelP = modelPList.length ? modelPList[modelPList.length - 1] : {};

      const graphInn = Array.isArray(M.graph?.innings)
        ? M.graph.innings.find(g => Number(g?.iid) === Number(currentIid))
        : null;
      const graphPartnerships = Array.isArray(graphInn?.partnership) ? graphInn.partnership : [];
      const latestGraphP = graphPartnerships.length ? graphPartnerships[graphPartnerships.length - 1] : {};

      const firstNonEmptyLocal = (...vals) => vals.find(v => v != null && v !== '') ?? '';
      const runs = firstNonEmptyLocal(
        rawP?.runs, rawP?.score, rawP?.partnershipRuns, rawP?.stand,
        latestRawP?.runs, latestRawP?.score, latestRawP?.stand,
        latestModelP?.runs, latestGraphP?.stand
      );
      const balls = firstNonEmptyLocal(
        rawP?.balls, rawP?.deliveries, rawP?.partnershipBalls,
        latestRawP?.balls, latestRawP?.deliveries, latestModelP?.balls
      );

      const p1 = safeLabel(firstNonEmptyLocal(
        rawP?.player1, rawP?.batsman1, rawP?.batter1, rawP?.name1, rawP?.striker,
        latestRawP?.player1, latestRawP?.batsman1, latestRawP?.batter1,
        latestModelP?.player1, ''
      ));
      const p2 = safeLabel(firstNonEmptyLocal(
        rawP?.player2, rawP?.batsman2, rawP?.batter2, rawP?.name2, rawP?.nonstriker,
        latestRawP?.player2, latestRawP?.batsman2, latestRawP?.batter2,
        latestModelP?.player2, ''
      ));

      const batters = Array.isArray(rawCurrent?.batTeamDetails?.batsmenData)
        ? rawCurrent.batTeamDetails.batsmenData
        : (Array.isArray(rawCurrent?.batsmenData) ? rawCurrent.batsmenData :
          (Array.isArray(raw?.currentBatters) ? raw.currentBatters : (Array.isArray(raw?.batsmen) ? raw.batsmen : [])));
      const bowlers = Array.isArray(rawCurrent?.bowlTeamDetails?.bowlersData)
        ? rawCurrent.bowlTeamDetails.bowlersData
        : (Array.isArray(rawCurrent?.bowlersData) ? rawCurrent.bowlersData :
          (Array.isArray(raw?.currentBowlers) ? raw.currentBowlers : (Array.isArray(raw?.bowlers) ? raw.bowlers : [])));

      const pickName = x => safeLabel(x?.batName || x?.bowlName || x?.name || x?.batsmanName || x?.bowlerName || x?.playerName || x?.player || '');
      const latestComment = ordered.length ? ordered[ordered.length - 1] : null;

      const flaggedStriker = batters.find(x => x?.isStriker || x?.striker || x?.isOnStrike || x?.onStrike || x?.batIsStriker);
      const flaggedNon = batters.find(x => x !== flaggedStriker && (x?.isNonStriker || x?.nonstriker || x?.nonStriker));
      const modelNotOut = (modelCurrent.bat || []).filter(b => !b.out);

      const striker = p1 || pickName(flaggedStriker) || latestComment?.striker ||
        modelNotOut.find(b => b.isStriker)?.n || modelNotOut[modelNotOut.length - 2]?.n || '';
      const nonStriker = p2 || pickName(flaggedNon) || latestComment?.nonstriker ||
        modelNotOut.find(b => String(b.n).toLowerCase() !== String(striker).toLowerCase())?.n ||
        modelNotOut[modelNotOut.length - 1]?.n || '';

      // For a live innings the latest ball-by-ball commentary is the most
      // reliable source for the bowler who is actually delivering the current
      // over. Some scorecard feeds keep the previous bowler flagged as
      // "current", so do NOT let that stale flag override live commentary.
      const latestCurrentComment = [...comments]
        .reverse()
        .find(x => {
          const sameInnings = !x?.inningsId || !currentIid || Number(x.inningsId) === Number(currentIid);
          return sameInnings && safeString(x?.bowler).trim();
        }) || null;

      const providerCurrentBowler = bowlers.find(x => x?.isCurrent || x?.current || x?.isCurrentBowler || x?.isBowler);
      const providerBowlerName = safeLabel(providerCurrentBowler?.bowlName || providerCurrentBowler?.name || providerCurrentBowler?.bowlerName || '');
      const explicitCurrentBowler = safeLabel(rawCurrent?.currentBowler || rawCurrent?.bowlerName || raw?.currentBowler || raw?.currentBowlerName || '');
      const commentaryBowlerName = safeLabel(latestCurrentComment?.bowler || '');
      const toOverNumber = value => {
        const m = safeString(value).match(/(\d+)\s*[.:-]\s*(\d+)/);
        if (m) return Number(m[1]) + Number(m[2]) / 100;
        const n = Number(value);
        return Number.isFinite(n) ? n : NaN;
      };
      const currentOverValue = toOverNumber(rawCurrent?.scoreDetails?.overs ?? rawCurrent?.scoreDetails?.over ?? rawCurrent?.overs ?? rawCurrent?.ov);
      const commentOverValue = toOverNumber(latestCurrentComment?.over);
      const commentaryIsCurrentOver = commentaryBowlerName && (
        !Number.isFinite(currentOverValue) ||
        !Number.isFinite(commentOverValue) ||
        commentOverValue >= currentOverValue
      );

      // Explicit current-bowler data is strongest. Otherwise use commentary only
      // when its ball belongs to the current over. At a fresh over (e.g. 39.0)
      // there may be no ball from the new bowler yet, so use the provider's current
      // bowler flag instead. Never use partnership data as a bowler source because
      // partnership records can belong to an older over.
      const bowler = explicitCurrentBowler ||
        (commentaryIsCurrentOver ? commentaryBowlerName : '') ||
        providerBowlerName || pickName(providerCurrentBowler) ||
        commentaryBowlerName || safeLabel((modelCurrent.bowl || []).slice(-1)[0]?.n || '');

      // Once the current bowler name is known, always resolve his figures by
      // NAME from the real scorecard/provider rows. This prevents a stale
      // "current bowler" flag from displaying another bowler's figures.
      const modelBowl = Array.isArray(modelCurrent.bowl) ? modelCurrent.bowl : [];
      const bowlerLower = String(bowler || '').trim().toLowerCase();
      const bowlerStat = bowlerLower
        ? (modelBowl.find(x => String(x.n || '').trim().toLowerCase() === bowlerLower) ||
           {})
        : {};

      const providerBowlerStat = bowlerLower
        ? (bowlers.find(x => pickName(x).trim().toLowerCase() === bowlerLower) ||
           providerCurrentBowler || {})
        : (providerCurrentBowler || {});
      const bowlerOvers = firstNonEmptyLocal(providerBowlerStat?.bowlOvs, providerBowlerStat?.overs, providerBowlerStat?.o, bowlerStat?.o, '');
      const bowlerMaidens = firstNonEmptyLocal(providerBowlerStat?.bowlMaidens, providerBowlerStat?.maidens, providerBowlerStat?.m, bowlerStat?.m, '');
      const bowlerWickets = firstNonEmptyLocal(providerBowlerStat?.bowlWkts, providerBowlerStat?.wickets, providerBowlerStat?.w, bowlerStat?.w, '');
      const bowlerRuns = firstNonEmptyLocal(providerBowlerStat?.bowlRuns, providerBowlerStat?.runs, providerBowlerStat?.r, bowlerStat?.r, '');
      const bowlerEcoRaw = firstNonEmptyLocal(providerBowlerStat?.bowlEcon, providerBowlerStat?.economy, providerBowlerStat?.econ, bowlerStat?.econ, '');
      const bowlerEco = bowlerEcoRaw !== '' ? bowlerEcoRaw : (() => {
        const o = Number(String(bowlerOvers).split(/\s+/)[0]);
        const r = Number(bowlerRuns);
        return Number.isFinite(o) && o > 0 && Number.isFinite(r) ? (r / o).toFixed(2) : '';
      })();

      // Use the normalized current innings rows. Cricbuzz's bat/bowl detail
      // objects now map directly to the real scorecard values.
      const currentBatRows = modelNotOut.length ? modelNotOut.slice(0, 2) : [];
      const batRows = currentBatRows.length ? currentBatRows : [
        { n: striker, r: '', b: '', f: '', sx: '', sr: '' },
        { n: nonStriker, r: '', b: '', f: '', sx: '', sr: '' }
      ].filter(x => x.n);

      const currentBowRows = bowler ? [{
        n: bowler,
        o: bowlerOvers,
        m: bowlerMaidens,
        r: bowlerRuns,
        w: bowlerWickets,
        econ: bowlerEco
      }] : [];

      const stat = (v, fallback = '') => v == null || v === '' ? fallback : v;
      const calcSR = row => {
        if (row?.sr !== '' && row?.sr != null) return row.sr;
        const r = Number(row?.r), b = Number(row?.b);
        return Number.isFinite(r) && Number.isFinite(b) && b > 0 ? (r * 100 / b).toFixed(2) : '';
      };
      const calcEco = row => {
        if (row?.econ !== '' && row?.econ != null) return row.econ;
        const o = Number(String(row?.o ?? '').split(/\s+/)[0]), r = Number(row?.r);
        return Number.isFinite(o) && o > 0 && Number.isFinite(r) ? (r / o).toFixed(2) : '';
      };

      const currentPartnershipRuns = runs !== '' ? runs : '';
      const currentPartnershipBalls = balls !== '' ? balls : '';

      const latestFow = Array.isArray(modelCurrent.fow) && modelCurrent.fow.length
        ? modelCurrent.fow[modelCurrent.fow.length - 1] : null;
      const lastWicketText = latestFow ? (() => {
        const dismissed = latestFow.player || '';
        const matched = (modelCurrent.bat || []).find(b => String(b.n).toLowerCase() === String(dismissed).toLowerCase());
        const dismissal = latestFow.dismissal || matched?.dismissal || '';
        const scoreAtWicket = latestFow.score || '';
        const overAtWicket = latestFow.over || '';
        const batterLine = matched ? (stat(matched.r, '') + '(' + stat(matched.b, '') + ')') : '';
        return [dismissed, dismissal, batterLine, scoreAtWicket ? '- ' + scoreAtWicket + '/' + stat(latestFow.wicket, '') : '', overAtWicket ? 'in ' + overAtWicket + ' ov.' : ''].filter(Boolean).join(' ');
      })() : '';

      // Last 5 overs MUST come from the real /overs or /ballsGraph feed.
      // Never fabricate or derive it from UI state.
      const overSeries = Array.isArray(M.graph?.innings)
        ? (M.graph.innings.find(g => Number(g?.iid) === Number(currentIid))?.overs || [])
        : [];
      const numericOvers = overSeries
        .filter(o => Number.isFinite(Number(o?.over)) && Number.isFinite(Number(o?.runs)))
        .sort((a,b) => Number(a.over) - Number(b.over));
      const recentOvers = numericOvers.slice(-5);
      const lastFiveRuns = recentOvers.length ? recentOvers.reduce((sum, o) => sum + Number(o.runs || 0), 0) : '';
      const lastFiveWkts = recentOvers.length
        ? recentOvers.reduce((sum, o) => sum + Number(o.wickets || 0), 0)
        : '';

      const batterTable = batRows.map(row => '<tr class="border-t border-gray-100 dark:border-gray-800">' +
        '<td class="py-2 pr-2 font-semibold text-blue-600 dark:text-blue-400">' + esc(row.n || '—') + (row.isStriker ? ' *' : '') + '</td>' +
        '<td class="py-2 text-right">' + esc(stat(row.r, '—')) + '</td>' +
        '<td class="py-2 text-right">' + esc(stat(row.b, '—')) + '</td>' +
        '<td class="py-2 text-right">' + esc(stat(row.f, '—')) + '</td>' +
        '<td class="py-2 text-right">' + esc(stat(row.sx, '—')) + '</td>' +
        '<td class="py-2 text-right">' + esc(stat(calcSR(row), '—')) + '</td></tr>').join('');

      const bowlerTable = currentBowRows.map(row => '<tr class="border-t border-gray-100 dark:border-gray-800">' +
        '<td class="py-2 pr-2 font-semibold text-blue-600 dark:text-blue-400">' + esc(row.n || '—') + (row.n && String(row.n).toLowerCase() === String(bowler).toLowerCase() ? ' *' : '') + '</td>' +
        '<td class="py-2 text-right">' + esc(stat(row.o, '—')) + '</td>' +
        '<td class="py-2 text-right">' + esc(stat(row.m, '—')) + '</td>' +
        '<td class="py-2 text-right">' + esc(stat(row.r, '—')) + '</td>' +
        '<td class="py-2 text-right">' + esc(stat(row.w, '—')) + '</td>' +
        '<td class="py-2 text-right">' + esc(stat(calcEco(row), '—')) + '</td></tr>').join('');

      if (striker || nonStriker || currentPartnershipRuns !== '' || bowler) {
        partnershipEl.innerHTML = '<div class="overflow-x-auto">' +
          '<table class="w-full text-xs min-w-[560px]"><thead><tr class="bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400">' +
          '<th class="py-2 px-2 text-left font-medium">Batter</th><th class="py-2 px-2 text-right font-medium">R</th><th class="py-2 px-2 text-right font-medium">B</th><th class="py-2 px-2 text-right font-medium">4s</th><th class="py-2 px-2 text-right font-medium">6s</th><th class="py-2 px-2 text-right font-medium">SR</th>' +
          '</tr></thead><tbody>' + (batterTable || '<tr><td colspan="6" class="py-4 text-gray-400">Live batter statistics are not available yet.</td></tr>') + '</tbody></table>' +
          '<table class="w-full text-xs min-w-[560px] mt-3"><thead><tr class="bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400">' +
          '<th class="py-2 px-2 text-left font-medium">Bowler</th><th class="py-2 px-2 text-right font-medium">O</th><th class="py-2 px-2 text-right font-medium">M</th><th class="py-2 px-2 text-right font-medium">R</th><th class="py-2 px-2 text-right font-medium">W</th><th class="py-2 px-2 text-right font-medium">ECO</th>' +
          '</tr></thead><tbody>' + (bowlerTable || '<tr><td colspan="6" class="py-4 text-gray-400">Live bowler statistics are not available yet.</td></tr>') + '</tbody></table>' +
          '</div>';
      } else if (M.score.status === 'live') {
        partnershipEl.innerHTML = '<p class="text-xs text-gray-400">Live partnership data is not present in the provider feed yet.</p>';
      } else {
        partnershipEl.innerHTML = '<p class="text-xs text-gray-400">Current partnership appears here when the match is live.</p>';
      }
    }

    const history = $('over-history');
    if (history) {
      const groups = [];
      const map = new Map();
      ordered.forEach(x => {
        const k = String(x.over || '—');
        if (!map.has(k)) map.set(k, []);
        map.get(k).push(x);
      });
      [...map.entries()].slice(-6).reverse().forEach(([over, balls]) => groups.push({ over, balls }));
      history.innerHTML = groups.length ? groups.map(g => '<div class="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0"><span class="text-xs font-semibold text-crexGold w-10">' + esc(g.over) + '</span><div class="flex gap-1 flex-1">' + g.balls.map(x => '<span class="over-ball ' + esc(x.type) + ' !w-6 !h-6 !text-[10px]">' + esc(ballLabel(x)) + '</span>').join('') + '</div></div>').join('') : '<p class="text-xs text-gray-400">Over-by-over history is not available.</p>';
    }
  }

  function renderCommentary() {

    if (REAL_DATA.commentary) {

      console.log("Using Backend Commentary");

    }

    const p = $('panel-commentary'); if (!p) return;
    const comments = Array.isArray(M.comm) ? M.comm : (M.comm?.items || []);

    const feed = comments
      .slice().reverse()
      .map(it => commItemHtml(it))
      .join('');
    const liveTag = M.score.status === 'live'
      ? '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/20 text-red-300 text-[11px] font-semibold border border-red-500/30"><span class="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"></span> LIVE</span>'
      : '';
    p.innerHTML =
      '<div class="col-span-12 lg:col-span-8 space-y-6">' +
      '<div id="comm-players" class="bg-white dark:bg-[#12172D] rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-4 flex items-center gap-4 overflow-x-auto"><span class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide shrink-0">' + esc(M.comm.label) + '</span></div>' +
      '<div class="bg-white dark:bg-[#12172D] rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-4 flex flex-col sm:flex-row sm:items-center gap-4"><div class="inline-flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700" id="comm-filters"><button class="comm-filter px-3.5 py-1.5 text-xs font-semibold rounded-md text-white bg-crexGold" data-filter="all"\>All</button><button class="comm-filter px-3.5 py-1.5 text-xs font-semibold rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white" data-filter="four">4s/PTS</button><button class="comm-filter px-3.5 py-1.5 text-xs font-semibold rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white" data-filter="six">6s/GOAL</button><button class="comm-filter px-3.5 py-1.5 text-xs font-semibold rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white" data-filter="wicket">Wickets</button><button class="comm-filter px-3.5 py-1.5 text-xs font-semibold rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white" data-filter="milestone">Milestones</button></div>' + (M.score.status === 'live' ? '<span class="text-xs text-gray-400 ml-auto hidden sm:block">Updates every few seconds · scroll for history</span>' : '') + '</div>' +
      '<section class="col-span-12 bg-white dark:bg-[#12172D] rounded-lg shadow-sm overflow-hidden border border-gray-200 dark:border-gray-800"><div class="flex items-center justify-between px-5 py-4 bg-[#0b1626] text-white"><h3 class="font-bold text-sm uppercase tracking-wide">Live Score Snapshot</h3>' + liveTag + '</div><div id="current-partnership" class="p-4"><p class="text-xs text-gray-400">Loading live batter, bowler and partnership data…</p></div></section>' +
      '<section class="bg-white dark:bg-[#12172D] rounded-lg shadow-sm overflow-hidden border border-gray-200 dark:border-gray-800"><div class="flex items-center justify-between px-5 py-4 bg-[#0b1626] text-white"><h3 class="font-bold text-sm uppercase tracking-wide">Commentary</h3>' + liveTag + '<span id="comm-innings-label" class="text-xs text-gray-300">' + esc(M.comm.label) + '</span></div><div id="comm-feed" class="divide-y divide-gray-100 dark:divide-gray-800">' + (feed || '<p class="p-6 text-sm text-gray-400">No commentary yet.</p>') + '</div></section>' +
      '</div>' +
      '<aside class="col-span-12 lg:col-span-4 space-y-6">' +
      '<section class="bg-white dark:bg-[#12172D] rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-800"><h3 class="font-bold text-gray-800 dark:text-white text-sm uppercase tracking-wide mb-4">This ' + (SC.isCricket ? 'Over' : 'Minute') + '</h3><div id="this-over-widget"><div class="flex items-center justify-between text-sm mb-2"><span class="text-gray-500 dark:text-gray-400">Over 0</span><span class="font-mono text-emerald-600 dark:text-emerald-400 font-bold">— = 0</span></div><div class="flex gap-1.5"><span class="text-xs text-gray-400">Waiting for first ball…</span></div></div></section>' +
      '<section class="bg-white dark:bg-[#12172D] rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-800"><h3 class="font-bold text-gray-800 dark:text-white text-sm uppercase tracking-wide mb-4">Over-by-Over</h3><div id="over-history"><p class="text-xs text-gray-400">Over-by-over summary will appear here.</p></div></section>' +
      '<section class="bg-white dark:bg-[#12172D] rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-800"><h3 class="font-bold text-gray-800 dark:text-white text-sm uppercase tracking-wide mb-4">Live Players</h3><div id="live-positions"><p class="text-xs text-gray-400">Live player positions appear here during the match.</p></div></section>' +
      '</aside>';

    renderRealOverWidgets();

    // filter handlers
    const feedEl = $('comm-feed');
    p.querySelectorAll('.comm-filter').forEach(btn => btn.addEventListener('click', () => {
      const f = btn.dataset.filter;
      p.querySelectorAll('.comm-filter').forEach(b => { const on = b === btn; b.classList.toggle('bg-crexGold', on); b.classList.toggle('text-white', on); b.classList.toggle('text-gray-500', !on); b.classList.toggle('dark:text-gray-400', !on); });
      feedEl.querySelectorAll('.comm-item').forEach(it => { it.style.display = (f === 'all' || it.dataset.type === f) ? '' : 'none'; });
    }));

    // live loop — only for live matches (score + commentary update live)
    if (M.score.status === 'live') startLiveLoop(feedEl);
  }

  // Rules & Regulations panel (sport-aware, proper for ALL games)
  function renderRules() {
    const p = $('panel-rules'); if (!p) return;
    const pts = RULE_SET.points.map(pt => '<li class="flex items-start gap-3"><span class="text-crexGold mt-0.5 text-lg">•</span><span class="text-sm text-gray-600 dark:text-gray-300">' + esc(pt) + '</span></li>').join('');
    p.innerHTML =
      '<div class="col-span-12 bg-white dark:bg-[#12172D] rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-800">' +
      '<div class="flex items-center gap-3 mb-5"><span class="text-3xl">' + SC.icon + '</span><h3 class="font-bold text-gray-800 dark:text-white text-lg">' + esc(RULE_SET.title) + '</h3></div>' +
      '<ul class="space-y-3" id="rules-list">' + pts + '</ul>' +
      '<p class="text-xs text-gray-400 mt-5">Applies to ' + esc(HOME_T.name) + ' vs ' + esc(AWAY_T.name) + ' · ' + esc(SC.label) + '.</p>' +
      '</div>';
  }

  let liveTimer = null;
  function flashScore() {
    const sec = $('score-header'); if (!sec) return;
    sec.querySelectorAll('.score-flash').forEach(el => {
      el.classList.remove('score-flash');
      void el.offsetWidth; // restart animation
      el.classList.add('score-flash');
    });
  }
  // Crex-style floating "score update" toast that pops on every live change
  function showScoreToast(team, delta, label) {
    let host = $('live-toast-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'live-toast-host';
      host.className = 'fixed z-[120] bottom-5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none';
      document.body.appendChild(host);
    }
    const t = document.createElement('div');
    t.className = 'live-toast flex items-center gap-2 px-4 py-2 rounded-full bg-crexGold text-white text-sm font-bold shadow-lg';
    t.innerHTML = '<span class="material-symbols-outlined text-[18px]">sports_cricket</span>' +
      '<span>' + esc(team) + ' ' + (delta > 0 ? '+' : '') + delta + ' &middot; ' + esc(label) + '</span>';
    host.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 2600);
  }
  // Crex-style "Over X complete" banner that slides in when an over ends
  function showOverBanner(overNo) {
    let host = $('over-banner-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'over-banner-host';
      host.className = 'fixed z-[125] top-20 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none';
      document.body.appendChild(host);
    }
    const t = document.createElement('div');
    t.className = 'over-banner px-5 py-2 rounded-full bg-crexHeader text-white text-sm font-bold shadow-lg border border-crexGold/40';
    t.innerHTML = '<span class="text-crexGold">End of over ' + overNo + '</span>';
    host.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 500); }, 2200);
  }
  // Pulsing LIVE badge + animated scoreboard header for live matches
  function ensureLiveBanner() {
    const sec = $('score-header'); if (!sec) return;
    if ($('live-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'live-banner';
    banner.className = 'max-w-7xl mx-auto mb-3 flex items-center justify-center gap-2';
    banner.innerHTML =
      '<span class="live-dot"></span>' +
      '<span class="text-crexGold text-xs font-extrabold uppercase tracking-[0.2em]">Live</span>' +
      '<span class="text-gray-300 text-xs">· ball-by-ball updates &amp; commentary</span>';
    const inner = sec.querySelector('.max-w-7xl');
    if (inner) inner.insertBefore(banner, inner.firstChild);
  }
  // Live score refresh is backend-only. No simulated clock, innings, winner or score path.
  async function refreshRealLiveData() {
    if (!SC.isCricket || !MATCHID || M.score.status !== 'live') return;
    const match = await API.getMatch().catch(() => null);
    const scorecard = await API.getScorecard().catch(() => null);
    if (match) REAL_DATA.match = match;
    if (scorecard) REAL_DATA.scorecard = scorecard;
    const iid = getCurrentInningsId();
    const jobs = [
      ['commentary', () => API.getCommentary(iid)],
      ['historicalCommentary', () => API.getHCommentary(iid)],
      ['overs', () => API.getOvers(iid)],
      ['overDetails', () => API.getOverDetails(iid)],
      ['highlights', () => API.getHighlights()],
      ['oversGraph', () => API.getOversGraph()],
      ['ballsGraph', () => API.getBallsGraph(iid)],
      ['partnershipGraph', () => API.getPartnershipGraph()]
    ];
    const settled = await Promise.all(jobs.map(async ([key, fn]) => {
      try { return [key, await fn()]; } catch (_) { return [key, null]; }
    }));
    settled.forEach(([key, value]) => { if (value) REAL_DATA[key] = value; });
    updateTeamsFromBackend();
    applyNormalizedModel(normalizeBackendData());
    applyHeroBackendData();
    if (!M.info.weather || !M.info.weatherFetchedAt || Date.now() - M.info.weatherFetchedAt >= 15 * 60 * 1000) await loadRealWeather();
    applyRealSummaryData();
    applyRealNewsData();
    renderScoreHeader();
    renderSummary();
    renderScorecard();
    renderCommentary();
    renderGraph();
    renderCurrentPlayers();
    renderNews();
  }


  function startLiveLoop(feedEl) {
    if (liveTimer) return;
    // IMPORTANT: no simulated balls, scores, wickets or clock progression.
    // Live updates come only from the backend.
    liveTimer = setInterval(() => {
      refreshRealLiveData().catch(err => console.warn('Live refresh failed', err));
    }, 30000);
    refreshRealLiveData().catch(err => console.warn('Live refresh failed', err));
  }

  // Big centre animation (between the two team scores) on a real score event.
  function animateCenterEvent(type, label) {
    const host = $('center-anim-host'); if (!host) return;
    const el = document.createElement('div');
    el.className = 'center-event center-event-' + type;
    el.innerHTML = '<span class="center-event-badge">' + esc(label) + '</span><span class="center-event-time">' + nowStr() + '</span>';
    host.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); }, 1500);
  }

  // ---- Crex-style floating ball animation ----
  function animateBall(type, label) {
    let host = $('ball-anim-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'ball-anim-host';
      host.className = 'fixed inset-0 z-[115] pointer-events-none overflow-hidden';
      document.body.appendChild(host);
    }
    const el = document.createElement('div');
    el.className = 'crex-ball crex-ball-' + type;
    el.textContent = label;
    // random horizontal start near center-top
    const leftPct = 50;
    el.style.left = leftPct + 'vw';
    el.style.top = '30vh';
    host.appendChild(el);
    setTimeout(() => el.remove(), 1600);
  }

  // ---- "This Over" widget (Crex-style over balls) ----
  function updateThisOverWidget(overNo, balls) {
    const el = $('this-over-widget'); if (!el) return;
    const total = balls.reduce((s, b) => s + (typeof b.runs === 'number' ? b.runs : 0), 0);
    const ballsHtml = balls.map(b => '<span class="over-ball ' + b.type + '">' + esc(b.label) + '</span>').join('');
    el.innerHTML =
      '<div class="flex items-center justify-between text-sm mb-2"><span class="text-gray-500 dark:text-gray-400">Over ' + overNo + '</span>' +
      '<span class="font-mono text-emerald-600 dark:text-emerald-400 font-bold">' + (balls.length ? balls.map(b => b.label).join(' ') : '—') + ' = ' + total + '</span></div>' +
      '<div class="flex gap-1.5 flex-wrap">' + (ballsHtml || '<span class="text-xs text-gray-400">Waiting for first ball…</span>') + '</div>';
  }

  // ---- Last over history shown in scorecard ----
  let overHistory = [];
  function pushOverHistory(overNo, balls) {
    overHistory.unshift({ over: overNo, balls });
    if (overHistory.length > 6) overHistory.pop();
    renderOverHistory();
  }
  function renderOverHistory() {
    const el = $('over-history'); if (!el) return;
    if (!overHistory.length) { el.innerHTML = '<p class="text-xs text-gray-400">Over-by-over summary will appear here.</p>'; return; }
    el.innerHTML = overHistory.map(o => {
      const total = o.balls.reduce((s, b) => s + (typeof b.runs === 'number' ? b.runs : 0), 0);
      const balls = o.balls.map(b => '<span class="over-ball ' + b.type + ' !w-6 !h-6 !text-[10px]">' + esc(b.label) + '</span>').join('');
      return '<div class="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0">' +
        '<span class="text-xs font-semibold text-crexGold w-10">' + o.over + '</span>' +
        '<div class="flex gap-1 flex-1">' + balls + '</div>' +
        '<span class="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold">' + total + '</span></div>';
    }).join('');
  }


  function renderGraph() {
    const p = $('panel-graph');
    if (!p) return;

    if (!$('graph-svg')) {
      p.innerHTML =
        '<div class="col-span-12 bg-white dark:bg-[#12172D] rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-800">' +
          '<div class="flex items-center justify-between mb-4">' +
            '<h3 class="font-bold text-gray-800 dark:text-white">Match Graphs</h3>' +
            '<span class="text-xs text-gray-400">Real match feed</span>' +
          '</div>' +
          '<div id="graph-innings-filters" class="flex flex-wrap gap-2 mb-3"></div>' +
          '<div id="graph-type-filters" class="flex flex-wrap gap-2 mb-4"></div>' +
          '<div class="overflow-x-auto"><svg id="graph-svg" viewBox="0 0 800 380" class="w-full min-w-[640px] h-auto" preserveAspectRatio="none"></svg></div>' +
          '<div id="graph-legend" class="flex flex-wrap gap-4 mt-3 text-xs text-gray-400"></div>' +
          '<div id="graph-loading" class="text-xs text-gray-400 mt-2"></div>' +
        '</div>';
    }

    const inningsEl = $('graph-innings-filters');
    const typeEl = $('graph-type-filters');
    const svg = $('graph-svg');
    const legend = $('graph-legend');
    const loading = $('graph-loading');
    if (!inningsEl || !typeEl || !svg) return;

    const allInnings = Array.isArray(M.graph?.innings) ? M.graph.innings : [];
    const scoreInnings = Array.isArray(M.scorecard?.innings) ? M.scorecard.innings : [];

    const ids = [...new Set([
      ...scoreInnings.map((inn, i) => Number(inn?.id ?? inn?.iid ?? inn?.inningsid ?? i + 1)),
      ...allInnings.map(g => Number(g?.iid))
    ])].filter(n => Number.isFinite(n) && n > 0).sort((a,b) => a-b);

    const ordinal = n => n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : n + 'th';

    const isTestGraph = /test/i.test(safeString(M.meta.format || FORMAT_PARAM)) || scoreInnings.length > 2;
    const teamNameFor = iid => {
      if (isTestGraph) return testInningsLabelById(scoreInnings, iid);
      const exact = scoreInnings.find((inn, idx) => Number(inn?.id ?? inn?.iid ?? inn?.inningsid ?? idx + 1) === Number(iid));
      return safeString(exact?.batteamname || exact?.teamname || exact?.team?.name || exact?.batteam || exact?.batteamshortname || ('Innings ' + iid));
    };

    if (!ids.length) {
      inningsEl.innerHTML = '';
      typeEl.innerHTML = '';
      if (legend) legend.innerHTML = '';
      // Non-cricket: real score progression from the live incident feed.
      const tl = Array.isArray(M.graph?.timeline) ? M.graph.timeline : [];
      if (tl.length) {
        svg.style.display = 'none';
        let tbl = $('graph-timeline');
        if (!tbl) { tbl = document.createElement('div'); tbl.id = 'graph-timeline'; svg.parentNode.appendChild(tbl); }
        tbl.innerHTML = '<div class="overflow-x-auto"><table class="w-full text-sm text-left"><thead><tr class="text-gray-400 text-xs uppercase border-b border-gray-200 dark:border-gray-700"><th class="py-2 px-4 font-medium">Time</th><th class="py-2 px-4 font-medium text-right">' + esc(HOME_T.name) + '</th><th class="py-2 px-4 font-medium text-right">' + esc(AWAY_T.name) + '</th></tr></thead><tbody class="text-gray-700 dark:text-gray-200">' +
          tl.map(r => '<tr class="border-b border-gray-100 dark:border-gray-800"><td class="py-2 px-4 text-crexGold font-semibold">' + esc(r.t || '—') + '</td><td class="py-2 px-4 text-right font-bold">' + esc(String(r.h)) + '</td><td class="py-2 px-4 text-right font-bold">' + esc(String(r.a)) + '</td></tr>').join('') +
          '</tbody></table></div>';
        if (loading) loading.textContent = 'Real score progression from the live feed.';
        return;
      }
      svg.innerHTML = '<text x="50%" y="50%" text-anchor="middle" fill="currentColor" opacity=".6" font-size="13">Real graph data is not available from the live feed.</text>';
      return;
    }

    let activeIid = Number(ids[ids.length - 1]);
    let activeType = 'worm';

    const graphTypes = [
      ['worm', 'Score / Worm'],
      ['runs', 'Runs / Over'],
      ['runrate', 'Run Rate'],
      ['partnership', 'Partnership'],
      ['winprob', 'Win Probability']
    ];

    const getInn = iid => allInnings.find(g => Number(g?.iid) === Number(iid)) || {
      iid, overs: [], wagon: [], runrate: [], partnership: [], winProbability: []
    };

    const renderButtons = () => {
      inningsEl.innerHTML = ids.map(iid =>
        '<button type="button" data-iid="' + iid + '" class="graph-inn-btn px-3 py-1.5 rounded-full text-xs font-semibold ' +
        (Number(iid) === activeIid ? 'bg-crexGold text-white' : 'border border-gray-700 text-gray-300') + '">' +
        esc(teamNameFor(iid)) +
        '</button>'
      ).join('');

      typeEl.innerHTML = graphTypes.map(([key, label]) =>
        '<button type="button" data-gt="' + key + '" class="graph-type-btn px-3 py-1.5 rounded-full text-xs font-semibold ' +
        (key === activeType ? 'bg-crexGold text-white' : 'border border-gray-700 text-gray-300') + '">' +
        esc(label) + '</button>'
      ).join('');

      inningsEl.querySelectorAll('.graph-inn-btn').forEach(btn => btn.addEventListener('click', () => {
        activeIid = Number(btn.dataset.iid);
        renderButtons();
        draw();
      }));
      typeEl.querySelectorAll('.graph-type-btn').forEach(btn => btn.addEventListener('click', () => {
        activeType = btn.dataset.gt;
        renderButtons();
        draw();
      }));
    };

    const numeric = value => {
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    };

    const drawLine = (points, opts = {}) => {
      const data = points.filter(p => Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)));
      if (!data.length) return null;

      const W = 800, H = 380, L = 58, R = 22, T = 24, B = 48;
      const xmax = Math.max(1, ...data.map(p => Number(p.x)));
      const ymax = Math.max(opts.minY ?? 1, ...data.map(p => Number(p.y)));
      const ymin = Number.isFinite(opts.minYValue) ? opts.minYValue : 0;
      const span = Math.max(1, ymax - ymin);
      const x = v => L + (Number(v) / xmax) * (W - L - R);
      const y = v => T + (1 - ((Number(v) - ymin) / span)) * (H - T - B);

      let h =
        '<line x1="' + L + '" y1="' + (H-B) + '" x2="' + (W-R) + '" y2="' + (H-B) + '" stroke="rgba(148,163,184,.35)"/>' +
        '<line x1="' + L + '" y1="' + T + '" x2="' + L + '" y2="' + (H-B) + '" stroke="rgba(148,163,184,.35)"/>';

      for (let i=0;i<=5;i++) {
        const v = ymin + (span * i / 5);
        h += '<line x1="' + L + '" y1="' + y(v) + '" x2="' + (W-R) + '" y2="' + y(v) + '" stroke="rgba(148,163,184,.10)"/>' +
             '<text x="' + (L-8) + '" y="' + (y(v)+3) + '" fill="currentColor" font-size="10" text-anchor="end" opacity=".55">' +
             esc(Number(v).toFixed(opts.decimals ?? 0)) + '</text>';
      }

      const poly = data.map(pt => x(pt.x) + ',' + y(pt.y)).join(' ');
      const stroke = opts.stroke || HOME_T.color || '#f7941d';
      h += '<polyline points="' + poly + '" fill="none" stroke="' + stroke + '" stroke-width="3" stroke-linejoin="round"/>';
      data.forEach(pt => {
        h += '<circle cx="' + x(pt.x) + '" cy="' + y(pt.y) + '" r="4" fill="' + stroke + '">' +
             '<title>' + esc(pt.title || (opts.xLabel + ' ' + pt.x + ': ' + pt.y)) + '</title></circle>';
      });
      h += '<text x="' + (W/2) + '" y="' + (H-10) + '" fill="currentColor" font-size="10" text-anchor="middle" opacity=".6">' + esc(opts.xLabel || 'Overs') + '</text>' +
           '<text x="14" y="' + (H/2) + '" fill="currentColor" font-size="10" text-anchor="middle" opacity=".6" transform="rotate(-90 14 ' + (H/2) + ')">' + esc(opts.yLabel || '') + '</text>';
      return { html: h, total: data[data.length-1]?.y };
    };

    const draw = () => {
      const g = getInn(activeIid);
      const overs = safeArray(g.overs)
        .map(o => ({
          over: numeric(o?.over),
          runs: numeric(o?.runs),
          total: numeric(o?.total ?? o?.score),
          rate: numeric(o?.rate)
        }))
        .filter(o => o.over != null && o.runs != null)
        .sort((a,b) => a.over - b.over);

      if (activeType === 'winprob') {
        const wp = safeArray(g.winProbability).map(p => ({
          x: numeric(p?.over),
          home: numeric(p?.home),
          away: numeric(p?.away)
        })).filter(p => p.x != null && (p.home != null || p.away != null));

        if (!wp.length) {
          svg.innerHTML = '<text x="50%" y="48%" text-anchor="middle" fill="currentColor" opacity=".6" font-size="13">Real win-probability data is not available for this innings.</text>';
          if (legend) legend.innerHTML = '<span class="text-gray-400">No win-probability values were supplied by the live API.</span>';
          return;
        }

        const W = 800, H = 380, L = 58, R = 22, T = 24, B = 48;
        const xmax = Math.max(1, ...wp.map(p => p.x));
        const x = v => L + (v/xmax)*(W-L-R);
        const y = v => T + (1-v/100)*(H-T-B);
        let h = '<line x1="'+L+'" y1="'+(H-B)+'" x2="'+(W-R)+'" y2="'+(H-B)+'" stroke="rgba(148,163,184,.35)"/>' +
                '<line x1="'+L+'" y1="'+T+'" x2="'+L+'" y2="'+(H-B)+'" stroke="rgba(148,163,184,.35)"/>';
        [0,20,40,60,80,100].forEach(v => {
          h += '<line x1="'+L+'" y1="'+y(v)+'" x2="'+(W-R)+'" y2="'+y(v)+'" stroke="rgba(148,163,184,.10)"/>' +
               '<text x="'+(L-8)+'" y="'+(y(v)+3)+'" fill="currentColor" font-size="10" text-anchor="end" opacity=".55">'+v+'%</text>';
        });
        const add = (key, label, stroke) => {
          const pts = wp.filter(p => p[key] != null);
          if (!pts.length) return;
          h += '<polyline points="'+pts.map(p=>x(p.x)+','+y(p[key])).join(' ')+'" fill="none" stroke="'+stroke+'" stroke-width="3" stroke-linejoin="round"/>';
          pts.forEach(p => h += '<circle cx="'+x(p.x)+'" cy="'+y(p[key])+'" r="3.5" fill="'+stroke+'"><title>'+esc(label+' · Over '+p.x+': '+p[key]+'%')+'</title></circle>');
        };
        add('home', HOME_T.name, HOME_T.color || '#10b981');
        add('away', AWAY_T.name, AWAY_T.color || '#f7941d');
        h += '<text x="'+(W/2)+'" y="'+(H-10)+'" fill="currentColor" font-size="10" text-anchor="middle" opacity=".6">Overs</text>' +
             '<text x="14" y="'+(H/2)+'" fill="currentColor" font-size="10" text-anchor="middle" opacity=".6" transform="rotate(-90 14 '+(H/2)+')">Win Probability</text>';
        svg.innerHTML = h;
        if (legend) legend.innerHTML = '<span>'+esc(HOME_T.name)+'</span><span>'+esc(AWAY_T.name)+'</span><span class="text-gray-500">API supplied probability</span>';
        return;
      }

      if (!overs.length) {
        const alt = safeArray(g.wagon).filter(o => numeric(o?.over) != null && numeric(o?.runs) != null);
        if (alt.length) {
          alt.forEach(o => overs.push({over:numeric(o.over),runs:numeric(o.runs),rate:numeric(o.rate)}));
        }
      }

      if (!overs.length) {
        svg.innerHTML = '<text x="50%" y="48%" text-anchor="middle" fill="currentColor" opacity=".6" font-size="13">Real over data is not available for ' + esc(teamNameFor(activeIid)) + '.</text>';
        if (legend) legend.innerHTML = '<span class="text-gray-400">Waiting for the real /overs?iid=' + activeIid + ' feed.</span>';
        return;
      }

      const worm = overs
        .filter(o => o.total != null)
        .map(o => ({ x:o.over, y:o.total, title:'Over '+o.over+': total '+o.total+' runs' }));
      const runs = overs.map(o => ({ x:o.over, y:o.runs, title:'Over '+o.over+': '+o.runs+' runs' }));
      const runrate = overs
        .filter(o => o.rate != null)
        .map(o => ({ x:o.over, y:o.rate, title:'Over '+o.over+': run rate '+Number(o.rate).toFixed(2) }));
      const partnership = safeArray(g.partnership).map(p => ({x:numeric(p?.over),y:numeric(p?.stand),title:'Over '+p?.over+': partnership '+p?.stand})).filter(p=>p.x!=null&&p.y!=null);

      let result = null;
      if (activeType === 'worm') result = drawLine(worm, {yLabel:'Total Runs', xLabel:'Overs', decimals:0, stroke:HOME_T.color});
      else if (activeType === 'runs') result = drawLine(runs, {yLabel:'Runs / Over', xLabel:'Overs', decimals:0, stroke:HOME_T.color});
      else if (activeType === 'runrate') result = drawLine(runrate, {yLabel:'Run Rate', xLabel:'Overs', decimals:2, stroke:HOME_T.color});
      else if (activeType === 'partnership') result = drawLine(partnership, {yLabel:'Partnership Runs', xLabel:'Overs', decimals:0, stroke:HOME_T.color});

      if (!result) {
        svg.innerHTML = '<text x="50%" y="48%" text-anchor="middle" fill="currentColor" opacity=".6" font-size="13">Real ' + esc(activeType) + ' data is not available for this innings.</text>';
        if (legend) legend.innerHTML = '<span class="text-gray-400">This graph requires data from the live API.</span>';
        return;
      }

      svg.innerHTML = result.html;
      if (legend) {
        const labels = {
          worm:'Score progression (Worm)',
          runs:'Runs scored per over',
          runrate:'Run rate derived from real over totals',
          partnership:'Real partnership feed'
        };
        legend.innerHTML =
          '<span class="text-gray-300">'+esc(teamNameFor(activeIid))+'</span>' +
          '<span class="text-gray-400">'+esc(labels[activeType] || '')+'</span>' +
          '<span class="text-gray-500">Real API data</span>';
      }
    };

    renderButtons();
    if (loading) loading.textContent = '';
    draw();
  }

  function renderNews() {
    const p=$('panel-news'); if(!p) return;
    let list=$('news-list'), src=$('news-source'), loading=$('news-loading');
    if(!list){
      p.innerHTML='<div class="col-span-12 bg-white dark:bg-[#12172D] rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-800"><div class="flex items-center justify-between mb-4"><h3 class="font-bold text-gray-800 dark:text-white">Cricket News</h3><span class="text-xs text-gray-400">Source: <span id="news-source">Live cricket feed</span></span></div><div id="news-list" class="grid grid-cols-1 sm:grid-cols-2 gap-4"></div><div id="news-loading" class="text-sm text-gray-500 dark:text-gray-400 mt-2"></div></div>';
      list=$('news-list'); src=$('news-source'); loading=$('news-loading');
    }
    if(src)src.textContent=M.news?.source||'Live cricket feed';
    const articles=Array.isArray(M.news?.articles)?M.news.articles:[];
    list.innerHTML=articles.length?articles.map(a=>'<article class="flex gap-3 rounded-lg border border-gray-200 dark:border-gray-800 p-3 bg-gray-50/40 dark:bg-white/5">'+(a.image?'<img src="'+esc(a.image)+'" alt="" class="w-20 h-20 rounded-md object-cover shrink-0" onerror="this.style.display=\'none\'">':'')+'<div class="min-w-0 flex-1"><p class="text-sm font-semibold text-gray-800 dark:text-white leading-snug">'+esc(a.title)+'</p><p class="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-3">'+esc(a.desc)+'</p><p class="text-[10px] text-gray-400 mt-1.5">'+esc(a.time)+'</p></div></article>').join(''):'<div class="col-span-2 p-6 text-sm text-gray-400">No related match news found. The common cricket feed is also empty right now.</div>';
    if(loading)loading.style.display='none';
  }

  // ============================================================ tabs
  function setupTabs() {
    const tabs = document.querySelectorAll('#match-tabs .tab-link');
    const panels = document.querySelectorAll('.tab-panel');
    function activate(tab) {
      const target = tab.dataset.tab;
      tabs.forEach(t => { t.classList.remove('border-crexGold', 'text-crexGold', 'font-bold'); t.classList.add('border-transparent'); });
      tab.classList.add('border-crexGold', 'text-crexGold', 'font-bold'); tab.classList.remove('border-transparent');
      panels.forEach(p => p.classList.toggle('hidden', p.id !== 'panel-' + target));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    tabs.forEach(tab => tab.addEventListener('click', e => { if (tab.id === 'prediction-link') return; e.preventDefault(); activate(tab); }));
  }

  // ============================================================ init
  // Sport-specific ambient background (subtle, theme-aware)
  function applySportBackground() {
    const body = document.body;
    body.classList.remove('sport-cricket', 'sport-football', 'sport-basketball', 'sport-tennis', 'sport-baseball', 'sport-hockey', 'sport-kabaddi', 'sport-esports', 'sport-tabletennis', 'sport-volleyball');
    const cls = 'sport-' + SPORT.replace(/[^a-z]/g, '');
    body.classList.add(cls);
    const sec = $('score-header');
    if (sec) sec.classList.add(cls);
  }

  // ============================================================================
  // LOAD BACKEND DATA BEFORE RENDER
  // ============================================================================
  async function bootMatchCenter() {
    document.body.style.visibility = "visible";
    try { init(); } catch (e) { console.warn('Initial shell render:', e); }
    try {
      await loadRealMatchData();
      updateTeamsFromBackend();
      const match = getMatchData();
      if (match && Object.keys(match).length) {
        M.meta.title = HOME_T.name + " vs " + AWAY_T.name;
        M.meta.sub = safeString(match.series || match.tournament || M.meta.sub);
        M.meta.series = safeString(match.series || match.tournament || M.meta.series);
        M.meta.venue = safeString(match.venue?.name || match.venue || M.meta.venue);
      } else {
        M.meta.title = M.meta.title || 'Match Center';
      }
      console.log("REAL Match Center loaded", MATCHID);
    } catch (err) {
      console.error("Boot Error:", err);
      setUnavailableModel('Real match data is not available');
      M.meta.title = 'Match Center';
    }
    init();
    document.body.style.visibility = "visible";
  }

  function init() {
    try { applySportBackground(); } catch (e) { console.error('bg', e); }
    try { renderScoreHeader(); } catch (e) { console.error('scoreHeader', e); }
    try { renderMatchInfo(); } catch (e) { console.error('matchInfo', e); }
    try { fetchTeamRankings(); } catch (e) { console.error('teamRankings', e); }
    try { renderSummary(); } catch (e) { console.error('summary', e); }
    try { renderScorecard(); } catch (e) { console.error('scorecard', e); }
    try { renderCommentary(); } catch (e) { console.error('commentary', e); }
    try { renderRules(); } catch (e) { console.error('rules', e); }
    try { renderSquads(); } catch (e) { console.error('squads', e); }
    try { renderGraph(); } catch (e) { console.error('graph', e); }
    try { renderNews(); } catch (e) { console.error('news', e); }
    try { setupTabs(); } catch (e) { console.error('tabs', e); }
    document.title = M.meta.title + ' | Fanconnact Match Center';
  }

  if (document.readyState === "loading") {

    document.addEventListener(
      "DOMContentLoaded",
      bootMatchCenter
    );

  }
  else {

    bootMatchCenter();

  }
})();
