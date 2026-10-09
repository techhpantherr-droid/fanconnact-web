// ============================================================================
// FanConnact SEO generator
// Pulls live/upcoming/recent matches from the backend and writes static,
// crawlable landing pages for every match + tournament, plus a sitemap.
// Run: node scripts/generate-seo-pages.mjs   (env: BACKEND_URL)
// Safe: if the backend returns no data, existing pages are left untouched.
// ============================================================================
import { writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const BASE = "https://fanconnact.com";
const BACKEND = (process.env.BACKEND_URL || "https://web-production-589a7.up.railway.app").replace(/\/$/, "");
const API = BACKEND + "/api";
const BRAND = "Fanconnact";
const NOW = Date.now();
const DAY = 86400000;

const SPORT_LABEL = {
  cricket: "Cricket", football: "Football", basketball: "Basketball", "e-sports": "E-Sports",
  volleyball: "Volleyball", tennis: "Tennis", hockey: "Hockey", baseball: "Baseball",
  "kabbaddi": "Kabaddi", tabletennis: "Table Tennis", esport: "E-Sports", "kabaddi": "Kabaddi",
};
const SPORT_SLUG = { esport: "e-sports", soccer: "football", icehockey: "hockey", kabaddi: "kabbaddi" };
const sportLabel = (s) => SPORT_LABEL[s] || (s ? s[0].toUpperCase() + s.slice(1) : "Sports");
const canonSport = (s) => { s = String(s || "cricket").toLowerCase(); return SPORT_SLUG[s] || s; };

const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const slugify = (s) => String(s || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "").slice(0, 70) || "x";
const fmtDate = (ms, fallback) => {
  if (ms == null || ms === "") return fallback || "";
  const d = new Date(Number(ms) || ms);
  return isNaN(d.getTime()) ? (fallback || "") : d.toISOString().slice(0, 10);
};
const fmtTime = (ms) => {
  if (ms == null || ms === "") return "";
  const d = new Date(Number(ms) || ms);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(11, 16) + " UTC";
};

function normStatus(raw) {
  const s = String(raw || "").toLowerCase();
  if (/complete|finished|result|won|drawn|abandon|stumps|post|after/.test(s)) return "finished";
  if (/preview|upcoming|scheduled|not started|pre|toss|delayed|starts/.test(s)) return "upcoming";
  return "live";
}

function cricketScore(score) {
  const get = (k) => {
    const inn = score && score[k];
    if (!inn) return "";
    const o = inn.innings || inn.inngs1 || inn;
    if (!o || o.runs == null) return "";
    const w = o.wickets != null ? "/" + o.wickets : "";
    const ov = o.overs != null ? " (" + o.overs + " ov)" : "";
    return o.runs + w + ov;
  };
  return { home: get("innings1"), away: get("innings2") };
}

async function getJSON(path, tries = 2) {
  for (let i = 0; i < tries; i++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 25000);
      const r = await fetch(API + path, { signal: ctrl.signal, headers: { accept: "application/json" } });
      clearTimeout(t);
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } catch (e) {
      if (i === tries - 1) { console.warn("  fail", path, "-", e.message); return null; }
    }
  }
  return null;
}
const asArray = (j) => (Array.isArray(j) ? j : (j && (j.matches || j.data || j.results)) || []);

function mkMatch(o) {
  const sport = canonSport(o.sport);
  const home = o.homeName || o.home || "";
  const away = o.awayName || o.away || "";
  if (!home || !away) return null;
  const date = o.date || "";
  const id = String(o.id || "");
  if (!id) return null;
  return {
    id, sport, status: o.status, tournament: o.tournament || "", format: o.format || "",
    venue: o.venue || "", city: o.city || "", date, time: o.time || "",
    home, away, homeShort: o.homeShort || "", awayShort: o.awayShort || "",
    homeScore: o.homeScore || "", awayScore: o.awayScore || "", detail: o.detail || "", result: o.result || "",
  };
}

