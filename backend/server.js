const {

    startCleanup

} = require("./presence/cleanupManager");

const presenceRoutes =
require("./routes/presence.routes");

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");
const http = require("http");
const https = require("https");
const cheerio = require("cheerio");
const cron = require('node-cron');
const rankingsSync = require("./rankings-sync");
const { createChatServer } = require("./chat-server");
const { createNotificationServer, pushNotification } = require("./notif-server");


const matchRoutes = require("./routes/matches.routes");

const seriesRoutes = require("./routes/series.routes");

const teamRoutes=require("./routes/teams.routes");
const playerRoutes =
require("./routes/players.routes");
const venueRoutes =
require("./routes/venues.routes");

const rankingRoutes =
require("./routes/rankings.routes");

const newsRoutes =
require("./routes/news.routes");
const photoRoutes =
require("./routes/photos.routes");

const matchCenterRoutes =
require("./routes/matchcenter.routes");

const auctionRoutes =
require("./routes/auction.routes");

const scheduleRoutes =
require("./routes/schedule.routes");

const archiveRoutes =
require("./routes/archive.routes");

const browseRoutes =
require("./routes/browse.routes");

const statsRoutes =
require("./routes/stats.routes");



dotenv.config();
const PORT = process.env.PORT || 5000;

const app = express();

const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 300
});



app.use(cors());
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginEmbedderPolicy: false
  }));
app.use(compression());
app.use(express.json());
app.use(limiter);



app.use("/api/matches", matchRoutes);

app.use("/api/series", seriesRoutes);

app.use("/api/teams",teamRoutes);

app.use("/api/players",playerRoutes);

app.use("/api/venues", venueRoutes);

app.use("/api/rankings", rankingRoutes);

app.use("/api/news",newsRoutes);

app.use("/api/photos", photoRoutes);

app.use("/api/mcenter",matchCenterRoutes);

app.use("/api/auction", auctionRoutes);

app.use("/api/schedule", scheduleRoutes);

app.use("/api/archive", archiveRoutes);

app.use("/api/browse", browseRoutes);

app.use("/api/stats", statsRoutes);

app.use(

"/api/presence",

presenceRoutes

);


const DATA_DIR = path.join(__dirname, "..", "data");
const PLAYER_RANKINGS_PATH = path.join(DATA_DIR, "player-rankings.json");
const TEAM_RANKINGS_PATH = path.join(DATA_DIR, "team-rankings.json");

const server = http.createServer(app);
const chatWSS = createChatServer(server);
const notifWSS = createNotificationServer(server);

// Explicit upgrade routing so multiple WS paths don't interfere
server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/ws/chat') {
    chatWSS.handleUpgrade(req, socket, head, (ws) => chatWSS.emit('connection', ws, req));
  } else if (url.pathname === '/ws/notifications') {
    notifWSS.handleUpgrade(req, socket, head, (ws) => notifWSS.emit('connection', ws, req));
  } else {
    socket.destroy();
  }
});

// ─── SPORT CONFIGURATIONS ────────────────────────────────────────────────────

