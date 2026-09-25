import {
    db
} from "../firebase-config.js";

import {

doc,

getDoc,

getDocs,

query,

where,

updateDoc,

increment,

serverTimestamp,

collection,

addDoc,

onSnapshot,

runTransaction

}

from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/*====================================

USER SERVICE

====================================*/

const USERS = "users";
const USER_PREDICTIONS = "user_predictions";
/*====================================

PREDICTION REWARDS

====================================*/

export const PREDICTION_REWARDS = {

    easy: {

        correct: {

            xp: 8,

            coins: 5

        },

        wrong: {

            xp: 1,

            coins: 0

        }

    },

    medium: {

        correct: {

            xp: 10,

            coins: 8

        },

        wrong: {

            xp: 2,

            coins: 0

        }

    },

    hard: {

        correct: {

            xp: 12,

            coins: 10

        },

        wrong: {

            xp: 2,

            coins: 0

        }

    },

    expert: {

        correct: {

            xp: 15,

            coins: 12

        },

        wrong: {

            xp: 2,

            coins: 0

        }

    }

};


/*==================================================
    PREDICTION REWARD ECONOMY LIMITS
==================================================*/

export const PREDICTION_ECONOMY = {
    DAILY_XP_CAP: 100,
    DAILY_COIN_CAP: 60
};

function dayKeyUTC(date = new Date()){
    return date.toISOString().slice(0,10);
}

export async function getUser(uid){

    try{

        const snap = await getDoc(

            doc(db, USERS, uid)

        );

        if(!snap.exists()){

            return null;

        }

        return {

            id:snap.id,

            ...snap.data()

        };

    }

    catch(error){

        console.error(

            "Get User Error:",

            error

        );

        return null;

    }

}
/*=====================================

LISTEN USER

=====================================*/

export function listenUser(

    uid,

    callback

){

    return onSnapshot(

        doc(

            db,

            USERS,

            uid

        ),

        (snapshot)=>{

            if(snapshot.exists()){

                callback({

                    id:snapshot.id,

                    ...snapshot.data()

                });

            }

        }

    );

}

export async function updateUser(

    uid,

    data

){

    try{

        await updateDoc(

            doc(db, USERS, uid),

            {

                ...data,

                updatedAt:

                serverTimestamp()

            }

        );

        return true;

    }

    catch(error){

        console.error(

            "Update User Error:",

            error

        );

        return false;

    }

}

export async function updateTheme(

    uid,

    theme

){

    return updateUser(

        uid,

        {

            theme

        }

    );

}

export async function updateSports(

    uid,

    sports

){

    return updateUser(

        uid,

        {

            selectedSports:sports

        }

    );

}

export async function updateSettings(

    uid,

    settings

){

    return updateUser(

        uid,

        settings

    );

}

/*====================================

LEVEL FORMULA

====================================*/

export function getRequiredXP(level){

    if(level <= 0) return 0;

    return Math.floor(

        150 * level +

        ((level - 1) * level * 25)

    );

}

export function calculateLevel(xp){

    let level = 0;

    while(

        xp >= getRequiredXP(level + 1)

    ){

        level++;

    }

    return level;

}

export async function addXP(

    uid,

    amount

){

    try{

        const user =

        await getUser(uid);

        if(!user) return false;

        const newXP =

        (Number(user.xp) || 0) + (Number(amount) || 0);

        const newLevel =

        calculateLevel(newXP);

        await updateUser(

            uid,

            {

                xp:newXP,

                level:newLevel

            }

        );

        return{

            xp:newXP,

            level:newLevel

        };

    }

    catch(error){

        console.error(

            error

        );

        return false;

    }

}

export async function addCoins(

    uid,

    amount

){

    try{

        const user =

        await getUser(uid);

        if(!user) return false;

        await updateUser(

            uid,

            {

                coins:

                user.coins + amount

            }

        );

        return true;

    }

    catch(error){

        console.error(

            error

        );

        return false;

    }

}


/*====================================
    SYNC / REPAIR PREDICTION STATS

    The prediction page can be opened after a prediction was already
    submitted (for example, before the stats fix was installed). In that
    case the user's `users/{uid}` counters can be stale even though the
    `user_predictions` record exists.

    This function rebuilds ONLY prediction counters from the user's
    prediction records. XP, coins, level and streak are not touched.
====================================*/