function fromCricket(raw) {
  const sc = cricketScore(raw.score);
  const st = normStatus(raw.status);
  const ms = raw.startTime ? Number(raw.startTime) : null;
  return mkMatch({
    id: raw.id, sport: "cricket", status: st,
    tournament: raw.series || raw.tournament || "", format: raw.matchType || raw.format || "",
    venue: raw.venue || "", city: raw.city || "",
    date: fmtDate(ms, raw.date), time: fmtTime(ms),
    homeName: raw.homeTeam && (raw.homeTeam.name || raw.homeTeam.short),
    awayName: raw.awayTeam && (raw.awayTeam.name || raw.awayTeam.short),
    homeShort: raw.homeTeam && raw.homeTeam.short, awayShort: raw.awayTeam && raw.awayTeam.short,
    homeScore: sc.home, awayScore: sc.away,
    detail: raw.statusText || raw.result || raw.status || "",
    result: st === "finished" ? (raw.result || raw.statusText || raw.status || "") : "",
  });
}

function fromAllSports(raw) {
  const ms = raw.startTime ? Number(raw.startTime) : null;
  const st = normStatus(raw.status);
  return mkMatch({
    id: raw.id || raw.matchId, sport: raw.sport, status: st,
    tournament: raw.series || raw.tournament || raw.league || "", format: raw.matchType || raw.format || raw.sport || "",
    venue: raw.venue || "", city: raw.city || "",
    date: fmtDate(ms, raw.date), time: raw.time || fmtTime(ms),
    homeName: raw.homeTeam && (raw.homeTeam.name || raw.homeTeam.shortName),
    awayName: raw.awayTeam && (raw.awayTeam.name || raw.awayTeam.shortName),
    homeShort: raw.homeTeam && raw.homeTeam.shortName, awayShort: raw.awayTeam && raw.awayTeam.shortName,
    homeScore: raw.score && raw.score.home, awayScore: raw.score && raw.score.away,
    detail: raw.statusText || raw.result || (raw.score && raw.score.detail) || "",
    result: st === "finished" ? (raw.result || raw.statusText || (raw.score && raw.score.detail) || "") : "",
  });
}

function fromEspn(raw, sport) {
  const st = normStatus(raw.status || raw.state);
  return mkMatch({
    id: raw.id, sport, status: st,
    tournament: raw.league || "", format: sport,
    venue: raw.venue || "", city: raw.city || "",
    date: fmtDate(raw.date, ""), time: raw.time || "",
    homeName: raw.homeName, awayName: raw.awayName,
    homeShort: raw.homeAbbr, awayShort: raw.awayAbbr,
    homeScore: raw.homeScore, awayScore: raw.awayScore,
    detail: raw.time || "", result: st === "finished" ? (raw.time || "Full Time") : "",
  });
}

const PRIORITY = { live: 3, finished: 2, upcoming: 1 };

async function collect() {
  const [live, upcoming, recent, allsports, football, hockey, tennis] = await Promise.all([
    getJSON("/matches/live"), getJSON("/matches/upcoming"), getJSON("/matches/recent"),
    getJSON("/all-sports/matches?days=8"), getJSON("/matches?sport=football"),
    getJSON("/matches?sport=hockey"), getJSON("/matches?sport=tennis"),
  ]);

  const byId = new Map();
  const add = (m) => {
    if (!m || !m.id) return;
    const prev = byId.get(m.id);
    if (!prev || (PRIORITY[m.status] || 0) > (PRIORITY[prev.status] || 0)) byId.set(m.id, m);
  };

  asArray(live).forEach((r) => add(fromCricket(r)));
  asArray(upcoming).forEach((r) => add(fromCricket(r)));
  asArray(recent).forEach((r) => add(fromCricket(r)));
  asArray(allsports).forEach((r) => add(fromAllSports(r)));
  asArray(football).forEach((r) => add(fromEspn(r, "football")));
  asArray(hockey).forEach((r) => add(fromEspn(r, "hockey")));
  asArray(tennis).forEach((r) => add(fromEspn(r, "tennis")));

  const all = [...byId.values()];

  const inWindow = (m) => {
    if (m.status === "live") return true;
    const t = m.date ? Date.parse(m.date + "T00:00:00Z") : NaN;
    if (isNaN(t)) return true;
    if (m.status === "upcoming") return t <= NOW + 10 * DAY;
    return t >= NOW - 5 * DAY; // finished
  };

  return all.filter(inWindow).slice(0, 500);
}

