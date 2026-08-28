const { db } = require('../db');

function getAll() {
    return db.prepare(`
        SELECT m.*, u.codice AS um_base_codice, u.descrizione AS um_base_descrizione
        FROM MATERIALI m
        INNER JOIN UM u ON u.id = m.um_base
        ORDER BY m.codice
    `).all();
}

function create(data) {
    const result = db.prepare(`
        INSERT INTO MATERIALI (codice, descrizione, um_base, categoria)
        VALUES (?, ?, ?, ?)
    `).run(
        data.codice.trim(),
        data.descrizione?.trim() || null,
        Number(data.um_base),
        data.categoria?.trim() || null
    );

    return getById(result.lastInsertRowid);
}

function getById(id) {
    return db.prepare(`
        SELECT m.*, u.codice AS um_base_codice, u.descrizione AS um_base_descrizione
        FROM MATERIALI m
        INNER JOIN UM u ON u.id = m.um_base
        WHERE m.id = ?
    `).get(id);
}

module.exports = { getAll, getById, create };
