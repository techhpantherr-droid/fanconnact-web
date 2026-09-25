const express = require("express");
const router = express.Router();

const rankings =
require("../providers/cricbuzz/rankings.provider");

const cacheManager = require("../cache/cacheManager");

router.get("/batsmen", async (req, res) => {

    try {

        const format = req.query.format || "t20";
        const women = req.query.women || 0;

        const key = `RANKINGS_BATSMEN_${format}_${women}`;

        const data = await cacheManager.getOrCreate(

            key,

            3600,

            () => rankings.getBatsmen(format, women)

        );

        res.json(data);

    }

    catch (err) {

        console.error(err);

        res.status(500).json({

            success: false,

            message: "Unable to fetch batsmen rankings"

        });

    }

});


router.get("/bowlers", async (req, res) => {

    try {

        const format = req.query.format || "t20";
        const women = req.query.women || 0;

        const key = `RANKINGS_BOWLERS_${format}_${women}`;

        const data = await cacheManager.getOrCreate(

            key,

            3600,

            () => rankings.getBowlers(format, women)

        );

        res.json(data);

    }

    catch (err) {

        console.error(err);

        res.status(500).json({

            success: false,

            message: "Unable to fetch bowlers rankings"

        });

    }

});

router.get("/allrounders", async (req, res) => {

    try {

        const format = req.query.format || "t20";
        const women = req.query.women || 0;

        const key = `RANKINGS_ALLROUNDERS_${format}_${women}`;

        const data = await cacheManager.getOrCreate(

            key,

            3600,

            () => rankings.getAllRounders(format, women)

        );

        res.json(data);

    }

    catch (err) {

        console.error(err);

        res.status(500).json({

            success: false,

            message: "Unable to fetch all-rounders rankings"

        });

    }

});
const fs = require("fs");
const path = require("path");

const TEAM_RANKINGS_PATH = path.join(__dirname, "..", "..", "data", "team-rankings.json");

function loadSyncedTeamRankings() {
    try {
        return JSON.parse(fs.readFileSync(TEAM_RANKINGS_PATH, "utf8"));
    } catch (e) {
        return {};
    }
}

// Cricket T20I aliases: the frontend sends format=t20 for the T20I category.
const CRICKET_FORMAT_ALIASES = {
    test: ["test"],
    odi: ["odi"],
    t20: ["t20", "t20i"]
};

router.get("/teams", async (req, res) => {

    try {

        const format = String(req.query.format || "t20").toLowerCase().trim();
        const women = String(req.query.women || "0") === "1";
        const gender = women ? "Women" : "Men";

        const db = loadSyncedTeamRankings();

        // Resolve the requested format -> sport + category across the real
        // synced rankings (ICC cricket, FIH hockey, FIFA football, ESPN NBA,
        // ATP/WTA tennis, etc.). The frontend sends the category lowercased
        // (e.g. "fih pro league", "pro kabaddi", "nba").
        let matchSport = null;
        let matchCategory = null;

        for (const [sportId, sport] of Object.entries(db)) {
            if (!sport || typeof sport !== "object" || !sport.categories || !sport.rankings) continue;
            const candidates = sportId === "cricket"
                ? (CRICKET_FORMAT_ALIASES[format] || [format])
                : [format];
            const hit = (sport.categories || []).find(c =>
                candidates.some(cand => String(c).toLowerCase() === cand)
            );
            if (hit) {
                matchSport = sportId;
                matchCategory = hit;
                break;
            }
        }

        // Cricket first: prefer the live Cricbuzz API (real-time source of
        // truth) when it is reachable, otherwise fall through to synced data.
        if (matchSport === "cricket") {
            try {
                const data = await cacheManager.getOrCreate(
                    `RANKINGS_TEAMS_${format}_${women ? 1 : 0}`,
                    3600,
                    () => rankings.getTeams(format, women ? 1 : 0)
                );
                const list = Array.isArray(data) ? data : (Array.isArray(data?.rankings) ? data.rankings : []);
                if (list.length) return res.json(list);
                console.warn("[rankings/teams] live Cricbuzz empty, using synced ICC data");
            } catch (err) {
                console.warn("[rankings/teams] live Cricbuzz failed, using synced ICC data:", err.message);
            }
        }

        // Serve the real synced data (populated by rankings-sync from the
        // official ICC / FIH / FIFA / ESPN / ATP sources every 6 hours).
        if (matchSport && matchCategory) {
            const sport = db[matchSport];
            const rows = sport?.rankings?.[gender]?.[matchCategory] || [];
            const teams = rows.map(t => { if (t._source) { const o = {}; for (const k of Object.keys(t)) if (k !== "_source") o[k] = t[k]; return o; } return t; });
            return res.json(teams);
        }

        res.status(404).json({
            success: false,
            message: "No team rankings found for format: " + format
        });

    }

    catch (err) {

        console.error(err);

        res.status(500).json({

            success: false,

            message: "Unable to fetch team rankings"

        });

    }

});

router.get("/cricket/:key", async (req, res) => {
  try {
    const key = req.params.key;

    const [format, role, gender] = key.split("_");

    const women = gender === "women" ? 1 : 0;

    const cacheKey = `CRICKET_${format}_${role}_${women}`;

    const players = await cacheManager.getOrCreate(

      cacheKey,

      3600, // 1 Hour Cache

      async () => {

    let rankingsData = [];

    switch (role) {

        case "bat":

            rankingsData =
                await rankings.getBatsmen(
                    format,
                    women
                );

            break;

        case "bowl":

            rankingsData =
                await rankings.getBowlers(
                    format,
                    women
                );

            break;

        case "ar":

            rankingsData =
                await rankings.getAllRounders(
                    format,
                    women
                );

            break;

        default:

            rankingsData = [];

    }

    return rankingsData;

}

    );
res.json({

    success: true,

    source: "icc",

    total:

        Array.isArray(players)

            ? players.length

            : 0,

    players:

        Array.isArray(players)

            ? players

            : [],

    cached: true,

    _lastSync: new Date().toISOString()

});

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      message: "Unable to fetch rankings"
    });

  }
});
module.exports = router;