function matchSlug(m) {
  return `${m.sport}-${slugify(m.home)}-vs-${slugify(m.away)}-${m.id}`;
}
function matchUrl(m) { return `${BASE}/matches/${matchSlug(m)}.html`; }
function appLink(m) {
  return `${BASE}/match-center.html?id=${encodeURIComponent(m.id)}&sport=${encodeURIComponent(m.sport)}&state=${encodeURIComponent(m.status)}`;
}
function titleFor(m) {
  const abbr = m.homeShort && m.awayShort ? ` (${m.homeShort} vs ${m.awayShort})` : "";
  const comp = m.tournament ? `, ${m.tournament}` : "";
  const live = m.status === "live" ? " Live Score" : m.status === "finished" ? " Result" : " Fixtures";
  return `${m.home} vs ${m.away}${abbr}${live}${comp} | ${BRAND}`;
}
function descFor(m) {
  const abbr = m.homeShort && m.awayShort ? ` (${m.homeShort} vs ${m.awayShort})` : "";
  const comp = m.tournament ? ` in the ${m.tournament}` : "";
  const when = m.date ? ` on ${m.date}${m.time ? " " + m.time : ""}` : "";
  const sc = m.homeScore || m.awayScore ? ` Score: ${m.home} ${m.homeScore || "-"}, ${m.away} ${m.awayScore || "-"}.` : "";
  return `${m.home} vs ${m.away}${abbr} ${sportLabel(m.sport)}${comp}${when}. Live score, result and full match details on ${BRAND}.${sc}`.slice(0, 300);
}

function head(title, desc, canon, extraLd) {
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": `${BASE}/#organization`, name: BRAND,
        alternateName: ["Fanconnect", "Fanconect", "Fanocnnact"],
        url: `${BASE}/`, logo: { "@type": "ImageObject", url: `${BASE}/assets/fancoin/fanconnact-icon.png` } },
      { "@type": "WebSite", "@id": `${BASE}/#website`, url: `${BASE}/`, name: BRAND, publisher: { "@id": `${BASE}/#organization` } },
      ...(Array.isArray(extra) ? extra : [extra]),
    ],
  };
  return "";
}

