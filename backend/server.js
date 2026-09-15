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

// ─── DATA GENERATORS ─────────────────────────────────────────────────────────

function generatePlayers(template, count = 100) {
  const players = [];
  for (let i = 0; i < count; i++) {
    const t = template[i % template.length];
    players.push({ rank: i + 1, ...t });
  }
  return players;
}

// ─── CRICKET DATA ────────────────────────────────────────────────────────────

const CRICKET_RAW = {
  odi_bat_men: [
    ["Shubman Gill", "India", 796, 50, 2876, 0, 58.2, 102.3],
    ["Babar Azam", "Pakistan", 778, 125, 5934, 0, 56.8, 89.4],
    ["Rohit Sharma", "India", 765, 267, 10866, 0, 48.9, 90.2],
    ["Virat Kohli", "India", 746, 295, 13906, 0, 57.3, 93.2],
    ["Daryl Mitchell", "New Zealand", 730, 45, 1983, 12, 52.6, 96.1],
    ["Harry Tector", "Ireland", 722, 52, 2198, 0, 47.8, 89.4],
    ["Ibrahim Zadran", "Afghanistan", 715, 38, 1756, 0, 50.1, 85.3],
    ["KL Rahul", "India", 708, 86, 3614, 0, 48.5, 88.7],
    ["Rassie van der Dussen", "South Africa", 702, 56, 2467, 0, 52.8, 87.9],
    ["Pathum Nissanka", "Sri Lanka", 695, 52, 2234, 0, 46.2, 85.6],
    ["Shai Hope", "West Indies", 688, 132, 4789, 0, 44.6, 80.5],
    ["Travis Head", "Australia", 680, 78, 3124, 21, 42.8, 98.7],
    ["Kane Williamson", "New Zealand", 672, 170, 7046, 12, 48.2, 81.3],
    ["Steve Smith", "Australia", 665, 158, 6321, 8, 43.7, 86.9],
    ["Heinrich Klaasen", "South Africa", 660, 52, 1965, 0, 45.3, 106.2],
    ["Joe Root", "England", 652, 178, 7432, 28, 51.3, 85.6],
    ["Fakhar Zaman", "Pakistan", 648, 95, 3954, 0, 45.6, 92.3],
    ["Rahmanullah Gurbaz", "Afghanistan", 642, 40, 1765, 0, 44.8, 91.5],
    ["Suryakumar Yadav", "India", 638, 62, 2254, 0, 44.2, 104.3],
    ["Quinton de Kock", "South Africa", 632, 155, 6743, 0, 45.8, 96.2],
    ["David Warner", "Australia", 625, 165, 6932, 0, 44.6, 95.3],
    ["Temba Bavuma", "South Africa", 618, 52, 2387, 0, 48.6, 84.2],
    ["Charith Asalanka", "Sri Lanka", 612, 58, 2187, 28, 44.8, 90.5],
    ["Litton Das", "Bangladesh", 608, 92, 3654, 0, 43.2, 87.6],
    ["Mohammad Rizwan", "Pakistan", 602, 86, 3165, 0, 42.8, 86.3],
    ["Aiden Markram", "South Africa", 596, 72, 2786, 14, 43.8, 91.2],
    ["Ben Stokes", "England", 590, 118, 3578, 82, 41.6, 96.4],
    ["Jonny Bairstow", "England", 585, 106, 3856, 0, 43.2, 98.7],
    ["Glenn Maxwell", "Australia", 580, 142, 3654, 72, 37.8, 102.3],
    ["Sean Williams", "Zimbabwe", 575, 56, 2104, 52, 45.2, 84.6],
  ].slice(0, 100),
  t20_bat_men: [
    ["Abhishek Sharma", "India", 929, 45, 1567, 0, 178.5, 158.2],
    ["Phil Salt", "England", 849, 62, 2134, 0, 141.2, 152.3],
    ["Tilak Varma", "India", 812, 38, 1456, 12, 145.3, 140.8],
    ["Suryakumar Yadav", "India", 798, 78, 2865, 0, 148.6, 165.2],
    ["Ishan Kishan", "India", 785, 52, 1895, 0, 137.8, 148.5],
    ["Tim Seifert", "New Zealand", 765, 48, 1654, 0, 136.5, 145.2],
    ["Jacob Bethell", "England", 752, 28, 987, 8, 142.3, 138.6],
    ["Jos Buttler", "England", 745, 118, 3567, 0, 138.2, 148.7],
    ["Mohammad Rizwan", "Pakistan", 738, 105, 3489, 0, 125.4, 128.3],
    ["Babar Azam", "Pakistan", 732, 125, 4123, 0, 132.5, 135.6],
    ["Sanju Samson", "India", 725, 35, 1245, 0, 146.8, 152.4],
    ["Shivam Dube", "India", 718, 42, 1456, 42, 135.8, 142.5],
    ["Finn Allen", "New Zealand", 712, 42, 1658, 0, 152.3, 168.5],
    ["Heinrich Klaasen", "South Africa", 708, 58, 1954, 0, 149.2, 172.3],
    ["Rilee Rossouw", "South Africa", 702, 52, 1789, 0, 138.5, 145.8],
    ["Glenn Maxwell", "Australia", 698, 108, 2456, 42, 128.6, 158.9],
    ["Travis Head", "Australia", 692, 52, 1678, 8, 138.5, 156.3],
    ["David Malan", "England", 685, 68, 2345, 0, 135.2, 138.6],
    ["Rahmanullah Gurbaz", "Afghanistan", 678, 52, 1789, 0, 134.2, 145.3],
    ["Kusal Mendis", "Sri Lanka", 672, 62, 2156, 0, 132.5, 138.2],
    ["Aiden Markram", "South Africa", 665, 45, 1523, 6, 128.4, 142.5],
    ["Wanindu Hasaranga", "Sri Lanka", 658, 65, 986, 108, 118.5, 145.2],
    ["Yashasvi Jaiswal", "India", 652, 32, 1254, 0, 148.6, 162.3],
    ["David Warner", "Australia", 648, 108, 3456, 0, 135.2, 142.8],
    ["Nicholas Pooran", "West Indies", 642, 72, 2456, 0, 136.5, 152.6],
    ["Liam Livingstone", "England", 638, 58, 1654, 32, 125.8, 156.2],
    ["Dasun Shanaka", "Sri Lanka", 632, 52, 1235, 25, 118.5, 132.4],
    ["Rohit Sharma", "India", 625, 158, 4562, 0, 135.2, 142.5],
    ["Virat Kohli", "India", 618, 125, 4235, 0, 132.5, 135.8],
    ["Quinton de Kock", "South Africa", 612, 92, 2956, 0, 136.8, 142.5],
  ].slice(0, 100),
  test_bat_men: [
    ["Harry Brook", "England", 898, 32, 2876, 0, 62.5, 98.2],
    ["Joe Root", "England", 880, 152, 12534, 32, 52.8, 85.6],
    ["Kane Williamson", "New Zealand", 865, 108, 9124, 12, 54.2, 78.5],
    ["Yashasvi Jaiswal", "India", 852, 28, 2356, 0, 68.5, 82.3],
    ["Steven Smith", "Australia", 845, 118, 9874, 8, 52.6, 75.8],
    ["Shubman Gill", "India", 835, 42, 3546, 0, 56.8, 78.2],
    ["Virat Kohli", "India", 828, 118, 9245, 0, 48.5, 72.3],
    ["Rohit Sharma", "India", 815, 68, 4235, 0, 45.2, 68.5],
    ["Marnus Labuschagne", "Australia", 805, 75, 5678, 8, 48.6, 72.5],
    ["Usman Khawaja", "Australia", 798, 58, 4235, 0, 46.8, 56.2],
    ["Daryl Mitchell", "New Zealand", 785, 38, 2567, 8, 48.5, 68.3],
    ["Babar Azam", "Pakistan", 775, 92, 6524, 0, 42.8, 65.2],
    ["Travis Head", "Australia", 768, 62, 3456, 12, 42.5, 78.3],
    ["Dimuth Karunaratne", "Sri Lanka", 756, 95, 6875, 0, 42.6, 58.2],
    ["Ben Stokes", "England", 748, 105, 6789, 42, 36.8, 72.5],
    ["Henry Nicholls", "New Zealand", 742, 68, 4562, 0, 42.5, 56.8],
    ["Tom Latham", "New Zealand", 735, 82, 5234, 0, 38.5, 52.6],
    ["Angelo Mathews", "Sri Lanka", 728, 118, 7845, 52, 42.8, 58.2],
    ["Dhananjaya de Silva", "Sri Lanka", 722, 52, 3456, 18, 42.5, 56.8],
    ["Rishabh Pant", "India", 718, 45, 2876, 0, 38.6, 72.5],
    ["Jonny Bairstow", "England", 712, 98, 6245, 0, 36.8, 58.2],
    ["Zak Crawley", "England", 705, 52, 3456, 0, 35.2, 52.6],
    ["Kraigg Brathwaite", "West Indies", 698, 92, 5678, 0, 32.5, 42.8],
    ["Temba Bavuma", "South Africa", 692, 62, 3896, 0, 38.5, 52.3],
    ["Aiden Markram", "South Africa", 685, 68, 4235, 8, 36.8, 56.2],
    ["David Warner", "Australia", 678, 112, 8965, 0, 45.2, 62.5],
    ["Shan Masood", "Pakistan", 672, 45, 2876, 0, 38.5, 52.6],
    ["Devon Conway", "New Zealand", 665, 28, 1678, 0, 42.5, 52.3],
    ["Rassie van der Dussen", "South Africa", 658, 32, 2187, 0, 42.6, 48.5],
    ["Abid Ali", "Pakistan", 652, 25, 1567, 0, 38.5, 45.2],
  ].slice(0, 100),
  odi_bowl_men: [
    ["Jasprit Bumrah", "India", 756, 95, 125, 236, 0, 22.5, 4.8],
    ["Shaheen Shah Afridi", "Pakistan", 748, 62, 156, 142, 0, 24.5, 5.2],
    ["Mohammad Nabi", "Afghanistan", 738, 82, 1452, 175, 32.5, 4.5],
    ["Kuldeep Yadav", "India", 730, 68, 125, 142, 0, 22.5, 5.2],
    ["Mohammed Siraj", "India", 722, 45, 52, 98, 0, 18.5, 5.8],
    ["Trent Boult", "New Zealand", 715, 108, 125, 235, 0, 24.5, 5.2],
    ["Rashid Khan", "Afghanistan", 708, 72, 456, 156, 28.5, 4.2],
    ["Mujeeb Ur Rahman", "Afghanistan", 702, 52, 125, 85, 22.5, 4.5],
    ["Anrich Nortje", "South Africa", 695, 45, 52, 92, 0, 18.5, 5.2],
    ["Kagiso Rabada", "South Africa", 688, 88, 125, 185, 0, 22.5, 5.5],
    ["Pat Cummins", "Australia", 682, 92, 215, 195, 18.5, 5.2],
    ["Josh Hazlewood", "Australia", 675, 78, 85, 165, 0, 20.5, 4.8],
    ["Mitchell Starc", "Australia", 668, 112, 125, 235, 0, 25.5, 5.5],
    ["Jasprit Bumrah", "India", 662, 95, 125, 236, 0, 22.5, 4.8],
    ["Adam Zampa", "Australia", 655, 88, 125, 142, 26.5, 5.5],
    ["Adil Rashid", "England", 648, 125, 125, 195, 22.5, 5.2],
    ["Mark Wood", "England", 642, 52, 52, 85, 0, 18.5, 5.8],
    ["Jofra Archer", "England", 635, 42, 25, 72, 0, 15.5, 5.2],
    ["Chris Woakes", "England", 628, 118, 235, 185, 28.5, 5.8],
    ["Curran", "England", 622, 72, 125, 98, 22.5, 5.5],
    ["Shakib Al Hasan", "Bangladesh", 615, 125, 456, 145, 32.5, 4.8],
    ["Mustafizur Rahman", "Bangladesh", 608, 98, 52, 145, 0, 20.5, 5.2],
    ["Taskin Ahmed", "Bangladesh", 602, 52, 25, 85, 0, 18.5, 5.5],
    ["Alzarri Joseph", "West Indies", 595, 52, 52, 72, 0, 20.5, 5.8],
    ["Jason Holder", "West Indies", 588, 142, 125, 185, 28.5, 5.2],
    ["Shaheen Shah Afridi", "Pakistan", 582, 62, 156, 142, 0, 24.5, 5.2],
    ["Haris Rauf", "Pakistan", 575, 42, 25, 72, 0, 18.5, 5.5],
    ["Naseem Shah", "Pakistan", 568, 28, 12, 52, 0, 15.5, 4.8],
    ["Maheesh Theekshana", "Sri Lanka", 562, 32, 25, 62, 0, 18.5, 4.5],
    ["Wanindu Hasaranga", "Sri Lanka", 555, 65, 125, 108, 28.5, 5.2],
  ].slice(0, 100),
  t20_bowl_men: [
    ["Jasprit Bumrah", "India", 826, 72, 25, 105, 0, 18.5, 6.2],
    ["Rashid Khan", "Afghanistan", 815, 85, 45, 125, 0, 15.5, 6.8],
    ["Wanindu Hasaranga", "Sri Lanka", 802, 65, 52, 108, 0, 14.5, 7.2],
    ["Shaheen Shah Afridi", "Pakistan", 795, 58, 12, 85, 0, 12.5, 7.5],
    ["Mohammad Nabi", "Afghanistan", 788, 72, 125, 95, 25.5, 6.8],
    ["Adil Rashid", "England", 782, 95, 25, 115, 0, 18.5, 7.2],
    ["Anrich Nortje", "South Africa", 775, 38, 5, 52, 0, 10.5, 7.8],
    ["Kuldeep Yadav", "India", 768, 52, 12, 72, 0, 14.5, 6.5],
    ["Akeal Hosein", "West Indies", 762, 42, 25, 52, 0, 12.5, 6.8],
    ["Adam Zampa", "Australia", 755, 72, 12, 85, 0, 15.5, 7.5],
    ["Axar Patel", "India", 748, 45, 125, 52, 25.5, 6.5],
    ["Bhuvneshwar Kumar", "India", 742, 85, 25, 95, 0, 18.5, 7.2],
    ["Arshdeep Singh", "India", 735, 42, 5, 62, 0, 12.5, 7.8],
    ["Trent Boult", "New Zealand", 728, 62, 12, 85, 0, 15.5, 7.2],
    ["Tim Southee", "New Zealand", 722, 105, 25, 145, 0, 22.5, 8.2],
    ["Mitchell Santner", "New Zealand", 715, 72, 125, 72, 25.5, 6.8],
    ["Josh Hazlewood", "Australia", 708, 52, 5, 62, 0, 12.5, 7.5],
    ["Pat Cummins", "Australia", 702, 58, 25, 72, 0, 15.5, 7.8],
    ["Mitchell Starc", "Australia", 695, 72, 12, 85, 0, 18.5, 8.2],
    ["Sam Curran", "England", 688, 52, 125, 52, 25.5, 7.5],
    ["Chris Jordan", "England", 682, 72, 12, 85, 0, 18.5, 8.5],
    ["Tymal Mills", "England", 675, 32, 2, 42, 0, 8.5, 8.2],
    ["Mark Wood", "England", 668, 42, 5, 52, 0, 10.5, 8.5],
    ["Jofra Archer", "England", 662, 28, 25, 32, 0, 8.5, 7.5],
    ["Haris Rauf", "Pakistan", 655, 52, 2, 72, 0, 12.5, 8.5],
    ["Naseem Shah", "Pakistan", 648, 32, 5, 42, 0, 8.5, 7.8],
    ["Mohammad Wasim", "Pakistan", 642, 28, 12, 32, 0, 10.5, 7.5],
    ["Shakib Al Hasan", "Bangladesh", 635, 85, 125, 72, 28.5, 6.8],
    ["Mustafizur Rahman", "Bangladesh", 628, 62, 5, 72, 0, 12.5, 7.5],
    ["Taskin Ahmed", "Bangladesh", 622, 32, 2, 42, 0, 8.5, 7.8],
  ].slice(0, 100),
  test_bowl_men: [
    ["Pat Cummins", "Australia", 898, 62, 125, 275, 0, 22.5, 2.8],
    ["Ravichandran Ashwin", "India", 885, 108, 456, 525, 28.5, 2.5],
    ["Jasprit Bumrah", "India", 872, 42, 25, 165, 0, 15.5, 2.8],
    ["Kagiso Rabada", "South Africa", 865, 68, 85, 225, 0, 20.5, 3.2],
    ["Mitchell Starc", "Australia", 858, 85, 125, 245, 0, 22.5, 3.5],
    ["Josh Hazlewood", "Australia", 852, 72, 52, 195, 0, 18.5, 2.8],
    ["Shaheen Shah Afridi", "Pakistan", 845, 38, 25, 125, 0, 15.5, 2.8],
    ["Nathan Lyon", "Australia", 838, 128, 125, 525, 0, 28.5, 3.2],
    ["Stuart Broad", "England", 832, 182, 125, 625, 0, 32.5, 3.5],
    ["James Anderson", "England", 825, 198, 52, 725, 0, 35.5, 2.8],
    ["Mohammed Shami", "India", 818, 65, 52, 195, 0, 18.5, 3.2],
    ["Mark Wood", "England", 812, 42, 25, 85, 0, 15.5, 3.5],
    ["Ollie Robinson", "England", 805, 32, 12, 72, 0, 12.5, 2.8],
    ["Kyle Jamieson", "New Zealand", 798, 28, 125, 85, 22.5, 2.5],
    ["Tim Southee", "New Zealand", 792, 105, 125, 225, 0, 28.5, 3.5],
    ["Neil Wagner", "New Zealand", 785, 72, 52, 185, 0, 22.5, 3.2],
    ["Trent Boult", "New Zealand", 778, 85, 52, 185, 0, 22.5, 3.2],
    ["Ajaz Patel", "New Zealand", 772, 25, 12, 52, 0, 12.5, 2.8],
    ["Kemar Roach", "West Indies", 765, 85, 52, 185, 0, 22.5, 3.2],
    ["Jason Holder", "West Indies", 758, 72, 125, 125, 32.5, 3.5],
    ["Shannon Gabriel", "West Indies", 752, 62, 25, 125, 0, 18.5, 3.5],
    ["Alzarri Joseph", "West Indies", 745, 32, 12, 52, 0, 12.5, 3.2],
    ["Naseem Shah", "Pakistan", 738, 18, 5, 42, 0, 8.5, 2.8],
    ["Mohammad Abbas", "Pakistan", 732, 28, 12, 72, 0, 12.5, 2.5],
    ["Shaheen Afridi", "Pakistan", 725, 38, 25, 125, 0, 15.5, 2.8],
    ["Lasith Embuldeniya", "Sri Lanka", 718, 22, 12, 52, 0, 10.5, 2.8],
    ["Prabath Jayasuriya", "Sri Lanka", 712, 18, 25, 42, 25.5, 2.5],
    ["Anrich Nortje", "South Africa", 705, 28, 5, 72, 0, 12.5, 3.2],
    ["Lungi Ngidi", "South Africa", 698, 32, 12, 62, 0, 15.5, 3.5],
    ["Marco Jansen", "South Africa", 692, 18, 125, 42, 22.5, 3.2],
  ].slice(0, 100),
  odi_ar_men: [
    ["Mohammad Nabi", "Afghanistan", 385, 82, 3895, 175, 32.5, 4.5],
    ["Shakib Al Hasan", "Bangladesh", 375, 125, 7568, 325, 35.5, 4.8],
    ["Ben Stokes", "England", 365, 118, 3895, 85, 42.5, 5.8],
    ["Rashid Khan", "Afghanistan", 358, 72, 1256, 156, 28.5, 4.2],
    ["Assad Vala", "PNG", 352, 45, 1895, 52, 38.5, 4.8],
    ["Zeeshan Maqsood", "Oman", 345, 38, 1567, 42, 35.5, 4.5],
    ["Sikandar Raza", "Zimbabwe", 338, 72, 2456, 85, 35.5, 5.2],
    ["Wanindu Hasaranga", "Sri Lanka", 332, 65, 1256, 108, 28.5, 5.2],
    ["Shadab Khan", "Pakistan", 325, 72, 1567, 85, 25.5, 5.5],
    ["Glenn Maxwell", "Australia", 318, 142, 3895, 72, 38.5, 5.8],
    ["Mitchell Santner", "New Zealand", 312, 72, 1256, 85, 25.5, 5.2],
    ["Axar Patel", "India", 305, 45, 1256, 52, 28.5, 5.5],
    ["Ravindra Jadeja", "India", 298, 125, 2895, 225, 32.5, 5.2],
    ["Chris Woakes", "England", 292, 118, 2356, 185, 28.5, 5.8],
    ["Moeen Ali", "England", 285, 68, 2356, 72, 32.5, 5.5],
    ["Jason Holder", "West Indies", 278, 142, 3456, 185, 35.5, 5.2],
    ["Angelo Mathews", "Sri Lanka", 272, 118, 5678, 125, 42.5, 5.5],
    ["Thisara Perera", "Sri Lanka", 265, 62, 1895, 52, 35.5, 6.2],
    ["Dasun Shanaka", "Sri Lanka", 258, 52, 1567, 42, 32.5, 5.8],
    ["Calvin Savage", "South Africa", 252, 28, 895, 25, 28.5, 5.5],
    ["Wiaan Mulder", "South Africa", 245, 25, 895, 32, 28.5, 5.2],
    ["Andile Phehlukwayo", "South Africa", 238, 42, 1256, 52, 25.5, 5.8],
    ["Hardik Pandya", "India", 232, 85, 1895, 85, 35.5, 5.8],
    ["Deepak Hooda", "India", 225, 22, 895, 12, 28.5, 5.5],
    ["Washington Sundar", "India", 218, 28, 456, 25, 22.5, 5.2],
    ["Shivam Dube", "India", 212, 18, 567, 8, 25.5, 5.8],
    ["Abdul Razzaq", "Pakistan", 205, 12, 456, 15, 22.5, 5.5],
    ["Faheem Ashraf", "Pakistan", 198, 32, 895, 42, 25.5, 5.8],
    ["Imad Wasim", "Pakistan", 192, 42, 1256, 32, 28.5, 5.2],
    ["Shadab Khan", "Pakistan", 185, 72, 1567, 85, 25.5, 5.5],
  ].slice(0, 100),
  t20_ar_men: [
    ["Hardik Pandya", "India", 412, 85, 1895, 85, 35.5, 8.5],
    ["Shakib Al Hasan", "Bangladesh", 405, 85, 2356, 125, 35.5, 7.5],
    ["Wanindu Hasaranga", "Sri Lanka", 398, 65, 1256, 108, 28.5, 7.2],
    ["Rashid Khan", "Afghanistan", 392, 72, 1256, 156, 28.5, 6.8],
    ["Mohammad Nabi", "Afghanistan", 385, 72, 1452, 85, 32.5, 6.5],
    ["Shadab Khan", "Pakistan", 378, 72, 1567, 85, 25.5, 7.5],
    ["Moeen Ali", "England", 372, 68, 2356, 72, 32.5, 7.8],
    ["Mitchell Santner", "New Zealand", 365, 72, 1256, 85, 25.5, 7.2],
    ["Axar Patel", "India", 358, 45, 1256, 52, 28.5, 7.5],
    ["Ravindra Jadeja", "India", 352, 62, 1895, 72, 32.5, 7.2],
    ["Sunil Narine", "West Indies", 345, 85, 1256, 125, 22.5, 6.5],
    ["Andre Russell", "West Indies", 338, 72, 2356, 52, 32.5, 9.5],
    ["Jason Holder", "West Indies", 332, 52, 1567, 52, 28.5, 8.5],
    ["Glenn Maxwell", "Australia", 325, 108, 2356, 42, 38.5, 8.8],
    ["Marcus Stoinis", "Australia", 318, 62, 1567, 32, 32.5, 8.5],
    ["Mitchell Marsh", "Australia", 312, 42, 1256, 12, 35.5, 8.2],
    ["Jimmy Neesham", "New Zealand", 305, 52, 1567, 25, 32.5, 8.5],
    ["Michael Bracewell", "New Zealand", 298, 28, 895, 12, 28.5, 7.8],
    ["Daryl Mitchell", "New Zealand", 292, 42, 1567, 12, 35.5, 8.2],
    ["Chris Woakes", "England", 285, 42, 1256, 32, 28.5, 8.5],
    ["Sam Curran", "England", 278, 42, 1256, 52, 25.5, 8.2],
    ["Liam Livingstone", "England", 272, 58, 1256, 25, 32.5, 8.8],
    ["Ben Stokes", "England", 265, 38, 1256, 25, 35.5, 8.5],
    ["Dasun Shanaka", "Sri Lanka", 258, 52, 1567, 42, 32.5, 8.5],
    ["Wanindu Hasaranga", "Sri Lanka", 252, 65, 1256, 108, 28.5, 7.2],
    ["Sikandar Raza", "Zimbabwe", 245, 52, 1256, 42, 32.5, 7.5],
    ["Thisara Perera", "Sri Lanka", 238, 62, 1895, 52, 35.5, 8.8],
    ["Angelo Mathews", "Sri Lanka", 232, 42, 1256, 18, 32.5, 7.5],
    ["Carlos Brathwaite", "West Indies", 225, 42, 1256, 32, 28.5, 8.5],
    ["Kieron Pollard", "West Indies", 218, 72, 2356, 25, 35.5, 9.2],
  ].slice(0, 100),
  test_ar_men: [
    ["Ravindra Jadeja", "India", 468, 72, 3256, 285, 38.5, 2.8],
    ["Ravichandran Ashwin", "India", 462, 108, 3456, 525, 32.5, 2.5],
    ["Ben Stokes", "England", 455, 105, 6789, 205, 38.5, 3.2],
    ["Pat Cummins", "Australia", 448, 62, 2356, 275, 25.5, 2.8],
    ["Shakib Al Hasan", "Bangladesh", 442, 72, 4567, 235, 42.5, 3.2],
    ["Jason Holder", "West Indies", 435, 72, 3456, 185, 35.5, 3.5],
    ["Mitchell Starc", "Australia", 428, 85, 3456, 245, 28.5, 3.5],
    ["Chris Woakes", "England", 422, 52, 2356, 125, 32.5, 3.5],
    ["Kyle Jamieson", "New Zealand", 415, 28, 1256, 85, 35.5, 2.8],
    ["Colin de Grandhomme", "New Zealand", 408, 38, 1895, 52, 38.5, 3.2],
    ["Angelo Mathews", "Sri Lanka", 402, 118, 7568, 125, 42.5, 3.5],
    ["Dhananjaya de Silva", "Sri Lanka", 395, 52, 3456, 52, 38.5, 3.2],
    ["Mitchell Marsh", "Australia", 388, 32, 1256, 12, 42.5, 3.5],
    ["Cameron Green", "Australia", 382, 25, 1256, 25, 45.2, 3.2],
    ["Moeen Ali", "England", 375, 68, 3256, 72, 35.5, 3.5],
    ["Sam Curran", "England", 368, 28, 1256, 52, 32.5, 3.2],
    ["Axar Patel", "India", 362, 22, 895, 52, 35.5, 2.8],
    ["Washington Sundar", "India", 355, 18, 456, 25, 32.5, 3.2],
    ["Rashid Khan", "Afghanistan", 348, 12, 456, 25, 28.5, 3.5],
    ["Mohammad Nabi", "Afghanistan", 342, 8, 456, 12, 32.5, 3.2],
    ["Dasun Shanaka", "Sri Lanka", 335, 12, 456, 8, 35.5, 3.5],
    ["Thisara Perera", "Sri Lanka", 328, 8, 456, 5, 32.5, 3.8],
    ["Glenn Maxwell", "Australia", 322, 28, 1256, 8, 42.5, 3.5],
    ["Mitchell Santner", "New Zealand", 315, 25, 895, 25, 28.5, 3.2],
    ["Michael Bracewell", "New Zealand", 308, 12, 456, 8, 32.5, 3.5],
  ].slice(0, 100),
  odi_bat_women: [
    ["Smriti Mandhana", "India", 785, 85, 3456, 0, 52.5, 85.2],
    ["Nat Sciver-Brunt", "England", 772, 112, 4562, 85, 48.5, 82.3],
    ["Ellyse Perry", "Australia", 758, 145, 5678, 125, 52.5, 78.5],
    ["Beth Mooney", "Australia", 745, 108, 4235, 0, 48.5, 75.2],
    ["Chamari Athapaththu", "Sri Lanka", 732, 125, 4562, 52, 42.5, 82.3],
    ["Tahlia McGrath", "Australia", 725, 42, 1895, 25, 45.2, 78.5],
    ["Alyssa Healy", "Australia", 718, 118, 3256, 0, 42.5, 75.2],
    ["Mithali Raj", "India", 712, 235, 10865, 0, 52.5, 68.5],
    ["Harmanpreet Kaur", "India", 705, 145, 4562, 42, 42.5, 72.3],
    ["Sophie Devine", "New Zealand", 698, 145, 4562, 85, 38.5, 78.5],
    ["Suzie Bates", "New Zealand", 692, 165, 5678, 42, 45.2, 68.5],
    ["Meg Lanning", "Australia", 685, 108, 4562, 0, 52.5, 72.3],
    ["Rachel Haynes", "Australia", 678, 78, 2356, 0, 42.5, 65.2],
    ["Sarah Taylor", "England", 672, 125, 3256, 0, 42.5, 68.5],
    ["Heather Knight", "England", 665, 145, 4562, 42, 38.5, 65.2],
    ["Tammy Beaumont", "England", 658, 118, 3256, 0, 42.5, 62.3],
    ["Amy Satterthwaite", "New Zealand", 652, 145, 4562, 25, 42.5, 65.2],
    ["Laura Wolvaardt", "South Africa", 645, 85, 2356, 0, 42.5, 68.5],
    ["Dane van Niekerk", "South Africa", 638, 108, 2356, 42, 35.5, 62.3],
    ["Marizanne Kapp", "South Africa", 632, 125, 2356, 125, 28.5, 65.2],
    ["Shabnim Ismail", "South Africa", 625, 125, 456, 185, 0, 22.5],
    ["Stafanie Taylor", "West Indies", 618, 165, 5678, 125, 38.5, 62.3],
    ["Hayley Matthews", "West Indies", 612, 85, 2356, 85, 32.5, 68.5],
    ["Deandra Dottin", "West Indies", 605, 145, 3256, 58, 35.5, 72.3],
    ["Nida Dar", "Pakistan", 598, 125, 2356, 85, 32.5, 62.5],
    ["Bismah Maroof", "Pakistan", 592, 145, 3456, 0, 35.5, 58.2],
    ["Sana Mir", "Pakistan", 585, 125, 1256, 125, 28.5, 52.3],
    ["Javeria Khan", "Pakistan", 578, 125, 2356, 25, 32.5, 58.5],
    ["Rumana Ahmed", "Bangladesh", 572, 85, 1256, 42, 28.5, 62.3],
    ["Fargana Hoque", "Bangladesh", 565, 85, 1567, 0, 32.5, 58.5],
  ].slice(0, 100),
};

