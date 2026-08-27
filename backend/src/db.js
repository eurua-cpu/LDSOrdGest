const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Root del progetto
const ROOT_DIR = path.join(__dirname, '..');

// Cartella e file database
const DB_DIR = path.join(ROOT_DIR, 'db');
const DB_FILE = path.join(DB_DIR, 'LDSOrdGest.db');

// Crea la cartella data se non esiste
if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

// Connessione SQLite
const db = new Database(DB_FILE);

// Configurazioni SQLite
db.pragma('foreign_keys = ON');

// WAL migliora le prestazioni quando ci sono letture e scritture
// contemporaneamente
db.pragma('journal_mode = WAL');

// Migliora la gestione delle transazioni
db.pragma('busy_timeout = 5000');

console.log(`SQLite database: ${DB_FILE}`);

module.exports = { 
    db, 
    DB_FILE
};