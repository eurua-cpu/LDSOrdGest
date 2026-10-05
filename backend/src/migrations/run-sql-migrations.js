const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '../../migrations/postgres');

async function runSqlMigrations(pool = require('../db').pool) {
    let files;

    try {
        files = fs
            .readdirSync(MIGRATIONS_DIR)
            .filter((file) => file.endsWith('.sql'))
            .sort();
    } catch (error) {
        console.error(`✗ Unable to read migrations directory ${MIGRATIONS_DIR}: ${error.message}`);
        return { success: false, executed: [], failed: null };
    }

    if (files.length === 0) {
        console.log('No SQL migrations found.');
        return { success: true, executed: [], failed: null };
    }

    console.log(`Running ${files.length} SQL migration(s)...`);

    const executed = [];

    for (const file of files) {
        try {
            const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
            await pool.query(sql);
            executed.push(file);
            console.log(`✓ SQL migration applied: ${file}`);
        } catch (error) {
            console.error(`✗ SQL migration failed: ${file}: ${error.message}`);
            return { success: false, executed, failed: file };
        }
    }

    console.log('✓ SQL migrations completed.');
    return { success: true, executed, failed: null };
}

module.exports = { runSqlMigrations };
