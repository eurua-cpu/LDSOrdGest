const crypto = require('crypto');
const { promisify } = require('util');
const { pool } = require('../db');

const scryptAsync = promisify(crypto.scrypt);

const SESSION_DURATION_DAYS = 7;

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

async function verifyPassword(password, storedHash) {
    const [salt, key] = storedHash.split(':');

    if (!salt || !key) {
        return false;
    }

    const derivedKey = await scryptAsync(
        password,
        salt,
        64
    );

    const storedKey = Buffer.from(key, 'hex');

    if (derivedKey.length !== storedKey.length) {
        return false;
    }

    return crypto.timingSafeEqual(
        derivedKey,
        storedKey
    );
}

function generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
}

function hashSessionToken(token) {
    return crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');
}

async function createSession(userId) {
    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);

    const result = await pool.query(
        `
        INSERT INTO sessions (
            user_id,
            token_hash,
            expires_at
        )
        VALUES (
            $1,
            $2,
            CURRENT_TIMESTAMP + INTERVAL '${SESSION_DURATION_DAYS} days'
        )
        RETURNING expires_at
        `,
        [
            userId,
            tokenHash
        ]
    );

    return {
        token,
        expiresAt: result.rows[0].expires_at
    };
}

async function getUserBySession(token) {
    if (!token) {
        return null;
    }

    const tokenHash = hashSessionToken(token);

    const result = await pool.query(
        `
        SELECT
            u.id,
            u.email,
            u.nome,
            u.cognome,
            u.ruolo,
            u.attivo
        FROM sessions s
        INNER JOIN users u
            ON u.id = s.user_id
        WHERE s.token_hash = $1
          AND s.expires_at > CURRENT_TIMESTAMP
          AND u.attivo = TRUE
        `,
        [tokenHash]
    );

    return result.rows[0] || null;
}
async function deleteSession(token) {
    if (!token) {
        return;
    }

    const tokenHash = hashSessionToken(token);

    await pool.query(
        `
        DELETE FROM sessions
        WHERE token_hash = $1
        `,
        [tokenHash]
    );
}

async function cleanupSessions() {
    await pool.query(
        `
        DELETE FROM sessions
        WHERE expires_at <= CURRENT_TIMESTAMP
        `
    );
}

module.exports = {
    hashPassword,
    verifyPassword,
    createSession,
    getUserBySession,
    deleteSession,
    cleanupSessions
};