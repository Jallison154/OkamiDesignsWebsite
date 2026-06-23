'use strict';

const DEFAULT_USER_NICK = 'OkamiDesigns';
const DEFAULT_PROFILE_URL = `https://cults3d.com/en/users/${DEFAULT_USER_NICK}/3d-models`;
const GRAPHQL_URL = 'https://cults3d.com/graphql';
const DEFAULT_CACHE_MS = 15 * 60 * 1000;
const DEFAULT_MODEL_LIMIT = 24;

function readCults3dConfig() {
    const username = (process.env.CULTS3D_USERNAME || '').trim();
    const apiKey = (process.env.CULTS3D_API_KEY || '').trim();
    const userNick = (process.env.CULTS3D_USER_NICK || DEFAULT_USER_NICK).trim() || DEFAULT_USER_NICK;
    const cacheMs = Number(process.env.CULTS3D_CACHE_MS) || DEFAULT_CACHE_MS;
    const modelLimit = Number(process.env.CULTS3D_MODEL_LIMIT) || DEFAULT_MODEL_LIMIT;

    return {
        username,
        apiKey,
        userNick,
        profileUrl: `https://cults3d.com/en/users/${encodeURIComponent(userNick)}/3d-models`,
        graphqlUrl: GRAPHQL_URL,
        cacheMs: Number.isFinite(cacheMs) && cacheMs > 0 ? cacheMs : DEFAULT_CACHE_MS,
        modelLimit: Number.isFinite(modelLimit) && modelLimit > 0 ? Math.min(modelLimit, 50) : DEFAULT_MODEL_LIMIT,
        configured: Boolean(username && apiKey)
    };
}

module.exports = {
    DEFAULT_PROFILE_URL,
    readCults3dConfig
};