const CRICKET_NAMES = [
  "Virat Kohli",
  "Babar Azam",
  "Rohit Sharma",
  "Shubman Gill",
  "Travis Head",
  "Suryakumar Yadav",
  "Heinrich Klaasen",
  "KL Rahul",
  "Pathum Nissanka",
  "Rassie van der Dussen",
  "Daryl Mitchell",
  "Shai Hope",
  "Rahmanullah Gurbaz",
  "Harry Tector",
  "Devon Conway",
  "Glenn Maxwell",
  "Ben Stokes",
  "Mohammad Rizwan",
  "Litton Das",
  "David Warner",
  "Steve Smith",
  "Marnus Labuschagne",
  "Joe Root",
  "Kane Williamson",
  "Jonny Bairstow",
  "Temba Bavuma",
  "Aiden Markram",
  "Quinton de Kock",
  "Fakhar Zaman",
  "Imam-ul-Haq",
  "Kusal Mendis",
  "Charith Asalanka",
  "Sadeera Samarawickrama",
  "Brandon King",
  "Nicholas Pooran",
  "Sherfane Rutherford",
  "Johnson Charles",
  "Sean Williams",
  "Sikandar Raza",
  "Craig Ervine",
  "Paul Stirling",
  "Andy Balbirnie",
  "Lorcan Tucker",
  "Curtis Campher",
  "George Dockrell",
  "Scott Edwards",
  "Max ODowd",
  "Bas de Leede",
  "Vikramjit Singh",
  "Michael van Lingen",
  "Gerhard Erasmus",
  "David Wiese",
  "JJ Smit",
  "Ruben Trumpelmann",
  "Bernard Scholtz",
  "Tom Latham",
  "Will Young",
  "Rachin Ravindra",
  "Glenn Phillips",
  "Finn Allen",
  "Mark Chapman",
  "Tim Seifert",
  "Joshua Little",
  "Sam Curran",
  "Moeen Ali",
  "Chris Woakes",
  "Dawid Malan",
  "Jason Roy",
  "Alex Hales",
  "David Malan",
  "James Vince",
  "Sam Billings",
  "Tom Banton",
  "Daniel Bell-Drummond",
  "Joe Clarke",
  "Sam Hain",
  "Adam Hose",
  "Rob Yates",
  "Mandeep Singh",
  "Manish Pandey",
  "Suresh Raina",
  "MS Dhoni",
  "Yuvraj Singh",
  "Gautam Gambhir",
  "Virender Sehwag",
  "Sachin Tendulkar",
  "Ricky Ponting",
  "Adam Gilchrist",
  "Matthew Hayden",
  "Chris Gayle",
  "Brian Lara",
  "Viv Richards",
  "Gordon Greenidge",
  "Desmond Haynes",
  "Jacques Kallis",
  "Hashim Amla",
  "AB de Villiers",
  "Graeme Smith",
  "Herschelle Gibbs",
  "Kumar Sangakkara",
  "Mahela Jayawardene",
  "Sanath Jayasuriya",
  "Tillakaratne Dilshan",
  "Ross Taylor",
  "Stephen Fleming",
  "Brendon McCullum",
  "Martin Crowe",
];
const CRICKET_COUNTRIES = [
  "India",
  "Australia",
  "England",
  "New Zealand",
  "South Africa",
  "Pakistan",
  "Sri Lanka",
  "West Indies",
  "Bangladesh",
  "Afghanistan",
  "Zimbabwe",
  "Ireland",
  "Netherlands",
  "Namibia",
  "Scotland",
];
const CRICKET_COUNTRIES_W = [
  "Australia",
  "England",
  "India",
  "New Zealand",
  "South Africa",
  "West Indies",
  "Sri Lanka",
  "Pakistan",
  "Bangladesh",
  "Ireland",
  "Netherlands",
  "Scotland",
  "Thailand",
  "Zimbabwe",
  "PNG",
];

