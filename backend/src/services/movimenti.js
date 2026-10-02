const { db } = require('../db');

async function getAll() {
    return normalizeDates(await db.prepare(`
        SELECT
            m.*,
            a.codice AS articolo_codice,
            a.descrizione AS articolo_descrizione,
            u.codice AS unita_vendita,
            u.descrizione AS unita_vendita_descrizione,
            c.nome AS cliente_nome
        FROM MOVIMENTI m
        INNER JOIN ARTICOLI a
            ON a.id = m.articolo_id
        LEFT JOIN UM u
            ON u.id = a.um_vendita
        LEFT JOIN ORDINI o
            ON o.id = m.riferimento_ordine_id
        LEFT JOIN CLIENTI c
            ON c.id = o.cliente_id
        ORDER BY
            CASE
                WHEN m.data ~ '^[0-9]{2}-[0-9]{2}-[0-9]{4}$'
                    THEN substring(m.data from 7 for 4) || '-' || substring(m.data from 4 for 2) || '-' || substring(m.data from 1 for 2)
                ELSE substring(m.data from 1 for 10)
            END DESC,
            m.id DESC
    `).all());
}

async function getByArticolo(articoloId) {
    return normalizeDates(await db.prepare(`
        SELECT
            m.*,
            a.codice AS articolo_codice,
            a.descrizione AS articolo_descrizione,
            u.codice AS unita_vendita,
            u.descrizione AS unita_vendita_descrizione,
            c.nome AS cliente_nome
        FROM MOVIMENTI m
        INNER JOIN ARTICOLI a
            ON a.id = m.articolo_id
        LEFT JOIN UM u
            ON u.id = a.um_vendita
        LEFT JOIN ORDINI o
            ON o.id = m.riferimento_ordine_id
        LEFT JOIN CLIENTI c
            ON c.id = o.cliente_id
        WHERE m.articolo_id = ?
        ORDER BY
            CASE
                WHEN m.data ~ '^[0-9]{2}-[0-9]{2}-[0-9]{4}$'
                    THEN substring(m.data from 7 for 4) || '-' || substring(m.data from 4 for 2) || '-' || substring(m.data from 1 for 2)
                ELSE substring(m.data from 1 for 10)
            END DESC,
            m.id DESC
    `).all(articoloId));
}

function normalizeDates(movimenti) {
    return movimenti.map((movimento) => ({
        ...movimento,
        data: formatDate(movimento.data)
    }));
}

function formatDate(value) {
    const text = String(value || '');
    if (/^\d{2}-\d{2}-\d{4}$/.test(text)) return text;
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
    return match ? `${match[3]}-${match[2]}-${match[1]}` : text;
}

async function getGiacenza(articoloId) {
    const result = await db.prepare(`
        SELECT
            COALESCE(SUM(quantita), 0) AS giacenza
        FROM MOVIMENTI
        WHERE articolo_id = ?
    `).get(articoloId);

    return result?.giacenza;
}

async function create(data) {

    const result = await db.prepare(`
        INSERT INTO MOVIMENTI (
            articolo_id,
            tipo,
            quantita,
            data
        )
        VALUES (?, ?, ?, ?)
    `).run(
        data.articolo_id,
        data.tipo,
        data.quantita,
        data.data ?? new Date().toISOString()
    );

    return db.prepare(`
        SELECT *
        FROM MOVIMENTI
        WHERE id = ?
    `).get(result.lastInsertRowid);
}

module.exports = {
    getAll,
    getByArticolo,
    getGiacenza,
    create
};