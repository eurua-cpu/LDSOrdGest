const { Pool } = require('pg');

async function listUsers() {
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
        const result = await pool.query(
            `SELECT id, email, nome, cognome, ruolo, attivo, password_hash FROM users ORDER BY id`
        );

        console.log('\n=== Users in Database ===\n');
        result.rows.forEach(user => {
            const passwordPreview = user.password_hash
                ? (user.password_hash.includes(':')
                    ? '[HASHED with scrypt]'
                    : `[PLAINTEXT: ${user.password_hash}]`)
                : '[NULL]';

            console.log(`ID: ${user.id}`);
            console.log(`Email: ${user.email}`);
            console.log(`Name: ${user.nome} ${user.cognome}`);
            console.log(`Role: ${user.ruolo}`);
            console.log(`Active: ${user.attivo}`);
            console.log(`Password: ${passwordPreview}`);
            console.log('---');
        });

        console.log(`\nTotal users: ${result.rows.length}`);
    } finally {
        await pool.end();
    }
}

listUsers().catch((error) => {
    console.error('Error:', error.message);
    process.exitCode = 1;
});
