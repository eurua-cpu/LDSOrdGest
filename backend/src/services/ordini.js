const { db } = require('../db');

function getAll() {
    return db.prepare(`
        SELECT
            o.*,
            c.nome AS cliente_nome,
            c.indirizzo AS cliente_indirizzo,
            c.localita AS cliente_localita,
            c.zona AS cliente_zona,
            COALESCE(SUM(r.quantita * r.prezzo_applicato), 0) AS totale_ordine
        FROM ORDINI o
        INNER JOIN CLIENTI c
            ON c.id = o.cliente_id
        LEFT JOIN RIGHE_ORDINE r
            ON r.ordine_id = o.id
        GROUP BY o.id
        ORDER BY o.data DESC
    `).all();
}

function getById(id) {
    const ordine = db.prepare(`
        SELECT
            o.*,
            c.nome AS cliente_nome,
            c.indirizzo AS cliente_indirizzo,
            c.localita AS cliente_localita,
            c.zona AS cliente_zona,
            COALESCE(SUM(r.quantita * r.prezzo_applicato), 0) AS totale_ordine
        FROM ORDINI o
        INNER JOIN CLIENTI c
            ON c.id = o.cliente_id
        LEFT JOIN RIGHE_ORDINE r
            ON r.ordine_id = o.id
        WHERE o.id = ?
        GROUP BY o.id
    `).get(id);

    if (!ordine) {
        return null;
    }

    ordine.righe = db.prepare(`
        SELECT
            r.*,
            a.codice AS articolo_codice,
            m.categoria AS articolo_categoria
        FROM RIGHE_ORDINE r
        INNER JOIN ARTICOLI a
            ON a.id = r.articolo_id
        INNER JOIN MATERIALI m
            ON m.id = a.materiale
        WHERE r.ordine_id = ?
        ORDER BY r.id
    `).all(id);

    return ordine;
}

function create(data) {

    const createOrder = db.transaction((ordine) => {

        // Verifica cliente
        const cliente = db.prepare(`
            SELECT id
            FROM CLIENTI
            WHERE id = ?
        `).get(ordine.cliente_id);

        if (!cliente) {
            throw new Error('Cliente non trovato');
        }

        // Crea ordine
        const orderResult = db.prepare(`
            INSERT INTO ORDINI (
                data,
                cliente_id,
                stato,
                pagato,
                note_ordine
            )
            VALUES (?, ?, ?, ?, ?)
        `).run(
            ordine.data ?? new Date().toISOString(),
            ordine.cliente_id,
            ordine.stato ?? 1,
            typeof ordine.pagato === 'boolean'
                ? (ordine.pagato ? 1 : 2)
                : (ordine.pagato ?? 2),
            ordine.note_ordine ?? null
        );

        const ordineId = orderResult.lastInsertRowid;

        // Statement riutilizzabile
        const insertRiga = db.prepare(`
            INSERT INTO RIGHE_ORDINE (
                ordine_id,
                articolo_id,
                quantita,
                prezzo_applicato,
                stato_riga
            )
            VALUES (?, ?, ?, ?, ?)
        `);

        for (const riga of ordine.righe ?? []) {

            const articolo = db.prepare(`
                SELECT id
                FROM ARTICOLI
                WHERE id = ?
            `).get(riga.articolo_id);

            if (!articolo) {
                throw new Error(
                    `Articolo ${riga.articolo_id} non trovato`
                );
            }

            insertRiga.run(
                ordineId,
                riga.articolo_id,
                riga.quantita,
                riga.prezzo_applicato,
                riga.stato_riga ?? 1
            );
        }

        return ordineId;
    });

    const id = createOrder(data);

    return getById(id);
}

function update(id, data) {
    const updateOrder = db.transaction((ordineId) => {
        const existing = db.prepare(`
            SELECT id
            FROM ORDINI
            WHERE id = ?
        `).get(ordineId);

        if (!existing) {
            return false;
        }

        const customer = db.prepare(`
            SELECT id
            FROM CLIENTI
            WHERE id = ?
        `).get(data.cliente_id);

        if (!customer) {
            throw new Error('Cliente non trovato');
        }

        db.prepare(`
            UPDATE ORDINI
            SET
                data = ?,
                cliente_id = ?,
                stato = ?,
                pagato = ?,
                note_ordine = ?
            WHERE id = ?
        `).run(
            data.data,
            data.cliente_id,
            data.stato,
            typeof data.pagato === 'boolean'
                ? (data.pagato ? 1 : 2)
                : (data.pagato ?? 2),
            data.note_ordine ?? null,
            ordineId
        );

        if (Array.isArray(data.righe)) {
            db.prepare(`
                DELETE FROM RIGHE_ORDINE
                WHERE ordine_id = ?
            `).run(ordineId);

            const insertLine = db.prepare(`
                INSERT INTO RIGHE_ORDINE (
                    ordine_id,
                    articolo_id,
                    quantita,
                    prezzo_applicato,
                    stato_riga
                )
                VALUES (?, ?, ?, ?, ?)
            `);

            for (const line of data.righe) {
                const article = db.prepare(`
                    SELECT id
                    FROM ARTICOLI
                    WHERE id = ?
                `).get(line.articolo_id);

                if (!article) {
                    throw new Error(`Articolo ${line.articolo_id} non trovato`);
                }

                insertLine.run(
                    ordineId,
                    line.articolo_id,
                    line.quantita,
                    line.prezzo_applicato,
                    line.stato_riga ?? 1
                );
            }
        }

        return true;
    });

    if (!updateOrder(id)) {
        return null;
    }

    return getById(id);
}

function remove(id) {

    const deleteOrder = db.transaction(() => {

        db.prepare(`
            DELETE FROM RIGHE_ORDINE
            WHERE ordine_id = ?
        `).run(id);

        const result = db.prepare(`
            DELETE FROM ORDINI
            WHERE id = ?
        `).run(id);

        return result.changes > 0;
    });

    return deleteOrder();
}

module.exports = {
    getAll,
    getById,
    create,
    update,
    remove
};