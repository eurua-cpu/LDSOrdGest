const fs = require('fs');
const path = require('path');
const { pool } = require('../src/db');

const ROOT_DIR = path.join(__dirname, '..');
const MIGRATIONS_DIR = path.join(ROOT_DIR, 'migrations', 'postgres');

async function migrate() {
    console.log('================================');
    console.log('PostgreSQL Database Migration');
    console.log('================================');
    console.log(`Migrations: ${MIGRATIONS_DIR}`);
    console.log('');

    const client = await pool.connect();

    try {
        // Tabella che tiene traccia delle migration
        await client.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id BIGSERIAL PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                executed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Legge esclusivamente le migration PostgreSQL
        const migrationFiles = fs
            .readdirSync(MIGRATIONS_DIR)
            .filter(file => file.endsWith('.sql'))
            .sort((a, b) =>
                a.localeCompare(b, undefined, { numeric: true })
            );

        const result = await client.query(`
            SELECT name
            FROM schema_migrations
            ORDER BY name
        `);

        const executedMigrations = result.rows.map(row => row.name);

        console.log(`Migration trovate: ${migrationFiles.length}`);
        console.log(`Migration già eseguite: ${executedMigrations.length}`);
        console.log('');

        let executedCount = 0;

        for (const file of migrationFiles) {

            if (executedMigrations.includes(file)) {
                console.log(`✓ ${file} - già eseguita`);
                continue;
            }

            console.log(`→ ${file} - esecuzione...`);

            const migrationPath = path.join(MIGRATIONS_DIR, file);
            const sql = fs.readFileSync(migrationPath, 'utf8');

            try {
                await client.query('BEGIN');

                // Esegue la migration
                await client.query(sql);

                // Registra la migration
                await client.query(
                    `
                    INSERT INTO schema_migrations (name)
                    VALUES ($1)
                    `,
                    [file]
                );

                await client.query('COMMIT');

                console.log(`✓ ${file} - completata`);
                executedCount++;

            } catch (error) {

                await client.query('ROLLBACK');

                console.error('');
                console.error(`✗ ${file} - ERRORE`);
                console.error('');
                console.error(error.message);
                console.error('');

                throw error;
            }
        }

        console.log('');

        if (executedCount === 0) {
            console.log('Database già aggiornato.');
        } else {
            console.log(`${executedCount} migration eseguite.`);
        }

        console.log('');

    } catch (error) {

        console.error('❌ Migration fallita');
        console.error(error.message);
        process.exitCode = 1;

    } finally {

        client.release();
        await pool.end();
    }
}

migrate();