const { db } = require('../db');


/**
 * ============================================================
 * GIACENZA FISICA
 * ============================================================
 *
 * Somma di tutti i movimenti dell'articolo.
 *
 * CARICO       +100
 * VENDITA       -20
 * RETTIFICA      +5
 *
 * Giacenza = 85
 */
async function getGiacenzaFisica(articoloId) {

    const result = await db.prepare(`
        SELECT
            COALESCE(SUM(quantita), 0) AS giacenza
        FROM MOVIMENTI
        WHERE articolo_id = ?
    `).get(articoloId);

    return Number(result.giacenza);
}


/**
 * ============================================================
 * STOCK IMPEGNATO
 * ============================================================
 *
 * Quantità ordinata ma non ancora consegnata.
 *
 * quantita - quantita_consegnata
 *
 * Non consideriamo le righe ANNULLATE.
 */
async function getStockImpegnato(articoloId, excludeOrderId = null) {

    const result = await db.prepare(`
        SELECT
            COALESCE(
                SUM(
                    r.quantita -
                    r.quantita_consegnata
                ),
                0
            ) AS impegnato

        FROM RIGHE_ORDINE r

        INNER JOIN STATUS_RIGA_ORDINE s
            ON s.id = r.stato_riga

        WHERE r.articolo_id = ?

        AND s.id NOT IN (2, 3)
        AND ($2::integer IS NULL OR r.ordine_id <> $3::integer)
    `).get(articoloId, excludeOrderId, excludeOrderId);

    return Number(result.impegnato);
}


/**
 * ============================================================
 * STOCK DISPONIBILE
 * ============================================================
 *
 * Fisicamente presente
 * meno
 * quantità già impegnata.
 */
async function getStockDisponibile(articoloId, excludeOrderId = null) {

    const fisico =
        await getGiacenzaFisica(articoloId);

    const impegnato =
        await getStockImpegnato(articoloId, excludeOrderId);

    return fisico - impegnato;
}


/**
 * ============================================================
 * SITUAZIONE ARTICOLO
 * ============================================================
 */
async function getStockArticolo(articoloId) {

    const articolo = await db.prepare(`
        SELECT
            id,
            codice,
            descrizione
        FROM ARTICOLI
        WHERE id = ?
    `).get(articoloId);

    if (!articolo) {
        throw new Error(
            `Articolo ${articoloId} non trovato`
        );
    }

    const giacenzaFisica =
        await getGiacenzaFisica(articoloId);

    const stockImpegnato =
        await getStockImpegnato(articoloId);

    const stockDisponibile =
        giacenzaFisica - stockImpegnato;

    return {
        articolo_id: articolo.id,
        codice: articolo.codice,
        descrizione: articolo.descrizione,

        giacenza_fisica: giacenzaFisica,

        stock_impegnato: stockImpegnato,

        stock_disponibile: stockDisponibile
    };
}


/**
 * ============================================================
 * TUTTO IL MAGAZZINO
 * ============================================================
 */
async function getStock() {

    return db.prepare(`
        SELECT

            a.id,
            a.codice,
            a.descrizione,
            u.codice AS unita_vendita,
            u.descrizione AS unita_vendita_descrizione,

            COALESCE(
                stock.giacenza,
                0
            ) AS giacenza_fisica,

            COALESCE(
                impegni.impegnato,
                0
            ) AS stock_impegnato,

            COALESCE(
                stock.giacenza,
                0
            )
            -
            COALESCE(
                impegni.impegnato,
                0
            ) AS stock_disponibile

        FROM ARTICOLI a
        LEFT JOIN UM u ON u.id = a.um_vendita

        LEFT JOIN (

            SELECT
                articolo_id,
                SUM(quantita) AS giacenza

            FROM MOVIMENTI

            GROUP BY articolo_id

        ) stock

            ON stock.articolo_id = a.id


        LEFT JOIN (

            SELECT

                r.articolo_id,

                SUM(
                    r.quantita -
                    r.quantita_consegnata
                ) AS impegnato

            FROM RIGHE_ORDINE r

            INNER JOIN STATUS_RIGA_ORDINE s
                ON s.id = r.stato_riga

            WHERE s.id NOT IN (2, 3)

            GROUP BY r.articolo_id

        ) impegni

            ON impegni.articolo_id = a.id

        ORDER BY a.codice

    `).all();
}

