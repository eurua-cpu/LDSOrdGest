const crypto = require('crypto');
const { promisify } = require('util');
const { Pool } = require('pg');

const scryptAsync = promisify(crypto.scrypt);

async function hashPassword(password) {
    if (!password || password.length < 8) {
        throw new Error('La password deve contenere almeno 8 caratteri');
    }

    const salt = crypto.randomBytes(16).toString('hex');

    const derivedKey = await scryptAsync(
        password,
        salt,
        64
    );

    return `${salt}:${derivedKey.toString('hex')}`;
}

async function rehashPasswords() {
    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL non impostata');
    }

    const connectionString = process.env.DATABASE_URL;
    const pool = new Pool({
        connectionString,
        ssl: connectionString.includes('127.0.0.1') || connectionString.includes('localhost')
            ? false
            : { rejectUnauthorized: false }
    });

    try {
        console.log('Checking plaintext passwords...');

        // Find plaintext passwords (those without ':' separator)
        const result = await pool.query(
            `SELECT id, email, password_hash FROM users WHERE password_hash NOT LIKE $1`,
            ['%:%']
        );
        const users = result.rows;

        if (users.length === 0) {
            console.log('No plaintext passwords found. All passwords are already hashed.');
            await pool.end();
            return;
        }

        console.log(`Found ${users.length} plaintext passwords. Hashing...`);

        for (const user of users) {
            try {
                const hashedPassword = await hashPassword(user.password_hash);
                await pool.query(
                    `UPDATE users SET password_hash = $1 WHERE id = $2`,
                    [hashedPassword, user.id]
                );
                console.log(`✓ User ${user.email} (ID: ${user.id}) password hashed`);
            } catch (error) {
                console.error(`✗ Failed to hash password for user ${user.email}: ${error.message}`);
            }
        }

        console.log('Password hashing completed.');
    } finally {
        await pool.end();
    }
}

rehashPasswords().catch((error) => {
    console.error('Script failed:', error.message);
    console.error('Stack:', error.stack);
    process.exitCode = 1;
});
