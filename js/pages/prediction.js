/* ==========================================================
    FanConnact - Prediction Page Controller
    Real Firestore prediction flow; no hardcoded prediction data.
========================================================== */

import * as predictionService from "../services/predictionService.js";
import * as userService from "../services/userService.js";
import { auth } from "../firebase-config.js";
import {
    handleMatchFinished
} from "../engines/predictionLifecycle.js";
import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let generatePredictions = null;

async function runPredictionEngine(){
    if(!state.match || state.sport !== "cricket") return;

    try{
        if(!generatePredictions){
            const engine =
                await import("../engines/predictionEngine.js");
            generatePredictions =
                engine.generatePredictions;
        }

        if(typeof generatePredictions === "function"){
            await generatePredictions({
                ...state.match,
                sport: "cricket",
                matchType:
                    state.match.matchType ||
                    state.match.matchFormat ||
                    state.match.format ||
                    "T20"
            });
        }
    }catch(error){
        // Prediction engine failure must never break the prediction page.
        console.warn("Prediction engine generation skipped:", error);
    }
}

const REWARDS = userService.PREDICTION_REWARDS || {};

const state = {
    matchId: null,
    sport: null,
    match: null,
    user: null,
    predictions: [],
    history: [],
    activeTab: "live",
    unsubscribeUser: null,
    unsubscribePredictions: null,
    countdownTimer: null,
    matchPollTimer: null,
    matchPollBusy: false,
    resultProcessing: false,
    selectedOptions: new Map(),
};

const ui = {
    container: document.getElementById("predictionContainer"),
    feed: document.getElementById("matchFeedContainer"),
    team1: document.getElementById("team1Name"),
    team2: document.getElementById("team2Name"),
    team1Score: document.getElementById("team1Score"),
    team2Score: document.getElementById("team2Score"),
    team1Initial: document.getElementById("team1Initial"),
    team2Initial: document.getElementById("team2Initial"),
    badge: document.getElementById("matchBadge"),
    status: document.getElementById("matchStatus")
};

function qs(name){
    return document.getElementById(name);
}

function showMessage(message, type = "info"){
    if(!ui.container) return;

    const icon = type === "error" ? "error" : "info";
    ui.container.innerHTML = `
        <div class="bg-white dark:bg-brand-card border border-gray-200 dark:border-brand-border rounded-2xl p-8 text-center">
            <span class="material-symbols-outlined text-4xl text-gray-400">${icon}</span>
            <p class="text-gray-500 dark:text-gray-400 mt-3 text-sm">${escapeHtml(message)}</p>
        </div>
    `;
}

