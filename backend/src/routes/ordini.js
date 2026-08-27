const express = require('express');
const service = require('../services/ordini');

const router = express.Router();

// GET tutti gli ordini
router.get('/', (req, res) => {
    try {
        res.json(service.getAll());
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

// GET ordine completo con righe
router.get('/:id', (req, res) => {
    try {
        const ordine = service.getById(req.params.id);

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
router.post('/', (req, res) => {
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

        const ordine = service.create(req.body);

        res.status(201).json(ordine);

    } catch (error) {
        res.status(400).json({
            error: error.message
        });
    }
});

// PUT ordine
router.put('/:id', (req, res) => {
    try {
        const ordine = service.update(
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
router.delete('/:id', (req, res) => {
    try {
        const deleted = service.remove(req.params.id);

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