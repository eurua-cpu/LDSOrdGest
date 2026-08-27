const { db } = require('../db');

function getAll() {
    return db.prepare(`
        SELECT *
        FROM CLIENTI
        ORDER BY nome
    `).all();
}

function getById(id) {
    return db.prepare(`
        SELECT *
        FROM CLIENTI
        WHERE id = ?
    `).get(id);
}

function create(data) {
    const result = db.prepare(`
        INSERT INTO CLIENTI (
            nome,
            indirizzo,
            localita,
            telefono,
            zona,
            note
        )
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(
        data.nome,
        data.indirizzo ?? null,
        data.localita ?? null,
        data.telefono ?? null,
        data.zona ?? null,
        data.note ?? null
    );

    return getById(result.lastInsertRowid);
}

function update(id, data) {
    const result = db.prepare(`
        UPDATE CLIENTI
        SET
            nome = ?,
            indirizzo = ?,
            localita = ?,
            telefono = ?,
            zona = ?,
            note = ?
        WHERE id = ?
    `).run(
        data.nome,
        data.indirizzo ?? null,
        data.localita ?? null,
        data.telefono ?? null,
        data.zona ?? null,
        data.note ?? null,
        id
    );

    if (result.changes === 0) {
        return null;
    }

    return getById(id);
}

function remove(id) {
    const result = db.prepare(`
        DELETE FROM CLIENTI
        WHERE id = ?
    `).run(id);

    return result.changes > 0;
}

module.exports = {
    getAll,
    getById,
    create,
    update,
    remove
};