const express = require('express');

const magazzino = require('../services/magazzino');

const router = express.Router();


/*
|--------------------------------------------------------------------------
| GET /api/magazzino
|--------------------------------------------------------------------------
| Restituisce tutti gli articoli con:
|
| - giacenza fisica
| - stock impegnato
| - stock disponibile
|
*/
router.get('/', (req, res) => {

    try {

        const stock = magazzino.getStock();

        res.json(stock);

    } catch (error) {

        console.error(
            'Errore GET /api/magazzino:',
            error
        );

        res.status(500).json({
            error: error.message
        });
    }
});

router.get('/materiali', (req, res) => {
    try {
        res.json(magazzino.getStockMateriali());
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


/*
|--------------------------------------------------------------------------
| GET /api/magazzino/articoli/:id
|--------------------------------------------------------------------------
| Situazione completa di un articolo
|
*/
router.get('/articoli/:id', (req, res) => {

    try {

        const articoloId =
            Number(req.params.id);

        if (!Number.isInteger(articoloId)) {

            return res.status(400).json({
                error: 'ID articolo non valido'
            });
        }

        const stock =
            magazzino.getStockArticolo(
                articoloId
            );

        res.json(stock);

    } catch (error) {

        console.error(
            'Errore GET articolo magazzino:',
            error
        );

        res.status(404).json({
            error: error.message
        });
    }
});


/*
|--------------------------------------------------------------------------
| GET /api/magazzino/articoli/:id/giacenza
|--------------------------------------------------------------------------
| Restituisce solamente la giacenza fisica
|
*/
router.get(
    '/articoli/:id/giacenza',
    (req, res) => {

        try {

            const articoloId =
                Number(req.params.id);

            if (!Number.isInteger(articoloId)) {

                return res.status(400).json({
                    error: 'ID articolo non valido'
                });
            }

            const giacenza =
                magazzino.getGiacenzaFisica(
                    articoloId
                );

            res.json({
                articolo_id: articoloId,
                giacenza_fisica: giacenza
            });

        } catch (error) {

            res.status(500).json({
                error: error.message
            });
        }
    }
);


/*
|--------------------------------------------------------------------------
| GET /api/magazzino/articoli/:id/impegnato
|--------------------------------------------------------------------------
| Restituisce lo stock impegnato da ordini cliente
|
*/
router.get(
    '/articoli/:id/impegnato',
    (req, res) => {

        try {

            const articoloId =
                Number(req.params.id);

            if (!Number.isInteger(articoloId)) {

                return res.status(400).json({
                    error: 'ID articolo non valido'
                });
            }

            const impegnato =
                magazzino.getStockImpegnato(
                    articoloId
                );

            res.json({
                articolo_id: articoloId,
                stock_impegnato: impegnato
            });

        } catch (error) {

            res.status(500).json({
                error: error.message
            });
        }
    }
);


/*
|--------------------------------------------------------------------------
| GET /api/magazzino/articoli/:id/disponibile
|--------------------------------------------------------------------------
| Stock realmente disponibile per nuovi ordini
|
| disponibile =
|     fisico - impegnato
|
*/
router.get(
    '/articoli/:id/disponibile',
    (req, res) => {

        try {

            const articoloId =
                Number(req.params.id);

            if (!Number.isInteger(articoloId)) {

                return res.status(400).json({
                    error: 'ID articolo non valido'
                });
            }

            const disponibile =
                magazzino.getStockDisponibile(
                    articoloId
                );

            res.json({
                articolo_id: articoloId,
                stock_disponibile: disponibile
            });

        } catch (error) {

            res.status(500).json({
                error: error.message
            });
        }
    }
);


/*
|--------------------------------------------------------------------------
| GET /api/magazzino/articoli/:id/movimenti
|--------------------------------------------------------------------------
| Storico completo dei movimenti dell'articolo
|
*/
router.get(
    '/articoli/:id/movimenti',
    (req, res) => {

        try {

            const articoloId =
                Number(req.params.id);

            if (!Number.isInteger(articoloId)) {

                return res.status(400).json({
                    error: 'ID articolo non valido'
                });
            }

            const movimenti =
                magazzino.getMovimenti(
                    articoloId
                );

            res.json(movimenti);

        } catch (error) {

            console.error(
                'Errore recupero movimenti:',
                error
            );

            res.status(500).json({
                error: error.message
            });
        }
    }
);


/*
|--------------------------------------------------------------------------
| POST /api/magazzino/carichi
|--------------------------------------------------------------------------
| Inserisce un carico di magazzino
|
| Body:
|
| {
|   "articoloId": 1,
|   "quantita": 100,
|   "note": "Carico fornitore"
| }
|
*/
router.post('/carichi', (req, res) => {

    try {

        const {
            articoloId,
            quantita,
            data,
            riferimentoTipo,
            riferimentoId,
            note
        } = req.body;


        const movimento =
            magazzino.carico({

                articoloId:
                    Number(articoloId),

                quantita:
                    Number(quantita),

                data,

                riferimentoTipo,

                riferimentoId,

                note
            });


        res.status(201).json(
            movimento
        );

    } catch (error) {

        console.error(
            'Errore carico magazzino:',
            error
        );

        res.status(400).json({
            error: error.message
        });
    }
});


/*
|--------------------------------------------------------------------------
| POST /api/magazzino/scarichi
|--------------------------------------------------------------------------
| Scarico manuale di magazzino
|
| Body:
|
| {
|   "articoloId": 1,
|   "quantita": 20,
|   "note": "Materiale danneggiato"
| }
|
*/
router.post('/scarichi', (req, res) => {

    try {

        const {
            articoloId,
            quantita,
            data,
            riferimentoTipo,
            riferimentoId,
            note
        } = req.body;


        const movimento =
            magazzino.scarico({

                articoloId:
                    Number(articoloId),

                quantita:
                    Number(quantita),

                data,

                riferimentoTipo,

                riferimentoId,

                note
            });


        res.status(201).json(
            movimento
        );

    } catch (error) {

        console.error(
            'Errore scarico magazzino:',
            error
        );

        res.status(400).json({
            error: error.message
        });
    }
});


/*
|--------------------------------------------------------------------------
| POST /api/magazzino/rettifiche
|--------------------------------------------------------------------------
| Rettifica inventariale
|
| Positiva:
|
| {
|   "articoloId": 1,
|   "delta": 10
| }
|
| Negativa:
|
| {
|   "articoloId": 1,
|   "delta": -10
| }
|
*/
router.post('/rettifiche', (req, res) => {

    try {

        const {
            articoloId,
            delta,
            note
        } = req.body;


        const movimento =
            magazzino.rettifica({

                articoloId:
                    Number(articoloId),

                delta:
                    Number(delta),

                note
            });


        res.status(201).json(
            movimento
        );

    } catch (error) {

        console.error(
            'Errore rettifica magazzino:',
            error
        );

        res.status(400).json({
            error: error.message
        });
    }
});


/*
|--------------------------------------------------------------------------
| POST /api/magazzino/resi
|--------------------------------------------------------------------------
| Reso da cliente
|
| Il materiale torna fisicamente in magazzino.
|
| Body:
|
| {
|   "articoloId": 1,
|   "quantita": 5,
|   "ordineId": 123,
|   "note": "Reso cliente"
| }
|
*/
router.post('/resi', (req, res) => {

    try {

        const {
            articoloId,
            quantita,
            ordineId,
            note
        } = req.body;


        const movimento =
            magazzino.resoCliente({

                articoloId:
                    Number(articoloId),

                quantita:
                    Number(quantita),

                ordineId:
                    Number(ordineId),

                note
            });


        res.status(201).json(
            movimento
        );

    } catch (error) {

        console.error(
            'Errore reso magazzino:',
            error
        );

        res.status(400).json({
            error: error.message
        });
    }
});


module.exports = router;