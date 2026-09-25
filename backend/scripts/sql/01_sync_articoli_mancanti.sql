-- Sincronizza in locale i MATERIALI e ARTICOLI (id 19-25 / 30-36) che esistono già
-- su Railway ma non nel SQLite locale (aggiunti direttamente sull'app in produzione).
-- Valori copiati 1:1 da Railway tramite /api/debug/counts.

INSERT INTO MATERIALI (id, codice, descrizione, um_base, categoria) VALUES
(19, 'MASTER - ROS - B', 'MASTER ROSSO - abete rosso - bancale (70 sacchi)', 1, 'PELLET'),
(20, 'MASTER-ROS-S', 'MASTER - ROS - sacco singolo', 2, 'PELLET'),
(21, 'POWER-B', 'POWER - abete bianco/rosso - bancale (70 sacchi)', 1, 'PELLET'),
(22, 'POWER-S', 'POWER - abete bianco/rosso - sacco', 2, 'PELLET'),
(23, 'SPAGNA-B', 'SPAGNOLO - abete rosso - bancale (70 sacchi)', 1, 'PELLET'),
(24, 'SPAGNA-S', 'SPAGNA - abete rosso - sacco singolo', 2, 'PELLET'),
(25, 'CARPINO-33', 'CARPINO 33 cm - bancale', 1, NULL);

INSERT INTO ARTICOLI (id, codice, descrizione, materiale, um_vendita, um_base_x_um, prezzo_acquisto, prezzo_vendita) VALUES
(30, 'MASTER-ROS-B', 'MASTER ROSSO - abete rosso - bancale (70 sacchi)', 19, 1, 1, 406, 476),
(31, 'MASTER-ROS-S', 'MASTER ROSSO - abete rosso - sacco singolo', 20, 2, 1, 5.8, 6.8),
(32, 'POWER-B', 'POWER - abete bianco/rosso - bancale (70 sacchi)', 21, 1, 1, 406, 476),
(33, 'POWER-S', 'POWER - abete bianco/rosso - sacco singolo', 22, 2, 1, 5.8, 6.8),
(34, 'SPAGNA-B', 'SPAGNA - abete rosso - bancale (70 sacchi)', 23, 1, 1, 385, 455),
(35, 'SPAGNA-S', 'SPAGNA - abete rosso - sacco singolo', 24, 2, 1, 5.5, 6.5),
(36, 'CARPINO-33', 'CARPINO 33 cm - bancale', 25, 1, 1, 190, 220);