function escapeHtml(value){
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getURLParameters(){
    const params = new URLSearchParams(window.location.search);

    // Priority: explicit Match Center URL -> same-tab saved match ->
    // persisted last Match Center match. This keeps direct sidebar
    // Predictions navigation match-specific without inventing an ID.
    // Only an explicit URL matchId is authoritative.
    // Do NOT reuse an old session/localStorage match here: direct
    // Predictions navigation must always resolve the current real match.
    state.matchId =
        params.get("matchId") ||
        params.get("id") ||
        params.get("match") ||
        null;

    // Prediction Arena is Cricket-only for now.
    // Ignore any sport query parameter so other sports can never
    // switch this page or create non-cricket predictions.
    state.sport = "cricket";
}

function waitForAuth(){
    return new Promise(resolve => {
        const unsubscribe = onAuthStateChanged(auth, user => {
            unsubscribe();
            resolve(user || null);
        });
    });
}

async function loadCurrentUser(){
    const authUser = await waitForAuth();

    if(!authUser){
        state.user = null;
        updateHeaderForGuest();
        return null;
    }

    state.user = await userService.getUser(authUser.uid);

    // Repair stale prediction counters from user_predictions before
    // rendering the stats panel. This fixes predictions submitted before
    // the counter fix was installed and keeps the UI truthful after refresh.
    if(state.user && typeof userService.syncPredictionStats === "function"){
        const syncedStats = await userService.syncPredictionStats(authUser.uid);
        if(syncedStats){
            state.user = {
                ...state.user,
                ...syncedStats
            };
        }
    }

    if(!state.user){
        state.user = {
            uid: authUser.uid,
            username: authUser.displayName || authUser.email?.split("@")[0] || "User",
            fullName: authUser.displayName || "User",
            photoURL: authUser.photoURL || "",
            xp: 0,
            level: 0,
            coins: 0,
            totalPredictions: 0,
            correctPredictions: 0,
            wrongPredictions: 0,
            currentStreak: 0,
            bestStreak: 0
        };
    }else{
        state.user.uid = authUser.uid;
    }

    updateUserUI(state.user);

    if(state.unsubscribeUser) state.unsubscribeUser();
    state.unsubscribeUser = userService.listenUser(authUser.uid, user => {
        state.user = { ...user, uid: authUser.uid };
        updateUserUI(state.user);
        renderCurrentTab();
    });

    return state.user;
}

function updateHeaderForGuest(){
    const name = qs("user-name-display");
    const level = qs("user-level-display");
    if(name) name.textContent = "Guest";
    if(level) level.textContent = "";
}

function calculateLevel(xp){
    xp = Math.max(0, Math.floor(Number(xp) || 0));
    let level = 0;
    while(xp >= requiredXP(level + 1)) level++;
    return level;
}

function requiredXP(level){
    level = Math.max(0, Math.floor(Number(level) || 0));
    if(level <= 0) return 0;
    return Math.floor(150 * level + ((level - 1) * level * 25));
}

function updateUserUI(user){
    const name = user.username || user.fullName || "User";
    const level = calculateLevel(user.xp);

    if(qs("user-name-display")) qs("user-name-display").textContent = "@" + String(name).replace(/^@/, "");
    if(qs("user-level-display")) qs("user-level-display").textContent = "LVL " + level;
    if(qs("wallet-coin-balance")) qs("wallet-coin-balance").textContent = (Number(user.coins) || 0).toLocaleString();

    setText("totalPredictions", Number(user.totalPredictions) || 0);
    setText("correctPredictions", Number(user.correctPredictions) || 0);

    const total = Number(user.totalPredictions) || 0;
    const correct = Number(user.correctPredictions) || 0;
    const accuracy = total ? ((correct / total) * 100).toFixed(1) : "0";

    setText("accuracy", accuracy + "%");
    setText("bestStreak", Number(user.bestStreak) || 0);
    setText("level", level);
    setText("rank", "#" + (user.predictionRank || "-"));
}

function setText(id, value){
    const el = qs(id);
    if(el) el.textContent = value;
}

async function loadMatch(){
    /*
     * IMPORTANT:
     * Match Center/backend is the source of truth for real match data.
     * We do NOT depend on Firestore's "matches" collection for the page header.
     * This is what makes match-center -> prediction and direct Prediction work.
     */
    const apiBases = [window.FC_API ? window.FC_API.api() : (location.origin.includes('localhost') ? 'http://localhost:5000/api' : location.origin)];

    async function requestRawMatch(path, timeoutMs = 8000){
        let lastError = null;

        for(const base of apiBases){
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);

            try{
                const response = await fetch(base + path, {
                    method: "GET",
                    headers: { Accept: "application/json" },
                    cache: "no-store",
                    signal: controller.signal
                });

                if(!response.ok){
                    throw new Error(`Match API ${response.status}: ${path}`);
                }

                return await response.json();
            }catch(error){
                lastError = error?.name === "AbortError"
                    ? new Error(`Match API timeout: ${path}`)
                    : error;
                console.warn("Prediction raw match API failed:", base + path, lastError);
            }finally{
                clearTimeout(timer);
            }
        }

        throw lastError || new Error("Match API unavailable.");
    }

    async function requestMatch(path){
        let lastError = null;

        for(const base of apiBases){
            try{
                const response = await fetch(base + path, {
                    method: "GET",
                    headers: { Accept: "application/json" },
                    cache: "no-store"
                });

                if(!response.ok){
                    throw new Error(`Match API ${response.status}: ${path}`);
                }

                const raw = await response.json();
                return normalizeBackendMatch(raw, state.matchId);
            }catch(error){
                lastError = error;
                console.warn("Prediction match API failed:", base + path, error);
            }
        }

        throw lastError || new Error("Match API unavailable.");
    }

    try{
        if(state.matchId){
            // Match Center loads both the match endpoint and scorecard.
            // Some live/older provider matches return incomplete team data
            // from /matches/:id even though /matches/:id/scorecard is valid.
            // Prediction must resolve the SAME match before loading questions.
            let matchRaw = null;
            let scorecardRaw = null;

            // Resolve the match endpoint FIRST. The scorecard is optional enrichment
            // and must never be allowed to keep the prediction page stuck on "Loading".
            try{
                matchRaw = await requestRawMatch(
                    `/matches/${encodeURIComponent(state.matchId)}`
                );
            }catch(error){
                console.warn("Prediction match endpoint failed:", error);
            }

            // Fetch scorecard only after the match request has completed. It is used
            // to repair incomplete team data, exactly like Match Center does.
            try{
                scorecardRaw = await requestRawMatch(
                    `/matches/${encodeURIComponent(state.matchId)}/scorecard`,
                    6000
                );
            }catch(error){
                console.warn("Prediction scorecard fallback failed:", error);
                scorecardRaw = null;
            }

            state.match = normalizeBackendMatch(matchRaw, state.matchId);

            // IMPORTANT: if /matches/:id has no usable teams, resolve them from
            // the same scorecard used by Match Center. Never invent Team A/B.
            if(!hasRealTeams(state.match) && scorecardRaw){
                const scoreRoot = scorecardRaw?.data || scorecardRaw || {};
                const scoreSource =
                    scoreRoot?.scorecard && typeof scoreRoot.scorecard === "object" && !Array.isArray(scoreRoot.scorecard)
                        ? scoreRoot.scorecard
                        : scoreRoot;

                const headers =
                    scoreRoot?.matchheaders ||
                    scoreRoot?.matchHeaders ||
                    scoreRoot?.matchheader ||
                    scoreRoot?.matchHeader ||
                    scoreRoot?.matchInfo ||
                    scoreSource?.matchheaders ||
                    scoreSource?.matchHeaders ||
                    scoreSource?.matchheader ||
                    scoreSource?.matchHeader ||
                    {};

                const innings =
                    (Array.isArray(scoreRoot?.scorecard) ? scoreRoot.scorecard : null) ||
                    (Array.isArray(scoreRoot?.innings) ? scoreRoot.innings : null) ||
                    (Array.isArray(scoreSource?.scorecard) ? scoreSource.scorecard : null) ||
                    (Array.isArray(scoreSource?.innings) ? scoreSource.innings : null) ||
                    [];

                const teamObject = value => {
                    if(!value) return {};
                    if(typeof value === "string") return { name: value };
                    return value;
                };
                const teamNameFrom = value => String(
                    value?.teamname || value?.teamName || value?.name ||
                    value?.team_name || value?.displayName || value?.batteamname || ""
                ).trim();

                const homeSource = teamObject(
                    headers.team1 || headers.homeTeam || headers.home ||
                    headers.teams?.home ||
                    scoreRoot.team1 || scoreRoot.homeTeam || scoreRoot.home ||
                    scoreRoot.teams?.home ||
                    scoreSource.team1 || scoreSource.homeTeam || scoreSource.home ||
                    scoreSource.teams?.home
                );
                const awaySource = teamObject(
                    headers.team2 || headers.awayTeam || headers.away ||
                    headers.teams?.away ||
                    scoreRoot.team2 || scoreRoot.awayTeam || scoreRoot.away ||
                    scoreRoot.teams?.away ||
                    scoreSource.team2 || scoreSource.awayTeam || scoreSource.away ||
                    scoreSource.teams?.away
                );

                const firstInnings = innings[0] || {};
                const secondInnings = innings[1] || {};

                // Scorecard data is only an enrichment source. It must never
                // replace a valid match pair with duplicate/ambiguous teams.
                const homeName = teamNameFrom(homeSource) || teamNameFrom(firstInnings);
                const awayName = teamNameFrom(awaySource) || teamNameFrom(secondInnings);
                const validScoreTeams = Boolean(
                    homeName &&
                    awayName &&
                    homeName.toLowerCase() !== awayName.toLowerCase()
                );

                const scoreStatus =
                    headers.state ??
                    headers.matchState ??
                    headers.status ??
                    scoreSource.state ??
                    scoreSource.matchState ??
                    scoreSource.status ??
                    null;
                const scoreIsLive =
                    headers.isLive === true ||
                    scoreSource.isLive === true;
                const scoreStart =
                    headers.matchstarttimestamp || headers.startTime ||
                    scoreSource.startdate || scoreSource.startTime || null;

                // IMPORTANT:
                // The match endpoint is the primary source, but it can lag behind
                // the live scorecard. Match Center is already showing this match
                // as LIVE, so a stale "UPCOMING" value from /matches/:id must NOT
                // force the Prediction hero back to UPCOMING.
                //
                // Also, scorecard "state" can be display text such as
                // "India opt to bat". Never treat that text as a lifecycle status.
                const explicitScorecardStatus =
                    classifyLifecycleValue(scoreStatus);

                const scorecardHasLiveEvidence =
                    scoreIsLive === true ||
                    explicitScorecardStatus === "LIVE" ||
                    hasLiveScorecardEvidence(scoreRoot, scoreSource, innings);

                const scorecardLifecycle =
                    explicitScorecardStatus === "FINISHED"
                        ? "FINISHED"
                        : scorecardHasLiveEvidence
                            ? "LIVE"
                            : null;

                if(validScoreTeams){
                    const currentStatus = String(
                        state.match?.status || "UPCOMING"
                    ).toUpperCase();

                    const resolvedStatus =
                        scorecardLifecycle === "FINISHED"
                            ? "FINISHED"
                            : scorecardLifecycle === "LIVE"
                                ? "LIVE"
                                : currentStatus;

                    state.match = {
                        ...(state.match || {}),
                        id: String(state.matchId),
                        sport: String(state.sport || "cricket").toLowerCase(),
                        status: resolvedStatus,
                        startTime: state.match?.startTime || scoreStart || null,

                        // Keep the API pair when it is already valid. Use the
                        // scorecard pair only when the API pair is missing or
                        // duplicated. This prevents "India vs India".
                        homeTeam: {
                            ...(state.match?.homeTeam || {}),
                            ...homeSource,
                            name: homeName
                        },
                        awayTeam: {
                            ...(state.match?.awayTeam || {}),
                            ...awaySource,
                            name: awayName
                        }
                    };
                }else if(scorecardLifecycle){
                    state.match = {
                        ...(state.match || {}),
                        status: scorecardLifecycle
                    };
                }
            }
        }else{
            let list = [];

            try{
                const liveRaw = await requestMatchList("/matches/live");
                list = extractMatchList(liveRaw);
            }catch(error){
                console.warn("Live match lookup failed:", error);
            }

            if(!list.length){
                const upcomingRaw = await requestMatchList("/matches/upcoming");
                list = extractMatchList(upcomingRaw);
            }

            // Prediction Arena is Cricket-only for now.
            // Never pick a Football/Basketball/etc. match for the hero card.
            list = list.filter(item => {
                const normalized = normalizeBackendMatch(item, item?.id);
                return String(normalized.sport || "cricket").toLowerCase() === "cricket";
            });

            if(list.length){
                state.match = normalizeBackendMatch(list[0], list[0]?.id);
                state.matchId = String(state.match.id);
                state.sport = "cricket";
            }
        }
    }catch(error){
        console.error("Real match load failed:", error);
        showMessage(
            "Real match data could not be loaded. Please keep the backend running on port 5000 and try again.",
            "error"
        );
        return null;
    }

    if(!state.match || !hasRealTeams(state.match)){
        showMessage(
            "Real match data is unavailable for this match. No dummy team data is used.",
            "error"
        );
        return null;
    }

    // Hard guard: this page supports Cricket predictions only.
    // A direct URL to another sport must not render its hero card or predictions.
    const resolvedSport = String(state.match.sport || "cricket").toLowerCase();
    if(resolvedSport !== "cricket"){
        console.warn("Prediction page ignored non-cricket match:", {
            matchId: state.match.id,
            sport: resolvedSport
        });
        showMessage(
            "Predictions are currently available for Cricket only.",
            "info"
        );
        return null;
    }

    state.matchId = String(state.match.id || state.matchId);
    state.sport = "cricket";

    renderMatchHeader(state.match);
    return state.match;
}

