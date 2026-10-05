const express = require('express');
const { pool } = require('../db');

const router = express.Router();

// GET /api/note
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT testo, updated_at FROM note_condivisa WHERE id = 1'
        );
        res.json(result.rows[0] || { testo: '', updated_at: null });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/note
router.put('/', async (req, res) => {
    try {
        if (typeof req.body.testo !== 'string') {
            return res.status(400).json({ error: 'Testo non valido' });
        }
        const result = await pool.query(
            `INSERT INTO note_condivisa (id, testo, updated_at)
             VALUES (1, $1, CURRENT_TIMESTAMP)
             ON CONFLICT (id) DO UPDATE
             SET testo = EXCLUDED.testo, updated_at = CURRENT_TIMESTAMP
             RETURNING testo, updated_at`,
            [req.body.testo]
        );
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
