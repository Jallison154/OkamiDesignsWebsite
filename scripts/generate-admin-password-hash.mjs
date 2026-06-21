/**
 * Generate a bcrypt hash for ADMIN_PASSWORD_HASH.
 *
 * Usage:
 *   node scripts/generate-admin-password-hash.mjs "your-secure-password"
 */
import bcrypt from 'bcrypt';

const password = process.argv[2];

if (!password) {
    console.error('Usage: node scripts/generate-admin-password-hash.mjs "your-secure-password"');
    process.exit(1);
}

const hash = await bcrypt.hash(password, 12);
console.log('Add to your server environment (.env or host config):');
console.log(`ADMIN_PASSWORD_HASH=${hash}`);