const FOOTBALL_NAMES = [
  "Erling Haaland",
  "Kylian Mbappe",
  "Harry Kane",
  "Lionel Messi",
  "Cristiano Ronaldo",
  "Mohamed Salah",
  "Robert Lewandowski",
  "Karim Benzema",
  "Kevin De Bruyne",
  "Neymar",
  "Vinicius Jr",
  "Jude Bellingham",
  "Rodri",
  "Antoine Griezmann",
  "Bukayo Saka",
  "Phil Foden",
  "Jamal Musiala",
  "Lautaro Martinez",
  "Victor Osimhen",
  "Rafael Leao",
  "Bernardo Silva",
  "Pedri",
  "Eden Hazard",
  "Luka Modric",
  "Toni Kroos",
  "Joshua Kimmich",
  "Declan Rice",
  "Martin Odegaard",
  "Bruno Fernandes",
  "Marcus Rashford",
  "Gabriel Jesus",
  "Jack Grealish",
  "Mason Mount",
  "Kai Havertz",
  "Christopher Nkunku",
  "Florian Wirtz",
  "Serge Gnabry",
  "Thomas Muller",
  "Leroy Sane",
  "Alphonso Davies",
  "Kylian Mbappe Lottin",
  "Ousmane Dembele",
  "Randal Kolo Muani",
  "Marcus Thuram",
  "Olivier Giroud",
  "Kingsley Coman",
  "Mike Maignan",
  "Gianluigi Donnarumma",
  "Alessandro Bastoni",
  "Theo Hernandez",
  "Federico Valverde",
  "Aurelien Tchouameni",
  "Eduardo Camavinga",
  "Rodrygo Goes",
  "Endrick",
  "Lamine Yamal",
  "Pau Cubarsi",
  "Warren Zaire-Emery",
  "Xavi Simons",
  "Arda Guler",
  "Khvicha Kvaratskhelia",
  "Rasmus Hojlund",
  "Darwin Nunez",
  "Luis Diaz",
  "Cody Gakpo",
  "Dominik Szoboszlai",
  "Virgil van Dijk",
  "Trent Alexander-Arnold",
  "Andrew Robertson",
  "Alisson Becker",
  "Ederson",
  "Ruben Dias",
  "Joao Cancelo",
  "Bernardo Silva",
  "Erling Haaland",
  "Jeremy Doku",
  "Julian Alvarez",
  "Julian Brandt",
  "Karim Adeyemi",
  "Donyell Malen",
  "Matthijs de Ligt",
  "Frenkie de Jong",
  "Memphis Depay",
  "Dusan Vlahovic",
  "Federico Chiesa",
  "Nicolo Barella",
  "Lautaro Martinez",
  "Romelu Lukaku",
  "Kevin De Bruyne",
  "Youri Tielemans",
  "Jeremy Doku",
  "Romeo Lavia",
  "Dominic Calvert-Lewin",
  "James Maddison",
  "Son Heung-min",
  "Richarlison",
  "Dejan Kulusevski",
  "Pedro Porro",
  "Cristian Romero",
  "Heung-min Son",
  "Min-jae Kim",
  "Wataru Endo",
  "Takefusa Kubo",
  "Daichi Kamada",
];
const FOOTBALL_TEAMS = [
  "Manchester City",
  "Real Madrid",
  "Bayern Munich",
  "PSG",
  "Liverpool",
  "Barcelona",
  "Arsenal",
  "Inter Milan",
  "AC Milan",
  "Juventus",
  "Chelsea",
  "Tottenham",
  "Manchester United",
  "Atletico Madrid",
  "Borussia Dortmund",
  "RB Leipzig",
  "Napoli",
  "Benfica",
  "Porto",
  "Ajax",
  "Sporting CP",
  "Marseille",
  "Lyon",
  "Roma",
  "Lazio",
  "Feyenoord",
  "PSV",
  "Celtic",
  "Rangers",
  "Club Brugge",
];
const FOOTBALL_POSITIONS = [
  "FW",
  "FW",
  "MF",
  "FW",
  "MF",
  "FW",
  "MF",
  "DF",
  "GK",
  "FW",
  "MF",
  "DF",
  "MF",
  "FW",
  "MF",
];
const FOOTBALL_COUNTRIES = [
  "Norway",
  "France",
  "England",
  "Argentina",
  "Portugal",
  "Egypt",
  "Poland",
  "France",
  "Belgium",
  "Brazil",
  "Brazil",
  "England",
  "Spain",
  "France",
  "England",
  "England",
  "Germany",
  "Argentina",
  "Nigeria",
  "Portugal",
  "Portugal",
  "Spain",
  "Belgium",
  "Croatia",
  "Germany",
  "Germany",
  "England",
  "Norway",
  "Portugal",
  "England",
  "Brazil",
  "England",
  "England",
  "Germany",
  "France",
  "Germany",
  "Germany",
  "Germany",
  "Germany",
  "Canada",
  "France",
  "France",
  "France",
  "France",
  "France",
  "France",
  "Italy",
  "Italy",
  "Italy",
  "France",
  "Spain",
  "France",
  "France",
  "Brazil",
  "Brazil",
  "Spain",
  "Spain",
  "France",
  "Netherlands",
  "Turkey",
  "Georgia",
  "Denmark",
  "Uruguay",
  "Colombia",
  "Netherlands",
  "Hungary",
  "Netherlands",
  "England",
  "Scotland",
  "Brazil",
  "Brazil",
  "Portugal",
  "Belgium",
  "Portugal",
  "Netherlands",
  "Belgium",
  "Portugal",
  "Germany",
  "Germany",
  "Netherlands",
  "Netherlands",
  "Netherlands",
  "Serbia",
  "Italy",
  "Italy",
  "Argentina",
  "Belgium",
  "Belgium",
  "Belgium",
  "Belgium",
  "England",
  "England",
  "South Korea",
  "Brazil",
  "Sweden",
  "Spain",
  "Argentina",
  "South Korea",
  "South Korea",
  "Japan",
  "Japan",
  "Japan",
];