const SPORTS = {
  cricket: {
    label: "Cricket",
    icon: "sports_cricket",
    title: "ICC Cricket Rankings",
    tournament: "ICC Men's & Women's Rankings 2026",
    subtitle:
      "Top 100 ranked players across formats — click any row for full profile",
    defaultCategory: "odi_bat_men",
    filters: [
      {
        group: "format",
        label: "Format",
        options: [
          { value: "odi", label: "ODI" },
          { value: "t20", label: "T20" },
          { value: "test", label: "Test" },
        ],
      },
      {
        group: "role",
        label: "Role",
        options: [
          { value: "bat", label: "Batsman" },
          { value: "bowl", label: "Bowler" },
          { value: "ar", label: "All-Rounder" },
        ],
      },
      {
        group: "gender",
        label: "Gender",
        options: [
          { value: "men", label: "Men" },
          { value: "women", label: "Women" },
        ],
      },
    ],
    columns: [
      { key: "name", label: "Player" },
      { key: "country", label: "Country" },
      { key: "rating", label: "Rating", align: "center" },
      { key: "matches", label: "Mat", align: "center", hide: "sm" },
      { key: "runs", label: "Runs", align: "center", hide: "md" },
      { key: "wkts", label: "Wkts", align: "center", hide: "md" },
      { key: "avg", label: "Avg", align: "center", hide: "lg" },
      { key: "econ", label: "Econ/SR", align: "center", hide: "lg" },
    ],
  },
  football: {
    label: "Football",
    icon: "sports_soccer",
    title: "Football Top Players",
    tournament: "FIFA World Cup 2026 & Domestic Leagues",
    subtitle: "Top ranked footballers — click any row for full profile",
    defaultCategory: "scorers_men",
    filters: [
      {
        group: "stat",
        label: "Category",
        options: [
          { value: "scorers", label: "Top Scorers" },
          { value: "assists", label: "Top Assists" },
          { value: "rating", label: "Highest Rated" },
        ],
      },
      {
        group: "gender",
        label: "Gender",
        options: [
          { value: "men", label: "Men" },
          { value: "women", label: "Women" },
        ],
      },
    ],
    columns: [
      { key: "name", label: "Player" },
      { key: "country", label: "Country" },
      { key: "team", label: "Team", hide: "sm" },
      { key: "position", label: "Pos", align: "center", hide: "md" },
      { key: "goals", label: "Goals", align: "center" },
      { key: "assists", label: "Assists", align: "center", hide: "md" },
      { key: "matches", label: "Mat", align: "center", hide: "sm" },
      { key: "rating", label: "Rating", align: "center", hide: "lg" },
    ],
  },
  basketball: {
    label: "Basketball",
    icon: "sports_basketball",
    title: "NBA Top Players",
    subtitle:
      "Top ranked NBA players by season stats — click any row for full profile",
    defaultCategory: "points",
    filters: [
      {
        group: "stat",
        label: "Category",
        options: [
          { value: "points", label: "Points" },
          { value: "rebounds", label: "Rebounds" },
          { value: "assists", label: "Assists" },
        ],
      },
    ],
    columns: [
      { key: "name", label: "Player" },
      { key: "team", label: "Team", hide: "sm" },
      { key: "position", label: "Pos", align: "center", hide: "md" },
      { key: "points", label: "PPG", align: "center" },
      { key: "rebounds", label: "RPG", align: "center", hide: "md" },
      { key: "assists", label: "APG", align: "center", hide: "md" },
      { key: "fg_pct", label: "FG%", align: "center", hide: "lg" },
      { key: "rating", label: "EFF", align: "center", hide: "lg" },
    ],
  },
  tennis: {
    label: "Tennis",
    icon: "sports_tennis",
    title: "ATP/WTA Rankings",
    subtitle: "Top ranked tennis players — click any row for full profile",
    defaultCategory: "atp_singles",
    filters: [
      {
        group: "type",
        label: "Tour",
        options: [
          { value: "atp", label: "ATP" },
          { value: "wta", label: "WTA" },
        ],
      },
      {
        group: "category",
        label: "Category",
        options: [
          { value: "singles", label: "Singles" },
          { value: "doubles", label: "Doubles" },
        ],
      },
    ],
    columns: [
      { key: "name", label: "Player" },
      { key: "country", label: "Country" },
      { key: "points", label: "Points", align: "center" },
      { key: "tournaments", label: "Tourn", align: "center", hide: "md" },
      { key: "titles", label: "Titles", align: "center", hide: "sm" },
      { key: "winrate", label: "Win%", align: "center", hide: "lg" },
      { key: "prize", label: "Prize $M", align: "center", hide: "lg" },
    ],
  },
  baseball: {
    label: "Baseball",
    icon: "sports_baseball",
    title: "MLB Top Players",
    subtitle: "Top ranked MLB players — click any row for full profile",
    defaultCategory: "hr",
    filters: [
      {
        group: "stat",
        label: "Category",
        options: [
          { value: "hr", label: "Home Runs" },
          { value: "avg", label: "Batting Avg" },
          { value: "rbi", label: "RBI" },
          { value: "ops", label: "OPS" },
        ],
      },
    ],
    columns: [
      { key: "name", label: "Player" },
      { key: "team", label: "Team", hide: "sm" },
      { key: "position", label: "Pos", align: "center", hide: "md" },
      { key: "hr", label: "HR", align: "center" },
      { key: "avg", label: "AVG", align: "center", hide: "md" },
      { key: "rbi", label: "RBI", align: "center", hide: "md" },
      { key: "ops", label: "OPS", align: "center", hide: "lg" },
      { key: "games", label: "G", align: "center", hide: "lg" },
    ],
  },
  hockey: {
    label: "Hockey",
    icon: "sports_hockey",
    title: "FIH Hockey Rankings",
    subtitle:
      "Top ranked field hockey players — click any row for full profile",
    defaultCategory: "goals_men",
    filters: [
      {
        group: "stat",
        label: "Category",
        options: [
          { value: "goals", label: "Top Scorers" },
          { value: "assists", label: "Top Assists" },
        ],
      },
      {
        group: "gender",
        label: "Gender",
        options: [
          { value: "men", label: "Men" },
          { value: "women", label: "Women" },
        ],
      },
    ],
    columns: [
      { key: "name", label: "Player" },
      { key: "country", label: "Country" },
      { key: "position", label: "Pos", align: "center", hide: "md" },
      { key: "goals", label: "Goals", align: "center" },
      { key: "assists", label: "Assists", align: "center", hide: "md" },
      { key: "matches", label: "Mat", align: "center", hide: "sm" },
      { key: "rating", label: "Rating", align: "center", hide: "lg" },
    ],
  },
  volleyball: {
    label: "Volleyball",
    icon: "sports_volleyball",
    title: "FIVB Volleyball Rankings",
    subtitle: "Top ranked volleyball players — click any row for full profile",
    defaultCategory: "points_men",
    filters: [
      {
        group: "stat",
        label: "Category",
        options: [
          { value: "points", label: "Total Points" },
          { value: "spikes", label: "Best Spiker" },
          { value: "blocks", label: "Best Blocker" },
        ],
      },
      {
        group: "gender",
        label: "Gender",
        options: [
          { value: "men", label: "Men" },
          { value: "women", label: "Women" },
        ],
      },
    ],
    columns: [
      { key: "name", label: "Player" },
      { key: "country", label: "Country" },
      { key: "position", label: "Pos", align: "center", hide: "md" },
      { key: "points", label: "Points", align: "center" },
      { key: "spikes", label: "Spikes", align: "center", hide: "md" },
      { key: "blocks", label: "Blocks", align: "center", hide: "md" },
      { key: "aces", label: "Aces", align: "center", hide: "lg" },
      { key: "rating", label: "Rating", align: "center", hide: "lg" },
    ],
  },
  kabbaddi: {
    label: "Kabaddi",
    icon: "sports_kabaddi",
    title: "PKL Top Players",
    subtitle: "Top ranked Pro Kabaddi players — click any row for full profile",
    defaultCategory: "raid",
    filters: [
      {
        group: "stat",
        label: "Category",
        options: [
          { value: "raid", label: "Raid Points" },
          { value: "tackle", label: "Tackle Points" },
          { value: "allround", label: "All-Round" },
        ],
      },
    ],
    columns: [
      { key: "name", label: "Player" },
      { key: "team", label: "Team", hide: "sm" },
      { key: "position", label: "Pos", align: "center", hide: "md" },
      { key: "raid_pts", label: "Raid Pts", align: "center" },
      { key: "tackle_pts", label: "Tackle Pts", align: "center", hide: "md" },
      { key: "total_pts", label: "Total", align: "center", hide: "md" },
      { key: "matches", label: "Mat", align: "center", hide: "sm" },
      { key: "rating", label: "Rating", align: "center", hide: "lg" },
    ],
  },
  "e-sports": {
    label: "E-Sports",
    icon: "sports_esports",
    title: "E-Sports Top Players",
    subtitle:
      "Top ranked e-sports players by prize money — click any row for full profile",
    defaultCategory: "earnings",
    filters: [
      {
        group: "game",
        label: "Game",
        options: [
          { value: "all", label: "All Games" },
          { value: "valorant", label: "Valorant" },
          { value: "lol", label: "League of Legends" },
          { value: "cs2", label: "CS:GO/CS2" },
          { value: "dota2", label: "Dota 2" },
          { value: "fortnite", label: "Fortnite" },
        ],
      },
    ],
    columns: [
      { key: "name", label: "Player" },
      { key: "team", label: "Team", hide: "sm" },
      { key: "game", label: "Game", hide: "md" },
      { key: "earnings", label: "Prize $M", align: "center" },
      { key: "tournaments", label: "Tourn", align: "center", hide: "md" },
      { key: "winrate", label: "Win%", align: "center", hide: "lg" },
      { key: "rating", label: "Rating", align: "center", hide: "lg" },
    ],
  },
  "table-tennis": {
    label: "Table Tennis",
    icon: "sports_tennis",
    title: "ITTF Table Tennis Rankings",
    subtitle:
      "Top ranked table tennis players — click any row for full profile",
    defaultCategory: "singles_men",
    filters: [
      {
        group: "category",
        label: "Category",
        options: [
          { value: "singles", label: "Singles" },
          { value: "doubles", label: "Doubles" },
        ],
      },
      {
        group: "gender",
        label: "Gender",
        options: [
          { value: "men", label: "Men" },
          { value: "women", label: "Women" },
        ],
      },
    ],
    columns: [
      { key: "name", label: "Player" },
      { key: "country", label: "Country" },
      { key: "points", label: "Points", align: "center" },
      { key: "tournaments", label: "Tourn", align: "center", hide: "md" },
      { key: "titles", label: "Titles", align: "center", hide: "sm" },
      { key: "winrate", label: "Win%", align: "center", hide: "lg" },
      { key: "prize", label: "Prize $M", align: "center", hide: "lg" },
    ],
  },
};


// ─── SPORTSCORE API HELPER ───────────────────────────────────────────────────
// Free API – requires "Powered by SportScore" dofollow link on pages using data

const SPORTSCORE_BASE = "https://sportscore.com";

async function fetchFootballScorers(category) {
  const stat = category === "assists" ? "assists" : "goals";
  try {
    const url =
      SPORTSCORE_BASE +
      "/api/widget/topscorers/?sport=football&slug=english-premier-league&limit=50&stat=" +
      stat +
      "&src=fanconnact";
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.scorers || !data.scorers.length) return null;
    return data.scorers.map(function (s, i) {
      return {
        rank: i + 1,
        name: s.player || "Unknown",
        country: "",
        team: s.team || "",
        position: "",
        goals: s.goals != null ? s.goals : 0,
        assists: s.assists != null ? s.assists : 0,
        matches: s.matches || 0,
        rating: s.rating != null ? parseFloat(s.rating) : 0,
        _source: "sportscore",
      };
    });
  } catch (e) {
    return null;
  }
}

// ─── ESPN API HELPERS ───────────────────────────────────────────────────────
// Free undocumented API — no key required. Data from ESPN (espn.com).

const ESPN_BASKETBALL_BASE =
  "https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba";
const ESPN_BASEBALL_BASE =
  "https://site.web.api.espn.com/apis/common/v3/sports/baseball/mlb";
const ESPN_TENNIS_CORE = "https://sports.core.api.espn.com/v2/sports/tennis";