async function getStockMateriali() {
    return db.prepare(`
        SELECT
            m.id AS materiale_id,
            m.codice AS materiale_codice,
            m.descrizione AS materiale_descrizione,
            u.codice AS unita_base,
            u.descrizione AS unita_base_descrizione,
            COALESCE(SUM(stock.giacenza_fisica * COALESCE(a.um_base_x_um, 1)), 0) AS giacenza_fisica,
            COALESCE(SUM(stock.stock_impegnato * COALESCE(a.um_base_x_um, 1)), 0) AS stock_impegnato,
            COALESCE(SUM(stock.stock_disponibile * COALESCE(a.um_base_x_um, 1)), 0) AS stock_disponibile
        FROM MATERIALI m
        INNER JOIN ARTICOLI a ON a.materiale = m.id
        LEFT JOIN UM u ON u.id = m.um_base
        LEFT JOIN (
            SELECT
                a2.id AS articolo_id,
                COALESCE((SELECT SUM(mv.quantita) FROM MOVIMENTI mv WHERE mv.articolo_id = a2.id), 0) AS giacenza_fisica,
                COALESCE((SELECT SUM(r.quantita - r.quantita_consegnata) FROM RIGHE_ORDINE r WHERE r.articolo_id = a2.id AND r.stato_riga NOT IN (2, 3)), 0) AS stock_impegnato,
                COALESCE((SELECT SUM(mv2.quantita) FROM MOVIMENTI mv2 WHERE mv2.articolo_id = a2.id), 0) - COALESCE((SELECT SUM(r2.quantita - r2.quantita_consegnata) FROM RIGHE_ORDINE r2 WHERE r2.articolo_id = a2.id AND r2.stato_riga NOT IN (2, 3)), 0) AS stock_disponibile
            FROM ARTICOLI a2
        ) stock ON stock.articolo_id = a.id
        GROUP BY m.id, u.codice, u.descrizione
        ORDER BY m.codice
    `).all();
}


/**
 * ============================================================
 * VERIFICA DISPONIBILITÀ
 * ============================================================
 */
async function verificaDisponibilita(
    articoloId,
    quantita,
    excludeOrderId = null
) {

    if (!Number.isFinite(Number(quantita))) {
        throw new Error(
            'Quantità non valida'
        );
    }

    if (Number(quantita) <= 0) {
        throw new Error(
            'La quantità deve essere maggiore di zero'
        );
    }

    const disponibile =
        await getStockDisponibile(articoloId, excludeOrderId);

    if (disponibile < Number(quantita)) {

        throw new Error(
            `Giacenza disponibile insufficiente. ` +
            `Disponibile: ${disponibile}, ` +
            `richiesto: ${quantita}`
        );
    }

    return true;
}


/**
 * ============================================================
 * CREA MOVIMENTO
 * ============================================================
 */
async function createMovimento({
    articoloId,
    tipo,
    quantita,
    data = null,
    riferimentoTipo = null,
    riferimentoId = null,
    riferimentoOrdineId = null,
    riferimentoRigaId = null,
    note = null
}) {

    if (!articoloId) {
        throw new Error(
            'articoloId obbligatorio'
        );
    }

    if (!tipo) {
        throw new Error(
            'tipo movimento obbligatorio'
        );
    }

    const qta = Number(quantita);

    if (!Number.isFinite(qta)) {
        throw new Error(
            'quantità movimento non valida'
        );
    }

    if (qta === 0) {
        throw new Error(
            'Un movimento non può avere quantità zero'
        );
    }

    const articolo = await db.prepare(`
        SELECT id, codice
        FROM ARTICOLI
        WHERE id = ?
    `).get(articoloId);

    if (!articolo) {
        throw new Error(
            `Articolo ${articoloId} non trovato`
        );
    }

    const result = await db.prepare(`
        INSERT INTO MOVIMENTI (
            articolo_id,
            tipo,
            quantita,
            data,
            riferimento_tipo,
            riferimento_id,
            riferimento_ordine_id,
            riferimento_riga_id,
            note
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(

        articoloId,

        tipo,

        qta,

        data ? normalizeMovementDate(data) : formatMovementDate(new Date()),

        riferimentoTipo,

        riferimentoId,

        riferimentoOrdineId,

        riferimentoRigaId,

        note
    );

    return db.prepare(`
        SELECT *
        FROM MOVIMENTI
        WHERE id = ?
    `).get(result.lastInsertRowid);
}

function formatMovementDate(value) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${day}-${month}-${year}`;
}

function normalizeMovementDate(value) {
    const text = String(value).trim();
    if (/^\d{2}-\d{2}-\d{4}$/.test(text)) return text;
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        const [year, month, day] = text.split('-');
        return `${day}-${month}-${year}`;
    }
    throw new Error('Data movimento non valida: usare DD-MM-AAAA');
}


