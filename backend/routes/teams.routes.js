const express = require("express");
const router = express.Router();

const teamsProvider = require("../providers/cricbuzz/teams.provider");

const cacheManager = require("../cache/cacheManager");
/* ==========================================
        INTERNATIONAL
========================================== */
router.get("/international", async (req, res) => {

    try {

        const data = await cacheManager.getOrCreate(

            "TEAMS_INTERNATIONAL",

            86400,

            () => teamsProvider.getInternationalTeams()

        );

        res.json(data);

    } catch (err) {

        console.error(err);

        res.json({

            success: true,

            teams: [],

            notice: "Team list temporarily unavailable (free daily API limit reached).",

        });

    }

});

/* ==========================================
        LEAGUE
========================================== */
router.get("/league", async (req, res) => {

    try {

        const data = await cacheManager.getOrCreate(

            "TEAMS_LEAGUE",

            86400,

            () => teamsProvider.getLeagueTeams()

        );

        res.json(data);

    } catch (err) {

        console.error(err);

        res.json({

            success: true,

            teams: [],

            notice: "Team list temporarily unavailable (free daily API limit reached).",

        });

    }

});

/* ==========================================
        DOMESTIC
========================================== */
router.get("/domestic", async (req, res) => {

    try {

        const data = await cacheManager.getOrCreate(

            "TEAMS_DOMESTIC",

            86400,

            () => teamsProvider.getDomesticTeams()

        );

        res.json(data);

    } catch (err) {

        console.error(err);

        res.json({

            success: true,

            teams: [],

            notice: "Team list temporarily unavailable (free daily API limit reached).",

        });

    }

});
/* ==========================================
        WOMEN
========================================== */
router.get("/women", async (req, res) => {

    try {

        const data = await cacheManager.getOrCreate(

            "TEAMS_WOMEN",

            86400,

            () => teamsProvider.getWomenTeams()

        );

        res.json(data);

    } catch (err) {

        console.error(err);

        res.json({

            success: true,

            teams: [],

            notice: "Team list temporarily unavailable (free daily API limit reached).",

        });

    }

});
/* ==========================================
        TEAM SCHEDULE
========================================== */
router.get("/:id/schedule", async (req, res) => {

    try {

        const key = `TEAM_SCHEDULE_${req.params.id}`;

        const data = await cacheManager.getOrCreate(

            key,

            1800,

            () => teamsProvider.getTeamSchedule(req.params.id)

        );

        res.json(data);

    } catch (err) {

        console.error(err);

        res.status(500).json({

            success: false,

            message: "Unable to fetch schedule"

        });

    }

});
/* ==========================================
        TEAM RESULTS
========================================== */
router.get("/:id/results", async (req, res) => {

    try {

        const key = `TEAM_RESULTS_${req.params.id}`;

        const data = await cacheManager.getOrCreate(

            key,

            1800,

            () => teamsProvider.getTeamResults(req.params.id)

        );

        res.json(data);

    } catch (err) {

        console.error(err);

        res.status(500).json({

            success: false,

            message: "Unable to fetch results"

        });

    }

});

/* ==========================================
        TEAM PLAYERS
========================================== */
router.get("/:id/players", async (req, res) => {

    try {

        const key = `TEAM_PLAYERS_${req.params.id}`;

        const data = await cacheManager.getOrCreate(

            key,

            86400,

            () => teamsProvider.getTeamPlayers(req.params.id)

        );

        res.json(data);

    } catch (err) {

        console.error(err);

        res.status(500).json({

            success: false,

            message: "Unable to fetch players"

        });

    }

});

/* ==========================================
        TEAM STATS
========================================== */
router.get("/:id/stats", async (req, res) => {

    try {

        const key = `TEAM_STATS_${req.params.id}`;

        const data = await cacheManager.getOrCreate(

            key,

            86400,

            () => teamsProvider.getTeamStats(req.params.id)

        );

        res.json(data);

    } catch (err) {

        console.error(err);

        res.status(500).json({

            success: false,

            message: "Unable to fetch stats"

        });

    }

});

/* ==========================================
        TEAM NEWS
========================================== */
router.get("/:id/news", async (req, res) => {

    try {

        const key = `TEAM_NEWS_${req.params.id}`;

        const data = await cacheManager.getOrCreate(

            key,

            1800,

            () => teamsProvider.getTeamNews(req.params.id)

        );

        res.json(data);

    } catch (err) {

        console.error(err);

        res.status(500).json({

            success: false,

            message: "Unable to fetch news"

        });

    }

});

module.exports = router;