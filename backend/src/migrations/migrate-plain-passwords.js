const crypto = require('crypto');
const { promisify } = require('util');

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

async function migratePlainPasswords(pool) {
    try {
        const result = await pool.query(
            `SELECT id, email, password_hash FROM users WHERE password_hash NOT LIKE $1 LIMIT 100`,
            ['%:%']
        );

        const users = result.rows;

        if (users.length === 0) {
            console.log('✓ All user passwords are properly hashed.');
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
                console.log(`✓ User ${user.email} password hashed`);
            } catch (error) {
                console.error(`✗ Failed to hash password for user ${user.email}: ${error.message}`);
            }
        }

        console.log('✓ Password migration completed.');
    } catch (error) {
        console.error('Password migration failed:', error);
    }
}

module.exports = { migratePlainPasswords };
