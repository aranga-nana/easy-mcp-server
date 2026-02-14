import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { createHttpLoggerMiddleware, maskHeaders } from '../../src/core/logger.js';

describe('http logger', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('masks sensitive headers (case-insensitive)', () => {
        const masked = maskHeaders({
            Authorization: 'Bearer secret',
            cookie: 'a=b',
            'X-Api-Key': '123',
            'content-type': 'application/json'
        });

        expect(masked.Authorization).toBe('***');
        expect(masked.cookie).toBe('***');
        expect(masked['X-Api-Key']).toBe('***');
        expect(masked['content-type']).toBe('application/json');
    });

    it('masks array and undefined header values', () => {
        const masked = maskHeaders({
            'set-cookie': ['a=b', 'c=d'],
            authorization: undefined,
            host: 'localhost'
        });

        expect(masked['set-cookie']).toEqual(['***', '***']);
        expect(masked.authorization).toBeUndefined();
        expect(masked.host).toBe('localhost');
    });

    it('logs request headers in yellow and request body in green', async () => {
        const app = express();
        app.use(express.json());
        app.use(createHttpLoggerMiddleware({ maxBodyLength: 1000 }));
        app.post('/ok', (req, res) => {
            res.json({ ok: true });
        });

        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

        await request(app)
            .post('/ok')
            .set('Authorization', 'Bearer secret')
            .set('Content-Type', 'application/json')
            .send({ hello: 'world' })
            .expect(200);

        const calls = logSpy.mock.calls;
        expect(calls.length).toBeGreaterThanOrEqual(4);

        const requestHeadersCall = calls.find((c) => String(c[0]).includes('[http] request headers'));
        expect(requestHeadersCall).toBeDefined();
        const headersObj = requestHeadersCall![1] as any;
        expect(headersObj.method).toBe('POST');
        expect(headersObj.path).toBe('/ok');
        expect(headersObj.headers.authorization).toBe('***');

        const requestBodyCall = calls.find((c) => String(c[0]).includes('[http] request body'));
        expect(requestBodyCall).toBeDefined();
        expect(String(requestBodyCall![1])).toContain('hello');
    });

    it('logs success responses in green and error responses in red', async () => {
        const app = express();
        app.use(express.json());
        app.use(createHttpLoggerMiddleware({ maxBodyLength: 1000 }));
        app.get('/ok', (_req, res) => {
            res.setHeader('Set-Cookie', ['a=b', 'c=d']);
            res.status(200).send('ok');
        });
        app.get('/err', (_req, res) => {
            res.setHeader('Set-Cookie', 'secret=1');
            res.status(500).send('boom');
        });

        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

        await request(app).get('/ok').expect(200);
        await request(app).get('/err').expect(500);

        const responseHeaderCalls = logSpy.mock.calls
            .filter((c) => String(c[0]).includes('[http] response headers'))
            .map((c) => ({ label: String(c[0]), payload: c[1] as any }));

        expect(responseHeaderCalls.length).toBeGreaterThanOrEqual(2);
        expect(responseHeaderCalls.some((c) => c.label.includes('\u001b['))).toBe(true);

        const okCall = responseHeaderCalls.find((c) => c.payload?.path === '/ok');
        const errCall = responseHeaderCalls.find((c) => c.payload?.path === '/err');
        expect(okCall).toBeDefined();
        expect(errCall).toBeDefined();

        // Response headers should also be masked.
        expect(okCall!.payload.headers['set-cookie']).toEqual(['***', '***']);
        expect(errCall!.payload.headers['set-cookie']).toBe('***');
    });

    it('handles undefined, text, raw, and unserializable bodies', async () => {
        const app = express();

        // Route with no body (req.body undefined)
        app.use((req, _res, next) => {
            if (req.path === '/nobody') {
                // Ensure req.body remains undefined for this GET.
                (req as any).body = undefined;
            }
            next();
        });

        // Force an unserializable request body for a single route, to cover the logger's safe JSON.stringify fallback.
        app.use((req, _res, next) => {
            if (req.path === '/unserializable') {
                (req as any).body = 1n;
            }
            next();
        });

        // Parse raw and text for subsequent routes.
        app.use(express.raw({ type: 'application/octet-stream' }));
        app.use(express.text({ type: 'text/plain' }));

        // Keep short enough to force truncation, but long enough to preserve key markers like '<Uint8Array'.
        app.use(createHttpLoggerMiddleware({ maxBodyLength: 11 }));

        app.get('/nobody', (_req, res) => res.status(204).send());
        app.post('/text', (req, res) => res.status(200).send(String(req.body)));
        app.post('/raw', (req, res) => res.status(200).send((req.body as Buffer).subarray(0, 1)));
        app.get('/unserializable', (_req, res) => res.status(200).send('ok'));

        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

        await request(app).get('/nobody').expect(204);
        await request(app).post('/text').set('Content-Type', 'text/plain').send('0123456789abcdef').expect(200);
        await request(app).post('/raw').set('Content-Type', 'application/octet-stream').send(Buffer.from([1, 2, 3, 4])).expect(200);
        await request(app).get('/unserializable').expect(200);

        // Ensure we logged at least one truncated line.
        const bodyLogs = logSpy.mock.calls
            .filter((c) => String(c[0]).includes('body'))
            .map((c) => String(c[1]));
        expect(bodyLogs.some((t) => t.includes('<truncated'))).toBe(true);
        expect(bodyLogs.some((t) => t.includes('<Uint8Array'))).toBe(true);
        expect(bodyLogs.some((t) => t.includes('<undefined>'))).toBe(true);
        expect(bodyLogs.some((t) => t.includes('<unserial'))).toBe(true);
    });
});
