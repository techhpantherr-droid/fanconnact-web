const cache = require("./cacheEngine");

// Prevent duplicate API requests for same cache key
const pendingRequests = new Map();

// Keep the last successful value so a temporary upstream 429 does not break
// the FanConnact match lists.
const staleValues = new Map();

// When RapidAPI returns 429, do not immediately hit the same endpoint again.
const failedUntil = new Map();
const RATE_LIMIT_COOLDOWN = 60;

const MATCH_LIST_KEYS = new Set([
    "LIVE_MATCHES",
    "UPCOMING",
    "RECENT"
]);

class CacheManager {

    get(key) {
        return cache.get(key);
    }

    set(key, value, ttl) {
        cache.set(key, value, ttl);

        // Keep the last successful value in memory so any upstream failure
        // (403 / 429 / timeout / DNS) can still serve real data.
        staleValues.set(key, value);
    }

    has(key) {
        return cache.has(key);
    }

    delete(key) {
        pendingRequests.delete(key);
        failedUntil.delete(key);
        staleValues.delete(key);
        cache.del(key);
    }

    clear() {
        pendingRequests.clear();
        failedUntil.clear();
        staleValues.clear();
        cache.flush();
    }

    /**
     * Smart Cache + Request Deduplication + 429 protection.
     *
     * A 429 from RapidAPI is treated as a temporary upstream condition for
     * match-list endpoints. The last successful response is returned when
     * available; otherwise an empty list is returned. This keeps the API
     * response stable and prevents a rapid retry loop from creating more 429s.
     */
    async getOrCreate(cacheKey, ttl, fetchFunction) {

        // 1. Normal cache check
        const cached = this.get(cacheKey);

        if (cached !== undefined && cached !== null) {
            console.log(`🟢 CACHE HIT  : ${cacheKey}`);
            return cached;
        }

        // 2. Rate-limit cooldown check
        const blockedUntil = failedUntil.get(cacheKey) || 0;

        if (Date.now() < blockedUntil) {
            console.warn(`🟡 429 COOLDOWN: ${cacheKey}`);

            if (staleValues.has(cacheKey)) {
                return staleValues.get(cacheKey);
            }

            if (MATCH_LIST_KEYS.has(cacheKey)) {
                return [];
            }
        }

        // 3. Existing request check
        if (pendingRequests.has(cacheKey)) {
            console.log(`🟡 WAIT       : ${cacheKey}`);
            return pendingRequests.get(cacheKey);
        }

        console.log(`🔴 API CALL   : ${cacheKey}`);

        // 4. Only one API request per cache key
        const promise = (async () => {

            try {

                const data = await fetchFunction();

                failedUntil.delete(cacheKey);
                this.set(cacheKey, data, ttl);

                console.log(`💾 CACHE SAVE : ${cacheKey}`);

                return data;

            } catch (err) {

                const status = err?.response?.status || err?.status;

                if (status === 429 && MATCH_LIST_KEYS.has(cacheKey)) {

                    failedUntil.set(
                        cacheKey,
                        Date.now() + RATE_LIMIT_COOLDOWN * 1000
                    );

                    console.warn(
                        `⚠️ RapidAPI 429 handled safely: ${cacheKey}`
                    );

                    if (staleValues.has(cacheKey)) {
                        return staleValues.get(cacheKey);
                    }

                    // First request can be rate-limited before any successful
                    // cache exists. Return a valid empty list instead of a 500.
                    return [];
                }

                console.error(`❌ API ERROR  : ${cacheKey}`);
                console.error(err.message);

                // Upstream failed for any reason (403 not subscribed, timeout,
                // DNS, 5xx). Serve the last known real data instead of a 500 so
                // the site keeps showing real cricket data.
                if (staleValues.has(cacheKey)) {
                    console.warn(`♻️ STALE FALLBACK: ${cacheKey}`);
                    return staleValues.get(cacheKey);
                }

                if (MATCH_LIST_KEYS.has(cacheKey)) {
                    return [];
                }

                throw err;

            } finally {

                pendingRequests.delete(cacheKey);

            }

        })();

        pendingRequests.set(cacheKey, promise);

        return promise;

    }

}

module.exports = new CacheManager();
