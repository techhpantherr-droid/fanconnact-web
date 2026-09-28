const api = require("../../gateway/apiGateway");
const endpoints = require("./endpoints");
const cacheManager = require("../../cache/cacheManager");

class PlayersProvider {

    async getTrendingPlayers() {

        const { data } =
        await api.get(endpoints.PLAYER_TRENDING);

        return data;

    }

    async searchPlayers(name) {

        const { data } =
        await api.get(endpoints.PLAYER_SEARCH(name));

        return data;

    }
    
   async resolvePlayerId(name) {

    const cacheKey = `PLAYER_ID_${name.trim().toLowerCase()}`;

    return await cacheManager.getOrCreate(

        cacheKey,

        86400, // 24 Hours

        async () => {

            const data = await this.searchPlayers(name);

            const list =
                data?.player ||
                data?.players ||
                data?.playerList ||
                data?.playerSearchResponse ||
                [];

            if (!Array.isArray(list) || !list.length) {

                return null;

            }

            const exact = list.find(p =>

                (p.name || "")
                    .toLowerCase()
                    .trim() ===
                name.toLowerCase().trim()

            );

            if (exact) {

                return exact.id || exact.playerId;

            }

            return list[0].id || list[0].playerId || null;

        }

    );

}

    async getPlayerInfo(id) {

        try {

            const { data } =
            await api.get(endpoints.PLAYER_INFO(id));

            // Guard against an empty 200 (provider sometimes answers {}).
            if (data && typeof data === "object" && Object.keys(data).length) {
                return data;
            }

        } catch (e) {

            // free daily limit reached or endpoint down -> try the fallback

        }

        // Last API: forecast allPlayers lookup. Cheap and only reached when
        // the main player endpoint failed, so it does not burn the budget.
        const { data: fallback } =
        await api.get(endpoints.PLAYER_ALLPLAYERS(id));

        return fallback;

    }

    async getPlayerBatting(id) {

        const { data } =
        await api.get(endpoints.PLAYER_BATTING(id));

        return data;

    }

    async getPlayerBowling(id) {

        const { data } =
        await api.get(endpoints.PLAYER_BOWLING(id));

        return data;

    }

  async getPlayerCareer(id) {

  
    const batting =
        await this.getPlayerBatting(id);

    const bowling =
        await this.getPlayerBowling(id);

   const test =
    this.buildCareerStats(batting, bowling, 1);

const odi =
    this.buildCareerStats(batting, bowling, 2);

const t20i =
    this.buildCareerStats(batting, bowling, 3);

const league =
    this.buildCareerStats(batting, bowling, 4);

return {

    all: this.sumCareerStats(
        test,
        odi,
        t20i,
        league
    ),

    test,

    odi,

    t20i,

    league,

    domestic: {}

};

}

    buildCareerStats(batting, bowling, index) {

    const result = {};

    const batRows =
        batting?.values || [];

    const bowlRows =
        bowling?.values || [];

    function read(rows, key) {

        const row =
            rows.find(r =>
                r.values &&
                r.values[0] === key
            );

        if (!row)
            return "—";

        if (index === null)
            return row.values[1];

        return row.values[index] || "—";

    }

    result.matches = Number(read(batRows,"Matches")) || 0;
    result.runs = Number(read(batRows,"Runs")) || 0;
    result.average = read(batRows,"Average");
    result.strikeRate = read(batRows,"SR");
    result.highest = read(batRows,"Highest");
    result.hundreds = Number(read(batRows,"100s")) || 0;
    result.fifties = Number(read(batRows,"50s")) || 0;
    result.balls = Number(read(batRows,"Balls")) || 0;
    result.fours = Number(read(batRows,"Fours")) || 0;
    result.sixes = Number(read(batRows,"Sixes")) || 0;
    result.wickets = Number(read(bowlRows,"Wickets")) || 0;

    return result;

}

sumCareerStats(...formats) {

    const total = {
        matches: 0,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        wickets: 0,
        hundreds: 0,
        fifties: 0,
        highest: "—",
        average: "—",
        strikeRate: "—"
    };

    let bestAverage = 0;
    let bestStrikeRate = 0;
    let highestScore = 0;

    for (const s of formats) {

        if (!s) continue;

        total.matches += Number(s.matches || 0);
        total.runs += Number(s.runs || 0);
        total.balls += Number(s.balls || 0);
        total.fours += Number(s.fours || 0);
        total.sixes += Number(s.sixes || 0);
        total.wickets += Number(s.wickets || 0);
        total.hundreds += Number(s.hundreds || 0);
        total.fifties += Number(s.fifties || 0);

        const hs = parseInt(s.highest) || 0;

        if (hs > highestScore) {
            highestScore = hs;
            total.highest = s.highest;
        }

        const avg = parseFloat(s.average) || 0;

        if (avg > bestAverage) {
            bestAverage = avg;
            total.average = s.average;
        }

        const sr = parseFloat(s.strikeRate) || 0;

        if (sr > bestStrikeRate) {
            bestStrikeRate = sr;
            total.strikeRate = s.strikeRate;
        }

    }

    return total;

}