/**
 * ============================================================
 * CARICO
 * ============================================================
 */
async function carico({
    articoloId,
    quantita,
    data = null,
    riferimentoTipo = null,
    riferimentoId = null,
    note = null
}) {

    const qta = Number(quantita);

    if (qta <= 0) {
        throw new Error(
            'Il carico deve avere quantità positiva'
        );
    }

    return createMovimento({
        articoloId,
        tipo: 'CARICO',
        quantita: qta,
        data,
        riferimentoTipo,
        riferimentoId,
        note
    });
}


/**
 * ============================================================
 * SCARICO
 * ============================================================
 */
async function scarico({
    articoloId,
    quantita,
    data = null,
    riferimentoTipo = null,
    riferimentoId = null,
    note = null
}) {

    const qta = Number(quantita);

    if (qta <= 0) {
        throw new Error(
            'Lo scarico deve avere quantità positiva'
        );
    }

    /*
     * Controlliamo la giacenza fisica,
     * NON quella disponibile.
     *
     * Questo è importante perché lo scarico
     * potrebbe essere relativo ad uno stock
     * già impegnato.
     */
    const fisico =
        await getGiacenzaFisica(articoloId);

    if (fisico < qta) {

        throw new Error(
            `Giacenza fisica insufficiente. ` +
            `Disponibile: ${fisico}, ` +
            `richiesto: ${qta}`
        );
    }

    return createMovimento({
        articoloId,
        tipo: 'SCARICO',
        quantita: -qta,
        data,
        riferimentoTipo,
        riferimentoId,
        note
    });
}


/**
 * ============================================================
 * VENDITA
 * ============================================================
 *
 * La vendita è uno scarico di magazzino.
 */
async function vendita({
    articoloId,
    quantita,
    ordineId,
    rigaOrdineId,
    note = null
}) {

    const qta = Number(quantita);

    if (qta <= 0) {
        throw new Error(
            'Quantità vendita non valida'
        );
    }

    return scarico({
        articoloId,
        quantita: qta,
        riferimentoTipo: 'ORDINE',
        riferimentoId: ordineId,
        riferimentoOrdineId: ordineId,
        riferimentoRigaId: rigaOrdineId,
        note: note
    });
}


/**
 * ============================================================
 * RESO CLIENTE
 * ============================================================
 */
async function resoCliente({
    articoloId,
    quantita,
    ordineId,
    note = null
}) {

    const qta = Number(quantita);

    if (qta <= 0) {
        throw new Error(
            'Quantità reso non valida'
        );
    }

    return createMovimento({
        articoloId,
        tipo: 'RESO_CLIENTE',
        quantita: qta,
        riferimentoTipo: 'ORDINE',
        riferimentoId: ordineId,
        note
    });
}


/**
 * ============================================================
 * RETTIFICA
 * ============================================================
 *
 * delta può essere positivo o negativo.
 */
async function rettifica({
    articoloId,
    delta,
    note = null
}) {

    const qta = Number(delta);

    if (!Number.isFinite(qta) || qta === 0) {
        throw new Error(
            'Rettifica non valida'
        );
    }

    return createMovimento({
        articoloId,
        tipo: 'RETTIFICA',
        quantita: qta,
        note
    });
}


/**
 * ============================================================
 * STORICO MOVIMENTI
 * ============================================================
 */
async function getMovimenti(
    articoloId
) {

    return db.prepare(`
        SELECT
            m.*,

            a.codice AS articolo_codice,
            a.descrizione AS articolo_descrizione

        FROM MOVIMENTI m

        INNER JOIN ARTICOLI a
            ON a.id = m.articolo_id

        WHERE m.articolo_id = ?

        ORDER BY
            m.data DESC,
            m.id DESC
    `).all(articoloId);
}


module.exports = {

    getGiacenzaFisica,
    getStockImpegnato,
    getStockDisponibile,

    getStockArticolo,
    getStock,
    getStockMateriali,

    verificaDisponibilita,

    createMovimento,

    carico,
    scarico,
    vendita,
    resoCliente,
    rettifica,

    getMovimenti
};