async function requestMatchList(path){
    const bases = [window.FC_API ? window.FC_API.api() : (location.origin.includes('localhost') ? 'http://localhost:5000/api' : location.origin)];

    let lastError = null;
    for(const base of bases){
        try{
            const response = await fetch(base + path, {
                headers: { Accept: "application/json" },
                cache: "no-store"
            });
            if(!response.ok) throw new Error(`Match API ${response.status}: ${path}`);
            return await response.json();
        }catch(error){
            lastError = error;
        }
    }
    throw lastError || new Error("Match API unavailable.");
}

function extractMatchList(raw){
    if(Array.isArray(raw)) return raw;
    if(Array.isArray(raw?.data)) return raw.data;
    if(Array.isArray(raw?.matches)) return raw.matches;
    if(Array.isArray(raw?.data?.matches)) return raw.data.matches;
    return [];
}

function normalizeBackendMatch(raw, requestedId){
    // Keep the same response-shape resolution used by Match Center.
    // Merge root + nested matchInfo so live score fields are not lost when
    // a provider places teams under matchInfo/matchHeader.
    const root = raw?.data || raw || {};

    const candidates = [
        root?.match,
        root?.matchInfo,
        root?.matchHeader,
        root?.matchheader,
        root?.matchheaders,
        root
    ];

    const source =
        candidates.find(value =>
            value &&
            typeof value === "object" &&
            !Array.isArray(value) &&
            Object.keys(value).length
        ) || {};

    const home =
        source.homeTeam ||
        source.home ||
        source.team1 ||
        source.teams?.home ||
        root.team1 ||
        root.homeTeam ||
        root.home ||
        root.teams?.home ||
        {};

    const away =
        source.awayTeam ||
        source.away ||
        source.team2 ||
        source.teams?.away ||
        root.team2 ||
        root.awayTeam ||
        root.away ||
        root.teams?.away ||
        {};

    const currentInnings =
        source.currentInnings ||
        root.currentInnings ||
        source.innings?.current ||
        root.innings?.current ||
        {};

    const currentOver =
        source.currentOver ??
        source.over ??
        currentInnings.currentOver ??
        currentInnings.over ??
        root.currentOver ??
        root.over ??
        root.score?.currentOver ??
        root.score?.over ??
        null;

    const lastEvent =
        source.lastEvent ||
        root.lastEvent ||
        source.lastEventInfo ||
        root.lastEventInfo ||
        root.recentEvents?.[0] ||
        root.events?.[0] ||
        null;

    const homeName = realTeamName(home);
    const awayName = realTeamName(away);

    return {
        ...root,
        ...source,

        id: String(
            source.id ??
            source.matchId ??
            root.id ??
            root.matchId ??
            requestedId ??
            ""
        ),

        sport: String(
            source.sport ||
            root.sport ||
            state.sport ||
            "cricket"
        ).toLowerCase(),

        status: normalizeMatchStatus(
            source.status ?? root.status,
            source.state ??
                root.state ??
                source.matchState ??
                root.matchState,
            source.isLive ?? root.isLive
        ),

        startTime:
            source.startTime ||
            source.start_at ||
            source.startAt ||
            source.date ||
            source.startDate ||
            root.startTime ||
            root.start_at ||
            root.startAt ||
            root.date ||
            root.startDate ||
            null,

        matchType:
            source.matchType ||
            source.matchFormat ||
            source.format ||
            root.matchType ||
            root.matchFormat ||
            root.format ||
            "",

        homeTeam: { ...home, name: homeName },
        awayTeam: { ...away, name: awayName },

        // Live cricket fields required by the prediction engine.
        currentOver: Number(currentOver) || 0,
        currentInnings,
        innings:
            source.innings ||
            root.innings ||
            [],

        currentBatter:
            source.currentBatter ||
            root.currentBatter ||
            source.currentBatters?.[0] ||
            root.currentBatters?.[0] ||
            null,

        currentBowler:
            source.currentBowler ||
            root.currentBowler ||
            source.currentBowlers?.[0] ||
            root.currentBowlers?.[0] ||
            null,

        currentBatters:
            source.currentBatters ||
            root.currentBatters ||
            source.batsmen ||
            root.batsmen ||
            [],

        currentBowlers:
            source.currentBowlers ||
            root.currentBowlers ||
            source.bowlers ||
            root.bowlers ||
            [],

        topPlayers:
            source.topPlayers ||
            root.topPlayers ||
            source.players ||
            root.players ||
            [],

        lastEvent,
        recentEvents:
            source.recentEvents ||
            root.recentEvents ||
            source.events ||
            root.events ||
            [],

        overHistory:
            source.overHistory ||
            source.overs ||
            root.overHistory ||
            root.overs ||
            source.recentOvers ||
            root.recentOvers ||
            [],

        lastOverRuns:
            source.lastOverRuns ??
            source.previousOverRuns ??
            root.lastOverRuns ??
            root.previousOverRuns ??
            null,

        lastOverHadWicket:
            source.lastOverHadWicket ??
            root.lastOverHadWicket ??
            null,

        lastOverHadSix:
            source.lastOverHadSix ??
            root.lastOverHadSix ??
            null,

        lastOverHadBoundary:
            source.lastOverHadBoundary ??
            root.lastOverHadBoundary ??
            null,

        expectedOverRuns:
            source.expectedOverRuns ??
            root.expectedOverRuns ??
            source.currentOverRunsExpected ??
            root.currentOverRunsExpected ??
            null,

        expectedPowerplay:
            source.expectedPowerplay ??
            root.expectedPowerplay ??
            null,

        expectedTotal:
            source.expectedTotal ??
            root.expectedTotal ??
            null,

        target:
            source.target ??
            root.target ??
            root.targetscore ??
            null,

        runsNeeded:
            source.runsNeeded ??
            root.runsNeeded ??
            root.requiredruns ??
            null,

        ballsRemaining:
            source.ballsRemaining ??
            root.ballsRemaining ??
            root.requiredballs ??
            null,

        winner:
            source.winner ??
            source.winnerTeam ??
            source.winnerId ??
            source.result?.winner ??
            root.winner ??
            root.winnerTeam ??
            root.winnerId ??
            root.result?.winner ??
            null,

        winnerId:
            source.winnerId ??
            source.result?.winnerId ??
            root.winnerId ??
            root.result?.winnerId ??
            null,

        result:
            source.result ||
            root.result ||
            null,

        tossWinner:
            source.tossWinner ??
            source.tossWinnerId ??
            source.toss?.winner ??
            root.tossWinner ??
            root.tossWinnerId ??
            root.toss?.winner ??
            null,

        tossWinnerId:
            source.tossWinnerId ??
            source.toss?.winnerId ??
            root.tossWinnerId ??
            root.toss?.winnerId ??
            null
    };
}

