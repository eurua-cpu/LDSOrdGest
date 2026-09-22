const crypto = require('crypto');
const { promisify } = require('util');

const scryptAsync = promisify(crypto.scrypt);

/**
 * Migrates users whose password_hash is still stored in plaintext
 * (i.e. does not contain the "salt:hash" separator) to a proper
 * scrypt-derived hash in the format "salt:hash".
 *
 * @param {import('pg').Pool} pool - PostgreSQL connection pool
 */
async function migratePlainPasswords(pool) {
    const result = await pool.query(
        `
        SELECT
            id,
            email,
            password_hash
        FROM users
        WHERE password_hash IS NOT NULL
          AND password_hash NOT LIKE '%:%'
        `
    );

    const plainPasswordUsers = result.rows;

    if (plainPasswordUsers.length === 0) {
        console.log('>>> Nessuna password in chiaro da migrare');
        return;
    }

    console.log(`>>> Trovate ${plainPasswordUsers.length} password in chiaro da migrare`);

    for (const user of plainPasswordUsers) {
        try {
            const salt = crypto.randomBytes(16).toString('hex');

            const derivedKey = await scryptAsync(
                user.password_hash,
                salt,
                64
            );

            const newHash = `${salt}:${derivedKey.toString('hex')}`;

            await pool.query(
                `
                UPDATE users
                SET password_hash = $1
                WHERE id = $2
                `,
                [
                    newHash,
                    user.id
                ]
            );

            console.log(`>>> Password migrata con successo per l'utente ${user.email}`);
        } catch (error) {
            console.error(`>>> Errore durante la migrazione della password per l'utente ${user.email}:`, error);
        }
    }
}

module.exports = { migratePlainPasswords };