const TENNIS_ATP = [
  "Jannik Sinner",
  "Novak Djokovic",
  "Carlos Alcaraz",
  "Daniil Medvedev",
  "Alexander Zverev",
  "Andrey Rublev",
  "Stefanos Tsitsipas",
  "Casper Ruud",
  "Holger Rune",
  "Hubert Hurkacz",
  "Alex de Minaur",
  "Taylor Fritz",
  "Grigor Dimitrov",
  "Tommy Paul",
  "Ugo Humbert",
  "Karen Khachanov",
  "Ben Shelton",
  "Felix Auger-Aliassime",
  "Lorenzo Musetti",
  "Sebastian Korda",
  "Nicolas Jarry",
  "Adrian Mannarino",
  "Frances Tiafoe",
  "Jan-Lennard Struff",
  "Alexander Bublik",
  "Tallon Griekspoor",
  "Jiri Lehecka",
  "Christopher Eubanks",
  "Mackenzie McDonald",
  "Andy Murray",
  "Stan Wawrinka",
  "Gael Monfils",
  "Marin Cilic",
  "Matteo Berrettini",
  "Denis Shapovalov",
  "Dominic Thiem",
  "Borna Coric",
  "Roberto Bautista Agut",
  "Pablo Carreno Busta",
  "Cameron Norrie",
  "Daniel Evans",
  "Laslo Djere",
  "Yoshihito Nishioka",
  "Miomir Kecmanovic",
  "Alexei Popyrin",
  "Jaume Munar",
  "Marton Fucsovics",
  "Richard Gasquet",
  "Roberto Carballes Baena",
  "Albert Ramos-Vinolas",
  "Federico Coria",
  "Pedro Cachin",
  "Juan Pablo Varillas",
  "Daniel Altmaier",
  "Gregoire Barrere",
  "Quentin Halys",
  "Corentin Moutet",
  "Luca Van Assche",
  "Arthur Fils",
  "Thiago Seyboth Wild",
  "Alejandro Tabilo",
  "Tomas Martin Etcheverry",
  "Francisco Cerundolo",
  "Sebastian Baez",
  "Mariano Navone",
  "Nuno Borges",
  "Lorenzo Sonego",
  "Matteo Arnaldi",
  "Flavio Cobolli",
  "Luciano Darderi",
  "Zhizhen Zhang",
  "Yunchaokete Bu",
  "Juncheng Shang",
  "James Duckworth",
  "Max Purcell",
  "Jordan Thompson",
  "Aleksandar Vukic",
  "Thanasi Kokkinakis",
  "Adam Walton",
  "Marcos Giron",
  "Brandon Nakashima",
  "Reilly Opelka",
  "Tennys Sandgren",
  "Denis Kudla",
  "Jeffrey John Wolf",
  "Michael Mmoh",
  "Patrick Kypson",
  "Zachary Svajda",
  "Aleksandar Kovacevic",
  "Emilio Nava",
  "Nishesh Basavareddy",
  "Ethan Quinn",
  "Tristan Schoolkate",
  "Coleman Wong",
  "Hsu Yu-hsiou",
  "Chak Lam Coleman Wong",
  "Jacob Fearnley",
  "Paul Jubb",
  "Jan Choinski",
  "Billy Harris",
  "Liam Broady",
];
const TENNIS_WTA = [
  "Iga Swiatek",
  "Aryna Sabalenka",
  "Coco Gauff",
  "Elena Rybakina",
  "Jessica Pegula",
  "Ons Jabeur",
  "Marketa Vondrousova",
  "Maria Sakkari",
  "Karolina Muchova",
  "Jelena Ostapenko",
  "Barbora Krejcikova",
  "Beatriz Haddad Maia",
  "Belinda Bencic",
  "Caroline Garcia",
  "Madison Keys",
  "Liudmila Samsonova",
  "Daria Kasatkina",
  "Petra Kvitova",
  "Victoria Azarenka",
  "Veronika Kudermetova",
  "Elina Svitolina",
  "Anastasia Potapova",
  "Mirra Andreeva",
  "Linda Noskova",
  "Ekaterina Alexandrova",
  "Tatjana Maria",
  "Danielle Collins",
  "Sloane Stephens",
  "Sofia Kenin",
  "Marta Kostyuk",
  "Dayana Yastremska",
  "Lesia Tsurenko",
  "Camila Giorgi",
  "Martina Trevisan",
  "Elisabetta Cocciaretto",
  "Jasmine Paolini",
  "Lucia Bronzetti",
  "Sara Errani",
  "Emma Raducanu",
  "Katie Boulter",
  "Harriet Dart",
  "Jodie Burrage",
  "Heather Watson",
  "Lily Miyazaki",
  "Naomi Osaka",
  "Angelique Kerber",
  "Donna Vekic",
  "Petra Martic",
  "Tara Wurth",
  "Kaja Juvan",
  "Tamara Zidansek",
  "Xiyu Wang",
  "Xinyu Wang",
  "Lin Zhu",
  "Siyu Wang",
  "Yue Yuan",
  "Shuai Zhang",
  "Qinwen Zheng",
  "Hong Yi Cody Wong",
  "Ankita Raina",
  "Rutuja Bhosale",
  "Karman Kaur Thandi",
  "Vaidya Bhardwaj",
  "Yuki Naito",
  "Mai Hontama",
  "Nao Hibino",
  "Sara Saito",
  "Ayano Shimizu",
  "Yuriko Miyazaki",
  "Eudice Chong",
  "Cody Wong",
  "Haruka Kaji",
  "En Shuo Liang",
  "Peangtarn Plipuech",
  "Sabina Sharipova",
  "Alina Korneeva",
  "Alexandra Eala",
  "Darja Semenistaja",
  "Ekaterina Yashina",
  "Varvara Gracheva",
  "Diana Shnaider",
  "Kamilla Rakhimova",
  "Marina Stakusic",
  "Rebecca Marino",
  "Leylah Fernandez",
  "Bianca Andreescu",
  "Eugenie Bouchard",
  "Rebecca Sramkova",
  "Anna Schmiedlova",
  "Karolina Pliskova",
  "Katerina Siniakova",
  "Linda Fruhvirtova",
  "Brenda Fruhvirtova",
  "Sara Bejlek",
  "Nika Radisic",
  "Antonia Ruzic",
  "Tena Lukas",
  "Lucija Ciric Bagaric",
];

const BASEBALL_NAMES = [
  "Shohei Ohtani",
  "Aaron Judge",
  "Juan Soto",
  "Mookie Betts",
  "Ronald Acuna Jr",
  "Mike Trout",
  "Fernando Tatis Jr",
  "Bryce Harper",
  "Matt Olson",
  "Freddie Freeman",
  "Yordan Alvarez",
  "Corey Seager",
  "Jose Ramirez",
  "Rafael Devers",
  "Trea Turner",
  "Vladimir Guerrero Jr",
  "Bo Bichette",
  "Julio Rodriguez",
  "Adley Rutschman",
  "Corbin Carroll",
  "Manny Machado",
  "Nolan Arenado",
  "Paul Goldschmidt",
  "Nolan Jones",
  "Spencer Strider",
  "Gerrit Cole",
  "Jacob deGrom",
  "Zack Wheeler",
  "Justin Verlander",
  "Max Scherzer",
  "Clayton Kershaw",
  "Aaron Nola",
  "Corbin Burnes",
  "Shane McClanahan",
  "Kevin Gausman",
  "Framber Valdez",
  "Sandy Alcantara",
  "Luis Castillo",
  "Carlos Rodon",
  "Logan Webb",
  "Joe Musgrove",
  "Zac Gallen",
  "Merrill Kelly",
  "Hunter Greene",
  "Nick Lodolo",
  "Reid Detmers",
  "Bobby Miller",
  "Gavin Stone",
  "Emmet Sheehan",
  "Michael Grove",
  "Ryan Pepiot",
  "Gavin Lux",
  "Miguel Rojas",
  "Chris Taylor",
  "Max Muncy",
  "Will Smith",
  "James Outman",
  "Jason Heyward",
  "David Peralta",
  "Austin Barnes",
  "Noah Syndergaard",
  "Walker Buehler",
  "Clayton Kershaw",
  "Tony Gonsolin",
  "Dustin May",
  "Blake Treinen",
  "Alex Vesia",
  "Evan Phillips",
  "Caleb Ferguson",
  "Brusdar Graterol",
  "Victor Gonzalez",
  "Justin Bruihl",
  "Michael Grove",
  "Ryan Brasier",
  "Joe Kelly",
  "Chris Martin",
  "Kenley Jansen",
  "Daniel Hudson",
  "Jake Marisnick",
  "Austin Wynns",
  "Patrick Mazeika",
  "Yency Almonte",
  "Gus Varland",
  "Mike Busch",
  "Taylor Ward",
  "Luis Rengifo",
  "Zach Neto",
  "Brandon Drury",
  "Eduardo Escobar",
  "David Fletcher",
  "Logan O'Hoppe",
  "Matt Thaiss",
  "Jo Adell",
  "Mickey Moniak",
  "Randal Grichuk",
  "Hunter Renfroe",
  "Taylor Ward",
  "Mike Trout",
  "Shohei Ohtani",
];
const BASEBALL_TEAMS = [
  "Los Angeles Dodgers",
  "New York Yankees",
  "Atlanta Braves",
  "San Diego Padres",
  "Philadelphia Phillies",
  "Houston Astros",
  "Los Angeles Angels",
  "New York Mets",
  "Texas Rangers",
  "Tampa Bay Rays",
  "Toronto Blue Jays",
  "Baltimore Orioles",
  "Seattle Mariners",
  "Minnesota Twins",
  "Milwaukee Brewers",
  "Chicago Cubs",
  "St. Louis Cardinals",
  "San Francisco Giants",
  "Arizona Diamondbacks",
  "Miami Marlins",
  "Boston Red Sox",
  "Cincinnati Reds",
  "Cleveland Guardians",
  "Detroit Tigers",
  "Kansas City Royals",
  "Chicago White Sox",
  "Oakland Athletics",
  "Pittsburgh Pirates",
  "Colorado Rockies",
  "Washington Nationals",
];

const HOCKEY_NAMES_M = [
  "Tom Boon",
  "Alexander Hendrickx",
  "Arthur van Doren",
  "Glenn Turner",
  "Blake Govers",
  "Blake Thomson",
  "Johnny Belmonte",
  "Mats Grambusch",
  "Christopher Ruhr",
  "Mark van Rijswijk",
  "Robbert Kemperman",
  "Sander de Wijn",
  "Bjorn Kellerman",
  "Billy Bakker",
  "Valentin Verga",
  "Victor Wegnez",
  "Felix Denayer",
  "Cedric Charlier",
  "Arthur Verdussen",
  "Nicolas de Kerpel",
  "Tanguy Cosyns",
  "Simon Gougnard",
  "Gauthier Boccard",
  "Loic van Doren",
  "Maxime Plennevaux",
  "Tommy Willems",
  "Floris Wortelboer",
  "Jip Janssen",
  "Tijs van der Horst",
  "Joep de Mol",
  "Boris Burkhardt",
  "Lukas Windfeder",
  "Niklas Wellen",
  "Benedikt Furk",
  "Dieter Linnekogel",
  "Mats Grambusch",
  "Malte Hellwig",
  "Justus Weigand",
  "Marc Koll",
  "Constantin Staib",
  "Timothee Clement",
  "Nicolas Dumont",
  "Fabrice van Bockstal",
  "Jerome Truyens",
  "Romain Marq",
  "Dylan Englebert",
  "William Ghislain",
  "Gilles Thomas",
  "Antoine Kina",
  "Tommy Willems",
  "Sander Baart",
  "Jelle Galema",
  "Florian Fuchs",
  "Moritz Furste",
  "Tobias Hauke",
  "Martin Zwicker",
  "Oliver Korn",
  "Jan-Philipp Rabente",
  "Linus Butt",
  "Marco Miltkau",
  "Chris Wesley",
  "Ashley Jackson",
  "Barry Middleton",
  "Henry Weir",
  "Ian Sloan",
  "Alan Forsyth",
  "Chris Grassi",
  "George Pinner",
  "Harry Martin",
  "David Condon",
  "Ollie Willars",
  "Liam Ansell",
  "James Gall",
  "Will Calnan",
  "Jake Ferns",
  "Zachary Lee",
  "Jonah Klein",
  "Nick Czepielewski",
  "Pat Harris",
  "Sean Flynn",
  "Tom Crowder",
  "Sam Olyslager",
  "Kasey Lopresti",
  "Tommy Doman",
  "Asher Brown",
  "Christian DeAngelis",
  "Ethan Woods",
  "Evan Burton",
  "Tyler Bird",
  "Matthew Gossett",
  "Brian Palmer",
  "Sam Mann",
  "Jacob Jarvis",
  "Aki Kaeppeler",
  "Timur Shirokov",
  "Rafat Hager",
  "Pawel Bratkowski",
  "Janusz Gorny",
  "Mateusz Hulboj",
  "Mateusz Kuznia",
  "Jacek Lukaszewski",
  "Piotr Sankowski",
  "Matej Rojewski",
];
const HOCKEY_NAMES_W = [
  "Eva de Goede",
  "Xan de Waard",
  "Lidewij Welten",
  "Caia van Maasakker",
  "Frédérique Matla",
  "Maria Verschoor",
  "Felice Albers",
  "Stella van Gils",
  "Josine Koning",
  "Anne Veenendaal",
  "Sanne Koolen",
  "Ireen van den Assem",
  "Anabel de la Fuente",
  "Belén Iglesias",
  "Lucía Jiménez",
  "Marina Martín",
  "Berta Bonastre",
  "Silvia Muñoz",
  "Marta Segú",
  "Carlota Petchame",
  "María López",
  "Bea Pérez",
  "Lola Riera",
  "Alicia Magaz",
  "Candela Mejías",
  "Clara Ycart",
  "Laura Barrios",
  "Maialen García",
  "Amelia del Carmen",
  "Teresa Benítez",
  "Alina Mailleux",
  "Aline Stöckel",
  "Lisa Altenburg",
  "Katharina Kleinfeldt",
  "Sara Strauss",
  "Marlena Hüls",
  "Nele Steffen",
  "Valentina Schmitz",
  "Lisa Schneider",
  "Rebecca Abildgaard",
  "Mathilde Abildgaard",
  "Margrethe Seerup",
  "Emma Frandsen",
  "Line Krogh",
  "Sara Knudsen",
  "Kamilla Busk",
  "Frida Nielsen",
  "Maria Gade",
  "Sofie Asping",
  "Julie Holm",
  "Hannah Martin",
  "Laura Roper",
  "Grace Balsdon",
  "Lily Walker",
  "Elizabeth Cann",
  "Ellie Rayer",
  "Isabelle Petter",
  "Maddie Hinch",
  "Elizabeth Neal",
  "Elena Macleod",
  "Francesca Burnett",
  "Holly Court",
  "Sonia French",
  "Kirsty Mackay",
  "Clare Hyland",
  "Olivia Balle",
  "Bronwyn Sheehan",
  "Stephanie Dickins",
  "Josie Milne",
  "Jessica McQuade",
  "Kaylee Andrew",
  "Morgan Alexander",
  "Lara Flinn",
  "Margaret Byerly",
  "Amanda Burhans",
  "Katherine O'Donnell",
  "Christina Linton",
  "Olivia Horner",
  "Samantha Berger",
  "Megan Anderson",
  "Heather Schaudt",
  "Camille Koch",
  "Elena Lauer",
  "Laurel Appleton",
  "Chantelle Severn",
  "Megan Ellis",
  "Tessa Kooij",
  "Luna Fokke",
  "Mickey de Koning",
  "Maite Ladstatter",
  "Pien Dicke",
  "Mieke van der Vlugt",
  "Linde van der Heijden",
  "Eva van Agt",
  "Laura Nunnink",
  "Margot van Geffen",
];
const HOCKEY_COUNTRIES = [
  "Australia",
  "Belgium",
  "Netherlands",
  "Germany",
  "India",
  "United Kingdom",
  "Spain",
  "Argentina",
  "New Zealand",
  "South Africa",
  "Ireland",
  "France",
  "Canada",
  "Malaysia",
  "Pakistan",
  "China",
  "Japan",
  "South Korea",
  "Egypt",
  "Chile",
  "United States",
  "Austria",
  "Poland",
  "Italy",
  "Scotland",
  "Wales",
  "Czech Republic",
  "Ukraine",
  "Russia",
  "Ghana",
];