function realTeamName(team){
    if(!team) return "";
    if(typeof team === "string") return team.trim();

    return String(
        team.name ??
        team.teamname ??
        team.teamName ??
        team.shortName ??
        team.teamsname ??
        team.teamSName ??
        team.displayName ??
        team.team_name ??
        ""
    ).trim();
}

function classifyLifecycleValue(value){
    const normalized = String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/[-_]+/g, " ")
        .replace(/\\s+/g, " ");

    if([
        "live",
        "in progress",
        "inprogress",
        "started",
        "ongoing",
        "innings break",
        "stumps",
        "rain delay"
    ].includes(normalized)){
        return "LIVE";
    }

    if([
        "finished",
        "completed",
        "complete",
        "ended",
        "result",
        "match ended",
        "abandoned",
        "cancelled",
        "canceled"
    ].includes(normalized)){
        return "FINISHED";
    }

    return null;
}

function hasLiveScorecardEvidence(scoreRoot, scoreSource, innings){
    const sources = [
        scoreRoot,
        scoreSource,
        ...(Array.isArray(innings) ? innings : [])
    ].filter(Boolean);

    for(const source of sources){
        if(typeof source !== "object") continue;

        if(source.isLive === true || source.live === true){
            return true;
        }

        const explicit =
            classifyLifecycleValue(source.status) ||
            classifyLifecycleValue(source.state) ||
            classifyLifecycleValue(source.matchState);

        if(explicit === "LIVE") return true;

        // A live scorecard normally exposes an active over/score. Do not use
        // team names, toss text, or scheduled start time as live evidence.
        const numericKeys = [
            "currentOver",
            "over",
            "currentScore",
            "score",
            "runs",
            "totalRuns",
            "scoreText"
        ];

        if(numericKeys.some(key => {
            const value = source[key];
            if(value == null || value === "") return false;
            if(typeof value === "number") return value >= 0;
            if(typeof value === "object") return (
                value.runs != null ||
                value.score != null ||
                value.total != null
            );
            return /\\d/.test(String(value));
        })){
            return true;
        }
    }

    return false;
}

function normalizeMatchStatus(status, stateValue, isLive){
    if(isLive === true) return "LIVE";

    const normalize = value => String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/[-_]+/g, " ")
        .replace(/\s+/g, " ");

    const classify = value => {
        if([
            "live",
            "in progress",
            "inprogress",
            "started",
            "ongoing",
            "innings break",
            "stumps",
            "rain delay"
        ].includes(value)) return "LIVE";

        if([
            "finished",
            "completed",
            "complete",
            "ended",
            "result",
            "match ended",
            "abandoned",
            "cancelled",
            "canceled"
        ].includes(value)) return "FINISHED";

        return null;
    };

    // Prefer a definitive lifecycle value from state, but NEVER let an
    // unrecognised state/display string overwrite a definitive status.
    // Example: state="India opt to bat", status="live" must remain LIVE.
    const fromState = classify(normalize(stateValue));
    if(fromState) return fromState;

    const fromStatus = classify(normalize(status));
    if(fromStatus) return fromStatus;

    return "UPCOMING";
}

function hasRealTeams(match){
    const home = realTeamName(match?.homeTeam);
    const away = realTeamName(match?.awayTeam);

    return Boolean(
        match?.id &&
        home &&
        away &&
        home.toLowerCase() !== "team a" &&
        away.toLowerCase() !== "team b" &&
        home !== "Loading..." &&
        away !== "Loading..." &&
        home.toLowerCase() !== away.toLowerCase()
    );
}

function teamName(team){
    if(!team) return "Team";
    return team.name || team.shortName || team.displayName || String(team);
}

function teamScore(team){
    if(!team) return "";
    if(team.score != null) return team.score;
    if(team.runs != null) return team.runs;
    if(team.scoreText != null) return team.scoreText;
    return "";
}

function renderMatchHeader(match){
    const home = match.homeTeam || match.home || match.team1 || {};
    const away = match.awayTeam || match.away || match.team2 || {};

    const homeName = teamName(home);
    const awayName = teamName(away);

    if(ui.team1) ui.team1.textContent = homeName;
    if(ui.team2) ui.team2.textContent = awayName;
    if(ui.team1Score) ui.team1Score.textContent = teamScore(home);
    if(ui.team2Score) ui.team2Score.textContent = teamScore(away);
    if(ui.team1Initial) ui.team1Initial.textContent = homeName.charAt(0).toUpperCase();
    if(ui.team2Initial) ui.team2Initial.textContent = awayName.charAt(0).toUpperCase();

    const status = String(match.status || "UPCOMING").toUpperCase();
    if(ui.badge) ui.badge.textContent = status === "LIVE" ? "LIVE" : status;
    if(ui.status) ui.status.textContent = status;

    if(ui.feed){
        const event = match.lastEvent;
        if(event){
            ui.feed.innerHTML = `
                <div class="text-sm text-gray-600 dark:text-gray-300">
                    <strong>${escapeHtml(event.type || "Match event")}</strong>
                    ${event.description ? `<div class="text-xs text-gray-400 mt-1">${escapeHtml(event.description)}</div>` : ""}
                </div>
            `;
        }else{
            ui.feed.innerHTML = `<div class="text-xs text-gray-400">Live match events will appear here.</div>`;
        }
    }
}

