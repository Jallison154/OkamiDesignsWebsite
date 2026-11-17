'use strict';

/**
 * Minimal front-matter parser for projects/*.md.
 *
 * Supports the small YAML subset project files need:
 *   key: value            (strings, true/false, numbers)
 *   key: "quoted value"
 *   key: [a, b, c]        (inline list)
 *   key:                  (block list)
 *     - item
 *     - item
 *   # comments
 *
 * Anything fancier (nested maps, multi-line strings) is intentionally unsupported —
 * long text belongs in the Markdown body.
 */

function parseScalar(raw) {
    const value = raw.trim();
    if (value === '') {
        return '';
    }
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        return value.slice(1, -1);
    }
    if (/^(true|yes|on)$/i.test(value)) {
        return true;
    }
    if (/^(false|no|off)$/i.test(value)) {
        return false;
    }
    if (/^-?\d+(\.\d+)?$/.test(value)) {
        return Number(value);
    }
    if (value.startsWith('[') && value.endsWith(']')) {
        const inner = value.slice(1, -1).trim();
        if (!inner) {
            return [];
        }
        return inner.split(',').map((item) => parseScalar(item)).filter((item) => item !== '');
    }
    return value;
}

function stripComment(line) {
    // Only treat " #" as a comment start so URLs with fragments (#) still work.
    const match = line.match(/^(.*?)\s+#.*$/);
    if (match && !/["']/.test(match[1].slice(-1))) {
        return match[1];
    }
    return line;
}

function parseFrontMatter(source) {
    const text = String(source || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    const match = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!match) {
        return { data: {}, body: text, hasFrontMatter: false };
    }

    const data = {};
    let currentListKey = null;
    const lines = match[1].split('\n');

    for (const rawLine of lines) {
        if (!rawLine.trim() || rawLine.trim().startsWith('#')) {
            continue;
        }
        const listItem = rawLine.match(/^\s+-\s+(.*)$/) || rawLine.match(/^-\s+(.*)$/);
        if (listItem && currentListKey) {
            data[currentListKey].push(parseScalar(stripComment(listItem[1])));
            continue;
        }
        const pair = rawLine.match(/^([A-Za-z][\w-]*)\s*:\s*(.*)$/);
        if (!pair) {
            currentListKey = null;
            continue;
        }
        const key = pair[1];
        const rest = stripComment(pair[2]);
        if (rest.trim() === '') {
            data[key] = [];
            currentListKey = key;
        } else {
            data[key] = parseScalar(rest);
            currentListKey = null;
        }
    }

    // Empty block keys with no list items become empty strings.
    for (const [key, value] of Object.entries(data)) {
        if (Array.isArray(value) && value.length === 0 && !/^(features|screenshots|tags)$/.test(key)) {
            data[key] = '';
        }
    }

    return { data, body: match[2], hasFrontMatter: true };
}

module.exports = { parseFrontMatter, parseScalar };