    async getPlayerNews(id) {

        const { data } =
        await api.get(endpoints.PLAYER_NEWS(id));

        return data;

    }

   async getBattingSummary(playerId) {

    const cacheKey = `PLAYER_BAT_${playerId}`;

    return await cacheManager.getOrCreate(

        cacheKey,

        21600,

        async () => {

            const batting =
                await this.getPlayerBatting(playerId);

            const rows =
                batting?.values || [];

            const summary = {};

            for (const row of rows) {

                const values = row.values || [];

                if (values.length < 2) continue;

                const key = values[0];

                summary[key] = values[2] || values[1] || "";

            }

            return {

                matches:
                    Number(summary["Matches"]) || 0,

                runs:
                    Number(summary["Runs"]) || 0,

                avg:
                    Number(summary["Average"]) || 0,

                strikeRate:
                    Number(summary["SR"]) || 0

            };

        }

    );

}

async getBowlingSummary(playerId) {

    const cacheKey = `PLAYER_BOWL_${playerId}`;

    return await cacheManager.getOrCreate(

        cacheKey,

        21600,

        async () => {

            const bowling =
                await this.getPlayerBowling(playerId);

            const rows =
                bowling?.values || [];

            const summary = {};

            for (const row of rows) {

                const values = row.values || [];

                if (values.length < 2) continue;

                const key = values[0];

                summary[key] = values[2] || values[1] || "";

            }

            return {

                matches:
                    Number(summary["Matches"]) || 0,

                wickets:
                    Number(summary["Wickets"]) || 0,

                economy:
                    Number(summary["Econ"]) || 0,

                average:
                    Number(summary["Average"]) || 0

            };

        }

    );

}

async getPlayerProfile(playerId) {

    const cacheKey = `PLAYER_PROFILE_${playerId}`;

    return await cacheManager.getOrCreate(

        cacheKey,

        21600,

        async () => {

            const info =
                await this.getPlayerInfo(playerId);

            return {

                id: playerId,

                name:
                    info?.name ||
                    info?.fullName ||
                    "",

                image:
                    info?.image ||
                    info?.faceImageId ||
                    info?.imageUrl ||
                    "",

                country:
                    info?.intlTeam ||
                    info?.teamName ||
                    info?.country ||
                    "",

                role:
                    info?.role ||
                    info?.playingRole ||
                    "",

                battingStyle:
                    info?.bat ||
                    info?.battingStyle ||
                    "",

                bowlingStyle:
                    info?.bowl ||
                    info?.bowlingStyle ||
                    "",

                birthDate:
                    info?.DoBFormat ||
                    info?.dob ||
                    "",

                birthPlace:
                    info?.birthPlace ||
                    "",

                height:
                    info?.height ||
                    "",

                weight:
                    info?.weight ||
                    "",

                jersey:
                    info?.jersey ||
                    info?.jerseyNumber ||
                    "",

              
                    debut:
info?.debut || "",

                bio:
                    info?.bio ||
                    info?.description ||
                    "",

                   // NEW
    intlTeam:
        info?.intlTeam ||
        info?.country ||
        "",

    teams:
        info?.teams ||
        info?.teamsName ||
        info?.teamNames ||
        info?.teamName ||
        info?.domesticTeams ||
        ""
            };

        }

    );

}

}



module.exports = new PlayersProvider();