const express = require('express');
const service = require('../services/clienti');

const router = express.Router();

// GET /api/clienti
router.get('/', async (req, res) => {
    try {
        res.json(await service.getAll());
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

// GET /api/clienti/:id
router.get('/:id', async (req, res) => {
    try {
        const cliente = await service.getById(req.params.id);

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
router.post('/', async (req, res) => {
    try {
        if (!req.body.nome) {
            return res.status(400).json({
                error: 'nome è obbligatorio'
            });
        }

        const cliente = await service.create(req.body);

        res.status(201).json(cliente);

    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

// PUT /api/clienti/:id
router.put('/:id', async (req, res) => {
    try {
        const cliente = await service.update(
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
router.delete('/:id', async (req, res) => {
    try {
        const deleted = await service.remove(req.params.id);

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