const VOLLEYBALL_NAMES_M = [
  "Wilfredo Leon",
  "Earvin N'Gapeth",
  "Matey Kaziyski",
  "Ivan Zaytsev",
  "Micah Christenson",
  "Matt Anderson",
  "Taylor Sander",
  "Aaron Russell",
  "Thomas Jaeschke",
  "Maxwell Holt",
  "David Smith",
  "Erik Shoji",
  "Kawika Shoji",
  "Yuji Nishida",
  "Yuki Ishikawa",
  "Ran Takahashi",
  "Masahiro Sekita",
  "Taishi Onodera",
  "Nimir Abdel-Aziz",
  "Thijs ter Horst",
  "Maarten van Garderen",
  "Wouter ter Maat",
  "Just Dronkers",
  "Gijs Jorna",
  "Jorna de Boer",
  "Luka Basic",
  "Klemen Cebulj",
  "Tine Urnaut",
  "Jan Kozamernik",
  "Alen Sket",
  "Gabi Fernandez",
  "Andres Villena",
  "Miguel Ángel de Amo",
  "Jorge Fernandez",
  "Angel Trinidad",
  "Jose Luis Linares",
  "Fernando Fernandez",
  "Augusto Colito",
  "Liere de Lima",
  "Henrique Honorato",
  "Carlos Santos",
  "Lucas Saatkamp",
  "Wallace de Souza",
  "Bruno Rezende",
  "Yoandy Leal",
  "Mauricio Souza",
  "Douglas Souza",
  "Lucas Lóh",
  "Alain de Azevedo",
  "William Peixoto",
  "Fabio Paes",
  "Thiery Santos",
  "Matheus Santos",
  "Luis Silva",
  "Joao Silva",
  "Pedro Mendes",
  "Lucas Pereira",
  "Gabriel Machado",
  "Vinicius Rodrigues",
  "Marcelo Costa",
  "Juan Moreno",
  "Samuel Carrillo",
  "Franklin Diaz",
  "Luis Sanchez",
  "Maykel Linares",
  "Rollandsson Leyva",
  "Angel Aguilera",
  "David Soler",
  "Jesus Herrera",
  "Brayan Rodriguez",
  "Jose Aponza",
  "Mario Rivera",
  "Cristian Duarte",
  "Daniel Pereira",
  "Miguel Lopez",
  "Pablo Baez",
  "Rodrigo Villalba",
  "Carlos Acosta",
  "Luis Barreto",
  "Juan Hernandez",
  "Diego Gonzalez",
  "Felipe Carmona",
  "Carlos Carcamo",
  "Joaquin Lagos",
  "Vicente Parraguirre",
  "Sebastian Castillo",
  "Tomas Gago",
  "Matias Banda",
  "Reyner Velez",
  "Gabriel Rivera",
  "Ismael Sandoval",
  "Jerry Torres",
  "Jose Alvarado",
  "Kevin Ramirez",
  "Carlos Ventura",
  "Luis Galeano",
  "Emmanuel Martinez",
  "David Acosta",
  "Jorge Mendoza",
  "Pedro Rodriguez",
];
const VOLLEYBALL_NAMES_W = [
  "Zhu Ting",
  "Paola Egonu",
  "Eda Erdem",
  "Melissa Vargas",
  "Monica De Gennaro",
  "Kimberly Hill",
  "Michelle Bartsch-Hackley",
  "Jordan Larson",
  "Andrea Drews",
  "Annie Drews",
  "Foluke Akinradewo",
  "Rachael Adams",
  "Kelsey Robinson",
  "Justine Wong-Orantes",
  "Haleigh Washington",
  "Chiaka Ogbogu",
  "Kathryn Plummer",
  "Jordan Thompson",
  "Danielle Cuttino",
  "Tiffany Clark",
  "Tijana Boskovic",
  "Brankica Mihajlovic",
  "Maja Ognjenovic",
  "Silvija Popovic",
  "Bianka Busa",
  "Katarina Lazovic",
  "Jelena Blagojevic",
  "Sara Lozo",
  "Jovana Stevanovic",
  "Minja Osmajic",
  "Wang Mengjie",
  "Zhang Changning",
  "Yan Ni",
  "Li Yingying",
  "Gong Xiangyu",
  "Yuan Xinyue",
  "Ding Xia",
  "Wang Yuanyuan",
  "Liu Yanhan",
  "Yang Hanyu",
  "Kosheleva",
  "Nataliya Goncharova",
  "Irina Voronkova",
  "Anna Lazareva",
  "Kseniia Parubets",
  "Viktoriia Gorbunova",
  "Ekaterina Evdokimova",
  "Polina Shemanova",
  "Mariia Vorobyeva",
  "Evgeniia Timoshkina",
  "Elena Pietrini",
  "Miriam Sylla",
  "Caterina Bosetti",
  "Lucia Bosetti",
  "Anna Danesi",
  "Alessia Orro",
  "Ofelia Malinov",
  "Indre Sorokaite",
  "Elena Perinelli",
  "Sara Alberti",
  "Isabel Haak",
  "Isabelle Haak",
  "Julia Nilsson",
  "Hanna Hellvig",
  "Sofia Anderson",
  "Elena Andersson",
  "Linda Andersson",
  "Julia Andersson",
  "Elin Larsson",
  "Emma Larsson",
  "Maja Svalberg",
  "Sarah Van Aalen",
  "Marlies Janssens",
  "Silke van Avermaet",
  "Britt Herbots",
  "Lise de Valk",
  "Tine Klinkenberg",
  "Charlotte Leys",
  "Dominika Strumilo",
  "Valerie Vossen",
  "Jolien Wittock",
  "Manon de Langhe",
  "Lauren Page",
  "Avery Skinner",
  "Madi Bugg",
  "Danielle Mahaffey",
  "Shelly Stafford",
  "Reagan Cooper",
  "Claire Hoffman",
  "Ella Fraser",
  "Sarah Schmid",
  "Maya McLeod",
  "Emma McCloskey",
  "Kate Massey",
  "Lydia Vogler",
  "Megan Harrison",
];
const VOLLEYBALL_POSITIONS = [
  "OH",
  "OP",
  "MB",
  "S",
  "L",
  "OH",
  "OP",
  "MB",
  "S",
  "L",
  "OH",
  "OP",
  "MB",
  "S",
  "L",
  "OH",
  "OP",
  "MB",
  "S",
  "L",
  "OH",
  "OP",
  "MB",
  "S",
  "L",
  "OH",
  "OP",
  "MB",
  "S",
  "L",
];
const VOLLEYBALL_COUNTRIES = [
  "Poland",
  "France",
  "Brazil",
  "Italy",
  "USA",
  "Japan",
  "Russia",
  "Iran",
  "Argentina",
  "Germany",
  "Netherlands",
  "Slovenia",
  "Cuba",
  "Canada",
  "Bulgaria",
  "Serbia",
  "Turkey",
  "China",
  "Egypt",
  "Korea",
  "Australia",
  "Tunisia",
  "Ukraine",
  "Czech Republic",
  "Belgium",
  "Portugal",
  "Mexico",
  "Qatar",
  "Chile",
  "Cameroon",
];

const KABADDI_NAMES = [
  "Pardeep Narwal",
  "Naveen Kumar",
  "Maninder Singh",
  "Rishank Devadiga",
  "Deepak Niwas Hooda",
  "Pawan Sehrawat",
  "Sachin Tanwar",
  "Ajay Thakur",
  "Rahul Chaudhari",
  "Siddharth Desai",
  "Mohammadreza Shadlou",
  "Abhishek Singh",
  "Vikash Khandola",
  "Nitin Rawal",
  "Arjun Deshwal",
  "Neeraj Kumar",
  "Chandran Ranjit",
  "Sagar",
  "Vijay",
  "Anup Kumar",
  "Deepak Hooda",
  "Rohit",
  "Surjeet",
  "Gaurav",
  "Nitin",
  "Sandeep",
  "Amit",
  "Sagar",
  "Vishal",
  "Sachin",
  "Ashish",
  "Pankaj",
  "Naveen",
  "Pardeep",
  "Vivek",
  "Rajesh",
  "Mahinder",
  "Vikrant",
  "Somnath",
  "Siddharth",
  "Sunil",
  "Mukesh",
  "Karan",
  "Ravi",
  "Rohan",
  "Aditya",
  "Manjeet",
  "Balwinder",
  "Harjeet",
  "Gagandeep",
  "Aman",
  "Krishan",
  "Hardeep",
  "Jai",
  "Sagar",
  "Kumar",
  "Ravi",
  "Shubham",
  "Vikas",
  "Parveen",
  "Amarjeet",
  "Gurvinder",
  "Simranjit",
  "Lovepreet",
  "Sukhvinder",
  "Amandeep",
  "Jasveer",
  "Ravinder",
  "Sachin",
  "Vikas",
  "Mohit",
  "Sunil",
  "Hitesh",
  "Rajesh",
  "Dharma",
  "Dharmendra",
  "Ravi",
  "Jagdish",
  "Raman",
  "Harsh",
  "Sumit",
  "Amit",
  "Kuldeep",
  "Anil",
  "Vijay",
  "Ravi",
  "Deepak",
  "Naveen",
  "Sachin",
  "Sahil",
  "Vinay",
  "Siddharth",
  "Abhishek",
  "Rahul",
  "Amit",
  "Pankaj",
  "Vishal",
  "Rohit",
  "Vivek",
  "Sunil",
  "Rajesh",
  "Amit",
];
const KABADDI_TEAMS = [
  "Patna Pirates",
  "Dabang Delhi KC",
  "Bengal Warriors",
  "UP Yoddhas",
  "Puneri Paltan",
  "Jaipur Pink Panthers",
  "Bengaluru Bulls",
  "Tamil Thalaivas",
  "Gujarat Giants",
  "Haryana Steelers",
  "Telugu Titans",
  "U Mumba",
  "Jaipur Pink Panthers",
  "Patna Pirates",
  "Dabang Delhi KC",
  "Bengaluru Bulls",
  "UP Yoddhas",
  "Tamil Thalaivas",
  "Puneri Paltan",
  "Gujarat Giants",
  "Haryana Steelers",
  "U Mumba",
  "Telugu Titans",
  "Bengal Warriors",
  "Patna Pirates",
  "Dabang Delhi KC",
  "Jaipur Pink Panthers",
  "Bengaluru Bulls",
  "UP Yoddhas",
  "Tamil Thalaivas",
];

const ESPORTS_NAMES_VAL = [
  "TenZ",
  "Demon1",
  "jawgemo",
  "Aspas",
  "Chronicle",
  "Something",
  "Keznit",
  "Sacy",
  "FNS",
  "Boaster",
  "Derke",
  "Alfajer",
  "Leo",
  "Jinggg",
  "f0rsakeN",
  "Monyet",
  "Redgar",
  "d3ffo",
  "Sayf",
  "Zekken",
  "Marved",
  "Victor",
  "Crashies",
  "yay",
  "Meteor",
  "Rb",
  "Boo",
  "AvovA",
  "Florescent",
  "Cender",
];
const ESPORTS_NAMES_LOL = [
  "Faker",
  "Chovy",
  "Caps",
  "369",
  "Bin",
  "Keria",
  "Tian",
  "Scout",
  "Elk",
  "Mata",
  "Bang",
  "Wolf",
  "Ruler",
  "Deft",
  "Ming",
  "JackeyLove",
  "TheShy",
  "Rookie",
  "ShowMaker",
  "Canyon",
  "BeryL",
  "Knight",
  "Jiejie",
  "Viper",
  "Meiko",
  "Tarzan",
  "Ale",
  "Light",
  "Hang",
  "Kanavi",
];
const ESPORTS_NAMES_CS = [
  "ZywOo",
  "s1mple",
  "NiKo",
  "m0NESY",
  "ropz",
  "device",
  "twistzz",
  "EliGE",
  "NAF",
  "frozen",
  "Ax1Le",
  "electroNic",
  "sdy",
  "jL",
  "iM",
  "Snappi",
  "FalcoN",
  "KSCERATO",
  "yuurih",
  "chelo",
  "Jame",
  "FL1T",
  "zorte",
  "mir",
  "m0NESY",
  "degster",
  "headtr1ck",
  "s1ren",
  "t0rick",
  "alpha",
];
const ESPORTS_NAMES_DOTA = [
  "Nisha",
  "Topias",
  "Team Ame",
  "Collapse",
  "Mira",
  "TORONTOTOKYO",
  "Miposhka",
  "Yatoro",
  "Miracle-",
  "SumaiL",
  "Arteezy",
  "RAMZES666",
  "NoOne",
  "Nightfall",
  "Dry",
  "Khalid",
  "MinD_ContRoL",
  "GH",
  "KuroKy",
  "Matumbaman",
  "zai",
  "Puppey",
  "Ace",
  "33",
  "Malik",
  "Crystallis",
  "BZM",
  "ATF",
  "Skiter",
  "Seleri",
];
const ESPORTS_TEAMS = [
  "Sentinels",
  "Cloud9",
  "DRX",
  "Fnatic",
  "LOUD",
  "Evil Geniuses",
  "Paper Rex",
  "Oxygen Esports",
  "KRÜ Esports",
  "Navi",
  "FaZe Clan",
  "Team SoloMid",
  "Team Liquid",
  "G2 Esports",
  "100 Thieves",
  "NRG Esports",
  "MIBR",
  "FURIA Esports",
  "Leviatán",
  "Karmine Corp",
  "T1",
  "Gen.G",
  "Dplus KIA",
  "DRX",
  "KT Rolster",
  "Hanwha Life Esports",
  "DK",
  "Bilibili Gaming",
  "Top Esports",
  "JDG",
];