async function loadPredictions(){
    // Cricket-only guard. This also protects against old/future non-cricket
    // prediction documents being rendered by this page.
    state.sport = "cricket";
    if(!state.matchId || !state.match || String(state.match.sport || "cricket").toLowerCase() !== "cricket") return;

    const matchStatus = String(state.match.status || "UPCOMING").toUpperCase();

    // The page tab must follow the real match lifecycle.
    if(matchStatus === "LIVE") state.activeTab = "live";
    else if(matchStatus === "UPCOMING") state.activeTab = "prematch";
    else if(matchStatus === "FINISHED" || matchStatus === "COMPLETED") state.activeTab = "results";

    async function loadMatchPredictions(){
        const all = await predictionService.getPredictionsByMatch(
            String(state.matchId)
        );

        const now = Date.now();

        return all
            .filter(item =>
                String(item.sport || "").toLowerCase() === String(state.sport || "").toLowerCase()
            )
            .filter(item => {
                if(matchStatus === "FINISHED" || matchStatus === "COMPLETED") return true;
                if(String(item.status || "") !== "LIVE") return false;

                // Never show an expired LIVE prediction. An old LIVE document can
                // remain in Firestore briefly before the lifecycle worker closes it.
                const expiry = toMillis(item.expiresAt);
                return expiry == null || expiry > now;
            });
    }

    // 1) Read all questions for this exact match first. Do not use the old
    //    getLivePredictions-only path because it hides pre-match questions.
    state.predictions = await loadMatchPredictions();

    // Repair the signed-in user's old PENDING/incorrectly persisted result as
    // soon as the authoritative prediction document is COMPLETED. This is what
    // makes an old Firestore PENDING record become WON or LOST after refresh.
    if(state.user?.uid && state.predictions.length){
        try {
            await predictionService.repairUserPredictionResults(
                state.user.uid,
                state.matchId,
                state.predictions
            );
        } catch(error){
            console.warn('Prediction result repair skipped:', error);
        }
    }

    /*
     * The prediction engine is the single source of truth for question
     * generation. There is intentionally NO page-level "Who will win?"
     * fallback here. That old fallback was the reason the page could show
     * only one match-winner question while the rule engine was waiting.
     */
    if(!state.predictions.length && matchStatus !== "FINISHED"){
        showMessage(
            "No prediction is available at this moment. The next eligible cricket checkpoint will open one.",
            "info"
        );
    }

    if(state.user?.uid){
        // Keep the normal history for Results/My Predictions, but resolve the
        // currently displayed questions from their exact deterministic user
        // prediction documents. This is the authoritative lock state and
        // survives refresh even if the history collection query is unavailable.
        try {
            state.history = await predictionService.getUserPredictionHistory(
                state.user.uid,
                state.matchId
            );
        } catch(error){
            console.warn("Prediction history query failed:", error);
            state.history = [];
        }

        for(const prediction of state.predictions){
            const mine = await predictionService.getUserPrediction(
                state.user.uid,
                prediction.id
            );
            if(!mine) continue;
            const index = state.history.findIndex(item =>
                String(item.userPrediction?.predictionId) === String(prediction.id)
            );
            const row = { userPrediction: mine, prediction: prediction };
            if(index === -1) state.history.push(row);
            else state.history[index] = { ...state.history[index], ...row };
        }
    }

    // Match status decides the visible tab after data is ready.
    document.querySelectorAll(".tab-btn").forEach(button => {
        button.classList.toggle("active", (button.dataset.tab || "live") === state.activeTab);
    });

    renderCurrentTab();
}

async function refreshHistory(){
    if(!state.user) return;
    try {
        state.history = await predictionService.getUserPredictionHistory(
            state.user.uid,
            state.matchId
        );
    } catch(error){
        console.warn("Prediction history refresh failed:", error);
        state.history = [];
    }

    // Always restore the exact current-match prediction from its deterministic
    // document. This is what controls the ✓/LOCKED/SUBMITTED UI.
    for(const prediction of state.predictions){
        const mine = await predictionService.getUserPrediction(
            state.user.uid,
            prediction.id
        );
        if(!mine) continue;
        const index = state.history.findIndex(item =>
            String(item.userPrediction?.predictionId) === String(prediction.id)
        );
        const row = { userPrediction: mine, prediction };
        if(index === -1) state.history.push(row);
        else state.history[index] = { ...state.history[index], ...row };
    }
}

function getMyPrediction(predictionId){
    const target = String(predictionId ?? "");
    return state.history.find(item =>
        String(item.userPrediction?.predictionId ?? "") === target
    )?.userPrediction || null;
}

function rewardFor(prediction){
    const difficulty = prediction?.difficulty || "easy";
    return REWARDS[difficulty] || REWARDS.easy || { correct:{xp:0,coins:0}, wrong:{xp:0,coins:0} };
}

function formatExpiry(value){
    const ms = toMillis(value);
    if(ms == null) return "";
    const remaining = Math.max(0, ms - Date.now());
    const totalSeconds = Math.floor(remaining / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2,"0")}:${String(seconds).padStart(2,"0")}`;
}

function toMillis(value){
    if(value == null) return null;
    if(typeof value === "number") return value;
    if(value instanceof Date) return value.getTime();
    if(typeof value.toMillis === "function") return value.toMillis();
    if(typeof value.seconds === "number") return value.seconds * 1000;
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : null;
}

async function renderCurrentTab(){
    if(!ui.container) return;
    if(state.activeTab === "results"){ renderResults(); return; }
    if(state.activeTab === "history"){ renderHistory(); return; }
    await renderPredictions(state.predictions);
}

function isPlaceholderOptionText(value){
    const text=String(value ?? "").trim().toLowerCase();
    return !text || ["—","-","team a","team b","team 1","team 2","loading...","loading"].includes(text);
}

function getRealOptions(prediction){
    return (Array.isArray(prediction?.options) ? prediction.options : []).filter(option=>
        !isPlaceholderOptionText(option?.text ?? option?.label ?? option?.name ?? option?.id)
    );
}

async function refreshPredictionStats(predictions){
    (predictions || []).forEach(prediction => {
        try{
            const counts = prediction?.optionCounts && typeof prediction.optionCounts === "object"
                ? prediction.optionCounts
                : {};
            const total = Math.max(0, Number(prediction.totalPlayers) || 0);
            prediction.options = getRealOptions(prediction).map(option => {
                const count = Number(counts[String(option.id)]) || 0;
                return {
                    ...option,
                    percent: total ? Number(((count / total) * 100).toFixed(1)) : 0
                };
            });
        }catch(error){
            console.warn("Prediction stats refresh failed:", error);
        }
    });
}


function selectPredictionOption(predictionId, optionId){
    if(!state.user){ showToast("Please login before making a prediction.","error"); return; }
    if(getMyPrediction(predictionId)){ showToast("Prediction is already locked.","warning"); return; }
    const prediction=state.predictions.find(p=>String(p.id)===String(predictionId));
    if(!prediction || !isOpen(prediction)){ showToast("Prediction Closed","warning"); return; }
    if(!getRealOptions(prediction).some(o=>String(o.id)===String(optionId))) return;
    state.selectedOptions.set(String(predictionId),String(optionId));
    renderCurrentTab();
}

function ensureConfirmModal(){
    let modal=document.getElementById("prediction-confirm-modal");
    if(modal) return modal;
    modal=document.createElement("div");
    modal.id="prediction-confirm-modal";
    modal.className="prediction-confirm-modal";
    modal.innerHTML=`<div class="prediction-confirm-backdrop" data-confirm-cancel></div><div class="prediction-confirm-dialog" role="dialog" aria-modal="true"><div class="prediction-confirm-icon">✓</div><h3>Submit Prediction?</h3><p>You can't change your prediction after submitting.</p><div class="prediction-confirm-actions"><button type="button" class="prediction-confirm-cancel" data-confirm-cancel>Cancel</button><button type="button" class="prediction-confirm-submit" data-confirm-submit>Submit</button></div></div>`;
    document.body.appendChild(modal);
    modal.querySelectorAll('[data-confirm-cancel]').forEach(b=>b.addEventListener('click',()=>resolveConfirm(false)));
    modal.querySelector('[data-confirm-submit]').addEventListener('click',()=>resolveConfirm(true));
    return modal;
}
function resolveConfirm(value){
    const modal=document.getElementById("prediction-confirm-modal"); if(!modal) return;
    const resolver=modal._resolver; modal._resolver=null; modal.classList.remove('is-open'); if(resolver) resolver(value);
}
function showConfirm(){
    const modal=ensureConfirmModal(); modal.classList.add('is-open');
    return new Promise(resolve=>{ modal._resolver=resolve; });
}

