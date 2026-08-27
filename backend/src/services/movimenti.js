const { db } = require('../db');

function getAll() {
    return db.prepare(`
        SELECT
            m.*,
            a.codice AS articolo_codice
        FROM MOVIMENTI m
        INNER JOIN ARTICOLI a
            ON a.id = m.articolo_id
        ORDER BY m.data DESC, m.id DESC
    `).all();
}

function getByArticolo(articoloId) {
    return db.prepare(`
        SELECT
            m.*,
            a.codice AS articolo_codice
        FROM MOVIMENTI m
        INNER JOIN ARTICOLI a
            ON a.id = m.articolo_id
        WHERE m.articolo_id = ?
        ORDER BY m.data DESC, m.id DESC
    `).all(articoloId);
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