function htmlPage({ title, desc, canonical, keywords, jsonld, body, links }) {
  const nav = (links || []).map((l) => `<a href="${esc(l.href)}">${esc(l.label)}</a>`).join(" &middot; ");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<meta name="keywords" content="${esc(keywords)}" />
<meta name="robots" content="index, follow" />
<link rel="canonical" href="${esc(canonical)}" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:url" content="${esc(canonical)}" />
<meta property="og:site_name" content="${BRAND}" />
<meta property="og:image" content="${BASE}/assets/fancoin/fanconnact-icon.png" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(desc)}" />
<meta name="twitter:image" content="${BASE}/assets/fancoin/fanconnact-icon.png" />
<link rel="icon" type="image/png" sizes="32x32" href="${BASE}/assets/fancoin/favicon-32x32.png" />
<link rel="apple-touch-icon" href="${BASE}/assets/fancoin/apple-touch-icon.png" />
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
<style>
:root{--bg:#0b1020;--card:#141a2e;--ink:#eaf0ff;--mut:#9fb0d0;--acc:#2196f3;--acc2:#00d4ff}
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:radial-gradient(1200px 600px at 70% -10%,#172554,#0b1020 60%);color:var(--ink);line-height:1.5}
.wrap{max-width:920px;margin:0 auto;padding:20px 16px 60px}
header.top{display:flex;align-items:center;gap:12px;padding:14px 0}
header.top a.logo{display:flex;align-items:center;gap:10px;text-decoration:none;color:var(--ink);font-weight:800;font-size:20px}
header.top img{width:34px;height:34px;border-radius:8px}
.crumb{color:var(--mut);font-size:13px;margin:6px 0 14px}.crumb a{color:var(--acc2);text-decoration:none}
h1{font-size:24px;margin:6px 0 4px}h2{font-size:17px;margin:22px 0 8px}
.board{background:var(--card);border:1px solid #26304d;border-radius:14px;padding:16px;margin:14px 0}
.row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #232c45}.row:last-child{border-bottom:0}
.team{display:flex;align-items:center;gap:10px;font-weight:600}.abbr{color:var(--mut);font-weight:500;font-size:13px}
.score{font-weight:800;font-variant-numeric:tabular-nums}
.badge{display:inline-block;font-size:12px;font-weight:700;padding:3px 9px;border-radius:999px;margin-left:8px}
.live{background:#7f1d1d;color:#fecaca}.finished{background:#1e3a5f;color:#bae6fd}.upcoming{background:#3f2d0a;color:#fde68a}
.info{background:var(--card);border:1px solid #26304d;border-radius:14px;padding:14px 16px}
.info div{display:flex;justify-content:space-between;gap:16px;padding:6px 0;border-bottom:1px dashed #232c45}.info div:last-child{border-bottom:0}
.info span:first-child{color:var(--mut)}
.cta{display:inline-block;margin-top:16px;background:linear-gradient(135deg,var(--acc),var(--acc2));color:#04121f;font-weight:800;text-decoration:none;padding:12px 20px;border-radius:12px}
p.note{color:var(--mut);font-size:14px}
ul.list{list-style:none;padding:0;margin:0}
ul.list li{background:var(--card);border:1px solid #26304d;border-radius:12px;padding:12px 14px;margin:8px 0}
ul.list a{color:var(--ink);text-decoration:none;font-weight:600}
ul.list .sub{color:var(--mut);font-size:13px;margin-top:2px}
footer{margin-top:34px;color:var(--mut);font-size:13px;border-top:1px solid #232c45;padding-top:14px}
footer a{color:var(--acc2)}
</style>
</head>
<body>
<div class="wrap">
<header class="top"><a class="logo" href="${BASE}/"><img src="${BASE}/assets/fancoin/fanconnact-icon.png" alt="${BRAND}" />${BRAND}</a></header>
${arguments[0].body}
<footer>
${nav}<br /><br />
&copy; ${new Date().getFullYear()} ${BRAND} &mdash; live scores, fixtures, rankings and results across cricket, football, basketball, e-sports, tennis, hockey, volleyball &amp; more.
</footer>
</div>
</body>
</html>
`;
}

function matchPage(m, crumbs) {
  const url = matchUrl(m);
  const sc = (m.homeScore || m.awayScore)
    ? `<div class="board">
<div class="row"><span class="team">${esc(m.home)}${m.homeShort ? ` <span class="abbr">(${esc(m.homeShort)})</span>` : ""}</span><span class="score">${esc(m.homeScore || "-")}</span></div>
<div class="row"><span class="team">${esc(m.away)}${m.awayShort ? ` <span class="abbr">(${esc(m.awayShort)})</span>` : ""}</span><span class="score">${esc(m.awayScore || "-")}</span></div>
</div>`
    : `<div class="board"><p class="note">Scoreboard will update when the match starts. Check the live score on ${BRAND}.</p></div>`;

  const statusBadge = `<span class="badge ${esc(m.status)}">${esc(m.status === "live" ? "LIVE" : m.status === "finished" ? "COMPLETED" : "UPCOMING")}</span>`;

  const info = [
    m.tournament && ["Tournament", m.tournament],
    m.format && ["Format", m.format],
    m.date && ["Date", m.date],
    m.time && ["Time", m.time],
    m.venue && ["Venue", m.venue + (m.city ? ", " + m.city : "")],
    m.result && ["Result", m.result],
    ["Teams", `${m.home}${m.homeShort ? " (" + m.homeShort + ")" : ""} vs ${m.away}${m.awayShort ? " (" + m.awayShort + ")" : ""}`],
    ["Sport", sportLabel(m.sport)],
  ].filter(Boolean).map(([k, v]) => `<div><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join("");

  const jsonld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SportsEvent", "@id": matchUrl(m) + "#event", name: `${m.home} vs ${m.away}`,
        sport: sportLabel(m.sport), startDate: m.date || undefined,
        eventStatus: m.status === "finished" ? "https://schema.org/EventScheduled" : "https://schema.org/EventScheduled",
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        location: m.venue ? { "@type": "Place", name: m.venue, address: m.city || undefined } : undefined,
        competitor: [
          { "@type": "SportsTeam", name: m.home, ...(m.homeShort ? { alternateName: m.homeShort } : {}) },
          { "@type": "SportsTeam", name: m.away, ...(m.awayShort ? { alternateName: m.awayShort } : {}) },
        ],
        description: descFor(m),
      },
      {
        "@type": "BreadcrumbList", itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: BASE + "/" },
          { "@type": "ListItem", position: 2, name: "Matches", item: BASE + "/matches/" },
          { "@type": "ListItem", position: 3, name: `${m.home} vs ${m.away}`, item: matchUrl(m) },
        ],
      },
    ],
  };

  const body = `
<nav class="crumb"><a href="${BASE}/">Home</a> &rsaquo; <a href="${BASE}/matches/">Matches</a> &rsaquo; ${esc(m.sport ? sportLabel(m.sport) : "Match")}</nav>
<h1>${esc(m.home)} vs ${esc(m.away)}${m.homeShort && m.awayShort ? ` <span class="abbr">(${esc(m.homeShort)} vs ${esc(m.awayShort)})</span>` : ""} <span class="badge ${esc(m.status)}">${m.status === "live" ? "LIVE" : m.status === "finished" ? "FINISHED" : "UPCOMING"}</span></h1>
<p class="note">${esc(descFor(m))}</p>
<div class="board">${boardRows(m)}</div>
<h2>Match information</h2>
<div class="info">${info}</div>
<a class="cta" href="${esc(appLink(m))}">Open live score on ${BRAND} &rarr;</a>
${m.tournament ? `<h2>More from ${esc(m.tournament)}</h2><p><a href="${BASE}/tournament/${slugify(m.tournament)}.html">See all ${esc(m.tournament)} fixtures &amp; results</a></p>` : ""}
<p class="note">Live scores, ball-by-ball updates and results for ${esc(m.home)} vs ${esc(m.away)} are available on ${BRAND}. ${esc(m.tournament ? "Part of the " + m.tournament + "." : "")}</p>`;

  return htmlPage({
    title: titleFor(m), desc: descFor(m), canonical: matchUrl(m),
    keywords: `${m.home} vs ${m.away}${m.homeShort && m.awayShort ? ", " + m.homeShort + " vs " + m.awayShort : ""}, ${m.home} vs ${m.away} live score, ${sportLabel(m.sport)} live score${m.tournament ? ", " + m.tournament : ""}, ${BRAND}`,
    jsonld, body,
  });
}

function boardRows(m) {
  const r = (name, abbr, score) => `<div class="row"><div class="team">${esc(name)}${abbr ? ` <span class="abbr">${esc(abbr)}</span>` : ""}</div><div class="score">${esc(score || "-")}</div></div>`;
  return r(m.home, m.homeShort, m.homeScore) + r(m.away, m.awayShort, m.awayScore);
}

function tournamentPage(name, matches) {
  const slug = slugify(name);
  const url = `${BASE}/tournament/${slug}.html`;
  const title = `${name} - Fixtures, Results & Live Scores | ${BRAND}`;
  const desc = `All ${name} matches: fixtures, live scores and results. Follow ${name} on ${BRAND}.`;
  const jsonld = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "CollectionPage", name, url, description: desc,
        breadcrumb: { "@id": url + "#breadcrumb" } },
      { "@type": "BreadcrumbList", "@id": url + "#breadcrumb", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: BASE + "/" },
        { "@type": "ListItem", position: 2, name: "Matches", item: BASE + "/matches/" },
        { "@type": "ListItem", position: 3, name, item: url },
      ] },
    ],
  };
  const items = matches
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .map((m) => `<li><a href="${esc(matchUrl(m))}">${esc(m.home)} vs ${esc(m.away)}</a><div class="sub">${esc(m.date)}${m.time ? " " + esc(m.time) : ""}${m.venue ? " &middot; " + esc(m.venue) : ""} &middot; <span class="badge ${esc(m.status)}">${m.status.toUpperCase()}</span></div></li>`)
    .join("");
  const body = `
<nav class="crumb"><a href="${BASE}/">Home</a> &rsaquo; <a href="${BASE}/matches/">Matches</a> &rsaquo; ${esc(name)}</nav>
<h1>${esc(name)}</h1>
<p class="note">${esc(desc)}</p>
<ul class="list">${items}</ul>`;
  return htmlPage({ title, desc, canonical: url, keywords: `${name}, ${name} live score, ${name} fixtures, ${name} results, ${BRAND}`, jsonld, body });
}

