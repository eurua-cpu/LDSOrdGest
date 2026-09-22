const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const DB_FILE = path.join(ROOT_DIR, 'db', 'LDSOrdGest.db');
const IMPORT_DIR = path.join(ROOT_DIR, 'imports');
const imports = [
    ['um.csv', 'UM', ['id', 'codice', 'descrizione']],
    ['status_ordine.csv', 'STATUS_ORDINE', ['id', 'stato', 'ordinamento_stato']],
    ['status_pagamento.csv', 'STATUS_PAGAMENTO', ['id', 'stato', 'ordinamento_stato']],
    ['status_riga_ordine.csv', 'STATUS_RIGA_ORDINE', ['id', 'stato', 'ordinamento_stato']],
    ['materiali.csv', 'MATERIALI', ['id', 'codice', 'descrizione', 'um_base', 'categoria']],
    ['clienti.csv', 'CLIENTI', ['id', 'nome', 'indirizzo', 'localita', 'telefono', 'zona', 'note']],
    ['articoli.csv', 'ARTICOLI', ['id', 'codice', 'descrizione', 'materiale', 'um_vendita', 'um_base_x_um', 'prezzo_acquisto', 'prezzo_vendita']]
    /*['ordini.csv', 'ORDINI', ['id', 'data', 'cliente_id', 'stato', 'pagato', 'note_ordine']],
    ['righe_ordine.csv', 'RIGHE_ORDINE', ['id', 'ordine_id', 'riga_ordine', 'articolo_id', 'quantita', 'prezzo_applicato', 'stato_riga', 'data_consegna', 'note_riga_ordine']]*/
];

function parseCsv(fileName) {
    const text = fs.readFileSync(path.join(IMPORT_DIR, fileName), 'utf8').replace(/^\uFEFF/, '');
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
        } else if (character === ';') { row.push(field); field = ''; }
        else if (character === '\n') { row.push(field.replace(/\r$/, '')); if (row.some(value => value)) rows.push({ line: rowLine, values: row }); row = []; field = ''; line += 1; rowLine = line; }
        else field += character;
    }
    if (quoted) throw new Error(`${fileName}:${line}: unterminated quoted field`);
    if (field || row.length) { row.push(field.replace(/\r$/, '')); if (row.some(value => value)) rows.push({ line: rowLine, values: row }); }
    return rows;
}

function integer(value, file, line, column) {
    if (!/^\d+$/.test(value)) throw new Error(`${file}:${line}: ${column} must be an integer`);
    return Number(value);
}

function nullable(value) { return value === '' ? null : value; }

function date(value, file, line, column) {
    if (!value) return null;
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
    if (!match) throw new Error(`${file}:${line}: ${column} must use DD/MM/YYYY`);
    return `${match[3]}-${match[2]}-${match[1]}`;
}

function decimal(value, file, line, column, optional = false) {
    if (!value && optional) return null;
    const normalized = value.replace(/\s/g, '').replace(/€/g, '').replace(/\./g, '').replace(',', '.');
    if (!/^-?\d+(\.\d+)?$/.test(normalized)) throw new Error(`${file}:${line}: ${column} is not a decimal/euro value`);
    return Number(normalized);
}

function transform(file, table, columns, row) {
    const values = Object.fromEntries(columns.map((column, index) => [column, row.values[index]]));
    const id = integer(values.id, file, row.line, 'id');
    if (table === 'UM') return [id, values.codice, nullable(values.descrizione)];
    if (table.startsWith('STATUS_')) return [id, nullable(values.stato), integer(values.ordinamento_stato, file, row.line, 'ordinamento_stato')];
    if (table === 'MATERIALI') return [id, values.codice, nullable(values.descrizione), values.um_base, nullable(values.categoria)];
    if (table === 'CLIENTI') return [id, values.nome, nullable(values.indirizzo), nullable(values.localita), nullable(values.telefono), nullable(values.zona), nullable(values.note)];
    if (table === 'ARTICOLI') return [id, values.codice, nullable(values.descrizione), values.materiale, values.um_vendita, decimal(values.um_base_x_um, file, row.line, 'um_base_x_um'), decimal(values.prezzo_acquisto, file, row.line, 'prezzo_acquisto'), decimal(values.prezzo_vendita, file, row.line, 'prezzo_vendita')];
    if (table === 'ORDINI') return [id, date(values.data, file, row.line, 'data'), integer(values.cliente_id, file, row.line, 'cliente_id'), integer(values.stato, file, row.line, 'stato'), integer(values.pagato, file, row.line, 'pagato'), nullable(values.note_ordine)];
    return [id, integer(values.ordine_id, file, row.line, 'ordine_id'), integer(values.riga_ordine, file, row.line, 'riga_ordine'), integer(values.articolo_id, file, row.line, 'articolo_id'), decimal(values.quantita, file, row.line, 'quantita'), decimal(values.prezzo_applicato, file, row.line, 'prezzo_applicato'), integer(values.stato_riga, file, row.line, 'stato_riga'), date(values.data_consegna, file, row.line, 'data_consegna'), nullable(values.note_riga_ordine)];
}

function load(definition) {
    const [file, table, columns] = definition;
    const rows = parseCsv(file);
    if (!rows.length || rows[0].values.join(';') !== columns.join(';')) throw new Error(`${file}: unexpected header`);
    const ids = new Set();
    return rows.slice(1).map(row => {
        if (row.values.length !== columns.length) throw new Error(`${file}:${row.line}: expected ${columns.length} columns, got ${row.values.length}`);
        const values = transform(file, table, columns, row);
        if (ids.has(values[0])) throw new Error(`${file}:${row.line}: duplicate id ${values[0]}`);
        ids.add(values[0]);
        return values;
    });
}

const data = imports.map(definition => ({ definition, values: load(definition) }));
const byTable = table => data.find(({ definition }) => definition[1] === table).values;
const umIds = new Map(byTable('UM').map(row => [row[1], row[0]]));
const materialIds = new Map(byTable('MATERIALI').map(row => [row[1], row[0]]));
byTable('MATERIALI').forEach(row => {
    if (!umIds.has(row[3])) throw new Error(`materiali.csv: unknown UM code ${row[3]}`);
    row[3] = umIds.get(row[3]);
});
byTable('ARTICOLI').forEach(row => {
    const materialCode = row[2];
    const description = row[3];
    if (!materialIds.has(materialCode)) throw new Error(`articoli.csv: unknown materiale code ${materialCode}`);
    if (!umIds.has(row[4])) throw new Error(`articoli.csv: unknown UM code ${row[4]}`);
    row[2] = description;
    row[3] = materialIds.get(materialCode);
    row[4] = umIds.get(row[4]);
});
const db = new Database(DB_FILE);
db.pragma('foreign_keys = ON');
try {
    db.transaction(() => data.forEach(({ definition }, index) => {
        const [, table, columns] = definition;
        const placeholders = columns.map(() => '?').join(', ');
        const updates = columns.slice(1).map(column => `${column}=excluded.${column}`).join(', ');
        const statement = db.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updates}`);
        data[index].values.forEach(row => statement.run(row));
    }))();
    console.log(`Database: ${DB_FILE}`);
    data.forEach(({ definition, values }) => console.log(`${definition[0]} -> ${definition[1]}: ${values.length} rows`));
} finally { db.close(); }