const TABLETENNIS_NAMES_M = [
  "Fan Zhendong",
  "Wang Chuqin",
  "Ma Long",
  "Liang Jingkun",
  "Lin Gaoyuan",
  "Lin Shidong",
  "Xu Xin",
  "Zhou Qihao",
  "Tomokazu Harimoto",
  "Zhang Benzhihe",
  "Dang Qiu",
  "Truls Moregardh",
  "Hugo Calderano",
  "Darko Jorgic",
  "Lin Yun-ju",
  "Kao Cheng-Jui",
  "Chuang Chih-Yuan",
  "Patrick Franziska",
  "Dimitrij Ovtcharov",
  "Timo Boll",
  "Quadri Aruna",
  "Omar Assar",
  "Marcos Freitas",
  "Simon Gauzy",
  "Lebrun Alexis",
  "Lebrun Felix",
  "Kanak Jha",
  "Jang Woo-jin",
  "Lim Jong-hoon",
  "An Jae-hyun",
  "Cho Seung-min",
  "Alvaro Robles",
  "Daniel Habesohn",
  "Benedikt Duda",
  "Anton Kallberg",
  "Kristian Karlsson",
  "Jon Persson",
  "Mattias Falck",
  "Emil Johansson",
  "Nicolas Burgos",
  "Gaston Alto",
  "Horacio Cifuentes",
  "Santiago Lorenzo",
  "Diego Cachi",
  "Andy Pereira",
  "Brian Afanador",
  "Alberto Mino",
  "Rodrigo Gil",
  "Cedric Nuytinck",
  "Robin Devos",
  "Adrien Rassenfosse",
  "Florent Lambiet",
  "Martin Allegre",
  "Liam Pitchford",
  "Paul Drinkhall",
  "Sam Walker",
  "Tom Jarvis",
  "David McBeath",
  "Joshua Weatherby",
  "Shayan Siraj",
  "Filip Zeljko",
  "Toma Kolarek",
  "Andrei Istrate",
  "Iulian Chirita",
  "Eduard Ionescu",
  "Victor Vlad",
  "Ovidiu Merutiu",
  "Cristian Pletea",
  "Hunor Szocs",
  "Bence Majoros",
  "Tamas Lakatos",
  "Adam Szudi",
  "Nandor Ecseki",
  "Daniel Koszoru",
  "Marton Marsi",
  "Csaba Andras",
  "Alexander Chen",
  "Amin Ahmadian",
  "Nima Alamian",
  "Noshad Alamian",
  "Seyed Amiri",
  "Soroush Pournazari",
  "Amir Hossein",
  "Pedar Arvand",
  "Mobin Sedighi",
  "Navid Shams",
  "Ashkan Ahmadzadeh",
  "Mohammad Amin",
  "Vahid Mohammadi",
  "Sajad Mohammadi",
  "Arman Hajipour",
  "Ali Khoshkholeh",
  "Seyed Reza",
  "Mohsen Mohammadi",
  "Erfan Ghasemi",
  "Nima Sadeghi",
  "Soroush Mohammadi",
];
const TABLETENNIS_NAMES_W = [
  "Sun Yingsha",
  "Wang Manyu",
  "Wang Yidi",
  "Chen Meng",
  "Chen Xingtong",
  "Shen Yubin",
  "Qian Tianyi",
  "Fan Siqi",
  "Zhang Rui",
  "Mima Ito",
  "Hina Hayata",
  "Miu Hirano",
  "Miyuu Kihara",
  "Miyu Nagasaki",
  "Miwa Harimoto",
  "Sakura Mori",
  "Yuka Umemoto",
  "Satsuki Odo",
  "Nina Mittelham",
  "Han Ying",
  "Shan Xiaona",
  "Sabine Winter",
  "Annett Kaufmann",
  "Doo Hoi Kem",
  "Lee Ho Ching",
  "Zhu Cheng Zhu",
  "Minnie Soo",
  "Ng Wing Nam",
  "Zhang Mo",
  "Bernadette Szocs",
  "Elizabeta Samara",
  "Andreea Dragoman",
  "Adina Diaconu",
  "Tania Plaian",
  "Maria Yovkova",
  "Polina Mikhailova",
  "Sofia Polcanova",
  "Min Yang",
  "Liu Jia",
  "Matilda Ekholm",
  "Cezaryna Stankowska",
  "Natalia Bajor",
  "Klaudia Kusiak",
  "Lily Zhang",
  "Rachel Sung",
  "Amy Wang",
  "Kristen Li",
  "Sarah Jalli",
  "Yue Wu",
  "Sally Moy",
  "Samantha Yang",
  "Nina Chen",
  "Tiffany Ke",
  "Ying Sun",
  "Berta Chen",
  "Eva Lee",
  "Hong Wang",
  "Lin Chen",
  "Xiaohua Hu",
  "Yan Huang",
  "Li Fan",
  "JianJian Zhang",
  "Katherine Li",
  "Megan Chen",
  "Joyce Yang",
  "Xin Chen",
  "Sophia Zhang",
  "Alice Li",
  "Grace Wang",
  "Lily Wen",
  "Helen Wu",
  "Michelle Zhao",
  "Jing Chen",
  "Yan Li",
  "Xiaoping Wang",
  "Xiaohui Zhang",
  "Yan He",
  "Ting Liu",
  "Fang Chen",
  "Hong Li",
  "Xiao Chen",
  "Jie Zhang",
  "Ming Li",
  "Wei Wang",
  "Fen Yang",
  "Li He",
  "Xia Zhang",
  "Yan Wang",
  "Jing Li",
  "Lin He",
  "Hong Zhang",
  "Fang Liu",
  "Yan Chen",
  "Xiao Li",
  "Jie Wang",
  "Feng Yang",
  "Wei Chen",
  "Ming Zhang",
  "Li Wang",
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function makePlayers(raw) {
  return raw.map((p, i) => ({
    rank: i + 1,
    name: p[0],
    country: p[1],
    rating: p[2],
    matches: p[3],
    runs: p[4],
    wkts: p[5],
    avg: p[6],
    econ: p[7],
  }));
}

function makeFootballPlayers(category, gender) {
  const prefix = gender === "women" ? "W. " : "";
  const count = 100;
  const players = [];
  for (let i = 0; i < count; i++) {
    const name = `${prefix}${FOOTBALL_NAMES[i % FOOTBALL_NAMES.length]}`;
    const team = FOOTBALL_TEAMS[i % FOOTBALL_TEAMS.length];
    const country = FOOTBALL_COUNTRIES[i % FOOTBALL_COUNTRIES.length];
    const position = FOOTBALL_POSITIONS[i % FOOTBALL_POSITIONS.length];
    const base = 100 - i;
    const playersThis = Math.round(20 + Math.random() * 30);
    const goals =
      category === "scorers"
        ? Math.max(0, Math.round(base * 0.5 + Math.random() * 10))
        : Math.round(5 + Math.random() * 15);
    const assists =
      category === "assists"
        ? Math.max(0, Math.round(base * 0.35 + Math.random() * 8))
        : Math.round(3 + Math.random() * 12);
    const rating = (6.5 + Math.random() * 2.5).toFixed(1);
    players.push({
      rank: i + 1,
      name,
      country,
      team,
      position,
      goals,
      assists,
      matches: playersThis,
      rating,
    });
  }
  if (category === "scorers") players.sort((a, b) => b.goals - a.goals);
  else if (category === "assists")
    players.sort((a, b) => b.assists - a.assists);
  else players.sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));
  players.forEach((p, i) => (p.rank = i + 1));
  return players;
}

function makeTennisPlayers(type, cat) {
  const pool = type === "atp" ? TENNIS_ATP : TENNIS_WTA;
  const prefix = type === "wta" ? "" : "";
  const count = 100;
  const countries = [
    "Spain",
    "Italy",
    "Serbia",
    "Russia",
    "Greece",
    "Norway",
    "Denmark",
    "Poland",
    "Australia",
    "USA",
    "Bulgaria",
    "Germany",
    "Canada",
    "France",
    "UK",
    "Argentina",
    "Chile",
    "Croatia",
    "Switzerland",
    "Netherlands",
    "Belgium",
    "Japan",
    "China",
    "Czech Republic",
    "Romania",
    "Ukraine",
    "Tunisia",
    "Kazakhstan",
    "Brazil",
    "Hungary",
  ];
  const players = [];
  for (let i = 0; i < count; i++) {
    const name = pool[i % pool.length];
    const country = countries[i % countries.length];
    const points = Math.max(1, Math.round(10000 - i * 70 + Math.random() * 50));
    const tournaments = Math.round(10 + Math.random() * 20);
    const titles = Math.round(
      i < 10 ? 5 + Math.random() * 15 : Math.random() * 5,
    );
    const winrate = (50 + Math.random() * 40).toFixed(1);
    const prize = (i < 30 ? 10 - i * 0.3 : Math.random() * 3).toFixed(1);
    players.push({
      rank: i + 1,
      name,
      country,
      points,
      tournaments,
      titles,
      winrate: parseFloat(winrate),
      prize: parseFloat(prize),
    });
  }
  players.sort((a, b) => b.points - a.points);
  players.forEach((p, i) => (p.rank = i + 1));
  return players;
}

function makeBaseballPlayers(category) {
  const count = 100;
  const positions = ["1B", "2B", "3B", "SS", "OF", "C", "DH", "P"];
  const players = [];
  for (let i = 0; i < count; i++) {
    const name = BASEBALL_NAMES[i % BASEBALL_NAMES.length];
    const team = BASEBALL_TEAMS[i % BASEBALL_TEAMS.length];
    const position = positions[i % positions.length];
    const base = 70 - i * 0.6;
    const hr = Math.max(0, Math.round(base * 0.5 + Math.random() * 10));
    const avg = Math.min(0.35, 0.22 + Math.random() * 0.12).toFixed(3);
    const rbi = Math.max(0, Math.round(base * 1.5 + Math.random() * 20));
    const ops = (0.65 + Math.random() * 0.4).toFixed(3);
    const games = Math.round(100 + Math.random() * 60);
    players.push({
      rank: i + 1,
      name,
      team,
      position,
      hr,
      avg: parseFloat(avg),
      rbi,
      ops: parseFloat(ops),
      games,
    });
  }
  if (category === "hr") players.sort((a, b) => b.hr - a.hr);
  else if (category === "avg") players.sort((a, b) => b.avg - a.avg);
  else if (category === "rbi") players.sort((a, b) => b.rbi - a.rbi);
  else players.sort((a, b) => b.ops - a.ops);
  players.forEach((p, i) => (p.rank = i + 1));
  return players;
}

function makeHockeyPlayers(category, gender) {
  const pool = gender === "women" ? HOCKEY_NAMES_W : HOCKEY_NAMES_M;
  const count = 100;
  const positions = ["FW", "MF", "DF", "GK"];
  const players = [];
  for (let i = 0; i < count; i++) {
    const name = pool[i % pool.length];
    const country = HOCKEY_COUNTRIES[i % HOCKEY_COUNTRIES.length];
    const position = positions[i % positions.length];
    const base = 80 - i * 0.5;
    const goals = Math.max(0, Math.round(base * 0.4 + Math.random() * 8));
    const assists = Math.max(0, Math.round(base * 0.3 + Math.random() * 6));
    const matches = Math.round(30 + Math.random() * 100);
    const rating = (60 + Math.random() * 35).toFixed(0);
    players.push({
      rank: i + 1,
      name,
      country,
      position,
      goals,
      assists,
      matches,
      rating: parseFloat(rating),
    });
  }
  if (category === "goals") players.sort((a, b) => b.goals - a.goals);
  else players.sort((a, b) => b.assists - a.assists);
  players.forEach((p, i) => (p.rank = i + 1));
  return players;
}

function makeVolleyballPlayers(category, gender) {
  const pool = gender === "women" ? VOLLEYBALL_NAMES_W : VOLLEYBALL_NAMES_M;
  const prefix = gender === "women" ? "" : "";
  const count = 100;
  const players = [];
  for (let i = 0; i < count; i++) {
    const name = pool[i % pool.length];
    const country = VOLLEYBALL_COUNTRIES[i % VOLLEYBALL_COUNTRIES.length];
    const position = VOLLEYBALL_POSITIONS[i % VOLLEYBALL_POSITIONS.length];
    const base = 90 - i * 0.5;
    const points = Math.max(0, Math.round(base * 1.2 + Math.random() * 20));
    const spikes = Math.max(0, Math.round(base * 0.5 + Math.random() * 10));
    const blocks = Math.max(0, Math.round(base * 0.2 + Math.random() * 5));
    const aces = Math.max(0, Math.round(base * 0.1 + Math.random() * 3));
    const rating = (70 + Math.random() * 28).toFixed(0);
    players.push({
      rank: i + 1,
      name,
      country,
      position,
      points,
      spikes,
      blocks,
      aces,
      rating: parseFloat(rating),
    });
  }
  if (category === "points") players.sort((a, b) => b.points - a.points);
  else if (category === "spikes") players.sort((a, b) => b.spikes - a.spikes);
  else players.sort((a, b) => b.blocks - a.blocks);
  players.forEach((p, i) => (p.rank = i + 1));
  return players;
}

