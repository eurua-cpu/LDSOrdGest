const { db } = require('../db');
const magazzino = require('./magazzino');

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
        ORDER BY o.data DESC, o.id DESC
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
        ORDER BY o.data DESC
    `).get(id);

    if (!ordine) {
        return null;
    }

    ordine.righe = db.prepare(`
        SELECT
            r.*,
            a.codice AS articolo_codice,
            m.categoria AS articolo_categoria,
            s.stato AS stato_riga_nome
        FROM RIGHE_ORDINE r
        INNER JOIN ARTICOLI a
            ON a.id = r.articolo_id
        INNER JOIN MATERIALI m
            ON m.id = a.materiale
        INNER JOIN STATUS_RIGA_ORDINE s
            ON s.id = r.stato_riga
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

        /*
        * ------------------------------------------------------
        * VERIFICA STOCK
        * ------------------------------------------------------
        *
        * Facciamo tutti i controlli PRIMA
        * di creare l'ordine.
        **/

        for (const riga of data.righe) {

            const articolo = db.prepare(`
                SELECT
                    id,
                    codice,
                    descrizione
                FROM ARTICOLI
                WHERE id = ?
            `).get(riga.articolo_id);

            if (!articolo) {

                throw new Error(
                    `Articolo ${riga.articolo_id} non trovato`
                );
            }

            const quantita =
                Number(riga.quantita);

            if (
                !Number.isFinite(quantita) ||
                quantita <= 0
            ) {

                throw new Error(
                    `Quantità non valida per ` +
                    `${articolo.codice}`
                );
            }

            if (ordine.stato !== 2) {
                magazzino.verificaDisponibilita(articolo.id, quantita);
            }
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
                stato_riga,
                quantita_consegnata
            )
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        for (const riga of ordine.righe ?? []) {

            /*const articolo = db.prepare(`
                SELECT id
                FROM ARTICOLI
                WHERE id = ?
            `).get(riga.articolo_id);

            if (!articolo) {
                throw new Error(
                    `Articolo ${riga.articolo_id} non trovato`
                );
            }*/

            insertRiga.run(
                ordineId,
                riga.articolo_id,
                riga.quantita,
                riga.prezzo_applicato,
                ordine.stato === 2 ? 2 : (riga.stato_riga ?? 1),
                ordine.stato === 2 ? riga.quantita : (riga.quantita_consegnata ?? 0)
            );
        }

        return ordineId;
    });

    const id = createOrder(data);

    return getById(id);
}

