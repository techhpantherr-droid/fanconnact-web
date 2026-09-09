import { db, auth } from "../firebase-config.js";

import {

    collection,

    doc,

    getDoc,

    getDocs,

    query,

    where,

    orderBy,

    limit,

    addDoc,

    updateDoc,

    increment,

    onSnapshot,

    serverTimestamp,

    runTransaction

} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/*=====================================

COLLECTIONS

=====================================*/

const PREDICTIONS = "predictions";

const USER_PREDICTIONS = "user_predictions";

const USERS = "users";
const MATCHES = "matches";

function timestampMillis(value){
    if(value == null) return null;
    if(typeof value === "number") return value;
    if(value instanceof Date) return value.getTime();
    if(typeof value.toMillis === "function") return value.toMillis();
    if(typeof value.seconds === "number") return value.seconds * 1000;
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : null;
}

/*=====================================

STATUS

=====================================*/

export const PredictionStatus = {

    LIVE: "LIVE",

    LOCKED: "LOCKED",

    COMPLETED: "COMPLETED",

    CANCELLED: "CANCELLED"

};

/*=====================================

DIFFICULTY

=====================================*/

export const Difficulty = {

    EASY: "easy",

    MEDIUM: "medium",

    HARD: "hard",

    EXPERT: "expert"

};

/*=====================================

PREDICTION TYPES

=====================================*/

export const PredictionType = {

    MATCH_WINNER: "MATCH_WINNER",

    NEXT_OVER_RUNS: "NEXT_OVER_RUNS",

    NEXT_WICKET: "NEXT_WICKET",

    NEXT_BOUNDARY: "NEXT_BOUNDARY",

    NEXT_SIX: "NEXT_SIX",

    POWERPLAY_SCORE: "POWERPLAY_SCORE",

    PLAYER_FIFTY: "PLAYER_FIFTY",

    PLAYER_CENTURY: "PLAYER_CENTURY",

    DEATH_OVER: "DEATH_OVER",

    CHASE: "CHASE",

    TOSS_WINNER: "TOSS_WINNER",

    TOTAL_RUNS: "TOTAL_RUNS",

    HIGHEST_SCORER: "HIGHEST_SCORER",

    NEXT_GOAL: "NEXT_GOAL",

    NEXT_SCORER: "NEXT_SCORER",

    NEXT_CORNER: "NEXT_CORNER",

    NEXT_YELLOW_CARD: "NEXT_YELLOW_CARD",

    NEXT_RED_CARD: "NEXT_RED_CARD",

    NEXT_ACE: "NEXT_ACE",

    NEXT_SET_WINNER: "NEXT_SET_WINNER",

    NEXT_RAID: "NEXT_RAID",

    NEXT_BONUS_POINT: "NEXT_BONUS_POINT",

    NEXT_SUPER_TACKLE: "NEXT_SUPER_TACKLE",

    NEXT_THREE_POINTER: "NEXT_THREE_POINTER",

    NEXT_FREE_THROW: "NEXT_FREE_THROW"

};

/*=====================================
    GET LIVE PREDICTIONS
=====================================*/

export async function getLivePredictions(

    matchId,
    sport,
    limitCount = 20

) {
    try {
        const q = query(
            collection(db, PREDICTIONS),
            where("matchId", "==", matchId)
        );
        const snapshot = await getDocs(q);
        const predictions = [];
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            if(String(data.sport || "").toLowerCase() !== String(sport || "").toLowerCase()) return;
            if(data.status !== PredictionStatus.LIVE) return;
            predictions.push({ id: docSnap.id, ...data });
        });
        predictions.sort((a,b) => (a.expiresAt?.toMillis?.() || 0) - (b.expiresAt?.toMillis?.() || 0));
        return predictions.slice(0, limitCount);
    } catch(error) {
        console.error("Error getting live predictions:", error);
        return [];
    }
}

/*=====================================
    GET ALL LIVE PREDICTIONS
    Used by lifecycle worker across all matches.
=====================================*/

export async function getAllLivePredictions(limitCount = 100) {
    try {
        const q = query(
            collection(db, PREDICTIONS),
            where("status", "==", PredictionStatus.LIVE)
        );
        const snapshot = await getDocs(q);
        const predictions = [];
        snapshot.forEach(docSnap => predictions.push({ id: docSnap.id, ...docSnap.data() }));
        predictions.sort((a,b) => (a.expiresAt?.toMillis?.() || 0) - (b.expiresAt?.toMillis?.() || 0));
        return predictions.slice(0, limitCount);
    } catch(error) {
        console.error("Error getting all live predictions:", error);
        return [];
    }
}

/*=====================================

GET PREDICTION BY ID

=====================================*/

export async function getPredictionById(predictionId) {

    try {

        const snapshot = await getDoc(

            doc(db, PREDICTIONS, predictionId)

        );

        if (!snapshot.exists()) {

            return null;

        }

        return {

            id: snapshot.id,

            ...snapshot.data()

        };

    }

    catch (error) {

        console.error(

            error

        );

        return null;

    }

}

/*=====================================
    GET LIVE MATCH
=====================================*/

export async function getLiveMatch(

    matchId

){

    return await getMatch(

        matchId

    );

}

/*=====================================

GET MATCH PREDICTIONS

=====================================*/

