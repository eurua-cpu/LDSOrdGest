const express = require('express');
const service = require('../services/materiali');

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        res.json(await service.getAll());
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/', async (req, res) => {
    try {
        if (!req.body.codice || !req.body.um_base) {
            return res.status(400).json({ error: 'codice e um_base sono obbligatori' });
        }
        res.status(201).json(await service.create(req.body));
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
