module.exports = {

    /* =============================
            MATCH LIST
    ============================== */

    LIVE_MATCHES: "/matches/v1/live",

    UPCOMING_MATCHES: "/matches/v1/upcoming",

    RECENT_MATCHES: "/matches/v1/recent",

    /* ==========================================
                HOME
    ========================================== */

    HOME:
        "/home/v1/index",

    /* ==========================================
             MATCH CENTER
    ========================================== */

    MATCH_INFO: id =>
        `/mcenter/v1/${id}`,

    COMMENTARY: (id, iid = 1, tms = Date.now()) =>
        `/mcenter/v1/${id}/comm?iid=${iid}&tms=${tms}`,

    HCOMMENTARY: (id, iid = 1, tms = Date.now()) =>
        `/mcenter/v1/${id}/hcomm?iid=${iid}&tms=${tms}`,

    SCORECARD: id =>
        `/mcenter/v1/${id}/scard`,

    SQUADS: id =>
        `/mcenter/v1/${id}/teams`,

    OVERS: (id, iid = 1, tms = Date.now()) =>
        `/mcenter/v1/${id}/overs?iid=${iid}&tms=${tms}`,

    OVER_DETAILS: (id, iid = 1, tms = Date.now()) =>
        `/mcenter/v1/${id}/overs/details?iid=${iid}&tms=${tms}`,

    HIGHLIGHTS: (id, htype = 2) =>
        `/mcenter/v1/${id}/hlights?htype=${htype}`,

    LEANBACK: id =>
        `/mcenter/v1/${id}/leanback`,

    HLEANBACK: id =>
        `/mcenter/v1/${id}/hleanback`,

    OVERS_GRAPH: id =>
        `/mcenter/v1/${id}/oversGraph`,

    BALL_GRAPH: (id, iid = 1) =>
        `/mcenter/v1/${id}/ballsGraph?iid=${iid}`,

    PARTNERSHIP_GRAPH: id =>
        `/mcenter/v1/${id}/partnershipGraph`,

    /******************************
            SERIES
    ******************************/

    SERIES_MATCHES: id =>
        `/series/v1/${id}`,

    POINTS_TABLE: id =>
        `/stats/v1/series/${id}/points-table`,

    SERIES_SQUADS: id =>
        `/series/v1/${id}/squads`,

    SQUAD_DETAILS: (seriesId, squadId) =>
        `/series/v1/${seriesId}/squads/${squadId}`,

    SERIES_STATS: (seriesId, statsType = "mostRuns") =>
        `/stats/v1/series/${seriesId}?statsType=${statsType}`,

    SERIES_VENUES: id =>
        `/series/v1/${id}/venues`,

    SERIES_NEWS: id =>
        `/news/v1/series/${id}?lastId=0`,

    /*--team--*/
    TEAM_INTERNATIONAL: "/teams/v1/international",

    TEAM_LEAGUE: "/teams/v1/league",

    TEAM_DOMESTIC: "/teams/v1/domestic",

    TEAM_WOMEN: "/teams/v1/women",

    TEAM_SCHEDULE: id => `/teams/v1/${id}/schedule`,

    TEAM_RESULTS: id => `/teams/v1/${id}/results`,

    TEAM_PLAYERS: id => `/teams/v1/${id}/players`,

    TEAM_STATS: id => `/stats/v1/team/${id}`,

    TEAM_NEWS: id => `/news/v1/team/${id}`,


    /* ===========================
        PLAYERS
=========================== */

    PLAYER_TRENDING:
        "/stats/v1/player/trending",

    PLAYER_SEARCH: name =>
        `/stats/v1/player/search?plrN=${encodeURIComponent(name)}`,

    PLAYER_INFO: id =>
        `/stats/v1/player/${id}`,

    PLAYER_BATTING: id =>
        `/stats/v1/player/${id}/batting`,

    PLAYER_BOWLING: id =>
        `/stats/v1/player/${id}/bowling`,

    PLAYER_CAREER: id =>
        `/stats/v1/player/${id}/career`,

    // Last-resort player lookup. Used only when the calls above fail or the
    // provider's free daily limit is spent, so it is never a hot-path call.
    PLAYER_ALLPLAYERS: id =>
        `/forecast/v1/allPlayers/${id}`,

    PLAYER_NEWS: id =>
        `/news/v1/player/${id}`,

    /* ==================================
                VENUES
    ================================== */

    VENUE_INFO: id =>
        `/venues/v1/${id}`,

    VENUE_MATCHES: id =>
        `/venues/v1/${id}/matches`,

    VENUE_STATS: id =>
        `/stats/v1/venue/${id}`,

    /* ==================================
                ICC RANKINGS
    ================================== */

    RANKING_BATSMEN: (format = "t20", women = 0) =>
        `/stats/v1/rankings/batsmen?isWomen=${women}&formatType=${format}`,

    RANKING_BOWLERS: (format = "t20", women = 0) =>
        `/stats/v1/rankings/bowlers?isWomen=${women}&formatType=${format}`,

    RANKING_ALLROUNDERS: (format = "t20", women = 0) =>
        `/stats/v1/rankings/allrounders?isWomen=${women}&formatType=${format}`,

    RANKING_TEAMS: (format = "t20", women = 0) =>
        `/stats/v1/rankings/teams?isWomen=${women}&formatType=${format}`,

    /* ==========================================
                    NEWS
    ========================================== */

    LATEST_NEWS: (lastId = 132054) =>
        `/news/v1/index?lastId=${lastId}`,

    NEWS_DETAIL: id =>
        `/news/v1/detail/${id}`,

    PREMIUM_NEWS: (lastId = 129328) =>
        `/news/v1/premiumIndex?lastId=${lastId}`,

    NEWS_TOPICS:
        "/news/v1/topics",

    NEWS_TOPIC: id =>
        `/news/v1/topics/${id}`,

    NEWS_CATEGORY:
        "/news/v1/cat",

    NEWS_CATEGORY_DETAIL: (id, lastId = 114370) =>
        `/news/v1/cat/${id}?lastId=${lastId}`,

    /* ==================================
                PHOTOS
    ================================== */

    PHOTOS: (lastId = 5921) =>
        `/photos/v1/index?lastId=${lastId}`,

    PHOTO_DETAIL: id =>
        `/photos/v1/detail/${id}`,

    /* ==================================
            AUCTION
================================== */

    AUCTION_SEASONS:
        "/auction/v1/seasons",

    AUCTION_TEAMS: (currency = "INR", tournament = "ipl", year = 2026) =>
        `/auction/v1/teams?currency=${currency}&tournament=${tournament}&year=${year}&sortField=auction_spent&sortDirection=DESC`,

    AUCTION_COMPLETED: (currency = "INR", tournament = "ipl", year = 2026) =>
        `/auction/v1/players/completed?timestamp=${Math.floor(Date.now() / 1000)}&currency=${currency}&tournament=${tournament}&year=${year}`,

    AUCTION_UPCOMING: (currency = "INR", tournament = "ipl", year = 2026) =>
        `/auction/v1/players/upcoming?timestamp=${Math.floor(Date.now() / 1000)}&currency=${currency}&tournament=${tournament}&year=${year}`,

    AUCTION_LIVE: (currency = "INR", tournament = "ipl", year = 2026) =>
        `/auction/v1/players/live?currency=${currency}&tournament=${tournament}&year=${year}`,

    /* ==================================
                SCHEDULE
    ================================== */

    SCHEDULE_INTERNATIONAL: (lastTime = Date.now()) =>
        `/schedule/v1/International?lastTime=${lastTime}`,

    SCHEDULE_LEAGUE: (lastTime = Date.now()) =>
        `/schedule/v1/league?lastTime=${lastTime}`,

    SCHEDULE_DOMESTIC: (lastTime = Date.now()) =>
        `/schedule/v1/domestic?lastTime=${lastTime}`,

    SCHEDULE_WOMEN: (lastTime = Date.now()) =>
        `/schedule/v1/women?lastTime=${lastTime}`,

    /* ==================================
                ARCHIVES
    ================================== */

    ARCHIVE_INTERNATIONAL: (lastId = 8686) =>
        `/series/v1/archives/International?lastId=${lastId}`,

    ARCHIVE_LEAGUE: (lastId = 7492) =>
        `/series/v1/archives/league?lastId=${lastId}`,

    ARCHIVE_DOMESTIC: (lastId = 7441) =>
        `/series/v1/archives/domestic?lastId=${lastId}`,

    ARCHIVE_WOMEN: (lastId = 8732) =>
        `/series/v1/archives/women?lastId=${lastId}`,

    /* ==================================
            BROWSE SERIES
    ================================== */

    BROWSE_INTERNATIONAL:
        "/series/v1/international",

    BROWSE_LEAGUE:
        "/series/v1/league",

    BROWSE_DOMESTIC:
        "/series/v1/domestic",

    BROWSE_WOMEN:
        "/series/v1/women",

    /* ==================================
                STATS
    ================================== */

    STATS_LIST:
        "/stats/v1/topstats",

    FETCH_STATS: (
        id = 0,
        statsType = "mostRuns",
        opponent = "",
        year = "",
        team = "",
        matchType = ""
    ) =>

        `/stats/v1/topstats/${id}?statsType=${statsType}&opponent=${opponent}&year=${year}&team=${team}&matchType=${matchType}`,
};