async function renderPredictions(predictions){
    if(!predictions.length){
        showMessage(
            state.match?.status === "UPCOMING"
                ? "No prediction is available yet for this match."
                : "No live predictions are currently available."
        );
        return;
    }
    await refreshPredictionStats(predictions);
    ui.container.innerHTML=predictions.map(renderPredictionCard).join("");
    ui.container.querySelectorAll('[data-prediction-option]').forEach(button=>button.addEventListener('click',()=>selectPredictionOption(button.dataset.predictionId,button.dataset.optionId)));
    ui.container.querySelectorAll('[data-prediction-submit]').forEach(button=>button.addEventListener('click',()=>submitPrediction(button.dataset.predictionId)));
    startCountdowns();
}

function renderPredictionCard(prediction){
    const mine=getMyPrediction(prediction.id);
    const rewards=rewardFor(prediction);
    const options=getRealOptions(prediction);
    const status=String(prediction.status||"LIVE");
    const locked=status!=="LIVE" || !isOpen(prediction);
    const displayStatus=mine ? "SUBMITTED" : status;
    const selectedId=mine?.selectedOption ?? state.selectedOptions.get(String(prediction.id));
    const optionsHtml=options.map(option=>{
        const selected=selectedId!=null && String(selectedId)===String(option.id);
        return `<button type="button" class="prediction-option ${selected?'active':''} ${mine||locked?'opacity-80':''}" data-prediction-option data-prediction-id="${escapeHtml(prediction.id)}" data-option-id="${escapeHtml(option.id)}" ${mine||locked?'disabled':''}><span class="option-title">${escapeHtml(option.text??option.label??option.name??option.id)}</span><span class="option-percent">${escapeHtml((option.percent??0)+'%')}</span>${selected?'<span class="prediction-selected-check">✓</span>':''}</button>`;
    }).join('');
    let resultLine='';
    if(status==='COMPLETED' && prediction.correctOption!=null){
        const correct=options.find(o=>String(o.id)===String(prediction.correctOption));
        resultLine+=`<div class="prediction-result-line">Result: <strong>${escapeHtml(correct?.text??prediction.correctOption)}</strong></div>`;
    }
    if(mine){
        const selected=options.find(o=>String(o.id)===String(mine.selectedOption));
        const won=String(mine.result||'').toUpperCase()==='WON';
        const lost=String(mine.result||'').toUpperCase()==='LOST';
        resultLine+=`<div class="prediction-my-pick">Your prediction: <strong>${escapeHtml(selected?.text??mine.selectedOption)}</strong>${won?'<span class="prediction-result-badge won">WON</span>':''}${lost?'<span class="prediction-result-badge lost">LOST</span>':''}${mine.rewardStatus==='REWARDED'?`<span class="prediction-reward-earned">+${Number(mine.rewardXP)||0} XP · +${Number(mine.rewardCoins)||0} Coins</span>`:''}</div>`;
    }
    const submitHtml=!mine && !locked && selectedId!=null ? `<div class="prediction-submit-wrap"><button type="button" class="prediction-submit-btn" data-prediction-submit data-prediction-id="${escapeHtml(prediction.id)}">Submit Prediction</button></div>`:'';
    const timerValue = predictionTimerValue(prediction);
    const timerLabel = predictionTimerLabel(prediction, mine, locked);
    const timerData = (prediction?.milestoneTarget === 50 || prediction?.milestoneTarget === 100)
        ? ""
        : `data-expiry="${escapeHtml(toMillis(prediction.expiresAt)??'')}"`;

    return `<div class="prediction-card" data-card-id="${escapeHtml(prediction.id)}"><div class="prediction-card-header"><div class="prediction-live"><span class="live-dot ${status==='LIVE' && !mine?'':'completed'}"></span>${escapeHtml(displayStatus)}</div><div class="prediction-timer"><i class="fa-regular fa-clock"></i><div><span class="time-value" ${timerData}>${escapeHtml(timerValue)}</span><small>${escapeHtml(timerLabel)}</small></div></div></div><h2 class="prediction-question">${escapeHtml(prediction.question||'Prediction')}</h2><div class="prediction-options">${optionsHtml||'<div class="text-sm text-gray-400">No real options are available.</div>'}</div>${submitHtml}${resultLine}<div class="prediction-footer"><div class="reward-section"><span class="reward-title">Reward</span><div class="reward-item coins">🪙 +${Number(rewards.correct?.coins)||0} Coins</div><div class="reward-item xp">⭐ +${Number(rewards.correct?.xp)||0} XP</div></div><div class="prediction-count"><strong>${Number(prediction.totalPlayers)||0}</strong><span>People Predict</span></div></div></div>`;
}

function isOpen(prediction){
    if(String(prediction?.status || "").toUpperCase() !== "LIVE") return false;

    // Milestone questions intentionally have no wall-clock expiry. They stay
    // open until the user submits or the milestone is actually completed.
    if(
        prediction?.milestoneTarget === 50 ||
        prediction?.milestoneTarget === 100 ||
        prediction?.type === "PLAYER_FIFTY" ||
        prediction?.type === "PLAYER_CENTURY"
    ){
        return true;
    }

    const expiry = toMillis(prediction?.expiresAt);
    return expiry != null && expiry > Date.now();
}

