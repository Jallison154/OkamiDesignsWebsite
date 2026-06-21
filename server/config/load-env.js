'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '../..');
const ENV_PATH = path.join(PROJECT_ROOT, '.env');

/**
 * Load `.env` from the project root before any config modules read process.env.
 * Uses dotenv when installed; falls back to a minimal parser otherwise.
 */
function loadEnv() {
    if (!fs.existsSync(ENV_PATH)) {
        return { loaded: false, path: ENV_PATH };
    }

    try {
        require('dotenv').config({ path: ENV_PATH });
        return { loaded: true, path: ENV_PATH, method: 'dotenv' };
    } catch (error) {
        parseEnvFile(ENV_PATH);
        return { loaded: true, path: ENV_PATH, method: 'fallback', warning: error.message };
    }
}

function parseEnvFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');

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

        if (key && process.env[key] === undefined) {
            process.env[key] = value;
        }
    });
}

module.exports = {
    PROJECT_ROOT,
    ENV_PATH,
    loadEnv
};