export async function getPredictionsByMatch(matchId) {
    try {
        const q = query(
            collection(db, PREDICTIONS),
            where("matchId", "==", matchId)
        );
        const snapshot = await getDocs(q);
        const predictions = [];
        snapshot.forEach(docSnap => predictions.push({ id: docSnap.id, ...docSnap.data() }));
        predictions.sort((a,b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
        return predictions;
    } catch(error) {
        console.error("Get Match Predictions Error:", error);
        return [];
    }
}

/*=====================================

UPCOMING PREDICTIONS

=====================================*/

export async function getUpcomingPredictions() {

    try {

        const q = query(

            collection(

                db,

                PREDICTIONS

            ),

            where(

                "status",

                "==",

                PredictionStatus.LOCKED

            ),

            orderBy(

                "expiresAt"

            )

        );

        const snapshot =

            await getDocs(q);

        const list = [];

        snapshot.forEach(docSnap => {

            list.push({

                id: docSnap.id,

                ...docSnap.data()

            });

        });

        return list;

    }

    catch (error) {

        console.error(error);

        return [];

    }

}

/*=====================================

CHECK AVAILABILITY

=====================================*/

export function checkPredictionAvailability(prediction) {

    if(prediction?.status !== PredictionStatus.LIVE){
        return false;
    }

    const expire = timestampMillis(prediction.expiresAt);
    return expire != null && Date.now() < expire;

}

/*=====================================

IS LOCKED

=====================================*/

export function isPredictionLocked(

    prediction

) {

    return (

        prediction.status ===

        PredictionStatus.LOCKED

    );

}


/*=====================================
        BACKEND MATCH BRIDGE
    Match Center is backed by the live
    Cricbuzz proxy on Node. Predictions
    must use that same real match source;
    Firestore remains the prediction store.
=====================================*/

const PREDICTION_API_BASES = [window.FC_API ? window.FC_API.api() : (location.origin.includes('localhost') ? 'http://localhost:5000/api' : location.origin)];

async function predictionApi(path){
    let lastError = null;

    for(const base of PREDICTION_API_BASES){
        try{
            const response = await fetch(base + path, {
                method: "GET",
                headers: { Accept: "application/json" },
                cache: "no-store"
            });

            if(!response.ok){
                throw new Error(`HTTP ${response.status}`);
            }

            return await response.json();
        }catch(error){
            lastError = error;
        }
    }

    throw lastError || new Error("Prediction match API unavailable");
}


// Resolve the actual striker without assuming batsmen[0] is always on strike.
// This is prediction-only data mapping; match/cache behaviour is unchanged.
function resolvePredictionCurrentBatter(root, current, currentBatters) {
    const explicit =
        root?.currentBatter || root?.currentbatter ||
        current?.currentBatter || current?.currentbatter ||
        root?.striker || current?.striker ||
        root?.onStrikeBatter || current?.onStrikeBatter || null;

    if (explicit && typeof explicit === 'object') return explicit;

    const list = Array.isArray(currentBatters) ? currentBatters.filter(Boolean) : [];
    if (!list.length) return null;
    if (list.length === 1) return list[0];

    const strikerId = String(
        root?.strikerId ?? root?.strikerID ?? current?.strikerId ?? current?.strikerID ?? ''
    );
    const strikerName = String(
        root?.strikerName ?? current?.strikerName ?? ''
    ).trim().toLowerCase();

    const marked = list.find(b => {
        const flag = b?.isStriker ?? b?.isOnStrike ?? b?.onStrike ?? b?.striker ?? b?.isOnstrike;
        if (flag === true || String(flag).toLowerCase() === 'true') return true;
        const role = String(b?.battingStatus ?? b?.status ?? b?.role ?? '').toLowerCase();
        return role.includes('striker') || role === 'on strike' || role === 'onstrike';
    });
    if (marked) return marked;

    if (strikerId) {
        const byId = list.find(b => String(b?.id ?? b?.playerId ?? b?.batsmanId ?? b?.batId ?? '') === strikerId);
        if (byId) return byId;
    }
    if (strikerName) {
        const byName = list.find(b => String(b?.name ?? b?.playerName ?? b?.batsmanName ?? '').trim().toLowerCase() === strikerName);
        if (byName) return byName;
    }

    // Do not guess from [0] when two active batters exist.
    return null;
}


function normalizePredictionMatch(raw, fallbackId = ""){
    const root = raw?.data || raw || {};
    const source =
        root?.match ||
        root?.matchInfo ||
        root?.matchHeader ||
        root?.matchheader ||
        root;

    const home =
        source?.homeTeam ||
        source?.home ||
        source?.team1 ||
        source?.teams?.home ||
        root?.team1 ||
        root?.homeTeam ||
        root?.teams?.home ||
        {};

    const away =
        source?.awayTeam ||
        source?.away ||
        source?.team2 ||
        source?.teams?.away ||
        root?.team2 ||
        root?.awayTeam ||
        root?.teams?.away ||
        {};

    // Provider display text can say things like "India opt to bat" while the
    // actual lifecycle is exposed separately as `state: inprogress`.
    // Lifecycle MUST prefer state/matchState/isLive over display status.
    const lifecycleValue =
        source?.state ??
        root?.state ??
        source?.matchState ??
        root?.matchState ??
        source?.status ??
        root?.status ??
        "";

    const rawStatus = String(lifecycleValue).toLowerCase().trim();
    const isLive = source?.isLive === true || root?.isLive === true;

    let status = "UPCOMING";
    if(isLive || /live|in progress|inprogress|started|ongoing|innings break|stumps|rain delay/.test(rawStatus)){
        status = "LIVE";
    }else if(/complete|completed|finished|result|ended|match ended|abandon|cancel/.test(rawStatus)){
        status = "FINISHED";
    }

    const score =
        source?.score ||
        root?.score ||
        root?.matchScore ||
        {};

    const scoreText = value => {
        if(value == null) return "";
        if(typeof value === "string" || typeof value === "number") return value;
        return value.runs != null
            ? `${value.runs}${value.wickets != null ? `/${value.wickets}` : ""}`
            : "";
    };

    const currentInnings =
        source?.currentInnings ||
        root?.currentInnings ||
        source?.innings?.current ||
        root?.innings?.current ||
        {};

    const currentOver =
        source?.currentOver ??
        source?.over ??
        currentInnings?.currentOver ??
        currentInnings?.over ??
        root?.currentOver ??
        root?.over ??
        root?.score?.currentOver ??
        root?.score?.over ??
        null;

    const lastEvent =
        source?.lastEvent ||
        root?.lastEvent ||
        root?.lastEventInfo ||
        root?.recentEvents?.[0] ||
        root?.events?.[0] ||
        null;

    return {
        ...root,
        ...source,
        id: String(
            source?.id ??
            source?.matchId ??
            root?.id ??
            root?.matchId ??
            root?.matchid ??
            fallbackId
        ),
        sport: String(
            source?.sport ||
            root?.sport ||
            "cricket"
        ).toLowerCase(),
        status,
        statusText:
            source?.statusText ||
            source?.status ||
            root?.statusText ||
            root?.status ||
            root?.state ||
            "",
        series: source?.series || root?.series || root?.seriesName || "",
        matchType:
            source?.matchType ||
            source?.matchFormat ||
            source?.format ||
            root?.matchType ||
            root?.matchFormat ||
            root?.format ||
            "",
        startTime:
            source?.startTime ||
            source?.startDate ||
            root?.startTime ||
            root?.startDate ||
            "",
        homeTeam: {
            id: home?.id ?? home?.teamId ?? "",
            name:
                home?.name ||
                home?.teamName ||
                home?.teamname ||
                home?.displayName ||
                "Team 1",
            shortName:
                home?.shortName ||
                home?.short ||
                home?.teamSName ||
                home?.teamsname ||
                ""
        },
        awayTeam: {
            id: away?.id ?? away?.teamId ?? "",
            name:
                away?.name ||
                away?.teamName ||
                away?.teamname ||
                away?.displayName ||
                "Team 2",
            shortName:
                away?.shortName ||
                away?.short ||
                away?.teamSName ||
                away?.teamsname ||
                ""
        },
        score,
        team1Score: scoreText(score.innings1 || score.team1Score),
        team2Score: scoreText(score.innings2 || score.team2Score),

        currentOver: Number(currentOver) || 0,

        currentInnings,
        innings:
            source?.innings ||
            root?.innings ||
            [],

        currentBatter:
            resolvePredictionCurrentBatter(
                root,
                source?.currentInnings || root?.currentInnings || source?.current || root?.current || {},
                source?.currentBatters || root?.currentBatters || source?.batsmen || root?.batsmen || []
            ),

        currentBowler:
            source?.currentBowler ||
            root?.currentBowler ||
            source?.currentBowlers?.[0] ||
            root?.currentBowlers?.[0] ||
            null,

        currentBatters:
            source?.currentBatters ||
            root?.currentBatters ||
            source?.batsmen ||
            root?.batsmen ||
            [],

        currentBowlers:
            source?.currentBowlers ||
            root?.currentBowlers ||
            source?.bowlers ||
            root?.bowlers ||
            [],

        topPlayers:
            source?.topPlayers ||
            root?.topPlayers ||
            source?.players ||
            root?.players ||
            [],

        lastEvent,

        recentEvents:
            source?.recentEvents ||
            root?.recentEvents ||
            source?.events ||
            root?.events ||
            [],

        overHistory:
            source?.overHistory ||
            source?.overs ||
            root?.overHistory ||
            root?.overs ||
            source?.recentOvers ||
            root?.recentOvers ||
            [],

        lastOverRuns:
            source?.lastOverRuns ??
            source?.previousOverRuns ??
            root?.lastOverRuns ??
            root?.previousOverRuns ??
            null,

        lastOverHadWicket:
            source?.lastOverHadWicket ??
            root?.lastOverHadWicket ??
            null,

        lastOverHadSix:
            source?.lastOverHadSix ??
            root?.lastOverHadSix ??
            null,

        lastOverHadBoundary:
            source?.lastOverHadBoundary ??
            root?.lastOverHadBoundary ??
            null,

        expectedOverRuns:
            source?.expectedOverRuns ??
            root?.expectedOverRuns ??
            source?.currentOverRunsExpected ??
            root?.currentOverRunsExpected ??
            null,

        expectedPowerplay:
            source?.expectedPowerplay ??
            root?.expectedPowerplay ??
            null,

        expectedTotal:
            source?.expectedTotal ??
            root?.expectedTotal ??
            null,

        target: source?.target ?? root?.target ?? root?.targetscore ?? null,
        runsNeeded:
            source?.runsNeeded ??
            root?.runsNeeded ??
            root?.requiredruns ??
            null,
        ballsRemaining:
            source?.ballsRemaining ??
            root?.ballsRemaining ??
            root?.requiredballs ??
            null,

        winner:
            source?.winner ??
            source?.winnerName ??
            source?.winnerId ??
            source?.result?.winner ??
            root?.winner ??
            root?.winnerName ??
            root?.winnerId ??
            root?.result?.winner ??
            null,

        winnerId:
            source?.winnerId ??
            source?.result?.winnerId ??
            root?.winnerId ??
            root?.result?.winnerId ??
            null,

        result: source?.result || root?.result || null,

        tossWinner:
            source?.tossWinner ??
            source?.tossWinnerId ??
            source?.toss?.winner ??
            root?.tossWinner ??
            root?.tossWinnerId ??
            root?.toss?.winner ??
            null,

        tossWinnerId:
            source?.tossWinnerId ??
            source?.toss?.winnerId ??
            root?.tossWinnerId ??
            root?.toss?.winnerId ??
            null,

        highestScorerId:
            source?.highestScorerId ??
            source?.highestScorer?.id ??
            root?.highestScorerId ??
            root?.highestScorer?.id ??
            null,

        highestScorer:
            source?.highestScorer ||
            root?.highestScorer ||
            null,

        totalRuns:
            source?.totalRuns ??
            source?.totalScore ??
            root?.totalRuns ??
            root?.totalScore ??
            root?.firstInningsRuns ??
            null,

        powerplayScore:
            source?.powerplayScore ??
            source?.powerplayRuns ??
            root?.powerplayScore ??
            root?.powerplayRuns ??
            null,

        deathOverRuns:
            source?.deathOverRuns ??
            source?.currentOverRuns ??
            root?.deathOverRuns ??
            root?.currentOverRuns ??
            null,

        nextOverRuns:
            source?.nextOverRuns ??
            root?.nextOverRuns ??
            null,

        wicketInNextOver:
            source?.wicketInNextOver ??
            root?.wicketInNextOver ??
            null,

        nextWicket:
            source?.nextWicket ||
            root?.nextWicket ||
            null,

        nextSix:
            source?.nextSix ??
            root?.nextSix ??
            null,

        nextBoundary:
            source?.nextBoundary ??
            root?.nextBoundary ??
            null,

        chaseSuccessful:
            source?.chaseSuccessful ??
            source?.chaseResult ??
            root?.chaseSuccessful ??
            root?.chaseResult ??
            null,

        playerReached50:
            source?.playerReached50 ??
            root?.playerReached50 ??
            null,

        playerReached100:
            source?.playerReached100 ??
            root?.playerReached100 ??
            null
    };
}

export async function getPredictionMatch(matchId){
    const raw = await predictionApi(`/matches/${encodeURIComponent(matchId)}`);
    return normalizePredictionMatch(raw, matchId);
}

export async function getDefaultPredictionMatch(){
    // Direct prediction.html opens on a real live match first.
    // If none is live, use the first real upcoming cricket match.
    try{
        const live = await predictionApi("/matches/live");
        const liveList = Array.isArray(live) ? live : (live?.data || []);
        const normalizedLive = liveList
            .map(item => normalizePredictionMatch(item))
            .filter(match => match && match.id && match.status === "LIVE");
        if(normalizedLive.length){
            return normalizedLive[0];
        }
    }catch(error){
        console.warn("Prediction live-match lookup failed:", error);
    }

    const upcoming = await predictionApi("/matches/upcoming");
    const upcomingList = Array.isArray(upcoming) ? upcoming : (upcoming?.data || []);
    if(!upcomingList.length) return null;

    return normalizePredictionMatch(upcomingList[0]);
}

/*=====================================
        GET MATCH
=====================================*/

function extractFinalResultFromScorecard(rawScorecard, match){
    if(!rawScorecard || typeof rawScorecard !== "object") return {};

    const root = rawScorecard?.data || rawScorecard;
    const source = root?.scorecard && !Array.isArray(root.scorecard)
        ? root.scorecard
        : root;

    const allObjects = [];
    const seen = new Set();
    const walk = (value, depth = 0) => {
        if(value == null || depth > 8) return;
        if(typeof value !== "object") return;
        if(seen.has(value)) return;
        seen.add(value);
        allObjects.push(value);
        if(Array.isArray(value)){
            for(const item of value) walk(item, depth + 1);
        }else{
            for(const child of Object.values(value)){
                if(child && typeof child === "object") walk(child, depth + 1);
            }
        }
    };
    walk(source);

    const teamName = team => {
        if(!team) return "";
        if(typeof team === "string") return team.trim();
        return String(
            team.name ?? team.teamname ?? team.teamName ??
            team.shortName ?? team.teamSName ?? team.teamsname ??
            team.displayName ?? team.team_name ?? ""
        ).trim();
    };

    const home = teamName(match?.homeTeam);
    const away = teamName(match?.awayTeam);

    const textFields = [];
    for(const obj of allObjects){
        for(const key of [
            "winner","winningTeam","winnerTeam","winnerName","result",
            "resultText","message","statusText","status","description","text"
        ]){
            const value = obj?.[key];
            if(typeof value === "string" && value.trim()) textFields.push(value.trim());
            else if(value && typeof value === "object"){
                const nested = teamName(value);
                if(nested) textFields.push(nested);
                for(const nk of ["name","text","message","winner","winningTeam"]){
                    if(typeof value?.[nk] === "string" && value[nk].trim()) textFields.push(value[nk].trim());
                }
            }
        }
    }

    let winner = null;
    for(const text of textFields){
        const lower = text.toLowerCase();
        if(!/won|winner|victory|defeated|beat|wins|result/.test(lower)) continue;
        if(home && lower.includes(home.toLowerCase()) && /won|winner|victory|defeated|beat|wins/.test(lower)){
            winner = home; break;
        }
        if(away && lower.includes(away.toLowerCase()) && /won|winner|victory|defeated|beat|wins/.test(lower)){
            winner = away; break;
        }
    }

    // Scorecard team totals: infer winner only when exactly two final numeric
    // team scores are available and they are unequal.
    const scoreNumber = value => {
        if(value == null) return null;
        if(typeof value === "number" && Number.isFinite(value)) return value;
        const matchNum = String(value).replace(/,/g, "").match(/\d+(?:\.\d+)?/);
        return matchNum ? Number(matchNum[0]) : null;
    };

    const teamScores = [];
    for(const obj of allObjects){
        const name = teamName(obj);
        if(!name) continue;
        for(const key of ["totalRuns","totalScore","runs","score","scoreText"]){
            const n = scoreNumber(obj?.[key]);
            if(n != null){
                teamScores.push({name, runs:n});
                break;
            }
        }
    }

    const bestTeamScore = name => teamScores
        .filter(x => x.name.toLowerCase() === String(name || "").toLowerCase())
        .sort((a,b) => b.runs-a.runs)[0];

    if(!winner && home && away){
        const hs = bestTeamScore(home)?.runs;
        const as = bestTeamScore(away)?.runs;
        if(Number.isFinite(hs) && Number.isFinite(as) && hs !== as){
            winner = hs > as ? home : away;
        }
    }

    // Player rows for highest-scorer resolution.
    const players = [];
    for(const obj of allObjects){
        const name = String(
            obj?.playerName ?? obj?.batsmanName ?? obj?.batsman ??
            obj?.name ?? obj?.displayName ?? ""
        ).trim();
        const runs = scoreNumber(
            obj?.runs ?? obj?.runsScored ?? obj?.batRuns ??
            obj?.batsmanRuns ?? obj?.score
        );
        if(name && Number.isFinite(runs) && (
            obj?.batsman || obj?.batsmanName || obj?.batRuns != null ||
            obj?.runsScored != null || obj?.batsmanRuns != null ||
            obj?.batRuns != null || obj?.batting === true
        )){
            players.push({
                name,
                id: obj?.playerId ?? obj?.batsmanId ?? obj?.id ?? null,
                runs
            });
        }
    }

    const highest = players.sort((a,b) => b.runs-a.runs)[0] || null;

    // Collect explicit innings/team totals for TOTAL_RUNS.
    const inningsTotals = [];
    for(const obj of allObjects){
        const name = teamName(obj);
        if(!name) continue;
        const n = scoreNumber(
            obj?.totalRuns ?? obj?.totalScore ?? obj?.runs ??
            obj?.score?.runs ?? obj?.score?.total
        );
        if(Number.isFinite(n)) inningsTotals.push({name, runs:n});
    }

    return {
        scorecard: rawScorecard,
        ...(winner ? { winner } : {}),
        ...(highest ? {
            highestScorer: { id: highest.id, name: highest.name, runs: highest.runs },
            highestScorerId: highest.id
        } : {}),
        ...(inningsTotals.length ? { scorecardTeamTotals: inningsTotals } : {})
    };
}

export async function getMatch(matchId, includeFinalScorecard = false) {

    // Match Center is the source of truth for real cricket matches.
    // Firestore is used only as a fallback if the backend/API is temporarily
    // unavailable.
    try{
        const match = await getPredictionMatch(matchId);

        if(!includeFinalScorecard) return match;

        try{
            const raw = await predictionApi(
                `/matches/${encodeURIComponent(matchId)}/scorecard`
            );
            const finalData = extractFinalResultFromScorecard(raw, match);
            const scoreRoot = raw?.data || raw || {};
            const lifecycleText = String(
                scoreRoot?.status ??
                scoreRoot?.state ??
                scoreRoot?.matchState ??
                scoreRoot?.matchStatus ??
                ""
            ).toLowerCase();

            if(/finished|completed|complete|ended|result|abandon|cancel/.test(lifecycleText)){
                match.status = "FINISHED";
            }

            return {
                ...match,
                ...finalData,
                result: {
                    ...(match.result && typeof match.result === "object" ? match.result : {}),
                    ...(finalData.winner ? { winner: finalData.winner } : {})
                }
            };
        }catch(scoreError){
            console.warn("Final scorecard lookup failed; using match result fields:", scoreError);
        }

        return match;
    }catch(error){
        console.warn("Match Center API lookup failed; checking Firestore:", error);
    }

    try {
        const snapshot = await getDoc(
            doc(db, MATCHES, String(matchId))
        );

        if(snapshot.exists()){
            return {
                id: snapshot.id,
                sport: "cricket",
                ...snapshot.data()
            };
        }
    }catch(error){
        console.error("Get Match Error:", error);
    }

    return null;
}

/*=====================================
    USER ALREADY PREDICTED
=====================================*/

export async function hasUserPredicted(uid, predictionId) {
    try {
        if(!uid || !predictionId) return false;
        // New predictions always use this deterministic owner+prediction key.
        // Reading the exact document avoids the user-history query and is also
        // fully compatible with the Firestore rule that allows a user to read
        // only their own prediction.
        const ref = doc(db, USER_PREDICTIONS, `${uid}_${predictionId}`);
        const snapshot = await getDoc(ref);
        return snapshot.exists();
    } catch(error){
        console.error("Has User Predicted Error:", error);
        return false;
    }
}

/*=====================================
    GET USER PREDICTION
=====================================*/

export async function getUserPrediction(uid, predictionId) {
    try {
        if(!uid || !predictionId) return null;
        // Read the exact deterministic document written by submitPrediction.
        // This makes the locked state survive refresh without depending on a
        // collection query or a composite/indexed history query.
        const ref = doc(db, USER_PREDICTIONS, `${uid}_${predictionId}`);
        const snapshot = await getDoc(ref);
        if(!snapshot.exists()) return null;
        return { id: snapshot.id, ...snapshot.data() };
    } catch(error){
        console.error("Get User Prediction Error:", error);
        return null;
    }
}


/*=====================================
    REPAIR CURRENT USER RESULTS
    Only the signed-in user's own documents are touched.
=====================================*/
export async function repairUserPredictionResults(uid, matchId, predictions = []) {
    if(!uid || !matchId || !Array.isArray(predictions) || !predictions.length) return 0;

    try {
        const rows = await getUserPredictions(uid, matchId);
        const byPrediction = new Map(
            predictions.map(prediction => [String(prediction.id), prediction])
        );
        let repaired = 0;

        for(const row of rows){
            const prediction = byPrediction.get(String(row.predictionId));
            if(!prediction || String(prediction.status || '').toUpperCase() !== PredictionStatus.COMPLETED) continue;

            const correct = String(prediction.correctOption ?? '').trim();
            const selected = String(row.selectedOption ?? '').trim();
            if(!correct || !selected) continue;

            const desiredResult = correct === selected ? 'WON' : 'LOST';
            const currentResult = String(row.result || '').toUpperCase();
            const currentStatus = String(row.status || '').toUpperCase();

            if(currentResult === desiredResult && currentStatus === PredictionStatus.COMPLETED) continue;

            const ref = doc(db, USER_PREDICTIONS, row.id);
            await updateDoc(ref, {
                status: PredictionStatus.COMPLETED,
                result: desiredResult,
                correctOption: correct,
                resultResolvedAt: serverTimestamp()
            });
            repaired++;
        }

        return repaired;
    } catch(error){
        console.error('Repair User Prediction Results Error:', error);
        return 0;
    }
}


/*=====================================
    PREDICTION ECONOMY / LIMITS
=====================================*/

export function normalizeCricketFormat(value){
    const raw = String(
        value?.matchType ??
        value?.matchFormat ??
        value?.format ??
        value?.seriesName ??
        value?.series ??
        value ??
        ""
    ).toLowerCase();

    if(/hundred|the hundred|100\s*ball|100\s*balls/.test(raw)) return "HUNDRED";
    if(/test/.test(raw)) return "TEST";
    if(/\bt10\b|ten10|ten-10|10 over/.test(raw)) return "T10";
    if(/\bt20\b|twenty20|twenty-20|20 over/.test(raw)) return "T20";
    if(/\bodi\b|one day|50 over/.test(raw)) return "ODI";
    return "T20";
}

export function getPerMatchPredictionLimit(value){
    switch(normalizeCricketFormat(value)){
        case "T10": return 12;
        case "T20": return 20;
        case "ODI": return 30;
        case "HUNDRED": return 20;
        case "TEST": return 40;
        default: return 20;
    }
}

async function getPersistedUserMatchPredictionCount(uid, matchId){
    if(!uid || !matchId) return 0;

    try{
        const q = query(
            collection(db, USER_PREDICTIONS),
            where("userId", "==", String(uid))
        );

        const snapshot = await getDocs(q);
        let count = 0;

        snapshot.forEach(docSnap => {
            const row = docSnap.data() || {};
            if(String(row.matchId || "") !== String(matchId)) return;

            const status = String(row.status || "").toUpperCase();
            if(status === "CANCELLED") return;

            count++;
        });

        return count;
    }catch(error){
        console.warn("Persisted match prediction count lookup failed:", error);
        return 0;
    }
}

const GLOBAL_PREDICTION_SUBMIT_COOLDOWN_MS = 10 * 1000;

/*=====================================
        SUBMIT PREDICTION
=====================================*/

export async function submitPrediction(data) {

    try {

        if(!data?.userId || !data?.predictionId){
            throw new Error("User and prediction are required.");
        }

        if(
            !auth.currentUser ||
            String(auth.currentUser.uid) !== String(data.userId)
        ){
            throw new Error("Authentication required.");
        }

        const prediction =
            await getPredictionById(data.predictionId);

        if(!prediction){
            throw new Error("Prediction not found.");
        }

        if(!checkPredictionAvailability(prediction)){
            throw new Error("Prediction Closed.");
        }

        if(data.selectedOption == null){
            throw new Error("Please select an option.");
        }

        const validOption =
            (prediction.options || []).some(
                option =>
                    String(option.id) ===
                    String(data.selectedOption)
            );

        if(!validOption){
            throw new Error("Invalid prediction option.");
        }

        /*
        =====================================================
        DETERMINISTIC USER PREDICTION ID
        =====================================================
        */

        const userPredictionId =
            `${data.userId}_${data.predictionId}`;

        const userPredictionRef =
            doc(
                db,
                USER_PREDICTIONS,
                userPredictionId
            );

        const predictionRef =
            doc(
                db,
                PREDICTIONS,
                data.predictionId
            );

        const userRef =
            doc(
                db,
                USERS,
                data.userId
            );

        /*
        Read the user's existing match submissions once before the transaction.
        The transaction field remains the race-condition guard; this read also
        repairs old users whose predictionMatchCounts field predates this limit.
        */
        const persistedMatchCount =
            await getPersistedUserMatchPredictionCount(
                data.userId,
                prediction.matchId || data.matchId
            );

        /*
        =====================================================
        ATOMIC TRANSACTION

        1. Save the user's prediction.
        2. Increase prediction player count.
        3. Increase the user's totalPredictions immediately.

        The same transaction protects all three values from
        getting out of sync.
        =====================================================
        */

        await runTransaction(
            db,
            async transaction => {

                // Firestore transactions must read all documents
                // before performing any writes.
                const predictionSnap =
                    await transaction.get(
                        predictionRef
                    );

                const existingSnap =
                    await transaction.get(
                        userPredictionRef
                    );

                const userSnap =
                    await transaction.get(
                        userRef
                    );

                if(!predictionSnap.exists()){
                    throw new Error(
                        "Prediction not found."
                    );
                }

                if(!userSnap.exists()){
                    throw new Error(
                        "User not found."
                    );
                }

                if(existingSnap.exists()){
                    throw new Error(
                        "Prediction is already submitted and locked."
                    );
                }

                const latest = predictionSnap.data();
                const user = userSnap.data();

                /*
                -----------------------------------------------------
                FORMAT-SPECIFIC PER-MATCH LIMIT

                The limit is counted on submitted predictions for the
                current user + match, not on generated questions.
                -----------------------------------------------------
                */
                const matchIdKey = String(
                    latest.matchId || data.matchId
                );

                const matchFormat =
                    latest.format ||
                    latest.matchFormat ||
                    latest.matchType ||
                    "T20";

                const perMatchLimit =
                    getPerMatchPredictionLimit(matchFormat);

                const matchCounts =
                    user.predictionMatchCounts &&
                    typeof user.predictionMatchCounts === "object"
                        ? { ...user.predictionMatchCounts }
                        : {};

                const currentMatchCount = Math.max(
                    Number(matchCounts[matchIdKey]) || 0,
                    Number(persistedMatchCount) || 0
                );

                if(currentMatchCount >= perMatchLimit){
                    throw new Error(
                        `You have reached the ${perMatchLimit}-prediction limit for this ${normalizeCricketFormat(matchFormat)} match.`
                    );
                }

                /*
                -----------------------------------------------------
                GLOBAL SUBMISSION COOLDOWN

                Prevents farming by jumping between many live matches.
                -----------------------------------------------------
                */
                const lastSubmittedAt =
                    timestampMillis(user.lastPredictionSubmittedAt);

                if(
                    lastSubmittedAt != null &&
                    Date.now() - lastSubmittedAt <
                        GLOBAL_PREDICTION_SUBMIT_COOLDOWN_MS
                ){
                    const remaining = Math.ceil(
                        (
                            GLOBAL_PREDICTION_SUBMIT_COOLDOWN_MS -
                            (Date.now() - lastSubmittedAt)
                        ) / 1000
                    );

                    throw new Error(
                        `Please wait ${remaining}s before submitting another prediction.`
                    );
                }

                matchCounts[matchIdKey] =
                    currentMatchCount + 1;

                if(!checkPredictionAvailability(latest)){
                    throw new Error(
                        "Prediction Closed."
                    );
                }

                /*
                -----------------------------
                SAVE USER PREDICTION
                -----------------------------
                */

                transaction.set(
                    userPredictionRef,
                    {
                        ...data,

                        userId:
                            String(data.userId),

                        predictionId:
                            String(data.predictionId),

                        selectedOption:
                            String(data.selectedOption),

                        status:
                            "SUBMITTED",

                        rewardStatus:
                            "PENDING",

                        locked:
                            true,

                        lockedAt:
                            serverTimestamp(),

                        /*
                        Total prediction count is now recorded
                        at submission time. The reward engine uses
                        this flag so it does not count it again.
                        */
                        statsCounted:
                            true,

                        statsCountedAt:
                            serverTimestamp(),

                        createdAt:
                            serverTimestamp()
                    }
                );

                /*
                -----------------------------
                UPDATE PREDICTION
                -----------------------------
                */

                const optionKey =
                    String(data.selectedOption);

                const optionCounts =
                    latest.optionCounts &&
                    typeof latest.optionCounts === "object"
                        ? { ...latest.optionCounts }
                        : {};

                optionCounts[optionKey] =
                    (
                        Number(
                            optionCounts[optionKey]
                        ) || 0
                    ) + 1;

                transaction.update(
                    predictionRef,
                    {
                        totalPlayers:
                            increment(1),

                        optionCounts,

                        updatedAt:
                            serverTimestamp()
                    }
                );

                /*
                -----------------------------
                UPDATE USER STATS
                -----------------------------
                */

                const currentTotal =
                    Number(
                        user.totalPredictions
                    ) || 0;

                transaction.update(
                    userRef,
                    {
                        totalPredictions:
                            currentTotal + 1,

                        predictionMatchCounts:
                            matchCounts,

                        lastPredictionSubmittedAt:
                            serverTimestamp(),

                        updatedAt:
                            serverTimestamp()
                    }
                );
            }
        );

        /*
        =====================================================
        READ BACK SAVED PREDICTION
        =====================================================
        */

        const savedSnapshot =
            await getDoc(
                userPredictionRef
            );

        return {

            success:
                true,

            id:
                userPredictionId,

            userPrediction:
                savedSnapshot.exists()
                    ? {
                        id:
                            savedSnapshot.id,

                        ...savedSnapshot.data()
                    }
                    : null
        };

    }
    catch(error){

        console.error(
            "Submit Prediction Error:",
            error
        );

        const code =
            String(error?.code || "").toLowerCase();

        const message =
            String(error?.message || "");

        if(
            code.includes("already-exists") ||
            /already exists|already-exist/i.test(message)
        ){
            return {
                success:false,
                message:
                    "Prediction is already submitted and locked."
            };
        }

        return {
            success:false,
            message:
                error.message ||
                "Unable to submit prediction."
        };
    }
}

export function listenPredictionUsers(predictionId, callback){
    const q=query(collection(db, USER_PREDICTIONS), where("predictionId","==",predictionId));
    return onSnapshot(q, snapshot=>{
        const rows=[];
        snapshot.forEach(docSnap=>rows.push({id:docSnap.id,...docSnap.data()}));
        callback(rows);
    }, error=>console.error("Prediction users listener error:",error));
}

/*=====================================
        CREATE PREDICTION
=====================================*/

export async function createPrediction(prediction) {

    try {

        /* Validate */

        if (

            !prediction.matchId ||

            !prediction.sport ||

            !prediction.question ||

            !prediction.options ||

            prediction.options.length < 2

        ) {

            throw new Error(

                "Invalid Prediction Data."

            );

        }

        const sport = String(prediction.sport || "").toLowerCase();

        // Prediction Arena is Cricket-only until other sport engines are
        // intentionally enabled in a future release.
        if(sport !== "cricket"){
            throw new Error(
                "Predictions are currently available for Cricket only."
            );
        }

        const format =
            prediction.format ||
            prediction.matchFormat ||
            prediction.matchType ||
            "T20";

        /* Default Values */
        const predictionData = {
            status: PredictionStatus.LIVE,
            sport: "cricket",
            format,
            difficulty:
                prediction.difficulty ||
                Difficulty.EASY,
            totalPlayers: 0,
            topPercentage: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            ...prediction,
            sport: "cricket",
            format
        };

        const docRef = await addDoc(

            collection(

                db,

                PREDICTIONS

            ),

            predictionData

        );

        return {

            success: true,

            id: docRef.id

        };

    }

    catch (error) {

        console.error(

            "Create Prediction Error:",

            error

        );

        return {

            success: false,

            message: error.message

        };

    }

}

/*=====================================
        UPDATE PREDICTION
=====================================*/

export async function updatePrediction(

    predictionId,

    data

) {

    try {

        await updateDoc(

            doc(

                db,

                PREDICTIONS,

                predictionId

            ),

            {

                ...data,

                updatedAt:

                    serverTimestamp()

            }

        );

        return true;

    }

    catch (error) {

        console.error(

            "Update Prediction Error:",

            error

        );

        return false;

    }

}
/*=====================================
        CLOSE PREDICTION
=====================================*/

export async function closePrediction(

    predictionId

) {

    try {

        return await runTransaction(db, async transaction => {

            const ref = doc(db, PREDICTIONS, predictionId);
            const snap = await transaction.get(ref);

            if(!snap.exists()) return false;

            const data = snap.data();

            if(data.status === PredictionStatus.LOCKED ||
               data.status === PredictionStatus.COMPLETED){
                return true;
            }

            if(data.status !== PredictionStatus.LIVE){
                return false;
            }

            transaction.update(ref, {
                status: PredictionStatus.LOCKED,
                lockedAt: serverTimestamp()
            });

            return true;
        });

    }
    catch(error){

        console.error("Close Prediction Error:", error);
        return false;

    }

}

/*=====================================
        PUBLISH RESULT
=====================================*/

export async function publishResult(

    predictionId,

    correctOption

) {

    try {

        return await runTransaction(

            db,

            async (transaction) => {

                const ref = doc(db, PREDICTIONS, predictionId);
                const snap = await transaction.get(ref);

                if(!snap.exists()) return false;

                const data = snap.data();

                if(data.status === PredictionStatus.CANCELLED){
                    return false;
                }

                const candidate = String(correctOption ?? "").trim();
                if(!candidate) return false;

                // A previous buggy result could have marked a prediction
                // COMPLETED while saving an empty/invalid correctOption. Repair
                // that record when a fresh, valid provider result is available.
                // Never overwrite a valid existing answer with a different one.
                if(data.status === PredictionStatus.COMPLETED){
                    const existing = String(data.correctOption ?? "").trim();
                    if(existing === candidate) return true;

                    const validExisting = Array.isArray(data.options) &&
                        data.options.some(option => String(option?.id ?? "").trim() === existing);

                    if(!existing || !validExisting){
                        transaction.update(ref, {
                            correctOption: candidate,
                            completedAt: data.completedAt || serverTimestamp(),
                            repairedAt: serverTimestamp()
                        });
                        return true;
                    }

                    return false;
                }

                transaction.update(ref, {
                    status: PredictionStatus.COMPLETED,
                    correctOption: candidate,
                    completedAt: serverTimestamp()
                });

                return true;

            }

        );

    }
    catch(error){

        console.error("Publish Result Error:", error);
        return false;

    }

}

/*=====================================
    GET PREDICTION USERS
=====================================*/

export async function getPredictionUsers(

    predictionId

) {

    try {

        const q = query(

            collection(

                db,

                USER_PREDICTIONS

            ),

            where(

                "predictionId",

                "==",

                predictionId

            )

        );

        const snapshot =

            await getDocs(q);

        const users = [];

        snapshot.forEach(docSnap => {

            users.push({

                id: docSnap.id,

                ...docSnap.data()

            });

        });

        return users;

    }

    catch (error) {

        console.error(

            "Get Prediction Users Error",

            error

        );

        return [];

    }

}
/*=====================================
    USER PREDICTION HISTORY
=====================================*/

export async function getUserPredictions(uid, matchId = null) {

    try {

        // Query by userId only and filter matchId in memory. This avoids
        // requiring a composite Firestore index for the prediction page.
        const q = query(
            collection(db, USER_PREDICTIONS),
            where("userId", "==", uid)
        );

        const snapshot = await getDocs(q);
        const rows = [];

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            if(matchId && String(data.matchId) !== String(matchId)) return;
            rows.push({
                id: docSnap.id,
                ...data
            });
        });

        rows.sort((a,b) => {
            const ta = a.createdAt?.toMillis?.() ||
                (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
            const tb = b.createdAt?.toMillis?.() ||
                (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
            return tb - ta;
        });

        return rows;

    }
    catch(error){

        console.error("Get User Predictions Error:", error);
        return [];

    }

}

export async function getUserPredictionHistory(uid, matchId = null) {

    const rows = await getUserPredictions(uid, matchId);

    return Promise.all(rows.map(async row => ({
        userPrediction: row,
        prediction: await getPredictionById(row.predictionId)
    })));

}

/*=====================================
    REALTIME LISTENER
=====================================*/

export function listenPredictions(matchId, sport, callback) {

    const q = query(
        collection(db, PREDICTIONS),
        where("matchId", "==", matchId)
    );

    return onSnapshot(
        q,
        snapshot => {
            snapshot.docChanges().forEach(change => {
                const data = change.doc.data();
                if(String(data.sport || "").toLowerCase() !== String(sport || "").toLowerCase()) return;
                callback({
                    id: change.doc.id,
                    changeType: change.type,
                    ...data
                });
            });
        },
        error => console.error("Prediction Listener Error:", error)
    );

}

/*=====================================
    USER PREDICTIONS
=====================================*/

export function listenUserPredictions(

    uid,

    callback

){

    const q=query(

        collection(

            db,

            USER_PREDICTIONS

        ),

        where(

            "userId",

            "==",

            uid

        )

    );

    return onSnapshot(

        q,

        snapshot=>{

            const list=[];

            snapshot.forEach(docSnap=>{

                list.push({

                    id:docSnap.id,

                    ...docSnap.data()

                });

            });

            callback(list);

        }

    );

}

/*=====================================
        GENERATE CLIENT ID
=====================================*/

export function generatePredictionId() {

    return crypto.randomUUID();

}

/*=====================================
    LIVE COUNT
=====================================*/

export async function getLivePredictionCount(

    matchId

){

    const predictions=

        await getPredictionsByMatch(

            matchId

        );

    return predictions.filter(

        prediction=>

        prediction.status===

        PredictionStatus.LIVE

    ).length;

}