const { Pool } = require('pg');
const { AsyncLocalStorage } = require('async_hooks');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error('DATABASE_URL non configurata. Configura la variabile d\'ambiente PostgreSQL.');
}

const pool = new Pool({
    connectionString,
    ssl: connectionString.includes('127.0.0.1') || connectionString.includes('localhost')
        ? false
        : { rejectUnauthorized: false }
});
const transactionStorage = new AsyncLocalStorage();

function postgresParameters(sql, values) {
    let index = 0;
    return sql.replace(/\?/g, () => `$${++index}`);
}

function createStatement(text, transactionClient = pool) {
    const queryText = postgresParameters(text);
    return {
        async all(...values) {
            const result = await transactionClient.query(queryText, values);
            return result.rows;
        },
        async get(...values) {
            const result = await transactionClient.query(queryText, values);
            return result.rows[0];
        },
        async run(...values) {
            const result = await transactionClient.query(queryText, values);
            return {
                changes: result.rowCount,
                lastInsertRowid: result.rows[0]?.id
            };
        }
    };
}

const db = {
    prepare(text) {
        return createStatement(text, transactionStorage.getStore() || pool);
    },
    transaction(callback) {
        return async (...args) => {
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                const result = await transactionStorage.run(client, () => callback(...args));
                await client.query('COMMIT');
                return result;
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        };
    }
};

pool.on('error', (error) => console.error('Errore PostgreSQL:', error));

module.exports = { db, pool };