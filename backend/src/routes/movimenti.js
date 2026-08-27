const express = require('express');
const service = require('../services/movimenti');

const router = express.Router();

// Tutti i movimenti
router.get('/', (req, res) => {
    try {
        res.json(service.getAll());
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

// Movimenti di un articolo
router.get('/articolo/:articoloId', (req, res) => {
    try {
        res.json(
            service.getByArticolo(req.params.articoloId)
        );
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

// Giacenza
router.get('/articolo/:articoloId/giacenza', (req, res) => {
    try {
        const giacenza = service.getGiacenza(
            req.params.articoloId
        );

        res.json({
            articolo_id: Number(req.params.articoloId),
            giacenza
        });

    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

// Nuovo movimento
router.post('/', (req, res) => {
    try {

        if (!req.body.articolo_id) {
            return res.status(400).json({
                error: 'articolo_id è obbligatorio'
            });
        }

        if (!req.body.tipo) {
            return res.status(400).json({
                error: 'tipo è obbligatorio'
            });
        }

        if (req.body.quantita === undefined) {
            return res.status(400).json({
                error: 'quantita è obbligatoria'
            });
        }

        const movimento = service.create(req.body);

        res.status(201).json(movimento);

    } catch (error) {
        res.status(400).json({
            error: error.message
        });
    }
});

module.exports = router;