const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const DB_DIR = path.join(ROOT_DIR, 'db');
const DB_FILE = path.join(DB_DIR, 'LDSOrdGest.db');
const MIGRATIONS_DIR = path.join(ROOT_DIR, 'migrations');

// Crea data/ se non esiste
if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

console.log('================================');
console.log('SQLite Database Migration');
console.log('================================');
console.log(`Database: ${DB_FILE}`);
console.log(`Migrations: ${MIGRATIONS_DIR}`);
console.log('');

// Connessione al database
const db = new Database(DB_FILE);

// Foreign keys
db.pragma('foreign_keys = ON');

// Tabella che tiene traccia delle migration
db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        executed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
`);

// Legge i file SQL
const migrationFiles = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter(file => file.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

// Migration già eseguite
const executedMigrations = db
    .prepare(`
        SELECT name
        FROM schema_migrations
        ORDER BY name
    `)
    .all()
    .map(row => row.name);

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

        const runMigration = db.transaction(() => {

            // Esegue SQL della migration
            db.exec(sql);

            // Registra la migration
            db.prepare(`
                INSERT INTO schema_migrations (name)
                VALUES (?)
            `).run(file);
        });

        runMigration();

        console.log(`✓ ${file} - completata`);
        executedCount++;

    } catch (error) {

        console.error('');
        console.error(`✗ ${file} - ERRORE`);
        console.error('');
        console.error(error.message);
        console.error('');

        db.close();

        process.exit(1);
    }
}

console.log('');

if (executedCount === 0) {
    console.log('Database già aggiornato.');
} else {
    console.log(`${executedCount} migration eseguite.`);
}

console.log('');

db.close();