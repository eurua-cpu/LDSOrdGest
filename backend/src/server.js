const express = require('express');
const path = require('path');
const fs = require('fs');
const { pool } = require('./db');
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

// TEMP DEBUG: check current row counts before a migration
app.get('/api/debug/counts', async (req, res) => {
    try {
        const tables = ['ORDINI', 'RIGHE_ORDINE', 'ARTICOLI', 'CLIENTI'];
        const out = {};
        for (const table of tables) {
            const result = await pool.query(`SELECT COUNT(*) c, MAX(id) m FROM ${table}`);
            out[table] = { count: Number(result.rows[0].c), maxId: result.rows[0].m };
        }
        const recentOrders = await pool.query('SELECT id, data, cliente_id, note_ordine FROM ORDINI ORDER BY id DESC LIMIT 5');
        out.recentOrders = recentOrders.rows;
        const articoliHigh = await pool.query('SELECT * FROM ARTICOLI WHERE id > 29 ORDER BY id');
        out.articoliHigh = articoliHigh.rows;
        const materialiIds = [...new Set(articoliHigh.rows.map(r => r.materiale))];
        const materialiHigh = await pool.query('SELECT * FROM MATERIALI WHERE id = ANY($1) ORDER BY id', [materialiIds]);
        out.materialiHigh = materialiHigh.rows;
        const allClienti = await pool.query('SELECT id, nome, localita FROM CLIENTI ORDER BY id');
        out.clienti = allClienti.rows;
        res.json(out);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// TEMP DEBUG: run the ordini/righe_ordine SQL import files against this database
app.post('/api/debug/run-ordini-import', async (req, res) => {
    const client = await pool.connect();
    try {
        const sqlDir = path.join(__dirname, '..', 'scripts', 'sql');
        const ordiniSql = fs.readFileSync(path.join(sqlDir, '02_ordini_pg.sql'), 'utf8');
        const righeSql = fs.readFileSync(path.join(sqlDir, '03_righe_ordine_pg.sql'), 'utf8');

        await client.query('BEGIN');
        await client.query(ordiniSql);
        await client.query(righeSql);
        await client.query('COMMIT');

        const ordiniCount = await client.query('SELECT COUNT(*) c FROM ordini');
        const righeCount = await client.query('SELECT COUNT(*) c FROM righe_ordine');
        res.json({
            success: true,
            ordini: Number(ordiniCount.rows[0].c),
            righeOrdine: Number(righeCount.rows[0].c)
        });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
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