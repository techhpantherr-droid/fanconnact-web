/* ============================================================================
 * matches-data.js  —  REAL match data (sourced from ESPNcricinfo / ESPN scoreboards)
 * Date captured: 2026-07-15 (Wednesday).  These are real fixtures/results for
 * the day.  Live scores are supplied by the backend/API; no client-side score simulation.
 * Tournament / format / rules are kept exactly as per the real competition.
 * ==========================================================================*/
(function () {
  "use strict";

  // Helper: team meta (code must match TEAM_REGISTRY in match-center-engine.js)
  // cc = country code for flagcdn, color = brand colour, logo = image url (optional)
  const TEAMS = {
    // ---- Cricket (international + domestic) ----
    zim: { name: "Zimbabwe", cc: "zw", color: "#D7263D", flag: "🇿🇼" },
    ban: { name: "Bangladesh", cc: "bd", color: "#C026D3", flag: "🇧🇩" },
    "wi-w": { name: "WI Women", cc: "ag", color: "#DC2626", flag: "🏝️" },
    "ire-w": { name: "IRE Women", cc: "ie", color: "#169B62", flag: "🇮🇪" },
    ham: { name: "Hampshire", cc: null, color: "#CF152D", flag: "🦁" },
    ess: { name: "Essex", cc: null, color: "#009BD9", flag: "🦁" },
    nor: { name: "Northants", cc: null, color: "#E32219", flag: "🦁" },
    glo: { name: "Gloucs", cc: null, color: "#FBAB1E", flag: "🦁" },
    not: { name: "Notts", cc: null, color: "#003C82", flag: "🦁" },
    sur: { name: "Surrey", cc: null, color: "#E03A3C", flag: "🦁" },
    yor: { name: "Yorkshire", cc: null, color: "#1D3E6E", flag: "🦁" },
    som: { name: "Somerset", cc: null, color: "#1B8A4B", flag: "🦁" },
    lak: { name: "LA Knight Riders", cc: null, color: "#552583", flag: "🦁" },
    sf: { name: "SF Unicorns", cc: null, color: "#1D428A", flag: "🦁" },
    ny: { name: "MI New York", cc: null, color: "#FDB827", flag: "🦁" },
    wf: { name: "Washington Freedom", cc: null, color: "#C8102E", flag: "🦁" },
    eng: { name: "England", cc: "gb-eng", color: "#D32F2F", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
    ind: { name: "India", cc: "in", color: "#2196F3", flag: "🇮🇳" },

    // ===== Additional International Teams (Backend Compatible) =====

    pak: {
      name: "Pakistan",
      cc: "pk",
      color: "#006600",
      flag: "🇵🇰"
    },

    nz: {
      name: "New Zealand",
      cc: "nz",
      color: "#000000",
      flag: "🇳🇿"
    },

    wi: {
      name: "West Indies",
      cc: "ag",
      color: "#7B1E3A",
      flag: "🏝️"
    },

    sa: {
      name: "South Africa",
      cc: "za",
      color: "#007A4D",
      flag: "🇿🇦"
    },

    aus: {
      name: "Australia",
      cc: "au",
      color: "#FFD700",
      flag: "🇦🇺"
    },

    sl: {
      name: "Sri Lanka",
      cc: "lk",
      color: "#0038A8",
      flag: "🇱🇰"
    },

    afg: {
      name: "Afghanistan",
      cc: "af",
      color: "#D32011",
      flag: "🇦🇫"
    },

    ire: {
      name: "Ireland",
      cc: "ie",
      color: "#169B62",
      flag: "🇮🇪"
    },

    ned: {
      name: "Netherlands",
      cc: "nl",
      color: "#FF6600",
      flag: "🇳🇱"
    },

    usa: {
      name: "United States",
      cc: "us",
      color: "#3C3B6E",
      flag: "🇺🇸"
    },

    can: {
      name: "Canada",
      cc: "ca",
      color: "#D52B1E",
      flag: "🇨🇦"
    },

    sco: {
      name: "Scotland",
      cc: "gb-sct",
      color: "#0065BD",
      flag: "🏴"
    },

    nam: {
      name: "Namibia",
      cc: "na",
      color: "#003580",
      flag: "🇳🇦"
    },

    uae: {
      name: "United Arab Emirates",
      cc: "ae",
      color: "#00732F",
      flag: "🇦🇪"
    },

    nep: {
      name: "Nepal",
      cc: "np",
      color: "#DC143C",
      flag: "🇳🇵"
    },

    omn: {
      name: "Oman",
      cc: "om",
      color: "#C8102E",
      flag: "🇴🇲"
    },

    hk: {
      name: "Hong Kong",
      cc: "hk",
      color: "#DE2910",
      flag: "🇭🇰"
    },

    png: {
      name: "Papua New Guinea",
      cc: "pg",
      color: "#000000",
      flag: "🇵🇬"
    }
    ,
    // ---- Football ----
    eng_f: { name: "England", cc: "gb-eng", color: "#D32F2F", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
    arg: { name: "Argentina", cc: "ar", color: "#75AADB", flag: "🇦🇷" },

    // ---- Basketball (NBA Summer League) ----
    lal: { name: "LA Lakers", cc: null, color: "#552583", flag: "🟣" },
    bos: { name: "Boston Celtics", cc: null, color: "#007A33", flag: "🍀" },

    // ---- Baseball (MLB) ----
    nyy: { name: "NY Yankees", cc: null, color: "#0C2340", flag: "🇺🇸" },
    bos_b: { name: "Boston Red Sox", cc: null, color: "#BD3039", flag: "🇺🇸" },
    lad: { name: "LA Dodgers", cc: null, color: "#005A9C", flag: "🇺🇸" },
    sf_b: { name: "SF Giants", cc: null, color: "#FD5A1E", flag: "🇺🇸" },

    // ---- Hockey (NHL) ----
    tbl: { name: "Tampa Bay", cc: null, color: "#00205B", flag: "⚡" },
    col: { name: "Colorado", cc: null, color: "#6F263D", flag: "❄️" },
    tor: { name: "Toronto", cc: null, color: "#00205B", flag: "🍁" },
    edm: { name: "Edmonton", cc: null, color: "#041E42", flag: "🔥" },

    // ---- E-Sports ----
    sr: { name: "Sentinels", cc: null, color: "#E5322D", flag: "🎮" },
    fnc: { name: "Fnatic", cc: null, color: "#FF5700", flag: "🎮" },
    t1: { name: "T1", cc: null, color: "#E2012D", flag: "🎮" },
    g2: { name: "G2 Esports", cc: null, color: "#EE3A35", flag: "🎮" },

    // ---- Kabaddi (PKL) ----
    pun: { name: "Puneri Paltan", cc: null, color: "#D81B60", flag: "🤼" },
    hyd: { name: "Telugu Titans", cc: null, color: "#1E88E5", flag: "🤼" },
    ben: { name: "Bengal Warriors", cc: null, color: "#00897B", flag: "🤼" },
    pat: { name: "Patna Pirates", cc: null, color: "#FBC02D", flag: "🤼" },

    // ---- Table Tennis ----
    wang: { name: "Wang Chuqin", cc: "cn", color: "#DE2910", flag: "🏓" },
    har: { name: "Truls Moregard", cc: "se", color: "#006AA7", flag: "🏓" },
    sun: { name: "Sun Yingsha", cc: "cn", color: "#DE2910", flag: "🏓" },
    hay: { name: "Hina Hayata", cc: "jp", color: "#BC002D", flag: "🏓" },

    // ---- Volleyball ----
    bra: { name: "Brazil", cc: "br", color: "#009C3B", flag: "🇧🇷" },
    pol: { name: "Poland", cc: "pl", color: "#DC143C", flag: "🇵🇱" },
    usa_v: { name: "USA", cc: "us", color: "#3C3B6E", flag: "🇺🇸" },
    ita_v: { name: "Italy", cc: "it", color: "#009246", flag: "🇮🇹" },

    // ---- Tennis (example real tour) ----
    alc: { name: "Carlos Alcaraz", cc: "es", color: "#C60B1E", flag: "🇪🇸" },
    djo: { name: "Novak Djokovic", cc: "rs", color: "#C09A2E", flag: "🇷🇸" }
  };

  // Backend/API is authoritative for the homepage. Static match fixtures are not
  // used for live scores; MATCHES is populated only from backend responses.
  const MATCHES = [];

  // ---------------------------------------------------------------------------
  // Dynamic Cricbuzz team registry
  // Loads ALL International / League / Domestic / Women teams from the same
  // backend provider already used by FanConnact.  This prevents unknown-team
  // fallbacks such as the generic 🏏 icon for small/associate teams.
  // ---------------------------------------------------------------------------
  const TEAM_ID_META = Object.create(null);

  const COUNTRY_CODES = {
    india:'in', pakistan:'pk', australia:'au', england:'gb-eng', 'south africa':'za',
    'new zealand':'nz', 'sri lanka':'lk', bangladesh:'bd', afghanistan:'af',
    ireland:'ie', zimbabwe:'zw', 'west indies':'ag', nepal:'np', scotland:'gb-sct',
    namibia:'na', oman:'om', 'united arab emirates':'ae', 'hong kong':'hk',
    'papua new guinea':'pg', canada:'ca', 'united states':'us', usa:'us',
    malaysia:'my', germany:'de', denmark:'dk', singapore:'sg', kuwait:'kw',
    vanuatu:'vu', jersey:'je', fiji:'fj', italy:'it', belgium:'be', uganda:'ug',
    kenya:'ke', tanzania:'tz', rwanda:'rw', nigeria:'ng', botswana:'bw',
    malawi:'mw', zambia:'zm', ghana:'gh', sierra:'sl', 'sierra leone':'sl',
    thailand:'th', bhutan:'bt', indonesia:'id', cambodia:'kh', japan:'jp',
    'south korea':'kr', philippines:'ph', qatar:'qa', bahrain:'bh', saudi:'sa',
    france:'fr', spain:'es', portugal:'pt', netherlands:'nl', austria:'at',
    switzerland:'ch', romania:'ro', croatia:'hr', serbia:'rs', greece:'gr',
    cyprus:'cy', estonia:'ee', latvia:'lv', lithuania:'lt', luxembourg:'lu',
    sweden:'se', norway:'no', finland:'fi', iceland:'is', isleofman:'im',
    bermuda:'bm', cayman:'ky', argentina:'ar', brazil:'br', chile:'cl',
    peru:'pe', mexico:'mx', costa:'cr', 'costa rica':'cr', panama:'pa',
    colombia:'co', bahamas:'bs', jamaica:'jm', guyana:'gy', suriname:'sr',
    'trinidad and tobago':'tt', barbados:'bb', 'british virgin islands':'vg'
  };

  function normTeam(s) {
    return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function countryCodeFor(name) {
    const n = normTeam(name);
    if (!n) return '';
    if (COUNTRY_CODES[n]) return COUNTRY_CODES[n];
    const hit = Object.keys(COUNTRY_CODES).find(k => n === normTeam(k));
    return hit ? COUNTRY_CODES[hit] : '';
  }

  function extractTeamList(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.list)) return payload.list;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.data?.list)) return payload.data.list;
    if (Array.isArray(payload?.teams)) return payload.teams;
    if (Array.isArray(payload?.data?.teams)) return payload.data.teams;
    return [];
  }

  function teamLogoUrl(imageId) {
    if (!imageId) return '';
    const value = String(imageId).trim();
    if (!value) return '';
    if (/^https?:\/\//i.test(value)) return value;
    return 'https://static.cricbuzz.com/a/img/v1/i1/c' + encodeURIComponent(value) + '/i.jpg';
  }

  function firstArray(...values) {
    for (const value of values) {
      if (Array.isArray(value)) return value;
    }
    return [];
  }

  function unwrapMatchList(payload) {
    return firstArray(
      payload,
      payload?.data,
      payload?.matches,
      payload?.data?.matches,
      payload?.data?.list,
      payload?.list
    );
  }

  function unwrapScorePart(value) {
    if (value == null || value === '') return null;
    if (Array.isArray(value)) return value.find(Boolean) || null;
    if (typeof value !== 'object') return value;

    return value.inngs1 ||
      value.inngs2 ||
      value.innings1 ||
      value.innings2 ||
      value.scoreDetails ||
      value.score ||
      value;
  }

  function formatScorePart(value) {
    const part = unwrapScorePart(value);
    if (part == null || part === '') return '';

    if (typeof part === 'string' || typeof part === 'number') {
      return String(part);
    }

    const runs = part.runs ?? part.run ?? part.score ?? part.r;
    const wickets = part.wickets ?? part.wkts ?? part.wicket ?? part.w;
    if (runs != null && runs !== '') {
      return wickets != null && wickets !== ''
        ? String(runs) + '/' + String(wickets)
        : String(runs);
    }

    const text = part.scoreText || part.scoretext || part.display || part.value || '';
    return text != null ? String(text) : '';
  }

  function formatOvers(value) {
    const part = unwrapScorePart(value);
    if (part == null || typeof part !== 'object') return '';
    const overs = part.overs ?? part.over ?? part.ov;
    return overs != null && overs !== '' ? String(overs) + ' ov' : '';
  }

  function normalizeStatus(rawStatus, resultText, match = null) {
    const raw = String(rawStatus || '').toLowerCase();
    const result = String(resultText || '').toLowerCase();
    const text = (raw + ' ' + result).trim();

    // Some cricket providers keep a started Test in /matches/upcoming when
    // play is stopped by rain. Treat that started Test as LIVE instead.
    const format = String(match?.matchType || match?.matchFormat || match?.format || match?.type || '').toLowerCase();
    const score = match?.score || match?.scoreCard || {};
    const hasScore = Object.keys(score).length > 0 || score?.innings1 != null || score?.innings2 != null || score?.team1Score != null || score?.team2Score != null;
    const startedTime = Number(match?.startTime);
    const started = Number.isFinite(startedTime) && startedTime > 0 && startedTime <= Date.now();
    const isTest = /test/.test(format);
    const delayedOrInProgress = /(rain|delay|delayed|stumps|lunch|tea|session|day\s*[1-5]|innings break|in progress)/i.test(text);

    if (/(complete|completed|finished|result|won|draw|tie|no result|abandon|cancel)/i.test(text)) return 'finished';
    if (/(live|in progress|innings break|stumps|lunch|tea|day\s*[1-5]|session|drinks|rain delay|delayed)/i.test(text)) return 'live';

    // Exact fix: status=upcoming + already-started Test + score/delay info.
    if (isTest && started && (hasScore || delayedOrInProgress)) return 'live';

    if (/(upcoming|scheduled|not started|preview|fixture|yet to start|match starts|starts at)/i.test(text)) return 'upcoming';
    return 'upcoming';
  }

  function teamKey(rawTeam) {
    return String(rawTeam?.short || rawTeam?.teamSName || rawTeam?.code || rawTeam?.name || '')
      .toLowerCase().trim();
  }

  function registerDynamicTeam(raw, category) {
    if (!raw || typeof raw !== 'object') return;
    const name = raw.teamName || raw.name || raw.team || '';
    const short = raw.teamSName || raw.shortName || raw.teamShortName || raw.code || '';
    const id = raw.teamId ?? raw.id ?? '';
    if (!name && !short) return;

    const countryName = raw.countryName || raw.country || raw.nation || '';
    const cc = countryCodeFor(countryName || name);
    const imageId = raw.imageId || raw.imageID || raw.logoId || '';
    const isNational = category === 'international' || !!countryName;
    const logo = !isNational ? teamLogoUrl(imageId) : '';
    const key = String(short || name).toLowerCase();
    const meta = {
      name: name || short,
      cc: isNational ? (cc || null) : null,
      color: '#2563eb',
      flag: cc ? '🇺🇳' : '🏏',
      logo: logo || null,
      imageId: imageId || null,
      teamId: id || null,
      category: category || 'unknown',
      countryName: countryName || null
    };

    if (cc) meta.flag = cc === 'in' ? '🇮🇳' : (cc === 'pk' ? '🇵🇰' : '🌐');
    TEAMS[key] = { ...(TEAMS[key] || {}), ...meta };
    TEAMS[normTeam(name)] = { ...(TEAMS[normTeam(name)] || {}), ...meta };
    if (id !== '') TEAM_ID_META[String(id)] = meta;
  }

  async function loadDynamicTeamRegistry() {
    const categories = ['international', 'league', 'domestic', 'women'];
    const results = await Promise.allSettled(categories.map(async category => {
      const res = await fetch((window.FC_API ? window.FC_API.api() : (location.origin.includes('localhost') ? 'http://localhost:5000/api' : location.origin)) + '/teams/' + category);
      if (!res.ok) throw new Error(category + ' teams: HTTP ' + res.status);
      return { category, payload: await res.json() };
    }));
    results.forEach(r => {
      if (r.status !== 'fulfilled') return;
      extractTeamList(r.value.payload).forEach(team => registerDynamicTeam(team, r.value.category));
    });
    console.log('[matches] Dynamic Cricbuzz teams loaded:', Object.keys(TEAM_ID_META).length);
  }

  let backendRefreshPromise = null;
  let backendHasLoadedOnce = false;

  async function fetchJson(path) {
    const bases = [window.FC_API ? window.FC_API.api() : (location.origin.includes('localhost') ? 'http://localhost:5000/api' : location.origin)];

    let lastError = null;
    for (const base of bases) {
      try {
        const res = await fetch(base + path, {
          headers: { Accept: 'application/json' },
          cache: 'no-store'
        });
        if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + path);
        return await res.json();
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error('Backend unavailable');
  }

  function normalizeBackendMatch(match) {
    if (!match || typeof match !== 'object') return null;

    const homeTeam = match.homeTeam || match.team1 || match.teams?.home || {};
    const awayTeam = match.awayTeam || match.team2 || match.teams?.away || {};
    const homeName = homeTeam.name || homeTeam.teamName || homeTeam.teamname || '';
    const awayName = awayTeam.name || awayTeam.teamName || awayTeam.teamname || '';
    if (!homeName || !awayName) return null;

    const homeKeyRaw = teamKey(homeTeam) || normTeam(homeName);
    const awayKeyRaw = teamKey(awayTeam) || normTeam(awayName);

    const MAP = {
      wisxi: 'wi',
      slu19: 'sl',
      indu19: 'ind',
      paku19: 'pak',
      namw: 'nam',
      ugaw: 'uga',
      hkcw: 'hk',
      tanw: 'tan'
    };

    const hk = MAP[homeKeyRaw] || homeKeyRaw;
    const ak = MAP[awayKeyRaw] || awayKeyRaw;

    const homeId = homeTeam.id ?? homeTeam.teamId ?? '';
    const awayId = awayTeam.id ?? awayTeam.teamId ?? '';

    const ensureTeam = (key, raw, id, fallbackColor) => {
      const existing = TEAMS[key] || {};
      const byId = TEAM_ID_META[String(id)] || {};
      const country = raw.countryName || raw.country || raw.nation || byId.countryName || '';
      const cc = raw.cc || countryCodeFor(country || raw.name || raw.teamName || '');
      const imageId = raw.imageId || raw.imageID || raw.logoId || byId.imageId || '';
      TEAMS[key] = {
        ...byId,
        ...existing,
        name: raw.name || raw.teamName || raw.teamname || existing.name || key.toUpperCase(),
        cc: cc || existing.cc || null,
        color: existing.color || byId.color || fallbackColor,
        flag: existing.flag || (cc ? '🌐' : '🏏'),
        logo: teamLogoUrl(imageId) || existing.logo || null,
        imageId: imageId || existing.imageId || null,
        teamId: id || existing.teamId || null
      };
    };

    ensureTeam(hk, homeTeam, homeId, '#2563eb');
    ensureTeam(ak, awayTeam, awayId, '#ef4444');

    const score = match.score || match.scoreCard || {};
    const innings1 = score.innings1 ?? score.team1Score ?? score.team1 ?? score.home;
    const innings2 = score.innings2 ?? score.team2Score ?? score.team2 ?? score.away;

    const homeScore = formatScorePart(innings1);
    const awayScore = formatScorePart(innings2);

    const detail =
      formatOvers(innings2) ||
      formatOvers(innings1) ||
      String(score.detail || score.statusLine || match.statusText || '');

    const status = normalizeStatus(match.status || match.state, match.result || match.statusText, match);

    return {
      id: String(match.id ?? match.matchId ?? ''),
      sport: String(match.sport || 'cricket').toLowerCase(),
      status,
      tournament: match.series || match.tournament || '',
      format: match.matchType || match.matchFormat || match.format || '',
      stage: match.stage || '',
      venue: typeof match.venue === 'object' ? (match.venue.name || '') : (match.venue || ''),
      date: match.startTime
        ? new Date(Number(match.startTime)).toLocaleDateString('en-CA')
        : (match.date || ''),
      time: match.startTime
        ? new Date(Number(match.startTime)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : (match.time || ''),
      rules: match.rules || match.matchType || match.matchFormat || '',
      home: hk,
      away: ak,
      homeName,
      awayName,
      score: {
        home: homeScore,
        away: awayScore,
        detail,
        innings1: unwrapScorePart(innings1),
        innings2: unwrapScorePart(innings2)
      },
      statusLine: match.statusText || match.result || match.status || '',
      result: status === 'finished' ? (match.result || match.statusText || match.status || '') : '',
      link: 'match-center.html?id=' + encodeURIComponent(String(match.id ?? match.matchId ?? ''))
    };
  }

  async function loadBackendMatches() {
    if (backendRefreshPromise) return backendRefreshPromise;

    backendRefreshPromise = (async () => {
      try {
        await Promise.allSettled([loadDynamicTeamRegistry()]);

        const paths = ['/matches/live', '/matches/upcoming', '/matches/recent'];
        const settled = await Promise.allSettled(paths.map(fetchJson));

        const live = settled[0].status === 'fulfilled' ? unwrapMatchList(settled[0].value) : [];
        const upcoming = settled[1].status === 'fulfilled' ? unwrapMatchList(settled[1].value) : [];
        const recent = settled[2].status === 'fulfilled' ? unwrapMatchList(settled[2].value) : [];

        const seen = new Set();
        const sourceMatches = [...live, ...upcoming, ...recent];
        const normalized = [];

        for (const raw of sourceMatches) {
          const item = normalizeBackendMatch(raw);
          if (!item || !item.id || seen.has(item.id)) continue;
          seen.add(item.id);
          normalized.push(item);
        }

        try {
          const allSportsRes = await fetchJson('/all-sports/matches');
          const allSportsMatches = allSportsRes?.matches || [];
          for (const raw of allSportsMatches) {
            const item = normalizeBackendMatch(raw);
            if (!item || !item.id || seen.has(item.id)) continue;
            seen.add(item.id);
            item.id = item.id || raw.id || raw.matchId;
            item.sport = raw.sport || item.sport;
            if (item.status === 'upcoming' && raw.statusText) {
              item.statusLine = raw.statusText;
            }
            normalized.push(item);
          }
          console.log('[matches] AllSports matches loaded:', allSportsMatches.length);
        } catch (e) {
          console.warn('[matches] AllSports load failed:', e.message);
        }

        const anyEndpointSucceeded = settled.some(r => r.status === 'fulfilled');

        // Do not destroy the last good live data because one API request failed.
        // On the first successful backend response, replace the old static data entirely.
        if (anyEndpointSucceeded) {
          MATCHES.length = 0;
          normalized.forEach(item => MATCHES.push(item));
          backendHasLoadedOnce = true;

          window.FANCONNECT_BACKEND_MATCHES_READY = true;
          window.FANCONNECT_MATCHES = {
            TEAMS,
            MATCHES,
            capturedOn: new Date().toISOString(),
            source: 'FanConnact backend'
          };

          console.log('✅ FanConnact backend matches:', MATCHES.length, MATCHES);
          window.dispatchEvent(new CustomEvent('fanconnact:matches-data-updated'));
        } else if (!backendHasLoadedOnce) {
          window.FANCONNECT_BACKEND_MATCHES_READY = false;
          console.warn('⚠️ FanConnact backend unavailable; no fake/stale live score injected.');
        }
      } catch (err) {
        console.error('Backend Error:', err);
        if (!backendHasLoadedOnce) {
          window.FANCONNECT_BACKEND_MATCHES_READY = false;
        }
      } finally {
        backendRefreshPromise = null;
      }
    })();

    return backendRefreshPromise;
  }

  // Initial/page-load refresh: fetch all three match buckets.
  // The recurring ticker must NOT refetch upcoming/recent every 30 seconds.
  async function refreshLiveMatchesOnly() {
    if (backendRefreshPromise) return backendRefreshPromise;

    backendRefreshPromise = (async () => {
      try {
        const payload = await fetchJson('/matches/live');
        const live = unwrapMatchList(payload);

        const normalizedLive = [];
        const seen = new Set();

        for (const raw of live) {
          const item = normalizeBackendMatch(raw);
          if (!item || !item.id || seen.has(item.id)) continue;
          seen.add(item.id);
          normalizedLive.push(item);
        }

        // Replace only live entries while preserving the cached upcoming/recent
        // data already loaded on the page.
        const nonLive = MATCHES.filter(item => item.status !== 'live');
        MATCHES.length = 0;
        [...nonLive, ...normalizedLive].forEach(item => MATCHES.push(item));

        backendHasLoadedOnce = true;
        window.FANCONNECT_BACKEND_MATCHES_READY = true;
        window.FANCONNECT_MATCHES = {
          TEAMS,
          MATCHES,
          capturedOn: new Date().toISOString(),
          source: 'FanConnact backend'
        };

        window.dispatchEvent(new CustomEvent('fanconnact:matches-data-updated'));
      } catch (err) {
        console.warn('[matches] Live-only refresh failed:', err);
      } finally {
        backendRefreshPromise = null;
      }
    })();

    return backendRefreshPromise;
  }

  // Used only by the 30-second live ticker.
  window.FANCONNECT_refreshLiveMatches = refreshLiveMatchesOnly;
  window.FANCONNECT_refreshMatches = loadBackendMatches;

  window.FANCONNECT_MATCHES = {
    TEAMS,
    MATCHES,
    capturedOn: null,
    source: 'FanConnact backend'
  };

  loadBackendMatches();


})();
