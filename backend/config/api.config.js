require("dotenv").config();

module.exports = {

    provider: process.env.API_PROVIDER,

    apiKey: process.env.CRICBUZZ_API_KEY,

    apiHost: process.env.CRICBUZZ_API_HOST,

    baseURL: process.env.CRICBUZZ_BASE_URL,

    allSports: {
        apiKey: process.env.ALLSPORTS_API_KEY,
        apiHost: process.env.ALLSPORTS_API_HOST,
        baseURL: process.env.ALLSPORTS_BASE_URL
    }

};