const express = require('express');
const { pool } = require('../db');

const {
    verifyPassword,
    createSession,
    deleteSession,
    getUserBySession
} = require('../services/auth');
const {
    getCookie
} = require('../middleware/auth');

const router = express.Router();

const COOKIE_MAX_AGE =
    7 * 24 * 60 * 60 * 1000;


// LOGIN
router.post('/login', async (req, res) => {

    console.log('>>> LOGIN ROUTE RAGGIUNTA');

    try {

        const {
            email,
            password
        } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                error: 'Email e password sono obbligatorie'
            });
        }

        const result = await pool.query(
            `
            SELECT
                id,
                email,
                password_hash,
                nome,
                cognome,
                ruolo,
                attivo
            FROM users
            WHERE LOWER(email) = LOWER($1)
            LIMIT 1
            `,
            [email.trim()]
        );

        const user = result.rows[0];

        if (!user || !user.attivo) {
            return res.status(401).json({
                error: 'Credenziali non valide'
            });
        }

        const validPassword =
            await verifyPassword(
                password,
                user.password_hash
            );

        if (!validPassword) {
            return res.status(401).json({
                error: 'Credenziali non valide'
            });
        }

        const session =
            await createSession(user.id);

        const secure =
            process.env.NODE_ENV === 'production';

        res.setHeader(
            'Set-Cookie',
            [
                `session=${encodeURIComponent(session.token)}`,
                'HttpOnly',
                'Path=/',
                'SameSite=Lax',
                `Max-Age=${COOKIE_MAX_AGE / 1000}`,
                secure ? 'Secure' : ''
            ]
                .filter(Boolean)
                .join('; ')
        );

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                nome: user.nome,
                cognome: user.cognome,
                ruolo: user.ruolo
            }
        });

    } catch (error) {

        console.error(
            'Errore login:',
            error
        );

        res.status(500).json({
            error: 'Errore durante il login'
        });
    }
});


// USER CORRENTE
router.get('/me', async (req, res) => {

    try {

        const token = getCookie(
            req,
            'session'
        );

        const user =
            await getUserBySession(token);

        if (!user) {
            return res.status(401).json({
                authenticated: false
            });
        }

        res.json({
            authenticated: true,
            user
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: 'Errore'
        });
    }
});


// LOGOUT
router.post('/logout', async (req, res) => {

    try {

        const token = getCookie(
            req,
            'session'
        );

        await deleteSession(token);

        res.setHeader(
            'Set-Cookie',
            'session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax'
        );

        res.json({
            success: true
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: 'Errore durante il logout'
        });
    }
});


module.exports = router;