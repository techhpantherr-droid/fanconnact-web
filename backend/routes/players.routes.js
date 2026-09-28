const express = require("express");
const router = express.Router();
const rankingsProvider =
require("../providers/cricbuzz/rankings.provider");

const cacheManager = require("../cache/cacheManager");

const players =
require("../providers/cricbuzz/players.provider");

const { normalizePlayer } =
require("../normalizers/playerNormalizer");

const fs = require("fs");
const path = require("path");

const SYNCED_PLAYERS_PATH = path.join(__dirname, "..", "..", "data", "player-rankings.json");

/* ==========================================
        FREE SOURCE FALLBACK (synced data)
        Real player records collected by
        rankings-sync from ESPN / FIFA / ICC
        etc. Used when the RapidAPI Cricbuzz
        provider is down or quota exhausted.
========================================== */

function loadSyncedPlayers() {
    try {
        return JSON.parse(fs.readFileSync(SYNCED_PLAYERS_PATH, "utf8"));
    } catch (e) {
        return {};
    }
}

function findSyncedPlayer(name, id) {
    const db = loadSyncedPlayers();
    const wanted = String(name || "").toLowerCase().trim();
    for (const [sport, cats] of Object.entries(db)) {
        if (!cats || typeof cats !== "object") continue;
        for (const [cat, list] of Object.entries(cats)) {
            if (!Array.isArray(list)) continue;
            for (const rec of list) {
                if (!rec || typeof rec !== "object") continue;
                const recName = String(rec.name || rec.player || "").toLowerCase().trim();
                const recId = String(rec.playerId ?? rec.id ?? rec.pid ?? rec.player_id ?? "");
                const nameHit = wanted && recName === wanted;
                const idHit = id && (recId === String(id) || recName && String(recName).includes(String(id).toLowerCase()));
                if (nameHit || idHit) return { sport, category: cat, rec };
            }
        }
    }
    return null;
}

function profileFromSynced(found) {
    const rec = found.rec;
    const statKeys = Object.keys(rec).filter(k =>
        !["rank", "name", "team", "country", "position", "_source", "playerId", "id", "pid", "player_id", "image", "rating"].includes(k)
    );
    const stats = {};
    statKeys.forEach(k => { stats[k] = rec[k]; });
    const rating = rec.rating || rec.points || 0;
    return {
        success: true,
        _fallback: "sync",
        _source: rec._source || null,
        id: "sync:" + rec.name,
        name: rec.name,
        basic: {
            id: "sync:" + rec.name,
            name: rec.name,
            image: rec.image || "",
            country: rec.country || "",
            team: rec.team || "",
            role: rec.position || "",
            rank: rec.rank ?? null,
            rating,
            battingStyle: rec._source ? "Source: " + rec._source : ""
        },
        career: { stats },
        stats,
        profile: { rank: rec.rank ?? null, rating },
        sport: found.sport,
        category: found.category,
        rank: rec.rank ?? null,
        rating,
        ranking: { rank: rec.rank ?? null, rating }
    };
}


/* ==========================================
        TRENDING PLAYERS
========================================== */

router.get("/trending", async (req, res) => {

    try {

        const data = await cacheManager.getOrCreate(

            "PLAYERS_TRENDING",

            1800,

            () => players.getTrendingPlayers()

        );

        res.json(data);

    }

    catch (err) {

        console.error(err);

        res.status(500).json({

            success: false,

            message: "Unable to fetch players"

        });

    }

});

/* ==========================================
        SEARCH PLAYERS
========================================== */

router.get("/search", async (req, res) => {

    try {

        const search = (req.query.name || "").trim();

        const key = `PLAYER_SEARCH_${search.toLowerCase()}`;

        const data = await cacheManager.getOrCreate(

            key,

            900,

            () => players.searchPlayers(search)

        );

        res.json(data);

    }

    catch (err) {

        console.error(err);

        res.status(500).json({

            success: false,

            message: "Search failed"

        });

    }

});

router.get(
"/resolve/:name",

async (req,res)=>{

try{

let id;

try {

id = await players.resolvePlayerId(
req.params.name
);

}
catch (e) {

console.warn("[players/resolve] Cricbuzz failed, using synced data:", e.message);

}

if (id) {

return res.json({

success:true,
id

});

}

const found = findSyncedPlayer(req.params.name);

if (found) {

return res.json({

success:true,

id: "sync:" + found.rec.name,

name: found.rec.name,

sport: found.sport,

_source: found.rec._source || "synced"

});

}

return res.status(404).json({

success:false

});

}

catch(err){

console.warn("[players/resolve] unexpected error:", err.message);

res.status(404).json({

success:false

});

}

});
/* ==========================================
        PLAYER INFO
========================================== */

