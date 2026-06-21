/**
 * Generate a bcrypt hash for ADMIN_PASSWORD_HASH.
 *
 * Usage:
 *   node scripts/generate-admin-password-hash.mjs "your-secure-password"
 */
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const password = process.argv[2];

if (!password) {
    console.error('Usage: node scripts/generate-admin-password-hash.mjs "your-secure-password"');
    process.exit(1);
}

const hash = await bcrypt.hash(password, 12);
const sessionSecret = crypto.randomBytes(32).toString('hex');

console.log('');
console.log('Add these lines to .env in the project root (see docs/ADMIN-LOGIN-SETUP.md):');
console.log('');
console.log(`ADMIN_PASSWORD_HASH=${hash}`);
console.log(`ADMIN_SESSION_SECRET=${sessionSecret}`);
console.log('');
console.log('Then restart the server: npm start');
console.log('Sign in at /admin.html with the plain password you used above — not the hash.');
console.log('');
