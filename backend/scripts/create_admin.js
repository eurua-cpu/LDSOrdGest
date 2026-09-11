const readline = require('readline');
const { pool } = require('../src/db');

const {
    hashPassword
} = require('../src/services/auth');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(text) {
    return new Promise(resolve => {
        rl.question(text, resolve);
    });
}

async function main() {

    try {

        const email =
            (await question('Email admin: '))
                .trim()
                .toLowerCase();

        const password =
            await question('Password: ');

        const nome =
            (await question('Nome: '))
                .trim();

        const cognome =
            (await question('Cognome: '))
                .trim();

        if (!email || !password) {
            throw new Error(
                'Email e password sono obbligatorie'
            );
        }

        const passwordHash =
            await hashPassword(password);

        const result =
            await pool.query(
                `
                INSERT INTO users (
                    email,
                    password_hash,
                    nome,
                    cognome,
                    ruolo,
                    attivo
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    'ADMIN',
                    TRUE
                )
                RETURNING
                    id,
                    email,
                    nome,
                    cognome,
                    ruolo
                `,
                [
                    email,
                    passwordHash,
                    nome,
                    cognome
                ]
            );

        console.log('');
        console.log(
            '✅ Utente amministratore creato'
        );
        console.log(
            result.rows[0]
        );

    } catch (error) {

        console.error(
            '❌ Errore:',
            error.message
        );

    } finally {

        rl.close();
        await pool.end();

    }
}

main();