function indexPage(matches, tournaments) {
  const url = `${BASE}/matches/`;
  const bySport = {};
  for (const m of matches) (bySport[m.sport] ||= []).push(m);
  const title = `All Matches - Live Scores, Fixtures & Results | ${BRAND}`;
  const desc = `Every live, upcoming and recently finished match across cricket, football, basketball, tennis, hockey and more: scores, fixtures and results on ${BRAND}.`;
  const sports = Object.keys(SPORT_LABEL).filter((s) => bySport[s]);
  const sections = sports.map((s) => {
    const items = bySport[s].sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .map((m) => `<li><a href="${esc(matchUrl(m))}">${esc(m.home)} vs ${esc(m.away)}</a><div class="sub">${esc(m.tournament)}${m.date ? " &middot; " + esc(m.date) : ""} <span class="badge ${esc(m.status)}">${esc(m.status)}</span></div></li>`).join("");
    return `<h2>${esc(sportLabel(s))}</h2><ul class="list">${items}</ul>`;
  }).join("");
  const tours = [...new Set(matches.map((m) => m.tournament).filter(Boolean))]
    .map((t) => `<li><a href="${BASE}/tournament/${slugify(t)}.html">${esc(t)}</a></li>`).join("");
  const jsonld = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "CollectionPage", name: title, url: BASE + "/matches/", description: desc },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: BASE + "/" },
        { "@type": "ListItem", position: 2, name: "Matches", item: BASE + "/matches/" },
      ] },
    ],
  };
  const body = `
<nav class="crumb"><a href="${BASE}/">Home</a> &rsaquo; Matches</nav>
<h1>Live scores, fixtures &amp; results</h1>
<p class="note">${esc(desc)}</p>
${tours ? `<h2>Tournaments</h2><ul class="list">${tours}</ul>` : ""}
${sections}`;
  return htmlPage({ title, desc, canonical: BASE + "/matches/", keywords: `live scores, fixtures, results, cricket live score, football live score, ${BRAND}`, jsonld, body });
}

