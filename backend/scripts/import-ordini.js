const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const DB_FILE = path.join(ROOT_DIR, 'db', 'LDSOrdGest.db');
const IMPORT_DIR = path.join(ROOT_DIR, 'imports');

// Missing articles referenced by righe_ordine.csv that don't exist yet in ARTICOLI.
// Prices confirmed by the user: SPAGNOLO 455, CARPINO 220.
const NEW_ARTICLES = [
    { id: 35, codice: 'SPAGNOLO', descrizione: 'SPAGNOLO - bancale', prezzoVendita: 455 },
    { id: 36, codice: 'CARPINO', descrizione: 'CARPINO - bancale', prezzoVendita: 220 }
];

// Data entry error in righe_ordine.csv: riga id 380 has "SACCHI" (text) instead of a numeric quantita.
// User confirmed the correct value is 100.
const QUANTITY_OVERRIDES = new Map([
    [380, 100]
]);

function parseCsvComma(fileName) {
    const text = fs.readFileSync(path.join(IMPORT_DIR, fileName), 'utf8').replace(/^﻿/, '');
    const rows = [];
    let row = [], field = '', quoted = false, line = 1, rowLine = 1;
    for (let index = 0; index < text.length; index += 1) {
        const character = text[index];
        if (quoted) {
            if (character === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
            else if (character === '"') quoted = false;
            else field += character;
        } else if (character === '"') {
            if (field) throw new Error(`${fileName}:${line}: unexpected quote`);
            quoted = true;
        } else if (character === ',') { row.push(field); field = ''; }
        else if (character === '\n') { row.push(field.replace(/\r$/, '')); if (row.some(value => value !== '')) rows.push({ line: rowLine, values: row }); row = []; field = ''; line += 1; rowLine = line; }
        else field += character;
    }
    if (quoted) throw new Error(`${fileName}:${line}: unterminated quoted field`);
    if (field || row.length) { row.push(field.replace(/\r$/, '')); if (row.some(value => value !== '')) rows.push({ line: rowLine, values: row }); }
    return rows;
}

function integer(value, file, line, column) {
    if (!/^\d+$/.test(value)) throw new Error(`${file}:${line}: ${column} must be an integer`);
    return Number(value);
}

function nullable(value) { return value === '' ? null : value; }

function dateDashDMY(value, file, line, column) {
    if (!value) return null;
    const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
    if (!match) throw new Error(`${file}:${line}: ${column} must use DD-MM-YYYY`);
    return `${match[3]}-${match[2]}-${match[1]}`;
}

function decimalDot(value, file, line, column, optional = false) {
    if (!value && optional) return null;
    if (!/^-?\d+(\.\d+)?$/.test(value)) throw new Error(`${file}:${line}: ${column} is not a plain decimal value`);
    return Number(value);
}

function loadOrdini() {
    const columns = ['id', 'data', 'cliente_id', 'stato', 'pagato', 'note_ordine'];
    const rows = parseCsvComma('ordini.csv');
    if (!rows.length || rows[0].values.join(',') !== columns.join(',')) throw new Error('ordini.csv: unexpected header');
    const ids = new Set();
    return rows.slice(1).map(row => {
        if (row.values.length !== columns.length) throw new Error(`ordini.csv:${row.line}: expected ${columns.length} columns, got ${row.values.length}`);
        const values = Object.fromEntries(columns.map((column, index) => [column, row.values[index]]));
        const id = integer(values.id, 'ordini.csv', row.line, 'id');
        if (ids.has(id)) throw new Error(`ordini.csv:${row.line}: duplicate id ${id}`);
        ids.add(id);
        return [
            id,
            dateDashDMY(values.data, 'ordini.csv', row.line, 'data'),
            integer(values.cliente_id, 'ordini.csv', row.line, 'cliente_id'),
            integer(values.stato, 'ordini.csv', row.line, 'stato'),
            integer(values.pagato, 'ordini.csv', row.line, 'pagato'),
            nullable(values.note_ordine)
        ];
    });
}

function loadRigheOrdine(priceByArticolo) {
    const columns = ['id', 'id_ordine', 'riga_ordine', 'articolo_id', 'quantita', 'prezzo_applicato', 'stato_riga', 'data_consegna', 'note_riga_ordine'];
    const rows = parseCsvComma('righe_ordine.csv');
    if (!rows.length || rows[0].values.join(',') !== columns.join(',')) throw new Error('righe_ordine.csv: unexpected header');
    const ids = new Set();
    return rows.slice(1).map(row => {
        if (row.values.length !== columns.length) throw new Error(`righe_ordine.csv:${row.line}: expected ${columns.length} columns, got ${row.values.length}`);
        const values = Object.fromEntries(columns.map((column, index) => [column, row.values[index]]));
        const id = integer(values.id, 'righe_ordine.csv', row.line, 'id');
        if (ids.has(id)) throw new Error(`righe_ordine.csv:${row.line}: duplicate id ${id}`);
        ids.add(id);
        const articoloId = integer(values.articolo_id, 'righe_ordine.csv', row.line, 'articolo_id');
        let prezzo = decimalDot(values.prezzo_applicato, 'righe_ordine.csv', row.line, 'prezzo_applicato', true);
        if (prezzo === null) {
            if (!priceByArticolo.has(articoloId)) throw new Error(`righe_ordine.csv:${row.line}: prezzo_applicato missing and no fallback price for articolo_id ${articoloId}`);
            prezzo = priceByArticolo.get(articoloId);
        }
        const quantita = QUANTITY_OVERRIDES.has(id)
            ? QUANTITY_OVERRIDES.get(id)
            : decimalDot(values.quantita, 'righe_ordine.csv', row.line, 'quantita');
        return [
            id,
            integer(values.id_ordine, 'righe_ordine.csv', row.line, 'id_ordine'),
            integer(values.riga_ordine, 'righe_ordine.csv', row.line, 'riga_ordine'),
            articoloId,
            quantita,
            prezzo,
            integer(values.stato_riga, 'righe_ordine.csv', row.line, 'stato_riga'),
            dateDashDMY(values.data_consegna, 'righe_ordine.csv', row.line, 'data_consegna'),
            nullable(values.note_riga_ordine)
        ];
    });
}

const priceByArticolo = new Map(NEW_ARTICLES.map(a => [a.id, a.prezzoVendita]));
const ordiniRows = loadOrdini();
const righeRows = loadRigheOrdine(priceByArticolo);

const orderIds = new Set(ordiniRows.map(row => row[0]));
righeRows.forEach(row => {
    if (!orderIds.has(row[1])) throw new Error(`righe_ordine.csv references unknown ordine id ${row[1]}`);
});

const db = new Database(DB_FILE);
db.pragma('foreign_keys = ON');

try {
    db.transaction(() => {
        // Create missing MATERIALI + ARTICOLI needed by the new order lines (LEGNA / bancale pattern).
        const legnaMateriale = db.prepare('SELECT id FROM MATERIALI WHERE codice = ?');
        const insertMateriale = db.prepare('INSERT INTO MATERIALI (id, codice, descrizione, um_base, categoria) VALUES (?, ?, ?, 1, \'LEGNA\')');
        const insertArticolo = db.prepare('INSERT OR IGNORE INTO ARTICOLI (id, codice, descrizione, materiale, um_vendita, um_base_x_um, prezzo_acquisto, prezzo_vendita) VALUES (?, ?, ?, ?, 1, 1, 0, ?)');
        const maxMaterialeId = db.prepare('SELECT MAX(id) m FROM MATERIALI').get().m;
        let nextMaterialeId = maxMaterialeId + 1;

        NEW_ARTICLES.forEach(article => {
            let materialeRow = legnaMateriale.get(article.codice);
            let materialeId;
            if (materialeRow) {
                materialeId = materialeRow.id;
            } else {
                materialeId = nextMaterialeId++;
                insertMateriale.run(materialeId, article.codice, article.descrizione);
            }
            insertArticolo.run(article.id, article.codice, article.descrizione, materialeId, article.prezzoVendita);
        });

        // Wipe existing orders/lines (svuota e reimporta da zero), then load the new dataset.
        db.prepare('DELETE FROM RIGHE_ORDINE').run();
        db.prepare('DELETE FROM ORDINI').run();

        const insertOrdine = db.prepare('INSERT INTO ORDINI (id, data, cliente_id, stato, pagato, note_ordine) VALUES (?, ?, ?, ?, ?, ?)');
        ordiniRows.forEach(row => insertOrdine.run(...row));

        const insertRiga = db.prepare('INSERT INTO RIGHE_ORDINE (id, ordine_id, riga_ordine, articolo_id, quantita, prezzo_applicato, stato_riga, data_consegna, note_riga_ordine) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
        righeRows.forEach(row => insertRiga.run(...row));

        // Keep AUTOINCREMENT counters consistent with the imported explicit ids.
        db.prepare('UPDATE sqlite_sequence SET seq = ? WHERE name = ?').run(Math.max(...ordiniRows.map(r => r[0])), 'ORDINI');
        db.prepare('UPDATE sqlite_sequence SET seq = ? WHERE name = ?').run(Math.max(...righeRows.map(r => r[0])), 'RIGHE_ORDINE');
    })();

    const fkIssues = db.pragma('foreign_key_check');
    if (fkIssues.length) {
        console.error('Foreign key violations found:', fkIssues);
        process.exitCode = 1;
    } else {
        console.log(`ORDINI: ${ordiniRows.length} righe importate`);
        console.log(`RIGHE_ORDINE: ${righeRows.length} righe importate`);
        console.log(`ARTICOLI aggiunti: ${NEW_ARTICLES.map(a => a.codice).join(', ')}`);
    }
} finally {
    db.close();
}
