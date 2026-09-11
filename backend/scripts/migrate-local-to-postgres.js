const Database = require('better-sqlite3');
const postgres = require('postgres');
const path = require('path');

const sqlite = new Database(path.join(__dirname, '..', 'db', 'LDSOrdGest.db'), { readonly: true });
const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: 'require' });

const tables = [
    'UM',
    'STATUS_ORDINE',
    'STATUS_RIGA_ORDINE',
    'STATUS_PAGAMENTO',
    'CLIENTI',
    'MATERIALI',
    'ARTICOLI',
    'ORDINI',
    'RIGHE_ORDINE',
    'CARICHI',
    'MOVIMENTI'
];

function quoteIdentifier(identifier) {
    return `"${identifier.replaceAll('"', '""')}"`;
}

async function resetSequences() {
    for (const table of tables) {
        const result = await sql.unsafe(`SELECT pg_get_serial_sequence('${table.toLowerCase()}', 'id') AS sequence`);
        const sequence = result[0]?.sequence;
        if (!sequence) continue;
        await sql.unsafe(`SELECT setval($1, COALESCE((SELECT MAX(id) FROM ${quoteIdentifier(table.toLowerCase())}), 1), EXISTS (SELECT 1 FROM ${quoteIdentifier(table.toLowerCase())}))`, [sequence]);
    }
}

(async () => {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL non impostata');
    try {
        await sql.begin(async (transaction) => {
            for (const table of tables) await migrateTableWith(transaction, table);
        });
        await resetSequences();
        console.log('Migrazione completata.');
    } finally {
        sqlite.close();
        await sql.end();
    }
})().catch((error) => {
    console.error(`Migrazione fallita: ${error.message}`);
    process.exitCode = 1;
});

async function migrateTableWith(transaction, table) {
    const columns = sqlite.prepare(`PRAGMA table_info(${quoteIdentifier(table)})`).all().map((column) => column.name);
    const rows = sqlite.prepare(`SELECT ${columns.map(quoteIdentifier).join(', ')} FROM ${quoteIdentifier(table)}`).all();
    if (!rows.length) {
        console.log(`${table}: 0 righe`);
        return;
    }
    const quotedTable = quoteIdentifier(table.toLowerCase());
    const quotedColumns = columns.map((column) => quoteIdentifier(column.toLowerCase())).join(', ');
    let parameterIndex = 0;
    const placeholders = rows.map(() => `(${columns.map(() => `$${++parameterIndex}`).join(', ')})`).join(', ');
    const values = rows.flatMap((row) => columns.map((column) => row[column]));
    const updateColumns = columns.slice(1).map((column) => {
        const quoted = quoteIdentifier(column.toLowerCase());
        return `${quoted} = EXCLUDED.${quoted}`;
    }).join(', ');
    await transaction.unsafe(
        `INSERT INTO ${quotedTable} (${quotedColumns}) VALUES ${placeholders} ` +
        `ON CONFLICT ("id") DO UPDATE SET ${updateColumns}`,
        values
    );
    console.log(`${table}: ${rows.length} righe`);
}
