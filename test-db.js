const { pool } = require('./backend/src/db');

async function test() {
    try {
        const result = await pool.query(`
            SELECT 
                NOW() AS data,
                version() AS versione
        `);

        console.log('✅ Connessione PostgreSQL OK');
        console.log('Data server:', result.rows[0].data);
        console.log('PostgreSQL:', result.rows[0].versione);

    } catch (error) {
        console.error('❌ Errore connessione PostgreSQL');
        console.error(error);
    } finally {
        await pool.end();
    }
}

test();