const express = require('express');
const path = require('path');
const { pool } = require('./db');
const { runSqlMigrations } = require('./migrations/run-sql-migrations');
const { migratePlainPasswords } = require('./migrations/migrate-plain-passwords');

const {
    requireAuth
} = require('./middleware/auth');
const authRoutes = require('./routes/auth');

const clientiRoutes = require('./routes/clienti');
const articoliRoutes = require('./routes/articoli');
const ordiniRoutes = require('./routes/ordini');
const movimentiRoutes = require('./routes/movimenti');
const magazzinoRoutes = require('./routes/magazzino');
const materialiRoutes = require('./routes/materiali');
const noteRoutes = require('./routes/note');


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
app.use('/api/note', noteRoutes);


const PORT = process.env.PORT || 8080;

// Start the server first so it is reachable even if the database is unavailable
app.listen(PORT, () => {
    console.log(`Server avviato su http://localhost:${PORT}`);

    // Run startup migrations in the background; a failure must not crash the server
    (async () => {
        try {
            const result = await runSqlMigrations(pool);
            if (!result.success) {
                console.error('⚠️ SQL migrations did not complete. Server will continue running.');
            }
        } catch (error) {
            console.error('⚠️ SQL migrations failed at startup:', error.message);
            console.error('Server will continue running.');
        }

        try {
            await migratePlainPasswords(pool);
            console.log('✓ Password migration completed at startup');
        } catch (error) {
            console.error('⚠️ Password migration failed at startup:', error.message);
            console.error('Server will continue running. Migration can be retried later.');
        }
    })();
});