export async function syncPredictionStats(uid){

    try{

        if(!uid) return null;

        const userRef = doc(db, USERS, uid);
        const userSnap = await getDoc(userRef);

        if(!userSnap.exists()){
            return null;
        }

        const q = query(
            collection(db, USER_PREDICTIONS),
            where("userId", "==", String(uid))
        );

        const snapshot = await getDocs(q);

        let total = 0;
        let correct = 0;
        let wrong = 0;

        snapshot.forEach(docSnap => {

            const data = docSnap.data() || {};
            const status = String(data.status || "").toUpperCase();

            // Cancelled/invalid records are not user predictions.
            if(status === "CANCELLED") return;

            total += 1;

            const result = String(
                data.result ||
                data.predictionResult ||
                ""
            ).toUpperCase();

            if(
                result === "WON" ||
                data.isCorrect === true
            ){
                correct += 1;
            }else if(
                result === "LOST" ||
                data.isCorrect === false
            ){
                wrong += 1;
            }

        });

        // Keep the aggregate counters consistent even if older records
        // were created before the counter fix.
        await updateDoc(
            userRef,
            {
                totalPredictions: total,
                correctPredictions: correct,
                wrongPredictions: wrong,
                updatedAt: serverTimestamp()
            }
        );

        return {
            totalPredictions: total,
            correctPredictions: correct,
            wrongPredictions: wrong,
            accuracy: total
                ? Number(((correct / total) * 100).toFixed(1))
                : 0
        };

    }catch(error){

        console.error(
            "Sync Prediction Stats Error:",
            error
        );

        return null;

    }

}

export function calculateAccuracy(

    correct,

    total

){

    if(total===0){

        return 0;

    }

    return Number(

        (

            (correct/total)

            *100

        ).toFixed(1)

    );


}

export async function getUserStats(uid){

    const user=

    await getUser(uid);

    if(!user) return null;

    return{

        xp:user.xp,

        level:user.level,

        coins:user.coins,

        total:user.totalPredictions,

        correct:user.correctPredictions,

        wrong:user.wrongPredictions,

        streak:user.currentStreak,

        accuracy:

        calculateAccuracy(

            user.correctPredictions,

            user.totalPredictions

        )

    };

}

export async function updatePredictionStats(

    uid,

    isCorrect

){

    try{

        const user = await getUser(uid);

        if(!user) return false;

        const data = {

            totalPredictions:

                user.totalPredictions + 1,

            updatedAt:

                serverTimestamp()

        };

        if(isCorrect){

            data.correctPredictions =

                user.correctPredictions + 1;

        }

        else{

            data.wrongPredictions =

                user.wrongPredictions + 1;

        }

        await updateDoc(

            doc(db, USERS, uid),

            data

        );

        return true;

    }

    catch(error){

        console.error(

            "Prediction Stats Error",

            error

        );

        return false;

    }

}

export async function updateStreak(

    uid,

    isCorrect

){

    const user = await getUser(uid);

    if(!user) return;

    let streak =

        Number(user.currentStreak) || 0;

    let best =

        Number(user.bestStreak) || 0;

    if(isCorrect){

        streak++;

        if(streak > best){

            best = streak;

        }

    }

    else{

        streak = 0;

    }

    await updateUser(

        uid,

        {

            currentStreak: streak,

            bestStreak: best

        }

    );

}

