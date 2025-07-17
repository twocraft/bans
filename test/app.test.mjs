import { expect } from 'chai';
import supertest from 'supertest';
import { createApp } from '../app.js';

import { config } from 'dotenv';


describe('All tests', () => {
    let app;
    let firstBannedId = 0;
    let db;

    before(async () => {
        config({ override: true, quiet: true });
        db = await import('../dba.js')
        await db.init();
        app = createApp(db.pool);

        db.addReporter('127.0.0.1', 'basic-key', 'tester')
        db.addReporter('127.0.0.2', 'second-key', 'other')
    });

    after(async () => {
        db.pool.end();
    });


    it('health check', async () => {
        const res = await supertest(app).get('/api/health');
        expect(res.status).to.eq(200)
    });


    it('bad auth - undefined ip', async () => {
        await supertest(app).post('/api/ban')
            .set({
                'x-forwarded-for': '127.0.0.100',
                'authorization': 'basic-key'
            })
            .send({ user: 'banme', reason: 'HAMMER' })
            .expect(403);
    });

    it('bad auth - wrong key', async () => {
        await supertest(app).post('/api/ban')
            .set({
                'x-forwarded-for': '127.0.0.1',
                'authorization': 'second-key'
            })
            .send({ user: 'banme', reason: 'HAMMER' })
            .expect(403);
    });

    it('bad auth - no auth', async () => {
        await supertest(app).post('/api/ban')
            .set({})
            .send({ user: 'banme', reason: 'HAMMER' })
            .expect(401);
    });


    it('ban user', async () => {
        const res = await supertest(app).post('/api/ban')
            .set({
                'x-forwarded-for': '127.0.0.1',
                'authorization': 'basic-key'
            })
            .send({ user: 'banme', reason: 'HAMMER' })
            .expect(200);

        expect(res.body.id || null).to.not.be.null;
        firstBannedId = res.body.id;
        expect(res.body.user).to.eq('banme');
    });

    it('ban same user again', async () => {
        const res = await supertest(app).post('/api/ban')
            .set({
                'x-forwarded-for': '127.0.0.1',
                'authorization': 'basic-key'
            })
            .send({ user: 'banme', reason: 'HAMMER' })
            .expect(200);

        expect(res.body.id).to.eq(firstBannedId);
        expect(res.body.user).to.eq('banme');
    });

    it('ban same user by other', async () => {
        const res = await supertest(app).post('/api/ban')
            .set({
                'x-forwarded-for': '127.0.0.2',
                'authorization': 'second-key'
            })
            .send({ user: 'banme', reason: 'HAMMER' })
            .expect(200);

        expect(res.body.id).to.eq(firstBannedId);
        expect(res.body.user).to.eq('banme');
    });


    it('search all bans', async () => {
        const res = await supertest(app).get('/api/ban')
            .set({
                'x-forwarded-for': '127.0.0.1',
                'authorization': 'basic-key'
            })
            .expect(200);

        expect(res.body.totalAmount).to.eq(1);
        const arr = res.body.bans;
        expect(arr?.length).to.eq(1);
        const first = arr[0];
        expect(first.id).to.eq(firstBannedId);
        expect(first.user).to.eq('banme');
        expect(first.reports?.length).to.eq(2);
    });
});
