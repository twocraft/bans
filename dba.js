const mysql = require('mysql2/promise');



const pool = mysql.createPool({
    database: process.env.DATABASE,
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_USER,
    port: process.env.DATABASE_PORT,
    password: process.env.DATABASE_PASSWORD,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function init() {
    const connection = await mysql.createConnection({
        database: process.env.DATABASE,
        host: process.env.DATABASE_HOST,
        user: process.env.DATABASE_USER,
        port: process.env.DATABASE_PORT,
        password: process.env.DATABASE_PASSWORD,
        multipleStatements: true
    });

    const data = (await import('node:fs')).readFileSync('init.sql', 'utf8');
    if (data) {
        await connection.query(data);
    }

    console.log('db initialized!');

    connection.end();
}

async function addReporter(ip, key, name) {
    // language=MySQL
    (await pool.query('INSERT INTO reporter (ip, `key`, name) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)', [ip, key, name]));

    return (await pool.query('SELECT * FROM reporter WHERE `key` = ?', [key]))[0];
}

async function removeReporter(ip, key) {
    return pool.query('DELETE FROM reporter WHERE ip = ? AND `key` = ?', [ip, key]);
}

module.exports = { pool, init, addReporter, removeReporter };