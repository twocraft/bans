const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger-output.json');


function createApp(pool) {
    const app = express();

    app.use(express.json());

    app.use(async (req, res, next) => {
        try {
            if (req.originalUrl.startsWith('/api/') && req.originalUrl !== '/api/health') {
                let ip = req.headers['x-forwarded-for'] || req.ip;

                if (ip === '::1')
                    ip = '127.0.0.1';

                if (ip.startsWith('::ffff:'))
                    ip = ip.substring('::ffff:'.length);

                const auth = req.headers['authorization'] || '';
                if (!ip || !auth)
                    return res.status(401).json({ error: 'Not authorized' });

                const result = await pool.query('SELECT id, ip, `key`, name FROM reporter WHERE ip = ? AND `key` = ?', [ip, auth]);
                const found = result[0]?.[0];
                if (!found) {
                    return res.status(403).json({ error: 'Forbidden' });
                }

                req.ip = ip;
                req.apiKey = auth;
                req.reporterName = found.name;
                req.reporterId = found.id;
            }
            next();
        } catch (e) {
            res.status(500).end();
        }
    });

    app.post('/api/ban', async (req, res) => {
        // #swagger.tags = ['Bans']
        // #swagger.security = [{bearerAuth: []}]
        // #swagger.description = 'Бан'
        // #swagger.parameters['user'] = { in: 'query', description: 'Ник / ip', example: 'kek' }
        // #swagger.parameters['reason'] = { in: 'query', description: 'Причина бана' }
        // #swagger.parameters['type'] = { in: 'query', description: 'Тип. soft / hard', type: 'enum', }
        /* #swagger.responses[200] = { description: 'Бан', schema: { id: 1, user: 'bad-man' } } */

        const user = (req.body.user || '').trim().toLowerCase();
        const reason = (req.body.reason || '').trim();
        const type = (req.body.type || 'soft').trim();

        if (!user) {
            res.status(400).json({
                error: 'Invalid "user", use string nick, ip or ip range'
            });
            return;
        }
        if (!reason) {
            res.status(400).json({
                error: 'Invalid "reason", describe ban reason, use 1...255 utf-8 characters'
            });
            return;
        }

        if (!['soft', 'hard'].includes(type)) {
            res.status(400).json({
                error: 'Invalid "type", use "soft" (show ban message) or "hard" (drop connect)'
            });
            return;
        }

        // language=MySQL
        await pool.query(
            `INSERT INTO ban (user)
             VALUES (?)
             ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`, [user]);

        const id = +(await pool.query('SELECT id FROM ban WHERE user = ?', [user]))[0]?.[0]?.id || 0;

        // language=MySQL
        await pool.query(
            `INSERT IGNORE INTO ban_reason (ban_id, reporter_id, reason)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE reason = VALUES(reason)`,
            [id, req.reporterId, reason]);

        res.status(200).json({
            id,
            user
        });
    });

    app.post('/api/pardon', async (req, res) => {
        // #swagger.tags = ['Bans']
        // #swagger.security = [{bearerAuth: []}]
        // #swagger.description = 'Разбан'
        // #swagger.parameters['user'] = { in: 'query', description: 'Ник / ip' }
        // #swagger.parameters['banId'] = { in: 'query', description: 'id бана', type: 'number' }
        /* #swagger.responses[200] = { description: 'Разбан', schema: { id: 1, user: 'bad-man' } } */

        const user = (req.body.user || '').trim();
        const banId = +req.body.banId || 0;

        if (!user && !banId || user && banId) {
            res.status(400).json({
                error: 'Use "user" or "banId"'
            });
            return;
        }

        const banResult = await pool.query('SELECT id, user FROM ban WHERE user = ? OR id = ?', [user, banId]);

        const id = banResult[0]?.[0]?.id;
        if (!id) {
            res.status(400).json({ error: 'User not found' });
            return;
        }

        await pool.query('DELETE FROM ban_reason WHERE ban_id = ? AND reporter_id = ?', [id, req.reporterId]);

        res.status(200).json({
            id,
            user: banResult?.[0]?.user
        });
    });

    app.get('/api/ban', async (req, res) => {
        // #swagger.tags = ['Bans']
        // #swagger.security = [{bearerAuth: []}]
        // #swagger.description = 'Получение списка банов'
        // #swagger.parameters['user'] = { in: 'query', description: 'Поиск по нику / ip' }
        // #swagger.parameters['strict'] = { in: 'query', description: 'Поиск по точному совпадению ника / ip', type: 'boolean' }
        // #swagger.parameters['banId'] = { in: 'query', description: 'Поиск по id бана', type: 'number' }
        // #swagger.parameters['since'] = { in: 'query', description: 'Фильтр всех обновлённых записей с даты. ISO' }
        // #swagger.parameters['offset'] = { in: 'query', description: 'Смещение от начала', type: 'number' }
        // #swagger.parameters['limit'] = { in: 'query', description: 'Лимит записей, от 1 до 1000', type: 'number' }
        /* #swagger.responses[200] = {
           description: 'Список банов',
           schema: {
               limit: 100,
               offset: 0,
               totalCount: 1,
               bans: [{
                    id: 1,
                    user: 'bad-man',
                    updatedAt: '2025-07-15T10:15:00.000Z',
                    commonMessage: 'Общая заметка про игрока',
                    reports: [{
                        reporter: 'Server',
                        reason: 'Грифер',
                        type: 'hard'
                    }]
               }]
           }
       } */

        const query = req.query;
        const user = query.user?.trim()?.toLowerCase() || '';
        const strict = query.strict === 'true' || query.strict === '1';
        const banId = +query.banId?.trim() || 0;
        const since = +query.since?.trim() || '';
        const offset = Math.max(0, +query.offset || 0);
        const limit = Math.max(1, Math.min(1000, +query.limit || 100));

        let sql = `
            SELECT ban.id,
                   ban.user,
                   ban.updated_at     AS updatedAt,
                   ban.common_message AS commonMessage,
                   JSON_ARRAYAGG(
                           JSON_OBJECT(
                                   'reporter', reporter.name,
                                   'reason', ban_reason.reason,
                                   'type', ban_reason.type
                           )
                   )                  AS reports
            FROM ban
                     INNER JOIN ban_reason ON ban.id = ban_reason.ban_id
                     INNER JOIN reporter ON reporter.id = ban_reason.reporter_id`;

        const whereClauses = [];
        const queryParams = [];

        if (user) {
            whereClauses.push('ban.user LIKE ?');
            queryParams.push(strict ? user : `%${user}%`);
        }

        if (banId) {
            whereClauses.push('ban.id = ?');
            queryParams.push(banId);
        }

        if (since) {
            whereClauses.push('ban.updated_at >= ?');
            queryParams.push(since);
        }

        if (whereClauses.length > 0)
            sql += ' WHERE ' + whereClauses.join(' AND ');

        sql += `
        GROUP BY ban.id, ban.user, ban.updated_at
        ORDER BY updatedAt DESC
        LIMIT ? OFFSET ?`;
        queryParams.push(limit, offset);

        let countSql = `SELECT COUNT(*) AS total
                        FROM ban`;
        const countWhereClauses = [];
        const countQueryParams = [];

        if (user) {
            countWhereClauses.push('ban.user LIKE ?');
            countQueryParams.push(`%${user}%`);
        }

        if (banId) {
            countWhereClauses.push('ban.id = ?');
            countQueryParams.push(banId);
        }

        if (countWhereClauses.length > 0) {
            countSql += ' WHERE ' + countWhereClauses.join(' AND ');
        }

        const bans = await pool.query(sql, queryParams);
        const totalAmount = (await pool.query(countSql, countQueryParams))[0][0].total;

        res.json({
            limit,
            offset,
            bans: bans[0],
            totalAmount
        });
    });

    app.get('/api/health', (req, res) => {
        // #swagger.tags = ['Common']
        // #swagger.security = [{bearerAuth: []}]
        // #swagger.description = 'Проверка что сервис работает'

        return res.status(200).json({ health: 'ok' });
    });

    app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

    app.use((err, req, res) => {
        console.error(err.stack)
        res.status(500).send('Something broke!')
    })

    return app;
}

module.exports = { createApp };