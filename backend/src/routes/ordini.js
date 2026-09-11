const express = require('express');
const service = require('../services/ordini');

const router = express.Router();

router.post('/righe/:id/consegna', async (req, res) => {
    try {
        res.json(await service.consegnaRiga({
            rigaOrdineId: Number(req.params.id),
            quantita: Number(req.body.quantita)
        }));
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.post('/:id/consegna', async (req, res) => {
    try {
        res.json(await service.consegnaOrdine(Number(req.params.id)));
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.post('/righe/:id/annulla', async (req, res) => {
    try {
        res.json(await service.annullaRiga(Number(req.params.id)));
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// GET tutti gli ordini
router.get('/', async (req, res) => {
    try {
        res.json(await service.getAll());
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

// GET ordine completo con righe
router.get('/:id', async (req, res) => {
    try {
        const ordine = await service.getById(req.params.id);

        if (!ordine) {
            return res.status(404).json({
                error: 'Ordine non trovato'
            });
        }

        res.json(ordine);

    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

// POST ordine + righe
router.post('/', async (req, res) => {
    try {

        if (!req.body.cliente_id) {
            return res.status(400).json({
                error: 'cliente_id è obbligatorio'
            });
        }

        if (!Array.isArray(req.body.righe)) {
            return res.status(400).json({
                error: 'righe deve essere un array'
            });
        }

        const ordine = await service.create(req.body);

        res.status(201).json(ordine);

    } catch (error) {
        res.status(400).json({
            error: error.message
        });
    }
});

// PUT ordine
router.put('/:id', async (req, res) => {
    try {
        const ordine = await service.update(
            req.params.id,
            req.body
        );

        if (!ordine) {
            return res.status(404).json({
                error: 'Ordine non trovato'
            });
        }

        res.json(ordine);

    } catch (error) {
        res.status(400).json({
            error: error.message
        });
    }
});

// DELETE ordine
router.delete('/:id', async (req, res) => {
    try {
        const deleted = await service.remove(req.params.id);

        if (!deleted) {
            return res.status(404).json({
                error: 'Ordine non trovato'
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