router.get("/:id", async (req, res) => {

    try {

        const key = `PLAYER_INFO_${req.params.id}`;

        const data = await cacheManager.getOrCreate(

            key,

            3600,

            () => players.getPlayerInfo(req.params.id)

        );

        res.json(data);

    }

    catch (err) {

        console.error(err);

        res.json({

            success: false,

            data: null,

            notice: "Player details are temporarily unavailable (free daily API limit reached). Try again once the limit resets.",

            message: "Unable to fetch player"

        });

    }

});


/* ==========================================
        PLAYER BATTING
========================================== */

router.get("/:id/batting", async (req, res) => {

    try {

        const key = `PLAYER_BATTING_${req.params.id}`;

        const data = await cacheManager.getOrCreate(

            key,

            86400,

            () => players.getPlayerBatting(req.params.id)

        );

        res.json(data);

    }

    catch (err) {

        console.error(err);

        res.status(500).json({

            success: false,

            message: "Unable to fetch batting stats"

        });

    }

});

/* ==========================================
        PLAYER BOWLING
========================================== */

router.get("/:id/bowling", async (req, res) => {

    try {

        const key = `PLAYER_BOWLING_${req.params.id}`;

        const data = await cacheManager.getOrCreate(

            key,

            86400,

            () => players.getPlayerBowling(req.params.id)

        );

        res.json(data);

    }

    catch (err) {

        console.error(err);

        res.status(500).json({

            success: false,

            message: "Unable to fetch bowling stats"

        });

    }

});

/* ==========================================
        PLAYER CAREER
========================================== */

router.get("/:id/career", async (req, res) => {

    try {

        const key = `PLAYER_CAREER_${req.params.id}`;

        const data = await cacheManager.getOrCreate(

            key,

            86400,

            () => players.getPlayerCareer(req.params.id)

        );

        res.json(data);

    }

    catch (err) {

        console.warn("[players/career] failed:", err.message);

        res.status(404).json({

            success: false,

            message: "Career data unavailable"

        });

    }

});

/* ==========================================
        PLAYER NEWS
========================================== */

router.get("/:id/news", async (req, res) => {

    try {

        const key = `PLAYER_NEWS_${req.params.id}`;

        const data = await cacheManager.getOrCreate(

            key,

            1800,

            () => players.getPlayerNews(req.params.id)

        );

        res.json(data);

    }

    catch (err) {

        console.warn("[players/news] failed:", err.message);

        res.status(404).json({

            success: false,

            message: "Player news unavailable"

        });

    }

});

router.get("/:id/profile", async (req, res) => {

    try {

    const { id } = req.params;

    // Free-source fallback: "sync:" ids resolve straight from player-rankings.json
    if (String(id).indexOf("sync:") === 0) {
        const found = findSyncedPlayer(id.replace(/^sync:/, ""));
        if (found) return res.json(profileFromSynced(found));
        return res.status(404).json({ success: false, message: "Player not found" });
    }

    const key = `PLAYER_PROFILE_${id}`;

    const player = await cacheManager.getOrCreate(

        key,

        3600,

        async () => {

           const [

info,

batting,

bowling,

career,

news,

profile

] = await Promise.allSettled([

players.getPlayerInfo(id),

players.getPlayerBatting(id),

players.getPlayerBowling(id),

players.getPlayerCareer(id),

players.getPlayerNews(id),

players.getPlayerProfile(id)

]);

const playerData = {

info:
info.status==="fulfilled"
?info.value:{},

batting:
batting.status==="fulfilled"
?batting.value:{},

bowling:
bowling.status==="fulfilled"
?bowling.value:{},

career:
career.status==="fulfilled"
?career.value:{},

news:
news.status==="fulfilled"
?news.value:[],

profile:
profile.status==="fulfilled"
?profile.value:{}

};
        const player = normalizePlayer(playerData);

player.profile = playerData.profile || {};

player.rank =
    player.profile.rank ||
    player.profile.worldRank ||
    player.profile.position ||
    null;

player.rating =
    player.profile.rating ||
    player.profile.points ||
    player.profile.value ||
    null;

player.ranking = {
    rank: player.rank,
    rating: player.rating
};

return player;

        }

    );

    // Empty shell returned by Cricbuzz while it is down / quota-exhausted:
    // fall back to the real synced record before giving up.
    const shellName = String(player?.basic?.name || player?.name || "").trim();
    if (!shellName) {
        const found = findSyncedPlayer("", id);
        if (found) return res.json(profileFromSynced(found));
        return res.status(404).json({ success: false, message: "Player data unavailable" });
    }

    res.json(player);

}

    catch(err){

        console.warn("[players/profile] failed:", err.message);

        const found = findSyncedPlayer("", req.params.id);

        if (found) return res.json(profileFromSynced(found));

        res.status(404).json({

            success:false,

            message:"Player data unavailable."

        });

    }

});

module.exports = router;