async function fetchBasketballFromESPN(category) {
  // Stat indices: PTS=offensive[0], REB=general[11], AST=offensive[10], FG%=offensive[3]
  var cfg = { catIdx: 1, valIdx: 0 };
  if (category === "rebounds") {
    cfg = { catIdx: 0, valIdx: 11 };
  } else if (category === "assists") {
    cfg = { catIdx: 1, valIdx: 10 };
  }

  try {
    var firstUrl =
      ESPN_BASKETBALL_BASE +
      "/statistics/byathlete?season=2026&seasontype=2&limit=50&page=1";
    var firstRes = await fetch(firstUrl, { signal: AbortSignal.timeout(8000) });
    if (!firstRes.ok) return null;
    var firstData = await firstRes.json();
    if (!firstData.athletes || !firstData.athletes.length) return null;

    var totalPages = firstData.pagination.pages || 1;
    var allAthletes = firstData.athletes.slice();

    if (totalPages > 1) {
      var pageUrls = [];
      for (var p = 2; p <= totalPages; p++) {
        pageUrls.push(
          ESPN_BASKETBALL_BASE +
            "/statistics/byathlete?season=2026&seasontype=2&limit=50&page=" +
            p,
        );
      }
      var pageResults = await Promise.allSettled(
        pageUrls.map(function (url) {
          return fetch(url, { signal: AbortSignal.timeout(8000) }).then(
            function (r) {
              return r.ok ? r.json() : null;
            },
          );
        }),
      );
      pageResults.forEach(function (result) {
        if (
          result.status === "fulfilled" &&
          result.value &&
          result.value.athletes
        ) {
          result.value.athletes.forEach(function (a) {
            allAthletes.push(a);
          });
        }
      });
    }

    var players = allAthletes.map(function (a) {
      var athlete = a.athlete;
      var cats = a.categories;
      var g = cats && cats[0] ? cats[0].values : null;
      var o = cats && cats[1] ? cats[1].values : null;
      var d = cats && cats[2] ? cats[2].values : null;
      return {
        name: athlete.displayName || athlete.firstName + " " + athlete.lastName,
        team: athlete.teamShortName || "",
        position: (athlete.position && athlete.position.abbreviation) || "",
        points: o ? o[0] : 0,
        rebounds: g ? g[11] : 0,
        assists: o ? o[10] : 0,
        fg_pct: o ? o[3] : 0,
        rating: 0,
        _source: "espn",
      };
    });

    players.sort(function (a, b) {
      var av = a[category] || a.points;
      var bv = b[category] || b.points;
      return bv - av;
    });
    players.forEach(function (p, i) {
      p.rank = i + 1;
    });
    players.forEach(function (p) {
      p.rating = parseFloat(
        (p.points + p.rebounds * 0.8 + p.assists * 0.7).toFixed(1),
      );
    });
    return players.slice(0, 100);
  } catch (e) {
    return null;
  }
}

async function fetchBaseballFromESPN(category) {
  // Batting stat indices: GP=0, AVG=4, HR=7, RBI=8, OPS=15
  var valIdx = 7;
  if (category === "avg") valIdx = 4;
  else if (category === "rbi") valIdx = 8;
  else if (category === "ops") valIdx = 15;

  try {
    var firstUrl =
      ESPN_BASEBALL_BASE +
      "/statistics/byathlete?category=batting&season=2026&seasontype=2&limit=50&page=1";
    var firstRes = await fetch(firstUrl, { signal: AbortSignal.timeout(8000) });
    if (!firstRes.ok) return null;
    var firstData = await firstRes.json();
    if (!firstData.athletes || !firstData.athletes.length) return null;

    var totalPages = firstData.pagination.pages || 1;
    var allAthletes = firstData.athletes.slice();

    if (totalPages > 1) {
      var pageUrls = [];
      for (var p = 2; p <= totalPages; p++) {
        pageUrls.push(
          ESPN_BASEBALL_BASE +
            "/statistics/byathlete?category=batting&season=2026&seasontype=2&limit=50&page=" +
            p,
        );
      }
      var pageResults = await Promise.allSettled(
        pageUrls.map(function (url) {
          return fetch(url, { signal: AbortSignal.timeout(8000) }).then(
            function (r) {
              return r.ok ? r.json() : null;
            },
          );
        }),
      );
      pageResults.forEach(function (result) {
        if (
          result.status === "fulfilled" &&
          result.value &&
          result.value.athletes
        ) {
          result.value.athletes.forEach(function (a) {
            allAthletes.push(a);
          });
        }
      });
    }

    var players = allAthletes.map(function (a) {
      var athlete = a.athlete;
      var batting = null;
      if (a.categories) {
        for (var j = 0; j < a.categories.length; j++) {
          if (a.categories[j].name === "batting") {
            batting = a.categories[j];
            break;
          }
        }
      }
      var v = batting ? batting.values : null;
      return {
        name: athlete.displayName || athlete.firstName + " " + athlete.lastName,
        team: athlete.teamShortName || "",
        position: (athlete.position && athlete.position.abbreviation) || "",
        hr: v ? v[7] : 0,
        avg: v ? v[4] : 0,
        rbi: v ? v[8] : 0,
        ops: v ? v[15] : 0,
        games: v ? v[0] : 0,
        _source: "espn",
      };
    });

    players.sort(function (a, b) {
      var av = a[category] || a.hr;
      var bv = b[category] || b.hr;
      return bv - av;
    });
    players.forEach(function (p, i) {
      p.rank = i + 1;
    });
    return players.slice(0, 100);
  } catch (e) {
    return null;
  }
}

async function fetchTennisFromESPN(type) {
  try {
    // Step 1: get rankings list to find latest ranking reference
    var listUrl = ESPN_TENNIS_CORE + "/leagues/" + type + "/rankings";
    var listRes = await fetch(listUrl, { signal: AbortSignal.timeout(8000) });
    if (!listRes.ok) return null;
    var listData = await listRes.json();
    if (!listData.items || !listData.items.length) return null;

    // Step 2: follow first $ref to get actual ranking data (includes rank, points, athlete.$ref)
    var rankRes = await fetch(listData.items[0].$ref, {
      signal: AbortSignal.timeout(8000),
    });
    if (!rankRes.ok) return null;
    var rankData = await rankRes.json();
    if (!rankData.ranks || !rankData.ranks.length) return null;

    // Step 3: get top 100 athlete details
    var topRanks = rankData.ranks.slice(0, 100);
    var athleteResults = await Promise.allSettled(
      topRanks.map(function (r) {
        return fetch(r.athlete.$ref, {
          signal: AbortSignal.timeout(5000),
        }).then(function (r2) {
          return r2.ok ? r2.json() : null;
        });
      }),
    );

    var players = [];
    for (var i = 0; i < topRanks.length; i++) {
      var r = topRanks[i];
      var ad =
        athleteResults[i].status === "fulfilled"
          ? athleteResults[i].value
          : null;
      if (!ad) continue;

      var name =
        ad.displayName ||
        (ad.firstName ? ad.firstName + " " + ad.lastName : "");
      var country = "";
      if (ad.citizenshipCountry) {
        country =
          ad.citizenshipCountry.abbreviation ||
          ad.citizenshipCountry.name ||
          "";
      }

      players.push({
        rank: r.current,
        name: name,
        country: country,
        points: r.points,
        tournaments: 0,
        titles: 0,
        winrate: 0,
        prize: 0,
        _source: "espn",
      });
    }

    if (players.length === 0) return null;
    return players.slice(0, 100);
  } catch (e) {
    return null;
  }
}

// ─── ROUTES ──────────────────────────────────────────────────────────────────

// Get list of all sports
app.get("/api/sports", (req, res) => {
  const list = Object.entries(SPORTS).map(([key, val]) => ({
    id: key,
    label: val.label,
    icon: val.icon,
    title: val.title,
  }));
  res.json({ sports: list });
});

