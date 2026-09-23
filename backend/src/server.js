const express = require('express');
const path = require('path');
const { pool } = require('./db');
const { migratePlainPasswords } = require('./migrations/migrate-plain-passwords');

const {
    requireAuth
} = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const { hashPassword } = require('./services/auth');

const clientiRoutes = require('./routes/clienti');
const articoliRoutes = require('./routes/articoli');
const ordiniRoutes = require('./routes/ordini');
const movimentiRoutes = require('./routes/movimenti');
const magazzinoRoutes = require('./routes/magazzino');
const materialiRoutes = require('./routes/materiali');


const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '../../frontend')));

console.log('>>> REGISTRO AUTH ROUTES');



// ==============================
// AUTH
// ==============================

app.use(
    '/api/auth',
    authRoutes
);
console.log('>>> AUTH ROUTES REGISTRATE');
// ==============================
// PUBLIC API
// ==============================

app.get('/api/health', (req, res) => {

    res.json({
        status: 'OK'
    });

});

// TEMP DEBUG: Create admin user
app.post('/api/debug/create-admin', async (req, res) => {
    try {
        const { email, password, nome, cognome } = req.body;
        if (!email || !password || !nome || !cognome) {
            return res.status(400).json({ error: 'email, password, nome, cognome required' });
        }
        const passwordHash = await hashPassword(password);
        const normalizedEmail = email.trim().toLowerCase();
        const existing = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [normalizedEmail]);
        let result;
        if (existing.rows.length > 0) {
            result = await pool.query(
                'UPDATE users SET password_hash = $1, nome = $2, cognome = $3, ruolo = $4, attivo = TRUE WHERE id = $5 RETURNING id, email, nome, cognome, ruolo',
                [passwordHash, nome.trim(), cognome.trim(), 'ADMIN', existing.rows[0].id]
            );
        } else {
            result = await pool.query(
                'INSERT INTO users (email, password_hash, nome, cognome, ruolo, attivo) VALUES ($1, $2, $3, $4, $5, TRUE) RETURNING id, email, nome, cognome, ruolo',
                [normalizedEmail, passwordHash, nome.trim(), cognome.trim(), 'ADMIN']
            );
        }
        res.json({ success: true, user: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==============================
// PROTECTED API
// ==============================

app.use(requireAuth);

app.get('/api/um', async (req, res) => {
    const result = await pool.query('SELECT id, codice, descrizione FROM UM ORDER BY codice');
    res.json(result.rows);
});

// Routes
app.use('/api/clienti', clientiRoutes);
app.use('/api/articoli', articoliRoutes);
app.use('/api/ordini', ordiniRoutes);
app.use('/api/movimenti', movimentiRoutes);
app.use('/api/magazzino', magazzinoRoutes);
app.use('/api/materiali', materialiRoutes);


const PORT = process.env.PORT || 8080;

(async () => {
    try {
        await migratePlainPasswords(pool);
    } catch (error) {
        console.error('Migration failed:', error);
    }

    app.listen(PORT, () => {
        console.log(`Server avviato su http://localhost:${PORT}`);
    });
})();