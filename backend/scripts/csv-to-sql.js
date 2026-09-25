// Converte ordini.csv e righe_ordine.csv in puro SQL (INSERT statements).
// Unica trasformazione: formato data DD-MM-YYYY -> YYYY-MM-DD.
// Correzioni dati concordate con l'utente:
//   - riga id 380: quantita "SACCHI" -> 100
//   - articolo_id 35 (note "SPAGNOLO", prezzo vuoto) -> articolo reale id 34 (SPAGNA-B, prezzo 455)
//   - articolo_id 36 (note "CARPINO", prezzo vuoto) -> prezzo 220 (CARPINO-33, già esistente)
const fs = require('fs');
const path = require('path');

const IMPORT_DIR = path.join(__dirname, '..', 'imports');
const OUT_DIR = path.join(__dirname, 'sql');

function readCsv(fileName) {
    const text = fs.readFileSync(path.join(IMPORT_DIR, fileName), 'utf8').replace(/^﻿/, '');
    const lines = text.split('\n').map(l => l.replace(/\r$/, '')).filter(l => l.length);
    const header = lines[0].split(',');
    return lines.slice(1).map(line => {
        const values = line.split(',');
        return Object.fromEntries(header.map((h, i) => [h, values[i] ?? '']));
    });
}

function ddmmyyyyToIso(value) {
    if (!value) return null;
    const [, dd, mm, yyyy] = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
    return `${yyyy}-${mm}-${dd}`;
}

function sqlValue(value) {
    if (value === null || value === undefined || value === '') return 'NULL';
    return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlNumber(value) {
    return value === null || value === undefined || value === '' ? 'NULL' : String(value);
}

const ordini = readCsv('ordini.csv');
const righe = readCsv('righe_ordine.csv');

const ordiniSql = ordini.map(row => {
    const data = sqlValue(ddmmyyyyToIso(row.data));
    return `(${row.id}, ${data}, ${row.cliente_id}, ${row.stato}, ${row.pagato}, ${sqlValue(row.note_ordine)})`;
});

const righeSql = righe.map(row => {
    let articoloId = row.articolo_id;
    let prezzo = row.prezzo_applicato;

    if (row.id === '380') {
        // "SACCHI" non è una quantità valida -> confermato dall'utente: 100
        row.quantita = '100';
    }
    if (articoloId === '35' && prezzo === '') {
        // "SPAGNOLO" nel CSV corrisponde all'articolo reale SPAGNA-B (id 34), non a un id 35 inventato
        articoloId = '34';
        prezzo = '455';
    }
    if (articoloId === '36' && prezzo === '') {
        // CARPINO-33 esiste già con questo id, manca solo il prezzo applicato
        prezzo = '220';
    }

    const dataConsegna = sqlValue(ddmmyyyyToIso(row.data_consegna));
    return `(${row.id}, ${row.id_ordine}, ${row.riga_ordine}, ${articoloId}, ${sqlNumber(row.quantita)}, ${sqlNumber(prezzo)}, ${row.stato_riga}, ${dataConsegna}, ${sqlValue(row.note_riga_ordine)})`;
});

const ordiniOut = `-- svuota e reimporta da zero (decisione utente)
DELETE FROM RIGHE_ORDINE;
DELETE FROM ORDINI;

INSERT INTO ORDINI (id, data, cliente_id, stato, pagato, note_ordine) VALUES
${ordiniSql.join(',\n')};
`;

const righeOut = `INSERT INTO RIGHE_ORDINE (id, ordine_id, riga_ordine, articolo_id, quantita, prezzo_applicato, stato_riga, data_consegna, note_riga_ordine) VALUES
${righeSql.join(',\n')};

UPDATE sqlite_sequence SET seq = (SELECT MAX(id) FROM ORDINI) WHERE name = 'ORDINI';
UPDATE sqlite_sequence SET seq = (SELECT MAX(id) FROM RIGHE_ORDINE) WHERE name = 'RIGHE_ORDINE';
`;

fs.writeFileSync(path.join(OUT_DIR, '02_ordini.sql'), ordiniOut);
fs.writeFileSync(path.join(OUT_DIR, '03_righe_ordine.sql'), righeOut);
console.log(`Scritti ${ordini.length} ordini e ${righe.length} righe ordine in backend/scripts/sql/`);
