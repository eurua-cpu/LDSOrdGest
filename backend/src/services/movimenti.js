const { db } = require('../db');

function getAll() {
    return normalizeDates(db.prepare(`
        SELECT
            m.*,
            a.codice AS articolo_codice,
            a.descrizione AS articolo_descrizione,
            u.codice AS unita_vendita,
            u.descrizione AS unita_vendita_descrizione
        FROM MOVIMENTI m
        INNER JOIN ARTICOLI a
            ON a.id = m.articolo_id
        LEFT JOIN UM u
            ON u.id = a.um_vendita
        ORDER BY m.data DESC, m.id DESC
    `).all());
}

function getByArticolo(articoloId) {
    return normalizeDates(db.prepare(`
        SELECT
            m.*,
            a.codice AS articolo_codice,
            a.descrizione AS articolo_descrizione,
            u.codice AS unita_vendita,
            u.descrizione AS unita_vendita_descrizione
        FROM MOVIMENTI m
        INNER JOIN ARTICOLI a
            ON a.id = m.articolo_id
        LEFT JOIN UM u
            ON u.id = a.um_vendita
        WHERE m.articolo_id = ?
        ORDER BY m.data DESC, m.id DESC
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

function getGiacenza(articoloId) {
    const result = db.prepare(`
        SELECT
            COALESCE(SUM(quantita), 0) AS giacenza
        FROM MOVIMENTI
        WHERE articolo_id = ?
    `).get(articoloId);

    return result.giacenza;
}

function create(data) {

    const result = db.prepare(`
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