export async function givePredictionRewardOnce(

    userPredictionId,

    uid,

    difficulty,

    isCorrect

){

    try{

        const reward =
            PREDICTION_REWARDS[difficulty]?.[
                isCorrect ? "correct" : "wrong"
            ];

        if(!reward){
            throw new Error("Invalid prediction difficulty.");
        }

        const userRef = doc(db, USERS, uid);
        const predictionRef = doc(db, USER_PREDICTIONS, userPredictionId);

        return await runTransaction(db, async transaction => {

            const userSnap = await transaction.get(userRef);
            const predictionSnap = await transaction.get(predictionRef);

            if(!userSnap.exists()){
                throw new Error("User not found.");
            }

            if(!predictionSnap.exists()){
                throw new Error("User prediction not found.");
            }

            const predictionData = predictionSnap.data();

            // Idempotency guard: the same prediction can never reward twice.
            if(
                predictionData.rewardStatus === "REWARDED" ||
                predictionData.rewardedAt
            ){
                return { rewarded:false, alreadyRewarded:true };
            }

            const user = userSnap.data();
            const currentXP = Number(user.xp) || 0;
            const currentCoins = Number(user.coins) || 0;
            const totalPredictions = Number(user.totalPredictions) || 0;

            /*
            Daily prediction-reward budget.
            Prediction gameplay is still allowed after the cap, but XP/coins
            from prediction rewards stop increasing for that UTC day.
            */
            const today = dayKeyUTC();
            const rewardDay =
                user.predictionRewardDay === today
                    ? today
                    : today;

            const usedDailyXP =
                user.predictionRewardDay === today
                    ? Number(user.predictionRewardXP) || 0
                    : 0;

            const usedDailyCoins =
                user.predictionRewardDay === today
                    ? Number(user.predictionRewardCoins) || 0
                    : 0;

            const remainingXP = Math.max(
                0,
                PREDICTION_ECONOMY.DAILY_XP_CAP - usedDailyXP
            );

            const remainingCoins = Math.max(
                0,
                PREDICTION_ECONOMY.DAILY_COIN_CAP - usedDailyCoins
            );

            const allowedXP = Math.min(
                Number(reward.xp) || 0,
                remainingXP
            );

            const allowedCoins = Math.min(
                Number(reward.coins) || 0,
                remainingCoins
            );
            const correctPredictions = Number(user.correctPredictions) || 0;
            const wrongPredictions = Number(user.wrongPredictions) || 0;
            let currentStreak = Number(user.currentStreak) || 0;
            let bestStreak = Number(user.bestStreak) || 0;

            if(isCorrect){
                currentStreak += 1;
                if(currentStreak > bestStreak) bestStreak = currentStreak;
            }else{
                currentStreak = 0;
            }

            const newXP = currentXP + allowedXP;
            const newLevel = calculateLevel(newXP);
            const newCoins = currentCoins + allowedCoins;

            const newDailyXP =
                usedDailyXP + allowedXP;

            const newDailyCoins =
                usedDailyCoins + allowedCoins;
            const newCorrect = correctPredictions + (isCorrect ? 1 : 0);
            const newWrong = wrongPredictions + (isCorrect ? 0 : 1);

            /*
            New predictions are counted when submitted.
            Older user_predictions created before this fix may not
            have statsCounted=true, so count those once at reward time.
            */
            const alreadyCounted =
                predictionData.statsCounted === true;

            const newTotal =
                alreadyCounted
                    ? totalPredictions
                    : totalPredictions + 1;

            const rewardHistoryRef = doc(collection(db, "rewards"));

            transaction.update(userRef, {
                xp: newXP,
                level: newLevel,
                coins: newCoins,
                totalPredictions: newTotal,
                correctPredictions: newCorrect,
                wrongPredictions: newWrong,
                currentStreak,
                bestStreak,
                predictionRewardDay: rewardDay,
                predictionRewardXP: newDailyXP,
                predictionRewardCoins: newDailyCoins,
                updatedAt: serverTimestamp()
            });

            transaction.update(predictionRef, {
                result: isCorrect ? "WON" : "LOST",
                rewardStatus: "REWARDED",
                rewardXP: allowedXP,
                rewardCoins: allowedCoins,
                rewardedAt: serverTimestamp(),
                statsCounted: true,
                statsCountedAt: serverTimestamp()
            });

            transaction.set(rewardHistoryRef, {
                uid,
                reason: isCorrect ? "Correct Prediction" : "Wrong Prediction",
                xp: allowedXP,
                coins: allowedCoins,
                predictionId: predictionData.predictionId || null,
                userPredictionId,
                createdAt: serverTimestamp()
            });

            return {
                rewarded:true,
                alreadyRewarded:false,
                reward: {
                    ...reward,
                    xp: allowedXP,
                    coins: allowedCoins
                },
                xp:newXP,
                level:newLevel,
                coins:newCoins,
                dailyRewardXP:newDailyXP,
                dailyRewardCoins:newDailyCoins
            };
        });

    }
    catch(error){

        console.error("Prediction Reward Once Error", error);
        return null;

    }

}