// Get sport config
app.get("/api/sports/:sport", (req, res) => {
  const sport = SPORTS[req.params.sport];
  if (!sport) return res.status(404).json({ error: "Sport not found" });
  res.json({
    id: req.params.sport,
    label: sport.label,
    icon: sport.icon,
    title: sport.title,
    tournament: sport.tournament || '',
    subtitle: sport.subtitle,
    defaultCategory: sport.defaultCategory,
    filters: sport.filters,
    columns: sport.columns,
  });
});

// Get rankings for a sport with optional category
app.get("/api/rankings/:sport/:category?", async (req, res) => {
  const { sport: sportId, category } = req.params;
  const config = SPORTS[sportId];
  if (!config) return res.status(404).json({ error: "Sport not found" });

  const cat = category || config.defaultCategory;

  let players = [];

  // Load from player-rankings.json if available
  if (PLAYER_RANKINGS[sportId] && PLAYER_RANKINGS[sportId][cat]) {
    players = PLAYER_RANKINGS[sportId][cat];
    // Re-rank to ensure correct order
    players.forEach((p, i) => (p.rank = i + 1));
  } else {
    // API-only: real providers (synced DB, ESPN, SportScore). No invented data —
    // uncovered categories return an empty list instead of generated players.
    switch (sportId) {
      case "football": {
        const fParts = cat.split("_");
        const fStat = fParts[0];
        const fGender = fParts[1] || "men";
        if ((fStat === "scorers" || fStat === "assists") && fGender === "men") {
          const apiPlayers = await fetchFootballScorers(fStat);
          if (apiPlayers) {
            players = apiPlayers;
            break;
          }
        }
        players = [];
        break;
      }
      case "basketball": {
        const apiBasketball = await fetchBasketballFromESPN(cat);
        players = apiBasketball || [];
        break;
      }
      case "tennis": {
        const tParts = cat.split("_");
        const tType = tParts[0];
        const tCat = tParts[1] || "singles";
        if (tCat === "singles") {
          const apiTennis = await fetchTennisFromESPN(tType);
          if (apiTennis) {
            players = apiTennis;
            break;
          }
        }
        players = [];
        break;
      }
      case "baseball": {
        const apiBaseball = await fetchBaseballFromESPN(cat);
        players = apiBaseball || [];
        break;
      }
      default:
        players = [];
        break;
    }
  }

  var dataSource = "none";
  if (PLAYER_RANKINGS[sportId] && PLAYER_RANKINGS[sportId][cat]) {
    dataSource = "database";
  } else if (players.length > 0 && players[0]._source) {
    dataSource = players[0]._source;
  }
  const cleaned = players.slice(0, 100).map(function (p) {
    if (p._source) {
      var o = {};
      Object.keys(p).forEach(function (k) {
        if (k !== "_source") o[k] = p[k];
      });
      return o;
    }
    return p;
  });
  var pd = loadPlayerRankings();
  res.json({
    sport: sportId,
    label: config.label,
    title: config.title,
    subtitle: config.subtitle,
    category: cat,
    defaultCategory: config.defaultCategory,
    filters: config.filters,
    columns: config.columns,
    source: dataSource,
    players: cleaned,
    _lastSync: (pd._meta && pd._meta.lastSync) || null,
  });
});

// ─── TEAM LEADERBOARD DATA ───────────────────────────────────────────────────

function loadTeamRankings() {
  try {
    return JSON.parse(fs.readFileSync(TEAM_RANKINGS_PATH, "utf8"));
  } catch { return {}; }
}

function loadPlayerRankings() {
  try {
    return JSON.parse(fs.readFileSync(PLAYER_RANKINGS_PATH, "utf8"));
  } catch { return {}; }
}

const TEAM_RANKINGS = loadTeamRankings();
const PLAYER_RANKINGS = loadPlayerRankings();

// Get leaderboard metadata (sports list with categories + genders)
app.get("/api/leaderboard", (req, res) => {
  const list = Object.entries(TEAM_RANKINGS).map(([key, val]) => ({
    id: key,
    label: val.label,
    icon: val.icon,
    categories: val.categories,
    genders: val.genders || ["Men", "Women"],
  }));
  var pd = loadPlayerRankings();
  res.json({
    sports: list,
    _lastSync: (pd._meta && pd._meta.lastSync) || null,
  });
});

// Get team rankings for a sport + gender + category
// Accepts either /:sport/:category (defaults to Men) or /:sport/:gender/:category
app.get("/api/leaderboard/:sport/:gender/:category", (req, res) => {
  const sport = TEAM_RANKINGS[req.params.sport];
  if (!sport) return res.status(404).json({ error: "Sport not found" });
  const gender = req.params.gender;
  const category = req.params.category;
  const genderBlock = sport.rankings[gender];
  if (!genderBlock) return res.status(404).json({ error: "Gender not found" });
  const rankings = genderBlock[category];
  if (!rankings) return res.status(404).json({ error: "Category not found" });
  var pd = loadPlayerRankings();
  res.json({
    sport: req.params.sport,
    label: sport.label,
    icon: sport.icon,
    gender,
    category,
    rankings,
    _lastSync: (pd._meta && pd._meta.lastSync) || null,
  });
});

// Backwards-compatible: /:sport/:category (defaults gender to Men)
app.get("/api/leaderboard/:sport/:category", (req, res) => {
  const sport = TEAM_RANKINGS[req.params.sport];
  if (!sport) return res.status(404).json({ error: "Sport not found" });
  const gender = (sport.genders && sport.genders[0]) || "Men";
  const genderBlock = sport.rankings[gender];
  if (!genderBlock) return res.status(404).json({ error: "Gender not found" });
  const rankings = genderBlock[req.params.category];
  if (!rankings) return res.status(404).json({ error: "Category not found" });
  var pd = loadPlayerRankings();
  res.json({
    sport: req.params.sport,
    label: sport.label,
    icon: sport.icon,
    gender,
    category: req.params.category,
    rankings,
    _lastSync: (pd._meta && pd._meta.lastSync) || null,
  });
});

// ─── SYNC STATUS ─────────────────────────────────────────────────────────────

