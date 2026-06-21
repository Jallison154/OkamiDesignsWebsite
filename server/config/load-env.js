'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '../..');
const ENV_PATH = path.join(PROJECT_ROOT, '.env');

function parseEnvFileContent(content) {
    const result = {};

    content.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
            return;
        }

        const separator = trimmed.indexOf('=');
        if (separator === -1) {
            return;
        }

        const key = trimmed.slice(0, separator).trim();
        let value = trimmed.slice(separator + 1).trim();

        if (
            (value.startsWith('"') && value.endsWith('"'))
            || (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }

        if (key) {
            result[key] = value;
        }
    });

    return result;
}

function readEnvFileParsed() {
    if (!fs.existsSync(ENV_PATH)) {
        return null;
    }

    const content = fs.readFileSync(ENV_PATH, 'utf8');

    try {
        return require('dotenv').parse(content);
    } catch {
        return parseEnvFileContent(content);
    }
}

/**
 * Apply parsed env values. Overrides empty strings so Docker-injected blanks
 * do not block values from the mounted .env file (bcrypt hashes use "$").
 */
function applyParsedEnv(parsed, { override = false } = {}) {
    if (!parsed) {
        return;
    }

    Object.entries(parsed).forEach(([key, value]) => {
        if (!key || value === undefined || value === null) {
            return;
        }

        const current = process.env[key];
        if (override || current === undefined || current === '') {
            process.env[key] = String(value);
        }
    });
}

/**
 * Load `.env` from the project root before any config modules read process.env.
 */
function loadEnv(options = {}) {
    const parsed = readEnvFileParsed();

    if (!parsed) {
        return {
            loaded: false,
            path: ENV_PATH,
            keysApplied: 0
        };
    }

    applyParsedEnv(parsed, { override: Boolean(options.override) });

    return {
        loaded: true,
        path: ENV_PATH,
        method: 'dotenv',
        keysApplied: Object.keys(parsed).length
    };
}

function reloadEnv() {
    return loadEnv({ override: true });
}

function getEnvFilePresence() {
    return {
        path: ENV_PATH,
        exists: fs.existsSync(ENV_PATH)
    };
}

module.exports = {
    PROJECT_ROOT,
    ENV_PATH,
    loadEnv,
    reloadEnv,
    getEnvFilePresence,
    readEnvFileParsed,
    applyParsedEnv,
    parseEnvFileContent
};