/*==================================================
    REPAIR / RECONCILE ALREADY-REWARDED PREDICTION
    Keeps result and stored reward amount consistent.
==================================================*/
export async function reconcilePredictionReward(
    userPredictionId,
    uid,
    difficulty,
    isCorrect
){
    try{
        const reward = PREDICTION_REWARDS[difficulty]?.[
            isCorrect ? "correct" : "wrong"
        ];

        if(!reward){
            throw new Error("Invalid prediction difficulty.");
        }

        const userRef = doc(db, USERS, uid);
        const predictionRef = doc(db, USER_PREDICTIONS, userPredictionId);

        return await runTransaction(db, async transaction => {
            const userSnap = await transaction.get(userRef);
            const predictionSnap = await transaction.get(predictionRef);

            if(!userSnap.exists() || !predictionSnap.exists()) return false;

            const predictionData = predictionSnap.data();
            if(predictionData.rewardStatus !== "REWARDED") return false;

            const currentXPReward = Number(predictionData.rewardXP) || 0;
            const currentCoinReward = Number(predictionData.rewardCoins) || 0;
            const expectedXP = Number(reward.xp) || 0;
            const expectedCoins = Number(reward.coins) || 0;

            const deltaXP = Math.max(0, expectedXP - currentXPReward);
            const deltaCoins = Math.max(0, expectedCoins - currentCoinReward);

            const user = userSnap.data();
            const currentXP = Number(user.xp) || 0;
            const currentCoins = Number(user.coins) || 0;
            const today = dayKeyUTC();

            const usedDailyXP =
                user.predictionRewardDay === today
                    ? Number(user.predictionRewardXP) || 0
                    : 0;
            const usedDailyCoins =
                user.predictionRewardDay === today
                    ? Number(user.predictionRewardCoins) || 0
                    : 0;

            if(deltaXP === 0 && deltaCoins === 0){
                transaction.update(predictionRef, {
                    result: isCorrect ? "WON" : "LOST"
                });
                return false;
            }

            const correctionHistoryRef = doc(collection(db, "rewards"));

            const newXP = currentXP + deltaXP;
            transaction.update(userRef, {
                xp: newXP,
                level: calculateLevel(newXP),
                coins: currentCoins + deltaCoins,
                predictionRewardDay: today,
                predictionRewardXP: usedDailyXP + deltaXP,
                predictionRewardCoins: usedDailyCoins + deltaCoins,
                updatedAt: serverTimestamp()
            });

            transaction.update(predictionRef, {
                result: isCorrect ? "WON" : "LOST",
                rewardXP: expectedXP,
                rewardCoins: expectedCoins,
                rewardAdjustedAt: serverTimestamp()
            });

            transaction.set(correctionHistoryRef, {
                uid,
                reason: "Prediction Reward Correction",
                xp: deltaXP,
                coins: deltaCoins,
                predictionId: predictionData.predictionId || null,
                userPredictionId,
                createdAt: serverTimestamp()
            });

            return {
                repaired: true,
                xp: expectedXP,
                coins: expectedCoins,
                deltaXP,
                deltaCoins
            };
        });
    }catch(error){
        console.error("Prediction Reward Reconciliation Error:", error);
        return false;
    }
}

export async function givePredictionReward(

    uid,

    difficulty,

    isCorrect

){

    try{

        const reward =

            PREDICTION_REWARDS

            [difficulty]

            [isCorrect

                ? "correct"

                : "wrong"

            ];

        await addXP(

            uid,

            reward.xp

        );

        if(reward.coins > 0){

            await addCoins(

                uid,

                reward.coins

            );

        }

        await updatePredictionStats(

            uid,

            isCorrect

        );

        await updateStreak(

            uid,

            isCorrect

        );
        await saveRewardHistory(

    uid,

    isCorrect

        ? "Correct Prediction"

        : "Wrong Prediction",

    reward.xp,

    reward.coins

);

        return reward;

    }

    catch(error){

        console.error(

            "Reward Error",

            error

        );

        return null;

    }

}

/*====================================

WELCOME BONUS

====================================*/

export async function giveWelcomeBonus(uid){

    try{

        const user = await getUser(uid);

        if(!user) return false;

        if(user.welcomeBonusClaimed){

            return false;

        }

        const newXP = user.xp + 10;

        const newLevel = calculateLevel(newXP);

        await updateUser(uid,{

            xp:newXP,

            level:newLevel,

            coins:user.coins + 5,

            welcomeBonusClaimed:true

        });

        await saveRewardHistory(

            uid,

            "Welcome Bonus",

            10,

            5

        );

        return true;

    }

    catch(error){

        console.error(

            "Welcome Bonus Error",

            error

        );

        return false;

    }

}

/*====================================

DAILY MISSION

====================================*/

export async function updateDailyMission(

    uid,

    amount = 1

){

    try{

        const user = await getUser(uid);

        if(!user) return;

        await updateUser(

            uid,

            {

                dailyMissionCompleted:

                    user.dailyMissionCompleted +

                    amount

            }

        );

    }

    catch(error){

        console.error(error);

    }

}

/*====================================

WEEKLY MISSION

====================================*/

export async function updateWeeklyMission(

    uid,

    amount = 1

){

    try{

        const user = await getUser(uid);

        if(!user) return;

        await updateUser(

            uid,

            {

                weeklyMissionCompleted:

                    user.weeklyMissionCompleted +

                    amount

            }

        );

    }

    catch(error){

        console.error(error);

    }

}

/*====================================

RESET DAILY

====================================*/

export async function resetDailyMission(uid){

    return updateUser(

        uid,

        {

            dailyMissionCompleted:0

        }

    );

}


/*====================================

RESET WEEKLY

====================================*/

export async function resetWeeklyMission(uid){

    return updateUser(

        uid,

        {

            weeklyMissionCompleted:0

        }

    );

}

/*====================================

SAVE REWARD HISTORY

====================================*/

export async function saveRewardHistory(

    uid,

    reason,

    xp,

    coins

){

    try{

        await addDoc(

            collection(

                db,

                "rewards"

            ),

            {

                uid,

                reason,

                xp,

                coins,

                createdAt:

                    serverTimestamp()

            }

        );

    }

    catch(error){

        console.error(

            error

        );

    }

}