// ── GLOBAL SEARCH (players + matches) ──────────────────────────────────
// Searches player rankings (all sports) and the static match list.
app.get("/api/search", async (req, res) => {
  const q = (req.query.q || "").toString().trim().toLowerCase();
  if (!q) return res.json({ players: [], matches: [] });

  // ---- Players: scan all sports/categories in player-rankings.json ----
  const players = [];
  try {
    const pd = loadPlayerRankings();
    Object.keys(pd).forEach(sportId => {
      if (sportId === "_meta") return;
      const sportBlock = pd[sportId];
      if (!sportBlock) return;
      Object.keys(sportBlock).forEach(cat => {
        const list = sportBlock[cat];
        if (!Array.isArray(list)) return;
        list.forEach(p => {
          if (p && p.name && p.name.toString().toLowerCase().includes(q)) {
            players.push({
              name: p.name,
              sport: sportId,
              category: cat,
              rank: p.rank || null,
              team: p.team || p.country || "",
              stat: p.runs != null ? p.runs
                : p.goals != null ? p.goals
                : p.points != null ? p.points
                : p.wkts != null ? p.wkts
                : p.rating != null ? p.rating : "",
            });
          }
        });
      });
    });
  } catch (e) { /* ignore */ }
  // De-dupe by name+sport, sort by rank
  const seen = new Set();
  const uniquePlayers = players.filter(p => {
    const k = p.sport + "|" + p.name;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).sort((a, b) => (a.rank || 999) - (b.rank || 999)).slice(0, 8);

  // ---- Matches: scan static match data ----
  let matches = [];
  try {
    const md = require("./../js/matches-data.js");
  } catch (e) {}
  // matches-data.js is a browser IIFE; read the file and eval the export instead.
  try {
    const fs = require("fs");
    const path = require("path");
    const mdPath = path.join(__dirname, "..", "js", "matches-data.js");
    const src = fs.readFileSync(mdPath, "utf8");
    // Extract TEAMS and MATCHES via a sandboxed eval
    const sandbox = { window: {}, module: {}, console };
    const vm = require("vm");
    vm.createContext(sandbox);
    vm.runInContext(src + "\n;__OUT={TEAMS:window.FANCONNECT_MATCHES?window.FANCONNECT_MATCHES.TEAMS:null,MATCHES:window.FANCONNECT_MATCHES?window.FANCONNECT_MATCHES.MATCHES:null};", sandbox);
    const OUT = sandbox.__OUT || {};
    const TEAMS = OUT.TEAMS || {};
    const MATCHES = OUT.MATCHES || [];
    matches = MATCHES.filter(m => {
      const h = (TEAMS[m.home] || { name: m.home }).name || "";
      const a = (TEAMS[m.away] || { name: m.away }).name || "";
      const t = (m.tournament || "").toString();
      return (h.toLowerCase().includes(q) || a.toLowerCase().includes(q) || t.toLowerCase().includes(q));
    }).slice(0, 8).map(m => {
      const h = (TEAMS[m.home] || { name: m.home }).name || m.home;
      const a = (TEAMS[m.away] || { name: m.away }).name || m.away;
      return {
        id: m.id, sport: m.sport, status: m.status,
        home: h, away: a,
        tournament: m.tournament || "",
        date: m.date || "", time: m.time || "",
        link: m.link || "match-center.html?id=" + encodeURIComponent(m.id),
      };
    });
  } catch (e) { /* ignore */ }

  res.json({ players: uniquePlayers, matches });
});

app.get("/api/sync/status", (req, res) => {
  res.json(rankingsSync.getSyncStatus());
});

app.post("/api/sync/trigger", async (req, res) => {
  res.json({ message: "Sync started", status: rankingsSync.getSyncStatus() });
  rankingsSync.fullSync().catch(() => {});
});

app.get("/api/sync/last-updated", (req, res) => {
  const playerData = loadPlayerRankings();
  const lastSync = playerData._meta?.lastSync || null;
  res.json({
    lastSync,
    humanReadable: lastSync ? new Date(lastSync).toLocaleString() : 'Never',
    dataAge: lastSync ? Math.floor((Date.now() - new Date(lastSync).getTime()) / 1000 / 60) + ' minutes' : 'N/A',
    playerRecords: Object.keys(playerData).filter(k => k !== '_meta').length,
  });
});

// ─── REFRESH DATA ────────────────────────────────────────────────────────────

function refreshData() {
  const td = loadTeamRankings();
  const pd = loadPlayerRankings();
  Object.keys(td).forEach(k => { TEAM_RANKINGS[k] = td[k]; });
  Object.keys(pd).forEach(k => { PLAYER_RANKINGS[k] = pd[k]; });
}

// Auto-sync every 6 hours
cron.schedule('0 */6 * * *', () => {
  console.log('[Cron] Starting auto-sync...');
  rankingsSync.fullSync().then(refreshData).catch(() => {});
});

// ─── MATCH NEWS (cricbuzz proxy with fallback) ──────────────────────────────
const NEWS_MATCH_ID = '129458'; // eng-vs-ind-1st-odi-2026
async function fetchCricbuzzNews() {
  try {
    const url = 'https://www.cricbuzz.com/cricket-match-news/' + NEWS_MATCH_ID + '/eng-vs-ind-1st-odi-india-tour-of-england-2026';
    const html = await new Promise((resolve, reject) => {
      https.get(url, res => {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => resolve(body));
      }).on('error', reject);
    });
    const $ = cheerio.load(html);
    const articles = [];
    $('.cb-col.cb-col-100.cb-lst-itm.cb-lst-itm-lg').each((i, el) => {
      const title = $(el).find('.cb-nws-hdln').text().trim() || $(el).find('a').first().text().trim();
      const desc = $(el).find('.cb-nws-con').text().trim();
      const link = $(el).find('a').first().attr('href') || '';
      const time = $(el).find('.cb-nws-time').text().trim();
      const img = $(el).find('img').first().attr('src') || '';
      if (title) articles.push({ title, desc: desc.slice(0, 200), link: link.startsWith('http') ? link : 'https://www.cricbuzz.com' + link, time, image: img });
    });
    if (articles.length) return articles.slice(0, 12);
  } catch (e) { console.error('News scrape failed', e.message); }
  // API-only: no invented headlines. Empty scrape means empty list.
  return [];
}
app.get('/api/match/news', async (req, res) => {
  try {
    const articles = await fetchCricbuzzNews();
    res.json({ source: 'cricbuzz', articles });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── MATCH GRAPHS ─────────────────────────────────────────────────────────────
// Removed: previously served a hardcoded fictional chase (India 259). Graphs
// now come only from real per-match endpoints (overs/balls/partnership).
// ─── MATCHES (real data from ESPN scoreboard, with team logos) ──────────────
// Maps our app sport keys -> ESPN scoreboard path.
const MATCH_SPORT_PATHS = {
  football: 'soccer/eng.1',     // Premier League
  basketball: 'basketball/nba',
  hockey: 'hockey/nhl',
  baseball: 'baseball/mlb',
  tennis: 'tennis/atp',
  cricket: 'cricket',           // ESPN has no cricket scoreboard; falls back
  volleyball: null,
  tabletennis: null,
  kabaddi: null,
  esports: null,
};

async function fetchEspnScoreboard(path) {
  const url = `https://site.web.api.espn.com/apis/site/v2/sports/${path}/scoreboard`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) return [];
    const j = await r.json();
    return (j.events || []).map((ev) => {
      const comp = (ev.competitions && ev.competitions[0]) || {};
      const cs = comp.competitors || [];
      const home = cs.find((c) => c.homeAway === 'home') || cs[0] || {};
      const away = cs.find((c) => c.homeAway === 'away') || cs[1] || {};
      const st = (ev.status && ev.status.type) || {};
      const state = st.state; // 'pre' | 'in' | 'post'
      const status = state === 'in' ? 'LIVE' : state === 'post' ? 'COMPLETED' : 'UPCOMING';
      const team = (t) => ({
        name: (t.team && t.team.displayName) || (t.team && t.team.name) || 'TBD',
        abbr: (t.team && t.team.abbreviation) || '',
        logo: (t.team && t.team.logo) || '',
      });
      const h = team(home), a = team(away);
      return {
        id: ev.id || "",
        sport: ev.league ? (ev.league.abbreviation || ev.league.name) : '',
        league: (ev.league && ev.league.name) || '',
        status,
        state,
        time: st.shortDetail || st.description || ev.date || '',
        date: ev.date || '',
        homeName: h.name,
        homeAbbr: h.abbr,
        homeLogo: h.logo,
        awayName: a.name,
        awayAbbr: a.abbr,
        awayLogo: a.logo,
        homeScore: home.score != null ? String(home.score) : '',
        awayScore: away.score != null ? String(away.score) : '',
        venue: (comp.venue && comp.venue.fullName) || '',
      };
    });
  } catch (e) {
    console.error('Scoreboard fetch failed for', path, e.message);
    return [];
  } finally {
    clearTimeout(t);
  }
}

// No static fallback: ESPN-only. Empty backend means empty results, never invented matches.
app.get('/api/matches', async (req, res) => {
  try {
    const sport = (req.query.sport || 'all').toString();
    let results = [];
    if (sport === 'all') {
      for (const key of Object.keys(MATCH_SPORT_PATHS)) {
        const path = MATCH_SPORT_PATHS[key];
        if (!path) continue;
        const ms = await fetchEspnScoreboard(path);
        results = results.concat(ms);
      }
    } else {
      const path = MATCH_SPORT_PATHS[sport];
      if (path) {
        results = await fetchEspnScoreboard(path);
      }
    }
    res.json({ source: 'espn', count: results.length, matches: results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── ALL SPORTS RAPIDAPI PROXY (basketball, football, etc.) ──────────────────
const ALLSPORTS_CONFIG = {
  key: process.env.ALLSPORTS_API_KEY,
  host: process.env.ALLSPORTS_API_HOST,
  base: process.env.ALLSPORTS_BASE_URL || "https://allsportsapi2.p.rapidapi.com",
};

// ─── NORMALIZED ALL-SPORTS MATCHES (for sport pages) ───────────────────────
const ALLSPORTS_SUPPORTED = ["basketball", "baseball", "volleyball", "handball", "esport", "kabaddi"];

// ─── PKL KABADDI SCRAPER (free, official prokabaddi.com fixtures) ───────────
// No key needed. The /fixtures page embeds window.fixtureWidgetData with every
// Season 12 match: dates, status, scores, teams and player involvements.
const pklCache = { ts: 0, events: [] };

function pklExtractBlob(html) {
  const m = html.match(/window\.fixtureWidgetData\s*=\s*\{/);
  if (!m) return null;
  const start = html.indexOf("{", m.index);
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (inStr) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') inStr = false; }
    else {
      if (ch === '"') inStr = true;
      else if (ch === "{") depth++;
      else if (ch === "}") { depth--; if (depth === 0) return html.slice(start, i + 1); }
    }
  }
  return null;
}

async function fetchPklKabaddi() {
  if (Date.now() - pklCache.ts < 30 * 60 * 1000 && pklCache.events.length) return pklCache.events;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch("https://www.prokabaddi.com/fixtures", {
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 (FanConnact live-score widget)" },
    });
    if (!r.ok) throw new Error("PKL HTTP " + r.status);
    const html = await r.text();
    const blob = pklExtractBlob(html);
    if (!blob) throw new Error("PKL data blob not found");
    const data = JSON.parse(blob);
    const byDate = data.fixtureByDate || {};
    const events = [];
    for (const [date, list] of Object.entries(byDate)) {
      for (const ev of (list || [])) {
        const parts = ev.participants || [];
        if (parts.length < 2) continue;
        events.push({
          date, start: ev.start_date || "", end: ev.end_date || "",
          status: ev.event_status || "", state: ev.event_state || "",
          result: ev.event_sub_status || "", series: ev.series_name || "Pro Kabaddi League",
          stage: ev.event_stage || "", venue: ev.venue_name || "",
          home: { name: parts[0].name || "", short: parts[0].short_name || "", score: parts[0].value != null ? String(parts[0].value) : "", players: parts[0].players_involved || [] },
          away: { name: parts[1].name || "", short: parts[1].short_name || "", score: parts[1].value != null ? String(parts[1].value) : "", players: parts[1].players_involved || [] },
        });
      }
    }
    pklCache.ts = Date.now();
    pklCache.events = events;
    console.log("[PKL] scraped matches:", events.length);
    return events;
  } finally {
    clearTimeout(t);
  }
}

function normalizePkl(ev) {
  const st = String(ev.status || ev.state || "");
  const status = /complet|result|tie|beat|won|draw/i.test(st) ? "finished"
    : (/live|progress|break|half|raid/i.test(st) ? "live" : "upcoming");
  const id = "pkl_" + ev.date + "_" + ev.home.short + "-" + ev.away.short;
  let time = "";
  if (ev.start) {
    const d = new Date(ev.start);
    if (!isNaN(d.getTime())) time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return {
    id, matchId: id, sport: "kabaddi", status,
    series: ev.series, matchType: "kabaddi", format: "kabaddi",
    stage: ev.stage, venue: ev.venue || "",
    startTime: ev.start ? Date.parse(ev.start) : null,
    date: ev.date || "", time, rules: "kabaddi",
    homeTeam: { name: ev.home.name, shortName: ev.home.short },
    awayTeam: { name: ev.away.name, shortName: ev.away.short },
    score: { home: ev.home.score, away: ev.away.score, detail: ev.result || "" },
    result: status === "finished" ? (ev.result || "Full Time") : "",
    statusText: ev.result || ev.status,
  };
}

function pklToDetail(ev) {
  const toPlayers = (p) => (p.players || []).slice(0, 14).map((x) => ({
    player: { name: x.name || "Player" }, position: x.type || "", points: x.value || "",
  }));
  return {
    success: true, source: "pkl",
    match: normalizePkl(ev), events: ev, incidents: [],
    lineups: { home: { players: toPlayers(ev.home) }, away: { players: toPlayers(ev.away) } },
    homeStats: [], awayStats: [],
  };
}

function normalizeAllSportsEvent(event, sport) {
  if (!event || !event.id) return null;
  const t = event.status?.type || "";
  let status;
  if (t === "inprogress" || t === "live") status = "live";
  else if (t === "finished") status = "finished";
  else status = "upcoming";

  const ts = event.startTimestamp ? event.startTimestamp * 1000 : null;
  return {
    id: "as_" + event.id,
    matchId: "as_" + event.id,
    sport,
    status,
    series: event.tournament?.name || "",
    matchType: sport,
    format: sport,
    stage: "",
    venue: "",
    startTime: ts,
    date: ts ? new Date(ts).toLocaleDateString("en-CA") : "",
    time: ts ? new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
    rules: sport,
    homeTeam: {
      name: event.homeTeam?.name || "",
      shortName: event.homeTeam?.shortName || event.homeTeam?.nameCode || "",
      id: event.homeTeam?.id || "",
    },
    awayTeam: {
      name: event.awayTeam?.name || "",
      shortName: event.awayTeam?.shortName || event.awayTeam?.nameCode || "",
      id: event.awayTeam?.id || "",
    },
    score: {
      home: String(event.homeScore?.current ?? ""),
      away: String(event.awayScore?.current ?? ""),
      detail: event.status?.description || "",
    },
    result: status === "finished" ? (event.status?.description || "Finished") : "",
    statusText: event.status?.description || "",
  };
}

const allSportsMatchesCache = new Map();

// ─── ESPN/FREE FALLBACK for AllSports (no key needed) ───────────────────────
// Used when RapidAPI AllSports fails, is rate-limited, or returns nothing.
// ESPN covers basketball (NBA) + baseball (MLB). Other sports have no free
// scoreboard and return [] so callers degrade gracefully.
const ESPN_ALLSPORTS_PATHS = {
  basketball: "basketball/nba",
  baseball: "baseball/mlb",
  football: "soccer/eng.1",
  hockey: "hockey/nhl",
  tennis: "tennis/atp",
};

function normalizeEspnToAllSports(ev, sport) {
  if (!ev || !ev.id) return null;
  const comp = (ev.competitions && ev.competitions[0]) || {};
  const cs = comp.competitors || [];
  const home = cs.find((c) => c.homeAway === "home") || cs[0] || {};
  const away = cs.find((c) => c.homeAway === "away") || cs[1] || {};
  const st = (ev.status && ev.status.type) || {};
  const state = st.state; // pre | in | post
  const status = state === "in" ? "live" : state === "post" ? "finished" : "upcoming";
  const detail = st.shortDetail || st.description || "";
  const ts = ev.date ? Date.parse(ev.date) : null;
  const id = "espn_" + ev.id;
  return {
    id, matchId: id, sport, status,
    series: (ev.league && ev.league.name) || "",
    matchType: sport, format: sport, stage: "",
    venue: (comp.venue && comp.venue.fullName) || "",
    startTime: Number.isFinite(ts) ? ts : null,
    date: Number.isFinite(ts) ? new Date(ts).toLocaleDateString("en-CA") : "",
    time: Number.isFinite(ts) ? new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
    rules: sport,
    homeTeam: { name: (home.team && (home.team.displayName || home.team.name)) || "", shortName: (home.team && home.team.abbreviation) || "", id: (home.team && home.team.id) || "" },
    awayTeam: { name: (away.team && (away.team.displayName || away.team.name)) || "", shortName: (away.team && away.team.abbreviation) || "", id: (away.team && away.team.id) || "" },
    score: { home: home.score != null ? String(home.score) : "", away: away.score != null ? String(away.score) : "", detail },
    result: status === "finished" ? (detail || "Finished") : "",
    statusText: detail,
  };
}

async function fetchEspnAllSportsMatches(sport) {
  const path = ESPN_ALLSPORTS_PATHS[sport];
  if (!path) return [];
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(`https://site.web.api.espn.com/apis/site/v2/sports/${path}/scoreboard`, { signal: ctrl.signal });
    if (!r.ok) return [];
    const j = await r.json();
    return (j.events || []).map((ev) => normalizeEspnToAllSports(ev, sport)).filter(Boolean);
  } catch (e) {
    console.error("[AllSports] ESPN fallback failed for", sport, e.message);
    return [];
  } finally {
    clearTimeout(t);
  }
}

async function fetchEspnAllSportsDetail(sport, rawId) {
  const path = ESPN_ALLSPORTS_PATHS[sport];
  if (!path) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const r = await fetch(`https://site.web.api.espn.com/apis/site/v2/sports/${path}/summary?event=${encodeURIComponent(rawId)}`, { signal: ctrl.signal });
    if (!r.ok) return null;
    const j = await r.json();
    const comp = (j.header && j.header.competitions && j.header.competitions[0]) || {};
    const cs = comp.competitors || [];
    const home = cs.find((c) => c.homeAway === "home") || cs[0] || {};
    const away = cs.find((c) => c.homeAway === "away") || cs[1] || {};
    const detail = (comp.status && comp.status.type && (comp.status.type.shortDetail || comp.status.type.description)) || "";
    const homeScore = home.score != null ? String(home.score) : "";
    const awayScore = away.score != null ? String(away.score) : "";
    return {
      success: true, source: "espn",
      match: {
        id: "espn_" + rawId, matchId: "espn_" + rawId, sport,
        status: /final|completed/i.test(detail) ? "finished" : (/1st|2nd|3rd|4th|quarter|half|inning|live|in progress/i.test(detail) ? "live" : "upcoming"),
        series: (j.header && j.header.league && j.header.league.name) || "",
        homeTeam: { name: (home.team && (home.team.displayName || home.team.name)) || "", shortName: (home.team && home.team.abbreviation) || "" },
        awayTeam: { name: (away.team && (away.team.displayName || away.team.name)) || "", shortName: (away.team && away.team.abbreviation) || "" },
        score: { home: homeScore, away: awayScore, detail },
        statusText: detail, result: detail,
      },
      events: comp,
      boxscore: j.boxscore || null,
      leaders: j.leaders || null,
      incidents: [],
      lineups: null,
      homeStats: [], awayStats: [],
    };
  } catch (e) {
    console.error("[AllSports] ESPN detail failed for", sport, rawId, e.message);
    return null;
  } finally {
    clearTimeout(t);
  }
}

app.get("/api/all-sports/matches/:sport", async (req, res) => {
  try {
    const { sport } = req.params;
    if (!ALLSPORTS_SUPPORTED.includes(sport)) {
      return res.status(400).json({ success: false, message: "Unsupported: " + sport + ". Supported: " + ALLSPORTS_SUPPORTED.join(", ") });
    }
    // Kabaddi comes from the free PKL scraper, not RapidAPI/ESPN.
    if (sport === "kabaddi") {
      try {
        const events = await fetchPklKabaddi();
        const matches = events.map(normalizePkl);
        allSportsMatchesCache.set("kabaddi_pkld", { ts: Date.now(), data: matches, source: "pkl" });
        return res.json({ success: true, source: "pkl", count: matches.length, matches });
      } catch (e) {
        console.error("[PKL] kabaddi error:", e.message);
        return res.status(502).json({ success: false, message: e.message });
      }
    }
    if (!ALLSPORTS_CONFIG.key || !ALLSPORTS_CONFIG.host) {
      return res.status(403).json({ success: false, message: "AllSports API key not configured" });
    }
    const today = new Date().toISOString().slice(0, 10);
    const dateParam = req.query.date || today;
    const cacheKey = sport + "_" + dateParam;
    const cached = allSportsMatchesCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < 5 * 60 * 1000) {
      return res.json({ success: true, source: cached.source || "allsports", cached: true, count: cached.data.length, matches: cached.data });
    }

    // Primary: RapidAPI AllSports. Fallback: free ESPN scoreboard.
    let matches = [];
    let source = "allsports";
    if (ALLSPORTS_CONFIG.key && ALLSPORTS_CONFIG.host) {
      try {
        const url = `${ALLSPORTS_CONFIG.base}/api/${sport}/matches/live?date=${dateParam}`;
        const apiRes = await fetch(url, {
          headers: {
            "X-RapidAPI-Key": ALLSPORTS_CONFIG.key,
            "X-RapidAPI-Host": ALLSPORTS_CONFIG.host,
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(12000),
        });
        const raw = await apiRes.json();
        const events = raw?.events || [];
        matches = events.map(e => normalizeAllSportsEvent(e, sport)).filter(Boolean);
      } catch (e) {
        console.error("[AllSports] RapidAPI failed, trying ESPN:", sport, e.message);
        matches = [];
      }
    }
    if (!matches.length) {
      matches = await fetchEspnAllSportsMatches(sport);
      if (matches.length) source = "espn";
    }

    allSportsMatchesCache.set(cacheKey, { ts: Date.now(), data: matches, source });
    res.json({ success: true, source, fallback: source === "espn", count: matches.length, matches });
  } catch (e) {
    console.error("[AllSports] matches error:", req.params.sport, e.message);
    try {
      const fb = await fetchEspnAllSportsMatches(req.params.sport);
      if (fb.length) return res.json({ success: true, source: "espn", fallback: true, count: fb.length, matches: fb });
    } catch (_) {}
    res.status(502).json({ success: false, message: e.message });
  }
});

app.get("/api/all-sports/matches", async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const dateParam = req.query.date || today;
    const results = await Promise.allSettled(
      ALLSPORTS_SUPPORTED.map(async (sport) => {
        // Kabaddi: free PKL scraper.
        if (sport === "kabaddi") {
          try {
            const cached = allSportsMatchesCache.get("kabaddi_pkld");
            if (cached && Date.now() - cached.ts < 30 * 60 * 1000) return cached.data;
            const events = await fetchPklKabaddi();
            const matches = events.map(normalizePkl);
            allSportsMatchesCache.set("kabaddi_pkld", { ts: Date.now(), data: matches, source: "pkl" });
            return matches;
          } catch (_) { return []; }
        }
        const cacheKey = sport + "_" + dateParam;
        const cached = allSportsMatchesCache.get(cacheKey);
        if (cached && Date.now() - cached.ts < 5 * 60 * 1000) return cached.data;

        // Primary RapidAPI, fallback free ESPN per sport.
        let matches = [];
        if (ALLSPORTS_CONFIG.key && ALLSPORTS_CONFIG.host) {
          try {
            const url = `${ALLSPORTS_CONFIG.base}/api/${sport}/matches/live?date=${dateParam}`;
            const apiRes = await fetch(url, {
              headers: {
                "X-RapidAPI-Key": ALLSPORTS_CONFIG.key,
                "X-RapidAPI-Host": ALLSPORTS_CONFIG.host,
                "Content-Type": "application/json",
              },
              signal: AbortSignal.timeout(12000),
            });
            const raw = await apiRes.json();
            const events = raw?.events || [];
            matches = events.map(e => normalizeAllSportsEvent(e, sport)).filter(Boolean);
          } catch (_) { matches = []; }
        }
        if (!matches.length) matches = await fetchEspnAllSportsMatches(sport);
        allSportsMatchesCache.set(cacheKey, { ts: Date.now(), data: matches, source: "mixed" });
        return matches;
      })
    );
    const all = results.flatMap(r => r.status === "fulfilled" ? r.value : []);
    const anyEspn = all.some(m => String(m.id || "").startsWith("espn_"));
    res.json({ success: true, source: anyEspn ? "mixed" : "allsports", count: all.length, matches: all });
  } catch (e) {
    console.error("[AllSports] aggregate error:", e.message);
    res.status(502).json({ success: false, message: e.message });
  }
});

// AllSports raw proxy (must come AFTER the specific /matches/:sport routes)
app.get("/api/all-sports/match/:sport/:matchId", async (req, res) => {
  try {
    const { sport } = req.params;
    // List endpoints normalize ids as "as_<numeric>" — upstream expects raw numeric id.
    // ESPN-fallback ids look like "espn_<numeric>" and use the free ESPN summary.
    const incoming = String(req.params.matchId || "");
    const isEspn = /^espn_/i.test(incoming);
    const rawId = incoming.replace(/^(as_|espn_)/i, "");
    // ESPN ids (football/hockey/tennis) bypass the AllSports sport list.
    if (isEspn) {
      const espnSport = String(sport || "").toLowerCase();
      const espnDetail = await fetchEspnAllSportsDetail(espnSport, rawId);
      if (espnDetail) return res.json(espnDetail);
      return res.status(502).json({ success: false, message: "ESPN detail unavailable" });
    }
    if (!ALLSPORTS_SUPPORTED.includes(sport)) {
      return res.status(400).json({ success: false, message: "Unsupported: " + sport });
    }
    // Kabaddi detail comes from the scraped PKL cache.
    if (/^pkl_/i.test(incoming) || sport === "kabaddi") {
      try {
        const events = await fetchPklKabaddi();
        const id = incoming.replace(/^pkl_/i, "");
        const ev = events.find((e) => ("pkl_" + e.date + "_" + e.home.short + "-" + e.away.short).toLowerCase() === ("pkl_" + id).toLowerCase())
          || events.find((e) => (e.date + "_" + e.home.short + "-" + e.away.short).toLowerCase() === id.toLowerCase());
        if (ev) return res.json(pklToDetail(ev));
        return res.status(404).json({ success: false, message: "PKL match not found" });
      } catch (e) {
        return res.status(502).json({ success: false, message: e.message });
      }
    }
    if (!ALLSPORTS_CONFIG.key || !ALLSPORTS_CONFIG.host) {
      return res.status(403).json({ success: false, message: "AllSports API key not configured" });
    }
    const [matchRes, incidentsRes, lineupsRes] = await Promise.allSettled([
      fetch(`${ALLSPORTS_CONFIG.base}/api/${sport}/match/${rawId}`, {
        headers: {
          "X-RapidAPI-Key": ALLSPORTS_CONFIG.key,
          "X-RapidAPI-Host": ALLSPORTS_CONFIG.host,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(12000),
      }),
      fetch(`${ALLSPORTS_CONFIG.base}/api/${sport}/match/${rawId}/incidents`, {
        headers: {
          "X-RapidAPI-Key": ALLSPORTS_CONFIG.key,
          "X-RapidAPI-Host": ALLSPORTS_CONFIG.host,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(12000),
      }),
      fetch(`${ALLSPORTS_CONFIG.base}/api/${sport}/match/${rawId}/lineups`, {
        headers: {
          "X-RapidAPI-Key": ALLSPORTS_CONFIG.key,
          "X-RapidAPI-Host": ALLSPORTS_CONFIG.host,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(12000),
      })
    ]);

    const safeJson = async (settled) => {
      try {
        if (!settled || settled.status !== "fulfilled" || !settled.value || !settled.value.ok) return null;
        const text = await settled.value.text();
        if (!text) return null;
        return JSON.parse(text);
      } catch (_) { return null; }
    };
    const matchRaw = await safeJson(matchRes);
    const events = matchRaw?.event || matchRaw || null;
    // Empty upstream (wrong sport for this id, finished/removed match):
    // signal failure so callers try the next source instead of blank data.
    if (!events) {
      return res.status(502).json({ success: false, message: "Upstream match detail empty" });
    }
    const incidentRaw = await safeJson(incidentsRes);
    const incidents = incidentRaw?.incidents || incidentRaw?.data?.incidents || [];
    const lineupRaw = await safeJson(lineupsRes);

    const normalized = normalizeAllSportsEvent(events || { id: rawId }, sport);
    if (!normalized || !normalized.homeTeam?.name) {
      return res.status(502).json({ success: false, message: "Upstream match has no teams" });
    }

    const homeStats = events?.homeStatistics || events?.statistics?.home || [];
    const awayStats = events?.awayStatistics || events?.statistics?.away || [];

    const detail = {
      match: normalized,
      events,
      incidents,
      lineups: lineupRaw || null,
      homeStats,
      awayStats
    };
    res.json({ success: true, source: "allsports", ...detail });
  } catch (e) {
    console.error("[AllSports] match detail error:", e.message);
    res.status(502).json({ success: false, message: e.message });
  }
});

// AllSports raw proxy (must come AFTER specific /matches/:sport and /match/:sport routes)
app.get("/api/all-sports/:sport/*", async (req, res) => {
  try {
    const { sport } = req.params;
    const rest = req.params[0] || "";
    if (!ALLSPORTS_CONFIG.key || !ALLSPORTS_CONFIG.host) {
      return res.status(403).json({ success: false, message: "All-Sports API key not configured" });
    }
    const qs = req.originalUrl.includes("?") ? req.originalUrl.split("?")[1] : "";
    const url = `${ALLSPORTS_CONFIG.base}/api/${sport}/${rest}${qs ? "?" + qs : ""}`;
    const apiRes = await fetch(url, {
      headers: {
        "X-RapidAPI-Key": ALLSPORTS_CONFIG.key,
        "X-RapidAPI-Host": ALLSPORTS_CONFIG.host,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(12000),
    });
    const data = await apiRes.json();
    res.json({ success: apiRes.ok, status: apiRes.status, data });
  } catch (e) {
    res.status(502).json({ success: false, message: e.message });
  }
});

app.get("/api/odds/:sport/:matchId", async (req, res) => {
  try {
    const { sport, matchId } = req.params;
    const featured = req.query.featured === "1" ? "/featured" : "";
    const url = `${ALLSPORTS_CONFIG.base}/api/${sport}/match/${matchId}/odds/1${featured}`;
    const apiRes = await fetch(url, {
      headers: {
        "X-RapidAPI-Key": ALLSPORTS_CONFIG.key,
        "X-RapidAPI-Host": ALLSPORTS_CONFIG.host,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(12000),
    });
    const data = await apiRes.json();
    res.json({ success: apiRes.ok, status: apiRes.status, data });
  } catch (e) {
    res.status(502).json({ success: false, message: e.message });
  }
});

// ─── SERVE FRONTEND STATIC FILES ─────────────────────────────────────────────
const FRONTEND_DIR = path.join(__dirname, '..');
app.use(express.static(FRONTEND_DIR));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/ws')) {
    const indexPath = path.join(FRONTEND_DIR, req.path);
    if (fs.existsSync(indexPath) && fs.statSync(indexPath).isFile()) {
      return res.sendFile(indexPath);
    }
  }
  res.status(404).json({ error: 'Not found' });
});

// ─── START SERVER ────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`FanConnact Rankings API running on http://localhost:${PORT}`);
  console.log(`WebSocket chat running on ws://localhost:${PORT}/ws/chat`);
  console.log(`Endpoints:`);
  console.log(`  GET /api/sports`);
  console.log(`  GET /api/sports/:sport`);
  console.log(`  GET /api/rankings/:sport/:category`);
  console.log(`  GET /api/leaderboard`);
  console.log(`  GET /api/leaderboard/:sport/:category`);
  console.log(`  GET /api/sync/status`);
  console.log(`  POST /api/sync/trigger`);
  console.log(`  GET /api/sync/last-updated`);

  startCleanup();

  // Initial sync in background
  rankingsSync.startAutoSync();
  setTimeout(refreshData, 5000);
});
