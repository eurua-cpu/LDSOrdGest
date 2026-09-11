const express = require('express');
const service = require('../services/articoli');

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        res.json(await service.getAll());
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const articolo = await service.getById(req.params.id);

        if (!articolo) {
            return res.status(404).json({
                error: 'Articolo non trovato'
            });
        }

        res.json(articolo);
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

router.get('/:id/giacenza', async (req, res) => {
    try {
        const articolo = await service.getById(req.params.id);

        if (!articolo) {
            return res.status(404).json({
                error: 'Articolo non trovato'
            });
        }

        res.json({
            articolo_id: Number(req.params.id),
            giacenza: await service.getGiacenza(req.params.id)
        });

    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

router.post('/', async (req, res) => {
    try {
        if (!req.body.codice) {
            return res.status(400).json({
                error: 'codice è obbligatorio'
            });
        }

        const articolo = await service.create(req.body);

        res.status(201).json(articolo);

    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const articolo = await service.update(
            req.params.id,
            req.body
        );

        if (!articolo) {
            return res.status(404).json({
                error: 'Articolo non trovato'
            });
        }

        res.json(articolo);

    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const deleted = await service.remove(req.params.id);

        if (!deleted) {
            return res.status(404).json({
                error: 'Articolo non trovato'
            });
        }

        res.status(204).send();

    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

module.exports = router;