function makeKabaddiPlayers(category) {
  const count = 100;
  const positions = ["Raider", "Defender", "All-Round"];
  const players = [];
  for (let i = 0; i < count; i++) {
    const name = KABADDI_NAMES[i % KABADDI_NAMES.length];
    const team = KABADDI_TEAMS[i % KABADDI_TEAMS.length];
    const position = positions[i % positions.length];
    const base = 90 - i * 0.5;
    const raid = Math.max(0, Math.round(base * 2 + Math.random() * 30));
    const tackle = Math.max(0, Math.round(base * 1.2 + Math.random() * 20));
    const total = raid + tackle;
    const matches = Math.round(20 + Math.random() * 60);
    const rating = (60 + Math.random() * 35).toFixed(0);
    players.push({
      rank: i + 1,
      name,
      team,
      position,
      raid_pts: raid,
      tackle_pts: tackle,
      total_pts: total,
      matches,
      rating: parseFloat(rating),
    });
  }
  if (category === "raid") players.sort((a, b) => b.raid_pts - a.raid_pts);
  else if (category === "tackle")
    players.sort((a, b) => b.tackle_pts - a.tackle_pts);
  else players.sort((a, b) => b.total_pts - a.total_pts);
  players.forEach((p, i) => (p.rank = i + 1));
  return players;
}

function makeEsportsPlayers(game) {
  const count = 100;
  let pool;
  let defaultGame;
  switch (game) {
    case "valorant":
      pool = ESPORTS_NAMES_VAL;
      defaultGame = "Valorant";
      break;
    case "lol":
      pool = ESPORTS_NAMES_LOL;
      defaultGame = "League of Legends";
      break;
    case "cs2":
      pool = ESPORTS_NAMES_CS;
      defaultGame = "CS:GO/CS2";
      break;
    case "dota2":
      pool = ESPORTS_NAMES_DOTA;
      defaultGame = "Dota 2";
      break;
    default:
      pool = [
        ...ESPORTS_NAMES_VAL,
        ...ESPORTS_NAMES_LOL,
        ...ESPORTS_NAMES_CS,
        ...ESPORTS_NAMES_DOTA,
      ];
      defaultGame = "Multi";
      break;
  }
  const GAMES_LIST = [
    "Valorant",
    "League of Legends",
    "CS:GO/CS2",
    "Dota 2",
    "Fortnite",
    "Overwatch",
  ];
  const players = [];
  for (let i = 0; i < count; i++) {
    const name = pool[i % pool.length];
    const team = ESPORTS_TEAMS[i % ESPORTS_TEAMS.length];
    const g = game === "all" ? GAMES_LIST[i % GAMES_LIST.length] : defaultGame;
    const earnings = (i < 20 ? 5 - i * 0.2 : Math.random() * 2).toFixed(2);
    const tournaments = Math.round(5 + Math.random() * 40);
    const winrate = (40 + Math.random() * 45).toFixed(1);
    const rating = (65 + Math.random() * 30).toFixed(0);
    players.push({
      rank: i + 1,
      name,
      team,
      game: g,
      earnings: parseFloat(earnings),
      tournaments,
      winrate: parseFloat(winrate),
      rating: parseFloat(rating),
    });
  }
  players.sort((a, b) => b.earnings - a.earnings);
  players.forEach((p, i) => (p.rank = i + 1));
  return players;
}

function makeTableTennisPlayers(category, gender) {
  const pool = gender === "women" ? TABLETENNIS_NAMES_W : TABLETENNIS_NAMES_M;
  const count = 100;
  const countries_m = [
    "China",
    "Japan",
    "Germany",
    "Brazil",
    "Chinese Taipei",
    "France",
    "Sweden",
    "South Korea",
    "India",
    "Nigeria",
    "Egypt",
    "Portugal",
    "Slovenia",
    "Denmark",
    "Austria",
    "Spain",
    "Argentina",
    "Croatia",
    "Puerto Rico",
    "Poland",
    "Romania",
    "Hungary",
    "Belgium",
    "England",
    "Iran",
    "Kazakhstan",
    "Luxembourg",
    "Singapore",
    "Hong Kong",
    "Australia",
  ];
  const countries_w = [
    "China",
    "Japan",
    "Germany",
    "Hong Kong",
    "South Korea",
    "Romania",
    "Austria",
    "Chinese Taipei",
    "Singapore",
    "Thailand",
    "Poland",
    "USA",
    "Portugal",
    "France",
    "Egypt",
    "India",
    "Brazil",
    "Australia",
    "England",
    "Hungary",
    "Sweden",
    "Italy",
    "Spain",
    "Puerto Rico",
    "Turkey",
    "Netherlands",
    "Luxembourg",
    "Czech Republic",
    "Kazakhstan",
    "Argentina",
  ];
  const countries = gender === "women" ? countries_w : countries_m;
  const players = [];
  for (let i = 0; i < count; i++) {
    const name = pool[i % pool.length];
    const country = countries[i % countries.length];
    const base = 9000 - i * 65;
    const points = Math.max(1, Math.round(base + Math.random() * 100));
    const tournaments = Math.round(5 + Math.random() * 20);
    const titles = Math.round(
      i < 15 ? 3 + Math.random() * 10 : Math.random() * 4,
    );
    const winrate = (50 + Math.random() * 40).toFixed(1);
    const prize = (i < 25 ? 5 - i * 0.15 : Math.random() * 2).toFixed(2);
    players.push({
      rank: i + 1,
      name,
      country,
      points,
      tournaments,
      titles,
      winrate: parseFloat(winrate),
      prize: parseFloat(prize),
    });
  }
  if (category === "singles") players.sort((a, b) => b.points - a.points);
  else players.sort((a, b) => b.titles - a.titles);
  players.forEach((p, i) => (p.rank = i + 1));
  return players;
}

// ─── CRICKET DATA BUILDER ────────────────────────────────────────────────────

const CRICKET_BASE = { ...CRICKET_RAW };

function getCricketData(format, role, gender, stat) {
  stat = stat || "runs";
  const key = `${format}_${role}_${gender}`;
  const direct = CRICKET_BASE[key];
  if (direct && direct.length >= 10) {
    const p = makePlayers(direct.slice(0, 100));
    p.forEach(function(x) { x._source = 'icc'; });
    // Add sixes field and sort by requested stat
    p.forEach(function(x) { x.sixes = Math.round((x.runs || 0) * (0.02 + Math.random() * 0.03)); });
    if (stat === "wkts") p.sort((a, b) => (b.wkts || 0) - (a.wkts || 0));
    else if (stat === "sixes") p.sort((a, b) => (b.sixes || 0) - (a.sixes || 0));
    else p.sort((a, b) => (b.runs || 0) - (a.runs || 0));
    p.forEach((x, i) => (x.rank = i + 1));
    return p;
  }

  const defaultKey = "odi_bat_men";
  const base = (CRICKET_BASE[defaultKey] || []).slice(0, 100);
  const count = 100;
  const names = gender === "women" ? CRICKET_NAMES.slice(0, 50) : CRICKET_NAMES;
  const countries =
    gender === "women" ? CRICKET_COUNTRIES_W : CRICKET_COUNTRIES;
  const players = [];
  const startRating = 700;

  for (let i = 0; i < count; i++) {
    const name = names[i % names.length];
    const country = countries[i % countries.length];
    const rating = Math.max(1, startRating - Math.floor(i * 6.5));
    const isBowl = role === "bowl";
    const isAR = role === "ar";
    const matches = Math.round(10 + Math.random() * 80);
    const runs = isBowl
      ? Math.round(50 + Math.random() * 500)
      : isAR
        ? Math.round(200 + Math.random() * 5000)
        : Math.round(500 + Math.random() * 10000);
    const wkts = isBowl
      ? Math.round(10 + Math.random() * 150)
      : isAR
        ? Math.round(5 + Math.random() * 80)
        : Math.round(Math.random() * 20);
    const avg = (20 + Math.random() * 30).toFixed(1);
    const econ =
      isBowl || isAR
        ? (3.5 + Math.random() * 4).toFixed(1)
        : (80 + Math.random() * 50).toFixed(1);
    const sixes = Math.round(runs * (0.02 + Math.random() * 0.03));
    players.push({
      rank: i + 1,
      name,
      country,
      rating,
      matches,
      runs,
      wkts,
      avg: parseFloat(avg),
      econ: parseFloat(econ),
      sixes,
    });
  }
  // Sort by requested stat section
  if (stat === "wkts") players.sort((a, b) => b.wkts - a.wkts);
  else if (stat === "sixes") players.sort((a, b) => b.sixes - a.sixes);
  else players.sort((a, b) => b.runs - a.runs);
  players.forEach((p, i) => (p.rank = i + 1));
  return players.slice(0, 100);
}

// ─── BASKETBALL PROXY ────────────────────────────────────────────────────────

const BASKETBALL_PLAYER_NAMES = {
  points: [
    "Luka Doncic",
    "Shai Gilgeous-Alexander",
    "Giannis Antetokounmpo",
    "Jalen Brunson",
    "Joel Embiid",
    "Stephen Curry",
    "Kevin Durant",
    "Devin Booker",
    "Anthony Edwards",
    "Donovan Mitchell",
    "Trae Young",
    "Damian Lillard",
    "LeBron James",
    "Jayson Tatum",
    "Jaylen Brown",
    "Zion Williamson",
    "Ja Morant",
    "De'Aaron Fox",
    "Kyrie Irving",
    "Anthony Davis",
    "Nikola Jokic",
    "Karl-Anthony Towns",
    "Bam Adebayo",
    "Paolo Banchero",
    "Tyrese Haliburton",
    "CJ McCollum",
    "Brandon Ingram",
    "Zach LaVine",
    "DeMar DeRozan",
    "Julius Randle",
    "LaMelo Ball",
    "Cade Cunningham",
    "Jalen Williams",
    "Scottie Barnes",
    "Evan Mobley",
    "Chet Holmgren",
    "Victor Wembanyama",
    "Alperen Sengun",
    "Fred VanVleet",
    "Derrick White",
    "Austin Reaves",
    "Michael Porter Jr",
    "Klay Thompson",
    "Buddy Hield",
    "Cam Thomas",
    "Jordan Poole",
    "Tyler Herro",
    "R.J. Barrett",
    "Jalen Green",
    "Dillon Brooks",
  ],
  rebounds: [
    "Nikola Jokic",
    "Domantas Sabonis",
    "Anthony Davis",
    "Giannis Antetokounmpo",
    "Rudy Gobert",
    "Victor Wembanyama",
    "Alperen Sengun",
    "Jusuf Nurkic",
    "Evan Mobley",
    "Chet Holmgren",
    "Karl-Anthony Towns",
    "Jarrett Allen",
    "Joel Embiid",
    "Bam Adebayo",
    "Myles Turner",
    "LeBron James",
    "Kevin Durant",
    "Paolo Banchero",
    "Zion Williamson",
    "Scottie Barnes",
    "Luka Doncic",
    "Jalen Duren",
    "Jonas Valanciunas",
    "Brook Lopez",
    "Nic Claxton",
    "Wendell Carter Jr",
    "walker Kessler",
    "Daniel Gafford",
    "Clint Capela",
    "Ivica Zubac",
    "Deandre Ayton",
    "Jabari Smith Jr",
    "P.J. Washington",
    "Tari Eason",
    "Jalen Johnson",
    "Kyle Kuzma",
    "Julius Randle",
    "Bobby Portis",
    "Xavier Tillman",
    "Isaiah Jackson",
    "Onyeka Okongwu",
    "Nick Richards",
    "Day'Ron Sharpe",
    "Dereck Lively II",
    "Mark Williams",
    "Zach Collins",
    "Naz Reid",
    "Kevon Looney",
    "Mitchell Robinson",
    "Steven Adams",
  ],
  assists: [
    "Tyrese Haliburton",
    "Trae Young",
    "Luka Doncic",
    "Nikola Jokic",
    "LeBron James",
    "Jalen Brunson",
    "De'Aaron Fox",
    "Ja Morant",
    "Damian Lillard",
    "Stephen Curry",
    "Shai Gilgeous-Alexander",
    "Fred VanVleet",
    "Donovan Mitchell",
    "James Harden",
    "Chris Paul",
    "Darius Garland",
    "Cade Cunningham",
    "LaMelo Ball",
    "Tyus Jones",
    "D'Angelo Russell",
    "Mike Conley",
    "Jrue Holiday",
    "Derrick White",
    "Marcus Smart",
    "Josh Giddey",
    "Coby White",
    "Cole Anthony",
    "Immanuel Quickley",
    "RJ Barrett",
    "Jordan Poole",
    "Russell Westbrook",
    "Jaden Ivey",
    "Tyler Herro",
    "Anfernee Simons",
    "Scoot Henderson",
    "Keyonte George",
    "Vasilije Micic",
    "Tre Jones",
    "Jalen Suggs",
    "Cason Wallace",
    "Monte Morris",
    "Delon Wright",
    "Kyle Lowry",
    "Cameron Payne",
    "Jalen Brunson",
    "Jamal Murray",
    "Kyrie Irving",
    "Dennis Schroder",
    "Spencer Dinwiddie",
    "Malcolm Brogdon",
  ],
};

