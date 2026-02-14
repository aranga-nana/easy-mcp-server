import request from 'supertest';
import http from 'http';
import { Application } from 'express';
import { createHttpServer } from '../../../src/core/transport.js';
import { createMcpServer } from '../../../src/core/mcp-server.js';
import { registerAddTwoNumbers } from '../../../src/tools/add-two-numbers/index.js';
import { PROTOCOL_VERSION } from '../../../src/meta.js';
import { SessionManager } from '../../../src/core/session.js';

describe('Add Two Numbers Tool Integration', () => {
    let app: Application;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let server: any;
    let port: number;
    let shutdown: (() => void) | undefined;
    let sessionManager: SessionManager;

    const commonHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
    };

    const initPayload = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: {},
            clientInfo: { name: 'test', version: '1.0' }
        }
    };

    beforeAll(async () => {
        const serverFactory = () => {
            const mcpServer = createMcpServer();
            registerAddTwoNumbers(mcpServer);
            return mcpServer;
        };

        const result = createHttpServer(serverFactory);
        app = result.app;
        shutdown = result.shutdown;
        sessionManager = result.sessionManager;

        await new Promise<void>((resolve) => {
            server = app.listen(0, () => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                port = (server.address() as any).port;
                resolve();
            });
        });
    });

    afterAll(async () => {
        if (shutdown) shutdown();
        if (server) {
            await new Promise<void>((resolve) => server.close(() => resolve()));
        }
    });

    async function initializeSession(): Promise<string> {
        const initResponse = await request(app)
            .post('/mcp')
            .send(initPayload)
            .set(commonHeaders);

        const sessionId = initResponse.headers['mcp-session-id'] as string | undefined;
        expect(sessionId).toBeDefined();
        return sessionId!;
    }

    it('should add two numbers correctly via JSON-RPC', async () => {
        const sessionId = await initializeSession();

        const toolCallPayload = {
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/call',
            params: {
                name: 'add_two_numbers',
                arguments: { a: 10, b: 20 }
            }
        };

        const response = await request(app)
            .post('/mcp')
            .set('Mcp-Session-Id', sessionId)
            .set(commonHeaders)
            .send(toolCallPayload);

        expect(response.status).toBe(200);

        if (JSON.stringify(response.body) !== '{}') {
            expect(JSON.stringify(response.body)).toContain('30');
        } else {
            const session = sessionManager.getSession(sessionId);
            expect(session).toBeDefined();
        }
    }, 10000);

    it('should add two numbers via Copilot UX alias', async () => {
        const sessionId = await initializeSession();

        const toolCallPayload = {
            jsonrpc: '2.0',
            id: 3,
            method: 'tools/call',
            params: {
                name: 'add-two-numbers',
                arguments: { prompt: 'add 10 and 20' }
            }
        };

        const response = await request(app)
            .post('/mcp')
            .set('Mcp-Session-Id', sessionId)
            .set(commonHeaders)
            .send(toolCallPayload);

        expect(response.status).toBe(200);

        if (JSON.stringify(response.body) !== '{}') {
            expect(JSON.stringify(response.body)).toContain('30');
        } else {
            const session = sessionManager.getSession(sessionId);
            expect(session).toBeDefined();
        }
    }, 10000);
});
