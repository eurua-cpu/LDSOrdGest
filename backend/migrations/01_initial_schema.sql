PRAGMA foreign_keys = ON;

-- ==========================================
-- CLIENTI
-- ==========================================

CREATE TABLE IF NOT EXISTS CLIENTI (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    indirizzo TEXT,
    localita TEXT,
    telefono TEXT,
    zona TEXT,
    note TEXT
);


-- ==========================================
-- ARTICOLI
-- ==========================================

CREATE TABLE IF NOT EXISTS ARTICOLI (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codice TEXT NOT NULL UNIQUE,
    descrizione TEXT,
    materiale INTEGER NOT NULL,
    um_vendita INTEGER NOT NULL,
    um_base_x_um INTEGER,
    prezzo_acquisto NUMERIC NOT NULL DEFAULT 0,
    prezzo_vendita NUMERIC NOT NULL DEFAULT 0,
    
    FOREIGN KEY (materiale)
        REFERENCES MATERIALI(id),

    FOREIGN KEY (um_vendita)
        REFERENCES UM(id)

);

-- ==========================================
-- MATERIALI
-- ==========================================

CREATE TABLE IF NOT EXISTS MATERIALI (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codice TEXT NOT NULL UNIQUE,
    descrizione TEXT,
    um_base INTEGER NOT NULL,
    categoria TEXT,

    FOREIGN KEY (um_base)
        REFERENCES UM(id)
);


-- ==========================================
-- ORDINI
-- ==========================================

CREATE TABLE IF NOT EXISTS ORDINI (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cliente_id INTEGER NOT NULL,
    stato INTEGER NOT NULL,
    pagato INTEGER NOT NULL,
    note_ordine TEXT,

    FOREIGN KEY (cliente_id)
        REFERENCES CLIENTI(id),

    FOREIGN KEY (stato)
        REFERENCES STATUS_ORDINE(id),
    
    FOREIGN KEY (pagato)
        REFERENCES STATUS_PAGAMENTO(id)
);


-- ==========================================
-- RIGHE ORDINE
-- ==========================================

CREATE TABLE IF NOT EXISTS RIGHE_ORDINE (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ordine_id INTEGER NOT NULL,
    riga_ordine INTEGER NOT NULL DEFAULT 10,
    articolo_id INTEGER NOT NULL,
    quantita NUMERIC NOT NULL,
    prezzo_applicato NUMERIC NOT NULL,
    stato_riga INTEGER NOT NULL,
    data_consegna TEXT,
    note_riga_ordine TEXT,

    FOREIGN KEY (ordine_id)
        REFERENCES ORDINI(id)
        ON DELETE CASCADE,

    FOREIGN KEY (articolo_id)
        REFERENCES ARTICOLI(id),

    FOREIGN KEY (stato_riga)
        REFERENCES STATUS_RIGA_ORDINE(id)
);


-- ==========================================
-- CARICHI
-- ==========================================

CREATE TABLE IF NOT EXISTS CARICHI (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    articolo_id INTEGER NOT NULL,
    quantita NUMERIC NOT NULL,
    data TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (articolo_id)
        REFERENCES ARTICOLI(id)
);


-- ==========================================
-- MOVIMENTI DI MAGAZZINO
-- ==========================================

CREATE TABLE IF NOT EXISTS MOVIMENTI (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    articolo_id INTEGER NOT NULL,
    tipo TEXT NOT NULL,
    quantita NUMERIC NOT NULL,
    data TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (articolo_id)
        REFERENCES ARTICOLI(id)
);

-- ==========================================
-- VALORI STATO ORDINE
-- ==========================================
CREATE TABLE IF NOT EXISTS STATUS_ORDINE (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stato TEXT,
    ordinamento_stato INTEGER NOT NULL DEFAULT 0
);

-- ==========================================
-- VALORI STATO RIGA ORDINE
-- ==========================================
CREATE TABLE IF NOT EXISTS STATUS_RIGA_ORDINE (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stato TEXT,
    ordinamento_stato INTEGER NOT NULL DEFAULT 0
);

-- ==========================================
-- VALORI STATO PAGAMENTI
-- ==========================================
CREATE TABLE IF NOT EXISTS STATUS_PAGAMENTO (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stato TEXT,
    ordinamento_stato INTEGER NOT NULL DEFAULT 0
);

-- ==========================================
-- UM
-- ==========================================
CREATE TABLE IF NOT EXISTS UM (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codice TEXT NOT NULL UNIQUE,
    descrizione TEXT
);


-- ==========================================
-- INDICI
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_ordini_cliente
    ON ORDINI(cliente_id);

CREATE INDEX IF NOT EXISTS idx_righe_ordine
    ON RIGHE_ORDINE(ordine_id);

CREATE INDEX IF NOT EXISTS idx_righe_articolo
    ON RIGHE_ORDINE(articolo_id);

CREATE INDEX IF NOT EXISTS idx_carichi_articolo
    ON CARICHI(articolo_id);

CREATE INDEX IF NOT EXISTS idx_movimenti_articolo
    ON MOVIMENTI(articolo_id);