function update(id, data) {
    const updateOrder = db.transaction((ordineId) => {
        const requestedStatus = Number(data.stato);
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

         /*
        * ------------------------------------------------------
        * VERIFICA STOCK
        * ------------------------------------------------------
        *
        * Facciamo tutti i controlli PRIMA
        * di creare l'ordine.
        **/

        for (const riga of data.righe ?? []) {

            const articolo = db.prepare(`
                SELECT
                    id,
                    codice,
                    descrizione
                FROM ARTICOLI
                WHERE id = ?
            `).get(riga.articolo_id);

            if (!articolo) {

                throw new Error(
                    `Articolo ${riga.articolo_id} non trovato`
                );
            }

            const quantita =
                Number(riga.quantita);

            if (
                !Number.isFinite(quantita) ||
                quantita <= 0
            ) {

                throw new Error(
                    `Quantità non valida per ` +
                    `${articolo.codice}`
                );
            }

            const lineStatus = Number(riga.stato_riga);
            const quantitaDaImpegnare = requestedStatus === 2 || lineStatus === 2
                ? 0
                : Math.max(0, quantita - Number(riga.quantita_consegnata ?? 0));
            if (quantitaDaImpegnare > 0) {
                magazzino.verificaDisponibilita(articolo.id, quantitaDaImpegnare, ordineId);
            }
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
            requestedStatus,
            typeof data.pagato === 'boolean'
                ? (data.pagato ? 1 : 2)
                : (data.pagato ?? 2),
            data.note_ordine ?? null,
            ordineId
        );

        if (Array.isArray(data.righe)) {
            const existingLines = db.prepare(`
                SELECT articolo_id, quantita_consegnata
                FROM RIGHE_ORDINE
                WHERE ordine_id = ?
            `).all(ordineId);

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
                    stato_riga,
                    quantita_consegnata
                )
                VALUES (?, ?, ?, ?, ?, ?)
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

                const requestedLineStatus = Number(line.stato_riga);
                const quantitaConsegnata = requestedStatus === 2 || requestedLineStatus === 2
                    ? Number(line.quantita)
                    : Number(line.quantita_consegnata ?? 0);

                if (!Number.isFinite(quantitaConsegnata) || quantitaConsegnata < 0 || quantitaConsegnata > Number(line.quantita)) {
                    throw new Error(`Quantità consegnata non valida per l'articolo ${line.articolo_id}`);
                }

                const statoRiga = requestedStatus === 2 || requestedLineStatus === 2 || quantitaConsegnata >= Number(line.quantita)
                    ? 2
                    : (quantitaConsegnata > 0 ? 4 : (line.stato_riga ?? 1));

                const previousDelivered = existingLines
                    .filter((oldLine) => oldLine.articolo_id === line.articolo_id)
                    .reduce((total, oldLine) => total + Number(oldLine.quantita_consegnata || 0), 0);
                const deliveryDelta = quantitaConsegnata - previousDelivered;
                if (deliveryDelta > 0) {
                    magazzino.vendita({ articoloId: line.articolo_id, quantita: deliveryDelta, ordineId, rigaOrdineId: line.id, note: `Consegna ordine "${ordineId}" riga "${line.id}"` });
                } else if (deliveryDelta < 0) {
                    magazzino.resoCliente({ articoloId: line.articolo_id, quantita: -deliveryDelta, ordineId, rigaOrdineId: line.id, note: `Rettifica consegna ordine "${ordineId}" riga "${line.id}"` });
                }

                insertLine.run(
                    ordineId,
                    line.articolo_id,
                    line.quantita,
                    line.prezzo_applicato,
                    requestedStatus === 2 ? 2 : statoRiga,
                    quantitaConsegnata
                );
            }
        }

        if (requestedStatus === 2) {
            db.prepare(`
                UPDATE RIGHE_ORDINE
                SET stato_riga = 2
                WHERE ordine_id = ?
            `).run(ordineId);
        } else if (requestedStatus === 1) {
            const lineStatus = db.prepare(`
                SELECT
                    COUNT(*) AS totale_righe,
                    SUM(CASE WHEN stato_riga = 2 THEN 1 ELSE 0 END) AS righe_consegnate
                FROM RIGHE_ORDINE
                WHERE ordine_id = ?
            `).get(ordineId);

            if (lineStatus.totale_righe > 0 && lineStatus.righe_consegnate > 0) {
                const derivedStatus = lineStatus.righe_consegnate === lineStatus.totale_righe ? 2 : 4;
                db.prepare(`
                    UPDATE ORDINI
                    SET stato = ?
                    WHERE id = ?
                `).run(derivedStatus, ordineId);
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

/**
 * ============================================================
 * CONSEGNA RIGA ORDINE
 * ============================================================
 *
 * Esempio:
 *
 * ordinato       = 100
 * consegnato      = 0
 *
 * consegno 30
 *
 * ordinato       = 100
 * consegnato     = 30
 * impegnato      = 70
 *
 * E contemporaneamente:
 *
 * MOVIMENTO = -30
 */
function consegnaRiga({
    rigaOrdineId,
    quantita
}) {

    const qta = Number(quantita);

    if (
        !Number.isFinite(qta) ||
        qta <= 0
    ) {
        throw new Error(
            'Quantità consegna non valida'
        );
    }


    const transaction = db.transaction(() => {

        /*
         * ------------------------------------------------------
         * RECUPERA RIGA
         * ------------------------------------------------------
         */

        const riga = db.prepare(`
            SELECT
                r.id,
                r.ordine_id,
                r.articolo_id,
                r.quantita,
                r.quantita_consegnata,
                r.stato_riga,

                a.codice AS articolo_codice,

                s.stato AS stato_codice

            FROM RIGHE_ORDINE r

            INNER JOIN ARTICOLI a
                ON a.id = r.articolo_id

            LEFT JOIN STATUS_RIGA_ORDINE s
                ON s.id = r.stato_riga

            WHERE r.id = ?
        `).get(rigaOrdineId);


        if (!riga) {
            throw new Error(
                `Riga ordine ${rigaOrdineId} non trovata`
            );
        }


        /*
         * ------------------------------------------------------
         * CONTROLLO STATO
         * ------------------------------------------------------
         */

        if (
            riga.stato_codice === 'ANNULLATA'
        ) {
            throw new Error(
                'Non puoi consegnare una riga annullata'
            );
        }


        /*
         * ------------------------------------------------------
         * CONTROLLO QUANTITÀ
         * ------------------------------------------------------
         */

        const daConsegnare =
            Number(riga.quantita)
            -
            Number(riga.quantita_consegnata);


        if (qta > daConsegnare) {

            throw new Error(
                `Quantità superiore al residuo ` +
                `della riga. ` +
                `Residua: ${daConsegnare}, ` +
                `richiesta: ${qta}`
            );
        }


        /*
         * ------------------------------------------------------
         * CONTROLLO GIACENZA FISICA
         * ------------------------------------------------------
         */

        const fisico =
            magazzino.getGiacenzaFisica(
                riga.articolo_id
            );


        if (fisico < qta) {

            throw new Error(
                `Giacenza insufficiente per ` +
                `${riga.articolo_codice}. ` +
                `Disponibile fisico: ${fisico}, ` +
                `richiesto: ${qta}`
            );
        }


        /*
         * ------------------------------------------------------
         * MOVIMENTO
         * ------------------------------------------------------
         */

        magazzino.vendita({

            articoloId:
                riga.articolo_id,

            quantita: qta,

            ordineId:
                riga.ordine_id,

            rigaOrdineId
        });


        /*
         * ------------------------------------------------------
         * AGGIORNA RIGA
         * ------------------------------------------------------
         */

        const nuovaQuantitaConsegnata =
            Number(riga.quantita_consegnata)
            +
            qta;


        db.prepare(`
            UPDATE RIGHE_ORDINE

            SET quantita_consegnata = ?

            WHERE id = ?
        `).run(
            nuovaQuantitaConsegnata,
            rigaOrdineId
        );


        /*
         * ------------------------------------------------------
         * AGGIORNA STATO
         * ------------------------------------------------------
         */

        let nuovoStato;


        if (
            nuovaQuantitaConsegnata
            >=
            Number(riga.quantita)
        ) {

            nuovoStato = db.prepare(`
                SELECT id
                FROM STATUS_RIGA_ORDINE
                WHERE id = 2
            `).get();

        } else {

            nuovoStato = db.prepare(`
                SELECT id
                FROM STATUS_RIGA_ORDINE
                WHERE id = 4
            `).get();
        }


        if (nuovoStato) {

            db.prepare(`
                UPDATE RIGHE_ORDINE

                SET stato_riga = ?

                WHERE id = ?
            `).run(
                nuovoStato.id,
                rigaOrdineId
            );
        }

        const statoOrdine = db.prepare(`
            SELECT
                COUNT(*) AS totale_righe,
                SUM(CASE WHEN stato_riga = 2 THEN 1 ELSE 0 END) AS righe_consegnate
            FROM RIGHE_ORDINE
            WHERE ordine_id = ?
        `).get(riga.ordine_id);
        if (statoOrdine.totale_righe > 0 && statoOrdine.righe_consegnate === statoOrdine.totale_righe) {
            db.prepare('UPDATE ORDINI SET stato = 2 WHERE id = ?').run(riga.ordine_id);
        } else if (statoOrdine.righe_consegnate > 0) {
            db.prepare('UPDATE ORDINI SET stato = 4 WHERE id = ?').run(riga.ordine_id);
        }


        return {
            riga_ordine_id: rigaOrdineId,

            articolo_id:
                riga.articolo_id,

            quantita_consegnata:
                nuovaQuantitaConsegnata,

            quantita_residua:
                Number(riga.quantita)
                -
                novaQuantitaConsegnata
        };
    });


    return transaction();
}


/**
 * ============================================================
 * CONSEGNA COMPLETA ORDINE
 * ============================================================
 *
 * Consegna tutte le quantità ancora mancanti.
 */
function consegnaOrdine(ordineId) {

    const transaction = db.transaction(() => {

        const righe = db.prepare(`
            SELECT
                id,
                articolo_id,
                quantita,
                quantita_consegnata
            FROM RIGHE_ORDINE
            WHERE ordine_id = ?

            AND quantita_consegnata < quantita
        `).all(ordineId);


        if (righe.length === 0) {

            throw new Error(
                'L\'ordine è già completamente consegnato'
            );
        }


        const risultati = [];


        /*
         * Prima controlliamo TUTTO.
         *
         * Se anche un solo articolo non ha
         * sufficiente stock, non consegniamo nulla.
         */

        for (const riga of righe) {

            const residua =
                Number(riga.quantita)
                -
                Number(riga.quantita_consegnata);


            const fisico =
                magazzino.getGiacenzaFisica(
                    riga.articolo_id
                );


            if (fisico < residua) {

                throw new Error(
                    `Giacenza insufficiente ` +
                    `per articolo ${riga.articolo_id}. ` +
                    `Disponibile: ${fisico}, ` +
                    `richiesto: ${residua}`
                );
            }
        }


        /*
         * Ora possiamo effettuare le consegne.
         */

        for (const riga of righe) {

            const residua =
                Number(riga.quantita)
                -
                Number(riga.quantita_consegnata);


            magazzino.vendita({

                articoloId:
                    riga.articolo_id,

                quantita:
                    residua,

                ordineId,
                rigaOrdineId: riga.id
            });


            db.prepare(`
                UPDATE RIGHE_ORDINE

                SET quantita_consegnata = quantita

                WHERE id = ?
            `).run(riga.id);


            risultati.push({
                riga_ordine_id: riga.id,
                articolo_id: riga.articolo_id,
                quantita_consegnata: residua
            });
        }


        /*
         * Tutte le righe sono state consegnate.
         */

        const stato = db.prepare(`
            SELECT id
            FROM STATUS_RIGA_ORDINE
            WHERE id = 2
        `).get();


        if (stato) {

            db.prepare(`
                UPDATE RIGHE_ORDINE

                SET stato_riga = ?

                WHERE ordine_id = ?

                AND quantita_consegnata >= quantita
            `).run(
                stato.id,
                ordineId
            );
        }

        db.prepare('UPDATE ORDINI SET stato = 2 WHERE id = ?').run(ordineId);


        return risultati;
    });


    return transaction();
}


/**
 * ============================================================
 * ANNULLAMENTO RIGA
 * ============================================================
 *
 * Se la riga non è stata consegnata,
 * togliamo automaticamente l'impegno.
 *
 * Non viene creato nessun movimento.
 */
function annullaRiga(rigaOrdineId) {

    const riga = db.prepare(`
        SELECT
            r.id,
            r.quantita,
            r.quantita_consegnata,
            r.stato_riga
        FROM RIGHE_ORDINE r
        WHERE r.id = ?
    `).get(rigaOrdineId);


    if (!riga) {
        throw new Error(
            'Riga ordine non trovata'
        );
    }


    const stato = db.prepare(`
        SELECT id
        FROM STATUS_RIGA_ORDINE
        WHERE id = 3
    `).get();


    if (!stato) {
        throw new Error(
            'Stato ANNULLATA non configurato'
        );
    }


    db.prepare(`
        UPDATE RIGHE_ORDINE

        SET stato_riga = ?

        WHERE id = ?
    `).run(
        stato.id,
        rigaOrdineId
    );

    db.prepare(`
        UPDATE ORDINI
        SET stato = CASE
            WHEN EXISTS (SELECT 1 FROM RIGHE_ORDINE WHERE ordine_id = (SELECT ordine_id FROM RIGHE_ORDINE WHERE id = ?) AND stato_riga = 2)
            THEN 4
            ELSE 1
        END
        WHERE id = (SELECT ordine_id FROM RIGHE_ORDINE WHERE id = ?)
    `).run(rigaOrdineId, rigaOrdineId);


    return {
        id: rigaOrdineId,
        stato: 'ANNULLATA'
    };
}


module.exports = {
    getAll,
    getById,
    create,
    update,
    remove,
    consegnaRiga,
    consegnaOrdine,
    annullaRiga
};