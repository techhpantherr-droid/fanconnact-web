const axios = require("axios");
const http = require("http");
const https = require("https");

const config = require("../config/api.config");

console.log("🌐 BASE URL :", config.baseURL);
console.log("📡 API HOST :", config.apiHost);
console.log("🔑 API KEY  :", config.apiKey ? "Loaded ✅" : "Missing ❌");

const api = axios.create({

    baseURL: config.baseURL,

    timeout: 10000,

    httpAgent: new http.Agent({

        keepAlive: true,
        maxSockets: 100

    }),

    httpsAgent: new https.Agent({

        keepAlive: true,
        maxSockets: 100

    }),

    headers: {

        "x-rapidapi-key": config.apiKey,

        "x-rapidapi-host": config.apiHost,

        "Content-Type": "application/json",

        "Accept-Encoding": "gzip"

    }

});


/* ==========================================
            REQUEST LOGGING
========================================== */

api.interceptors.request.use(

    request => {

        console.log(

            `📤 ${request.method.toUpperCase()} ${request.url}`

        );

        request.metadata = {

            start: Date.now()

        };

        return request;

    }

);


/* ==========================================
            RESPONSE LOGGING
========================================== */

api.interceptors.response.use(

    response => {

        const time = Date.now() - response.config.metadata.start;

        console.log(

            `✅ ${response.config.url} (${time} ms)`

        );

        return response;

    },

    async error => {

        const configReq = error.config;

        if (!configReq) {

            console.error(error.message);

            throw error;

        }

        configReq.__retryCount = configReq.__retryCount || 0;

        const shouldRetry =

            !error.response ||

            error.code === "ECONNABORTED" ||

            (error.response && error.response.status >= 500);

        if (shouldRetry && configReq.__retryCount < 3) {

            configReq.__retryCount++;

            console.log(

                `🔁 Retry ${configReq.__retryCount}/3 -> ${configReq.url}`

            );

            await new Promise(resolve =>

                setTimeout(resolve, 1000)

            );

            return api(configReq);

        }

        const status = error.response?.status;

        // 429 is handled by cacheManager for match-list endpoints. Do not
        // label it as an application/API crash or retry it here.
        if (status === 429) {

            console.warn(
                "⚠️ RapidAPI rate limit (429)",
                {
                    url: configReq.url,
                    status,
                    message: error.message
                }
            );

            throw error;

        }

        console.error(

            "❌ API ERROR",

            {

                url: configReq.url,

                status,

                message: error.message

            }

        );

        throw error;

    }

);

/* ==========================================
        PERSISTENT CACHE (protects the daily quota)

        The provider's free plan allows a small number of requests per day.
        Every response is written to the shared on-disk cache and served from
        there afterwards, so one fetch serves every visitor. If the provider
        errors or rate-limits, the last good copy is returned instead of a 500.
========================================== */

const { getCached, setCached } = require("../api-quota");

const LIVE_URL_RE = /(\/live|\/upcoming|\/recent|scorecard|commentary)/i;

function cacheTtlFor(url) {
    return LIVE_URL_RE.test(String(url || "")) ? 60 * 1000 : 6 * 60 * 60 * 1000;
}

function attachPersistentCache(instance) {
    ["get", "post"].forEach((method) => {
        const original = instance[method].bind(instance);
        instance[method] = async function cachedRequest(url, requestConfig) {
            const ttl = cacheTtlFor(url);
            const params = (requestConfig && requestConfig.params) || null;
            const cached = getCached(url, params, ttl);
            if (cached.hit) return { data: cached.data, status: 200, fromCache: true };
            try {
                const response = await original(url, requestConfig);
                if (response && response.status === 200 && response.data !== null && response.data !== undefined) {
                    setCached(url, params, response.data, ttl);
                }
                return response;
            } catch (err) {
                // 429 / 5xx / network: serve the last good copy when we have one.
                const fallback = getCached(url, params, 365 * 24 * 60 * 60 * 1000);
                if (fallback.stale) {
                    console.warn(`[cache] stale serve for ${url} (${err.message})`);
                    return { data: fallback.data, status: 200, fromCache: true, stale: true };
                }
                throw err;
            }
        };
    });
    return instance;
}

attachPersistentCache(api);

module.exports = api;