function predictionTimerLabel(prediction, mine, locked){
    if(mine || locked) return "Locked";

    const target = Number(prediction?.milestoneTarget);
    if(target === 50 || target === 100) return `Until ${target}`;

    return "Time Left";
}

function predictionTimerValue(prediction){
    const target = Number(prediction?.milestoneTarget);
    if(target === 50 || target === 100) return `Until ${target}`;

    return formatExpiry(prediction?.expiresAt) || "—";
}

async function submitPrediction(predictionId){
    if(!state.user){
        showToast("Please login before making a prediction.","error");
        return;
    }

    const prediction = state.predictions.find(
        p => String(p.id) === String(predictionId)
    );
    const optionId = state.selectedOptions.get(String(predictionId));

    if(!prediction || optionId == null){
        showToast("Select a team first.","warning");
        return;
    }

    if(!isOpen(prediction)){
        showToast("Prediction Closed","warning");
        return;
    }

    if(getMyPrediction(predictionId)){
        showToast("Prediction is already locked.","warning");
        return;
    }

    if(!await showConfirm()) return;

    try{
        const result = await predictionService.submitPrediction({
            userId: state.user.uid,
            predictionId: prediction.id,
            selectedOption: optionId,
            matchId: state.matchId,
            sport: state.sport
        });

        if(!result?.success){
            throw new Error(
                result?.message || "Unable to submit prediction."
            );
        }

        // Clear only the temporary selection. The persisted user_prediction
        // becomes the authoritative selected/locked state.
        state.selectedOptions.delete(String(predictionId));

        const saved = result.userPrediction ||
            await predictionService.getUserPrediction(
                state.user.uid,
                prediction.id
            );

        if(!saved){
            throw new Error(
                "Prediction was saved, but the saved record could not be read back."
            );
        }

        const index = state.history.findIndex(item =>
            String(item.userPrediction?.predictionId ?? "") ===
            String(prediction.id)
        );

        const row = {
            userPrediction: saved,
            prediction: { ...prediction }
        };

        if(index === -1){
            state.history.push(row);
        }else{
            state.history[index] = {
                ...state.history[index],
                ...row
            };
        }

        // Reconcile the user's aggregate prediction counters immediately.
        // This also repairs older records if the page was opened before the
        // stats fix was installed.
        if(typeof userService.syncPredictionStats === "function"){
            const syncedStats = await userService.syncPredictionStats(state.user.uid);
            if(syncedStats){
                state.user = { ...state.user, ...syncedStats };
                updateUserUI(state.user);
            }
        }

        // Immediately show SUBMITTED + ✓ + LOCKED.
        renderCurrentTab();

        // Refresh Firestore prediction totals/percentages. The realtime
        // listener will also update these when another user submits.
        await loadPredictions();

        showToast("Prediction Submitted Successfully","success");
    }catch(error){
        console.error("Prediction submit error:",error);
        showToast(
            error?.message || "Unable to submit prediction",
            "error"
        );
    }
}

function renderResults(){
    const matchStatus = String(state.match?.status || "UPCOMING").toUpperCase();

    // Results are strictly post-match. A completed live/event prediction
    // must not make the Results tab appear before the actual match finishes.
    if(matchStatus !== "FINISHED" && matchStatus !== "COMPLETED"){
        showMessage(
            matchStatus === "LIVE"
                ? "Results will appear here after the match is actually finished."
                : "Results will appear here after the match is finished."
        );
        return;
    }

    const completed = state.history.filter(item => {
        const prediction = item?.prediction;
        const userPrediction = item?.userPrediction;
        const correct = String(prediction?.correctOption ?? "").trim();
        const selected = String(userPrediction?.selectedOption ?? "").trim();
        const result = String(userPrediction?.result ?? "").toUpperCase();
        return prediction &&
            String(prediction.status || "").toUpperCase() === "COMPLETED" &&
            correct &&
            selected &&
            (result === "WON" || result === "LOST" || result === "");
    });

    if(!completed.length){
        showMessage("No completed predictions for this match yet.");
        return;
    }

    ui.container.innerHTML = completed.map(({userPrediction, prediction}) => {
        const selected = prediction.options?.find(o => String(o.id) === String(userPrediction.selectedOption));
        const correct = prediction.options?.find(o => String(o.id) === String(prediction.correctOption));
        // Once a real correctOption exists, result is deterministic. Never
        // default an unresolved/blank answer to LOST.
        const won = String(userPrediction.selectedOption) === String(prediction.correctOption);

        return `
            <div class="prediction-card">
                <div class="prediction-card-header">
                    <div class="prediction-live"><span class="live-dot completed"></span>RESULT</div>
                    <div class="prediction-result-badge ${won ? "won" : "lost"}">${won ? "WON" : "LOST"}</div>
                </div>
                <h2 class="prediction-question">${escapeHtml(prediction.question || "Prediction")}</h2>
                <div class="text-sm text-gray-500 dark:text-gray-400 space-y-2">
                    <div>Your pick: <strong>${escapeHtml(selected?.text ?? userPrediction.selectedOption)}</strong></div>
                    <div>Correct: <strong>${escapeHtml(correct?.text ?? prediction.correctOption)}</strong></div>
                </div>
            </div>
        `;
    }).join("");
}

function renderHistory(){
    if(!state.history.length){
        showMessage("You have not made a prediction for this match yet.");
        return;
    }

    ui.container.innerHTML = state.history.map(({userPrediction, prediction}) => {
        const selected = prediction?.options?.find(o => String(o.id) === String(userPrediction.selectedOption));
        const status = prediction?.status || userPrediction.status || "PENDING";

        return `
            <div class="prediction-card">
                <div class="prediction-card-header">
                    <div class="prediction-live"><span class="live-dot ${status === "COMPLETED" ? "completed" : ""}"></span>${escapeHtml(status)}</div>
                    <div class="text-xs text-gray-400">${escapeHtml(formatExpiry(prediction?.expiresAt) || "")}</div>
                </div>
                <h2 class="prediction-question">${escapeHtml(prediction?.question || "Prediction")}</h2>
                <div class="text-sm text-gray-500 dark:text-gray-400">
                    Your pick: <strong>${escapeHtml(selected?.text ?? userPrediction.selectedOption)}</strong>
                </div>
            </div>
        `;
    }).join("");
}

function startCountdowns(){
    if(state.countdownTimer) clearInterval(state.countdownTimer);

    state.countdownTimer = setInterval(() => {
        ui.container?.querySelectorAll("[data-expiry]").forEach(el => {
            const expiry = Number(el.dataset.expiry);
            if(!expiry) return;
            el.textContent = formatExpiry(expiry) || "00:00";
        });
    }, 1000);
}

