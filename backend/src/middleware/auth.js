const {
    getUserBySession
} = require('../services/auth');

function getCookie(req, name) {
    const cookies = req.headers.cookie;

    if (!cookies) {
        return null;
    }

    const parts = cookies.split(';');

    for (const part of parts) {
        const [key, ...valueParts] = part.trim().split('=');

        if (key === name) {
            return decodeURIComponent(valueParts.join('='));
        }
    }

    return null;
}

async function requireAuth(req, res, next) {
    try {
        const token = getCookie(
            req,
            'session'
        );

        if (!token) {
            return res.status(401).json({
                error: 'Autenticazione richiesta'
            });
        }

        const user = await getUserBySession(token);

        if (!user) {
            return res.status(401).json({
                error: 'Sessione non valida o scaduta'
            });
        }

        req.user = user;

        next();

    } catch (error) {
        console.error(
            'Errore autenticazione:',
            error
        );

        res.status(500).json({
            error: 'Errore durante l\'autenticazione'
        });
    }
}

module.exports = {
    requireAuth,
    getCookie
};