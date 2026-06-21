#!/usr/bin/env node
'use strict';

/**
 * Generate a bcrypt hash for ADMIN_PASSWORD_HASH.
 * CommonJS — works on Node 14+ (no top-level await required).
 *
 * Usage:
 *   node scripts/generate-admin-password-hash.cjs "your-secure-password"
 */
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const password = process.argv[2];

if (!password) {
    console.error('Usage: node scripts/generate-admin-password-hash.cjs "your-secure-password"');
    process.exit(1);
}

bcrypt.hash(password, 12, (error, hash) => {
    if (error) {
        console.error('Failed to generate hash:', error.message || error);
        process.exit(1);
    }

    const sessionSecret = crypto.randomBytes(32).toString('hex');

    console.log('');
    console.log('Add these lines to .env in the project root (see docs/ADMIN-LOGIN-SETUP.md):');
    console.log('');
console.log(`ADMIN_PASSWORD_HASH='${hash}'`);
console.log(`ADMIN_SESSION_SECRET=${sessionSecret}`);
console.log('');
console.log('Use single quotes around ADMIN_PASSWORD_HASH — bcrypt hashes contain $ characters.');
    console.log('Then restart the server: npm start');
    console.log('Sign in at /admin.html with the plain password you used above — not the hash.');
    console.log('');
});