function attachEvents(){
    const howToPlayModal = document.getElementById("howToPlayModal");
    const howToPlayButton = document.getElementById("howToPlayBtn");

    function closeHowToPlay(){
        if(!howToPlayModal) return;
        howToPlayModal.classList.remove("is-open");
        howToPlayModal.setAttribute("aria-hidden", "true");
    }

    if(howToPlayModal && howToPlayButton){
        howToPlayButton.addEventListener("click", () => {
            howToPlayModal.classList.add("is-open");
            howToPlayModal.setAttribute("aria-hidden", "false");
            howToPlayModal.querySelector(".how-to-play-close")?.focus();
        });

        howToPlayModal.querySelectorAll("[data-how-to-play-close]").forEach(button => {
            button.addEventListener("click", closeHowToPlay);
        });

        document.addEventListener("keydown", event => {
            if(event.key === "Escape" && howToPlayModal.classList.contains("is-open")){
                closeHowToPlay();
            }
        });
    }

    document.querySelectorAll(".tab-btn").forEach(button => {
        button.addEventListener("click", async () => {
            document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
            button.classList.add("active");
            state.activeTab = button.dataset.tab || "live";
            if(state.activeTab === "results" || state.activeTab === "history"){
                await refreshHistory();
            }
            renderCurrentTab();
        });
    });

    document.querySelectorAll(".sport-pill").forEach(button => {
        button.addEventListener("click", async () => {
            // Cricket-only for now. Ignore any future non-cricket pill.
            if(String(button.dataset.sport || "").toLowerCase() !== "cricket"){
                return;
            }

            document.querySelectorAll(".sport-pill").forEach(b => b.classList.remove("active"));
            button.classList.add("active");
            state.sport = "cricket";
            await loadPredictions();
        });
    });
}

function listenRealtime(){
    if(!state.matchId || !state.sport) return;
    if(state.unsubscribePredictions) state.unsubscribePredictions();

    function toMillisSafe(value){
        if(value == null) return null;
        if(typeof value === "number") return value;
        if(value instanceof Date) return value.getTime();
        if(typeof value.toMillis === "function") return value.toMillis();
        if(typeof value.seconds === "number") return value.seconds * 1000;

        const parsed = new Date(value).getTime();
        return Number.isFinite(parsed) ? parsed : null;
    }

    function isActiveLivePrediction(prediction){
        if(!prediction) return false;

        if(String(prediction.sport || "").toLowerCase()
            !== String(state.sport || "").toLowerCase()){
            return false;
        }

        if(String(prediction.status || "").toUpperCase() !== "LIVE"){
            return false;
        }

        const expiresAt = toMillisSafe(prediction.expiresAt);

        // Keep the same compatibility rule used by loadPredictions():
        // no expiry means open; an existing expiry must still be future.
        return expiresAt == null || expiresAt > Date.now();
    }

    state.unsubscribePredictions = predictionService.listenPredictions(
        state.matchId,
        state.sport,
        change => {
            const id = String(change.id || "");
            if(!id) return;

            const index = state.predictions.findIndex(
                p => String(p.id) === id
            );

            // The service deliberately sends "removed" whenever a prediction
            // leaves the LIVE/non-expired state. Remove it from the live board.
            if(change.changeType === "removed"
                || !isActiveLivePrediction(change)){

                if(index !== -1){
                    state.predictions.splice(index, 1);
                }

                if(String(change.status || "").toUpperCase() === "COMPLETED"){
                    refreshHistory().catch(()=>{});
                }

                renderCurrentTab();
                return;
            }

            if(index === -1){
                state.predictions.push(change);
            }else{
                state.predictions[index] = {
                    ...state.predictions[index],
                    ...change
                };
            }

            renderCurrentTab();
        }
    );
}

/* ==========================================================
   MATCH RESULT FINALIZATION

   IMPORTANT: loadMatch() can correctly detect FINISHED, but detecting the
   status alone does not finalize Firestore predictions. The lifecycle/result
   engine must be called explicitly. This also repairs matches that finished
   while the Prediction page was closed.
========================================================== */

async function finalizeFinishedMatch(match){
    const status = String(match?.status || "").toUpperCase();

    if(status !== "FINISHED" && status !== "COMPLETED") return false;
    if(state.resultProcessing) return false;

    state.resultProcessing = true;

    try{
        const rewardUid =
            state.user?.uid ||
            auth.currentUser?.uid ||
            null;

        await handleMatchFinished(match, rewardUid);
        return true;
    }catch(error){
        console.error("Finished match result processing failed:", error);
        return false;
    }finally{
        state.resultProcessing = false;
    }
}

function showToast(message, type = "success"){
    if(window.showToast){
        window.showToast(message, type);
        return;
    }

    console[type === "error" ? "error" : "log"](message);
}


/* ==========================================================
   LIVE PREDICTION REFRESH
   Generation must not depend on the Prediction page staying open.
   This page still refreshes its own match snapshot so milestone/event
   rules see the latest batter/over/event data.
========================================================== */

async function refreshPredictionMatch(){
    if(state.matchPollBusy || !state.matchId) return;
    state.matchPollBusy = true;

    try{
        const latest = await loadMatch();
        if(!latest) return;

        // CRITICAL FIX: status detection and result finalization are two
        // separate operations. Finalize the match BEFORE rebuilding the UI.
        // This updates prediction.correctOption, COMPLETED status and the
        // current user's WON/LOST + REWARDED record.
        const finished = await finalizeFinishedMatch(latest);

        await runPredictionEngine();
        await loadPredictions();

        if(finished ||
            String(latest.status || "").toUpperCase() === "FINISHED" ||
            String(latest.status || "").toUpperCase() === "COMPLETED"
        ){
            if(state.matchPollTimer){
                clearInterval(state.matchPollTimer);
                state.matchPollTimer = null;
            }
        }
    }catch(error){
        console.warn("Prediction live refresh skipped:", error);
    }finally{
        state.matchPollBusy = false;
    }
}

function startPredictionMatchPolling(){
    if(state.matchPollTimer) clearInterval(state.matchPollTimer);

    // 20s keeps milestone/event generation responsive without creating a
    // per-ball API hammering loop. Match Service cache itself is untouched.
    state.matchPollTimer = setInterval(refreshPredictionMatch, 20000);
}


async function init(){
    try{
        getURLParameters();

        // Auth is optional for viewing predictions. Never block the page on
        // Firebase auth initialization.
        await Promise.race([
            loadCurrentUser(),
            new Promise(resolve => setTimeout(resolve, 2500))
        ]);

        // Login is required only when submitting a prediction.
        // The prediction board must load even if auth is not ready.
        const match = await loadMatch();
        if(!match) return;

        // Before finalizing a finished match, make sure Firebase Auth has
        // resolved the current user. Result publication can work without a
        // user, but rewards are user-owned and require the exact UID.
        if(!state.user){
            await loadCurrentUser();
        }

        // CRITICAL FIX: also finalize an already-finished match on page open.
        // This repairs predictions that remained PENDING because the match
        // ended while the user/page was offline or closed.
        await finalizeFinishedMatch(match);

        // Cricket-only: the Cricket pill is the only active sport option.
        state.sport = "cricket";
        document.querySelectorAll(".sport-pill").forEach(p => {
            p.classList.toggle("active", String(p.dataset.sport || "").toLowerCase() === "cricket");
        });

        attachEvents();
        await runPredictionEngine();
        await loadPredictions();
        listenRealtime();
        startPredictionMatchPolling();
    }
    catch(error){
        console.error("Prediction page init error:", error);
        showMessage("Unable to load predictions right now.", "error");
    }
}

document.addEventListener("DOMContentLoaded", init);
