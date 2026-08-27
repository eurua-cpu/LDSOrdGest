const express = require('express');
const service = require('../services/clienti');

const router = express.Router();

// GET /api/clienti
router.get('/', (req, res) => {
    try {
        res.json(service.getAll());
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

// GET /api/clienti/:id
router.get('/:id', (req, res) => {
    try {
        const cliente = service.getById(req.params.id);

        if (!cliente) {
            return res.status(404).json({
                error: 'Cliente non trovato'
            });
        }

        res.json(cliente);
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

// POST /api/clienti
router.post('/', (req, res) => {
    try {
        if (!req.body.nome) {
            return res.status(400).json({
                error: 'nome è obbligatorio'
            });
        }

        const cliente = service.create(req.body);

        res.status(201).json(cliente);

    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

// PUT /api/clienti/:id
router.put('/:id', (req, res) => {
    try {
        const cliente = service.update(
            req.params.id,
            req.body
        );

        if (!cliente) {
            return res.status(404).json({
                error: 'Cliente non trovato'
            });
        }

        res.json(cliente);

    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

// DELETE /api/clienti/:id
router.delete('/:id', (req, res) => {
    try {
        const deleted = service.remove(req.params.id);

        if (!deleted) {
            return res.status(404).json({
                error: 'Cliente non trovato'
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