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

// Versione per Railway: esclude i 33 ordini con cliente_id non risolvibile
// (id cliente rinumerati su Railway dopo la migrazione iniziale; utente ha scelto di saltarli).
const CLIENTI_NON_RISOLVIBILI = new Set([49, 54, 195, 216, 222, 223, 226, 284, 314, 319, 360, 411, 492, 501, 506, 538, 550, 559, 568]);
const excludedOrderIds = new Set(ordini.filter(row => CLIENTI_NON_RISOLVIBILI.has(Number(row.cliente_id))).map(row => row.id));

const ordiniSqlPg = ordini.filter(row => !excludedOrderIds.has(row.id)).map((row, i) => ordiniSql[ordini.indexOf(row)]);
const righeSqlPg = righe.filter(row => !excludedOrderIds.has(row.id_ordine)).map(row => righeSql[righe.indexOf(row)]);

const ordiniPgOut = `-- svuota e reimporta da zero (decisione utente), escludendo ${excludedOrderIds.size} ordini
-- con cliente_id non risolvibile su Railway (id cliente rinumerati dopo la migrazione)
DELETE FROM righe_ordine;
DELETE FROM ordini;

INSERT INTO ordini (id, data, cliente_id, stato, pagato, note_ordine) VALUES
${ordiniSqlPg.join(',\n')};
`;

const righeOrdinePgOut = `INSERT INTO righe_ordine (id, ordine_id, riga_ordine, articolo_id, quantita, prezzo_applicato, stato_riga, data_consegna, note_riga_ordine) VALUES
${righeSqlPg.join(',\n')};

SELECT setval(pg_get_serial_sequence('ordini','id'), (SELECT MAX(id) FROM ordini));
SELECT setval(pg_get_serial_sequence('righe_ordine','id'), (SELECT MAX(id) FROM righe_ordine));
`;

fs.writeFileSync(path.join(OUT_DIR, '02_ordini_pg.sql'), ordiniPgOut);
fs.writeFileSync(path.join(OUT_DIR, '03_righe_ordine_pg.sql'), righeOrdinePgOut);
console.log(`Railway: esclusi ${excludedOrderIds.size} ordini (${ordiniSqlPg.length} ordini, ${righeSqlPg.length} righe ordine da importare)`);