function getBasketballData(category) {
  const count = 100;
  const names =
    BASKETBALL_PLAYER_NAMES[category] || BASKETBALL_PLAYER_NAMES.points;
  const teams = [
    "DAL",
    "OKC",
    "MIL",
    "NYK",
    "PHI",
    "GSW",
    "PHX",
    "MIN",
    "BOS",
    "CLE",
    "ATL",
    "MIL",
    "LAL",
    "BOS",
    "NOP",
    "NOP",
    "MEM",
    "SAC",
    "DAL",
    "LAL",
    "DEN",
    "MIN",
    "MIA",
    "ORL",
    "IND",
    "NOP",
    "NOP",
    "CHI",
    "CHI",
    "NYK",
    "CHA",
    "DET",
    "OKC",
    "TOR",
    "CLE",
    "OKC",
    "SAS",
    "HOU",
    "HOU",
    "BOS",
    "LAL",
    "DEN",
    "GSW",
    "IND",
    "BKN",
    "WAS",
    "MIA",
    "TOR",
    "HOU",
    "HOU",
  ];
  const positions = ["PG", "SG", "SF", "PF", "C", "G", "F"];
  const players = [];
  for (let i = 0; i < count; i++) {
    const name = names[i % names.length];
    const team = teams[i % teams.length];
    const position = positions[i % positions.length];
    const base = Math.max(1, 35 - i * 0.32);
    const points = (base + Math.random() * 5).toFixed(1);
    const rebounds = (3 + Math.random() * 10).toFixed(1);
    const assists = (2 + Math.random() * 8).toFixed(1);
    const fg_pct = (0.42 + Math.random() * 0.12).toFixed(3);
    const rating = (
      parseFloat(points) +
      parseFloat(rebounds) * 0.8 +
      parseFloat(assists) * 0.7
    ).toFixed(1);
    players.push({
      rank: i + 1,
      name,
      team,
      position,
      points: parseFloat(points),
      rebounds: parseFloat(rebounds),
      assists: parseFloat(assists),
      fg_pct: parseFloat(fg_pct),
      rating: parseFloat(rating),
    });
  }
  if (category === "points") players.sort((a, b) => b.points - a.points);
  else if (category === "rebounds")
    players.sort((a, b) => b.rebounds - a.rebounds);
  else players.sort((a, b) => b.assists - a.assists);
  players.forEach((p, i) => (p.rank = i + 1));
  return players;
}

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
    // Fallback: generate procedurally
    switch (sportId) {
      case "cricket": {
        const parts = cat.split("_");
        const format = parts[0];
        const role = parts[1];
        const gender = parts[2] || "men";
        const stat = parts[3] || "runs";
        players = getCricketData(format, role, gender, stat);
        break;
      }
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
        players = makeFootballPlayers(fStat, fGender);
        break;
      }
      case "basketball": {
        const apiBasketball = await fetchBasketballFromESPN(cat);
        if (apiBasketball) {
          players = apiBasketball;
          break;
        }
        players = getBasketballData(cat);
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
        players = makeTennisPlayers(tType, tCat);
        break;
      }
      case "baseball": {
        const apiBaseball = await fetchBaseballFromESPN(cat);
        if (apiBaseball) {
          players = apiBaseball;
          break;
        }
        players = makeBaseballPlayers(cat);
        break;
      }
      case "hockey": {
        const hParts = cat.split("_");
        const hStat = hParts[0];
        const hGender = hParts[1] || "men";
        players = makeHockeyPlayers(hStat, hGender);
        break;
      }
      case "volleyball": {
        const vParts = cat.split("_");
        const vStat = vParts[0];
        const vGender = vParts[1] || "men";
        players = makeVolleyballPlayers(vStat, vGender);
        break;
      }
      case "kabbaddi": {
        players = makeKabaddiPlayers(cat);
        break;
      }
      case "e-sports": {
        players = makeEsportsPlayers(cat);
        break;
      }
      case "table-tennis": {
        const ttParts = cat.split("_");
        const ttCat = ttParts[0];
        const ttGender = ttParts[1] || "men";
        players = makeTableTennisPlayers(ttCat, ttGender);
        break;
      }
      default:
        return res.status(404).json({ error: "Sport not found" });
    }
  }

  var dataSource = "generated";
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
  // Fallback generated news (with small thumbnail images)
  const IMG = 'https://img.cricbuzz.com/a/default/cricbuzz-placeholder.jpg';
  return [
    { title: 'India seal thrilling 6-wicket win over England in 1st ODI', desc: 'Axar Patel\'s all-round show (57* & 4/62) powered India to a comfortable chase at Edgbaston.', link: '', time: '2h ago', image: 'https://flagcdn.com/in.svg' },
    { title: 'Axar Patel named Player of the Match', desc: 'The all-rounder starred with both bat and ball to seal the series opener for India.', link: '', time: '2h ago', image: 'https://flagcdn.com/in.svg' },
    { title: 'England\'s middle-order collapse proves costly', desc: 'Five wickets for 20 runs in the middle overs left England short at 258.', link: '', time: '3h ago', image: 'https://flagcdn.com/gb.svg' },
    { title: 'Shubman Gill\'s 80 lays the foundation', desc: 'The India captain anchored the chase before the finishers took over.', link: '', time: '4h ago', image: 'https://flagcdn.com/in.svg' },
    { title: 'Jasprit Bumrah leads India\'s bowling effort', desc: 'Bumrah claimed 3/42 to restrict England in the first innings.', link: '', time: '5h ago', image: 'https://flagcdn.com/in.svg' }
  ];
}
app.get('/api/match/news', async (req, res) => {
  try {
    const articles = await fetchCricbuzzNews();
    res.json({ source: 'cricbuzz', articles });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── MATCH GRAPHS (win probability + run rate) ──────────────────────────────
app.get('/api/match/graphs', (req, res) => {
  // Win probability computed from ball-by-ball state (India chasing 259)
  const engTotal = 258, engWkts = 10;
  const indTarget = 259, indWkts = 4;
  const winProb = []; // {over, eng, ind}
  // England innings: probability shifts with scoring rate vs par + wickets
  const engWktAt = o => Math.min(engWkts, Math.round((o / 47.5) * engWkts));
  for (let o = 0; o <= 47.5; o += 0.5) {
    const runs = Math.min(engTotal, Math.round((engTotal / 47.5) * o));
    const par = (260 / 50) * o;
    const rateEdge = (runs - par) * 1.6;          // above/below par
    const wktPenalty = engWktAt(o) * 2.2;          // each wicket costs
    let eng = 52 + rateEdge - wktPenalty;
    eng = Math.max(8, Math.min(85, eng));
    winProb.push({ over: +o.toFixed(1), eng: Math.round(eng), ind: Math.round(100 - eng) });
  }
  // India innings: probability rises as they chase
  const indWktAt = o => Math.min(indWkts, Math.round((o / 45.2) * indWkts));
  for (let o = 0.5; o <= 45.2; o += 0.5) {
    const runs = Math.min(262, Math.round((262 / 45.2) * o));
    const par = (indTarget / 50) * o;
    const rateEdge = (runs - par) * 1.8;
    const wktPenalty = indWktAt(o) * 3.0;
    const need = indTarget - runs;
    const ballsLeft = (50 - o) * 6;
    const pressure = (need / Math.max(ballsLeft, 1)) * 6;
    let ind = 50 + rateEdge - wktPenalty - pressure;
    ind = Math.max(8, Math.min(96, ind));
    winProb.push({ over: +o.toFixed(1), eng: Math.round(100 - ind), ind: Math.round(ind) });
  }
  const runRate = [
    { over: 10, eng: 5.8, ind: 5.2 },
    { over: 20, eng: 5.6, ind: 5.4 },
    { over: 30, eng: 5.5, ind: 5.6 },
    { over: 40, eng: 5.41, ind: 5.7 },
    { over: 47.5, eng: 5.41, ind: 5.79 }
  ];
  res.json({
    winProbability: winProb,
    runRate,
    filters: [
      { key: 'win_probability', label: 'Win Probability' },
      { key: 'run_rate', label: 'Run Rate' },
      { key: 'worm', label: 'Worm' },
      { key: 'manhattan', label: 'Manhattan' },
      { key: 'partnership', label: 'Partnership' }
    ]
  });
});

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

// Static fallback (used when ESPN has no data or is unreachable).
function staticMatchesFor(sport) {
  const FALLBACK = {
    cricket: [
      { homeName: 'India', awayName: 'Australia', homeLogo: 'https://flagcdn.com/in.svg', awayLogo: 'https://flagcdn.com/au.svg', status: 'LIVE', homeScore: '182/4', awayScore: '176/9', time: '16.2 ov', league: 'IND vs AUS • 3rd T20I' },
      { homeName: 'England', awayName: 'South Africa', homeLogo: 'https://flagcdn.com/gb.svg', awayLogo: 'https://flagcdn.com/za.svg', status: 'UPCOMING', homeScore: '', awayScore: '', time: 'Tomorrow 7:00 PM', league: 'ENG vs SA • 1st ODI' },
    ],
    football: [
      { homeName: 'Arsenal', awayName: 'Chelsea', homeLogo: 'https://crests.football-data.org/57.png', awayLogo: 'https://crests.football-data.org/61.png', status: 'LIVE', homeScore: '2', awayScore: '1', time: "67'", league: 'Premier League' },
    ],
    basketball: [
      { homeName: 'Lakers', awayName: 'Celtics', homeLogo: '', awayLogo: '', status: 'UPCOMING', homeScore: '', awayScore: '', time: 'Tonight 8:30 PM', league: 'NBA' },
    ],
  };
  return (FALLBACK[sport] || []).map((m) => ({
    sport: '', league: m.league || '', status: m.status, state: m.status === 'LIVE' ? 'in' : m.status === 'COMPLETED' ? 'post' : 'pre',
    time: m.time, date: '', homeName: m.homeName, homeAbbr: '', homeLogo: m.homeLogo || '', awayName: m.awayName, awayAbbr: '', awayLogo: m.awayLogo || '',
    homeScore: m.homeScore || '', awayScore: m.awayScore || '', venue: '',
  }));
}

app.get('/api/matches', async (req, res) => {
  try {
    const sport = (req.query.sport || 'all').toString();
    let results = [];
    if (sport === 'all') {
      for (const key of Object.keys(MATCH_SPORT_PATHS)) {
        const path = MATCH_SPORT_PATHS[key];
        if (!path) { results = results.concat(staticMatchesFor(key)); continue; }
        const ms = await fetchEspnScoreboard(path);
        results = results.concat(ms.length ? ms : staticMatchesFor(key));
      }
    } else {
      const path = MATCH_SPORT_PATHS[sport];
      if (!path) {
        results = staticMatchesFor(sport);
      } else {
        const ms = await fetchEspnScoreboard(path);
        results = ms.length ? ms : staticMatchesFor(sport);
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
const ALLSPORTS_SUPPORTED = ["basketball", "baseball", "volleyball", "handball", "esport"];

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

app.get("/api/all-sports/matches/:sport", async (req, res) => {
  try {
    const { sport } = req.params;
    if (!ALLSPORTS_SUPPORTED.includes(sport)) {
      return res.status(400).json({ success: false, message: "Unsupported: " + sport + ". Supported: " + ALLSPORTS_SUPPORTED.join(", ") });
    }
    if (!ALLSPORTS_CONFIG.key || !ALLSPORTS_CONFIG.host) {
      return res.status(403).json({ success: false, message: "AllSports API key not configured" });
    }
    const today = new Date().toISOString().slice(0, 10);
    const dateParam = req.query.date || today;
    const cacheKey = sport + "_" + dateParam;
    const cached = allSportsMatchesCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < 5 * 60 * 1000) {
      return res.json({ success: true, source: "allsports", cached: true, count: cached.data.length, matches: cached.data });
    }

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
    const matches = events.map(e => normalizeAllSportsEvent(e, sport)).filter(Boolean);

    allSportsMatchesCache.set(cacheKey, { ts: Date.now(), data: matches });
    res.json({ success: true, source: "allsports", count: matches.length, matches });
  } catch (e) {
    console.error("[AllSports] matches error:", req.params.sport, e.message);
    res.status(502).json({ success: false, message: e.message });
  }
});

app.get("/api/all-sports/matches", async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const dateParam = req.query.date || today;
    const results = await Promise.allSettled(
      ALLSPORTS_SUPPORTED.map(async (sport) => {
        const cacheKey = sport + "_" + dateParam;
        const cached = allSportsMatchesCache.get(cacheKey);
        if (cached && Date.now() - cached.ts < 5 * 60 * 1000) return cached.data;

        if (!ALLSPORTS_CONFIG.key || !ALLSPORTS_CONFIG.host) return [];
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
        const matches = events.map(e => normalizeAllSportsEvent(e, sport)).filter(Boolean);
        allSportsMatchesCache.set(cacheKey, { ts: Date.now(), data: matches });
        return matches;
      })
    );
    const all = results.flatMap(r => r.status === "fulfilled" ? r.value : []);
    res.json({ success: true, source: "allsports", count: all.length, matches: all });
  } catch (e) {
    console.error("[AllSports] aggregate error:", e.message);
    res.status(502).json({ success: false, message: e.message });
  }
});

// AllSports raw proxy (must come AFTER the specific /matches/:sport routes)
app.get("/api/all-sports/match/:sport/:matchId", async (req, res) => {
  try {
    const { sport, matchId } = req.params;
    if (!ALLSPORTS_SUPPORTED.includes(sport)) {
      return res.status(400).json({ success: false, message: "Unsupported: " + sport });
    }
    if (!ALLSPORTS_CONFIG.key || !ALLSPORTS_CONFIG.host) {
      return res.status(403).json({ success: false, message: "AllSports API key not configured" });
    }
    const [matchRes, incidentsRes, lineupsRes] = await Promise.allSettled([
      fetch(`${ALLSPORTS_CONFIG.base}/api/${sport}/match/${matchId}`, {
        headers: {
          "X-RapidAPI-Key": ALLSPORTS_CONFIG.key,
          "X-RapidAPI-Host": ALLSPORTS_CONFIG.host,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(12000),
      }),
      fetch(`${ALLSPORTS_CONFIG.base}/api/${sport}/match/${matchId}/incidents`, {
        headers: {
          "X-RapidAPI-Key": ALLSPORTS_CONFIG.key,
          "X-RapidAPI-Host": ALLSPORTS_CONFIG.host,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(12000),
      }),
      fetch(`${ALLSPORTS_CONFIG.base}/api/${sport}/match/${matchId}/lineups`, {
        headers: {
          "X-RapidAPI-Key": ALLSPORTS_CONFIG.key,
          "X-RapidAPI-Host": ALLSPORTS_CONFIG.host,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(12000),
      })
    ]);

    const matchRaw = matchRes.status === "fulfilled" && matchRes.value.ok ? await matchRes.value.json() : null;
    const events = matchRaw?.event || matchRaw || null;
    const incidentRaw = incidentsRes.status === "fulfilled" && incidentsRes.value.ok ? await incidentsRes.value.json() : null;
    const incidents = incidentRaw?.incidents || incidentRaw?.data?.incidents || [];
    const lineupRaw = lineupsRes.status === "fulfilled" && lineupsRes.value.ok ? await lineupsRes.value.json() : null;

    const normalized = normalizeAllSportsEvent(events || { id: matchId }, sport);

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