function write(rel, html) {
  const p = join(ROOT, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, html, "utf8");
}

async function main() {
  console.log("Backend:", API);
  const matches = await collect();
  console.log("Matches collected:", matches.length);

  if (!matches.length) {
    console.warn("No matches returned - leaving existing generated pages untouched.");
    return;
  }

  for (const d of ["matches", "tournament"]) {
    const p = join(ROOT, d);
    if (existsSync(p)) rmSync(p, { recursive: true, force: true });
  }

  for (const m of matches) write(join("matches", matchSlug(m) + ".html"), matchPage(m));

  const tours = new Map();
  for (const m of matches) if (m.tournament) {
    if (!tours.has(m.tournament)) tours.set(m.tournament, []);
    tours.get(m.tournament).push(m);
  }
  for (const [name, ms] of tours) write(join("tournament", slugify(name) + ".html"), tournamentPage(name, ms));

  write(join("matches", "index.html"), indexPage(matches, tours));

  const urls = [];
  urls.push(BASE + "/matches/");
  for (const m of matches) urls.push(matchUrl(m));
  for (const name of tours.keys()) urls.push(`${BASE}/tournament/${slugify(name)}.html`);
  const today = new Date().toISOString().slice(0, 10);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${u.replace(/&/g, "&amp;")}</loc><lastmod>${today}</lastmod><changefreq>hourly</changefreq><priority>0.7</priority></url>`).join("\n") +
    `\n</urlset>\n`;
  writeFileSync(join(ROOT, "sitemap-matches.xml"), xml, "utf8");

  console.log(`Wrote ${matches.length} match pages, ${tours.size} tournament pages, sitemap-matches.xml (${urls.length} urls).`);
}

main().catch((e) => { console.error("FATAL", e); process.exit(1); });
