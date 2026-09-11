const { db } = require('../db');

async function getAll() {
    return db.prepare(`
        SELECT a.*, 
        m.descrizione AS materiale_descrizione, 
        m.codice AS materiale_codice,
        u.descrizione AS um_vendita_descrizione,
        u.codice AS um_vendita_codice,
        ub.codice AS um_base_codice
        FROM ARTICOLI a
        JOIN MATERIALI m
            ON m.id = a.materiale
        JOIN UM u
            ON u.id = a.um_vendita
        JOIN UM ub
            ON ub.id = m.um_base
        ORDER BY a.codice
    `).all();
}

async function getById(id) {
    return db.prepare(`
        SELECT a.*, 
        m.descrizione AS materiale_descrizione, 
        m.codice AS materiale_codice,
        u.descrizione AS um_vendita_descrizione,
        u.codice AS um_vendita_codice,
        ub.codice AS um_base_codice
        FROM ARTICOLI a
        JOIN MATERIALI m
            ON m.id = a.materiale
        JOIN UM u
            ON u.id = a.um_vendita
        JOIN UM ub
            ON ub.id = m.um_base
        WHERE a.id = ?
    `).get(id);
}

async function create(data) {
    const result = await db.prepare(`
        INSERT INTO ARTICOLI (
            codice,
            descrizione,
            materiale,
            um_vendita,
            um_base_x_um,
            prezzo_acquisto,
            prezzo_vendita
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
        data.codice,
        data.descrizione ?? null,
        data.materiale,
        data.um_vendita,
        data.um_base_x_um ?? null,
        data.prezzo_acquisto ?? 0,
        data.prezzo_vendita ?? 0
    );

    return getById(result.lastInsertRowid);
}

async function update(id, data) {
    const result = await db.prepare(`
        UPDATE ARTICOLI
        SET
            codice = ?,
            descrizione = ?,
            materiale = ?,
            um_vendita = ?,
            um_base_x_um = ?,
            prezzo_acquisto = ?,
            prezzo_vendita = ?
        WHERE id = ?
    `).run(
        data.codice,
        data.descrizione ?? null,
        data.materiale,
        data.um_vendita,
        data.um_base_x_um ?? null,
        data.prezzo_acquisto ?? 0,
        data.prezzo_vendita ?? 0,
        id
    );

    if (result.changes === 0) {
        return null;
    }

    return getById(id);
}

async function remove(id) {
    const result = await db.prepare(`
        DELETE FROM ARTICOLI
        WHERE id = ?
    `).run(id);

    return result.changes > 0;
}

async function getGiacenza(id) {
    const result = await db.prepare(`
        SELECT
            COALESCE(SUM(quantita), 0) AS giacenza
        FROM MOVIMENTI
        WHERE articolo_id = ?
    `).get(id);

    return result?.giacenza;
}

module.exports = {
    getAll,
    getById,
    create,
    update,
    remove,
    getGiacenza
};