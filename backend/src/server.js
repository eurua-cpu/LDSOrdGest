const express = require('express');
const path = require('path');
const { db } = require('./db');

const clientiRoutes = require('./routes/clienti');
const articoliRoutes = require('./routes/articoli');
const ordiniRoutes = require('./routes/ordini');
const movimentiRoutes = require('./routes/movimenti');
const magazzinoRoutes = require('./routes/magazzino');
const materialiRoutes = require('./routes/materiali');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '../../frontend')));

app.get('/api/um', (req, res) => {
    res.json(db.prepare('SELECT id, codice, descrizione FROM UM ORDER BY codice').all());
});

// Routes
app.use('/api/clienti', clientiRoutes);
app.use('/api/articoli', articoliRoutes);
app.use('/api/ordini', ordiniRoutes);
app.use('/api/movimenti', movimentiRoutes);
app.use('/api/magazzino', magazzinoRoutes);
app.use('/api/materiali', materialiRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK'
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server avviato su http://localhost:${PORT}`);
});