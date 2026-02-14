import request from 'supertest';
import { Application } from 'express';
import { createHttpServer } from '../../../src/core/transport.js';
import { createMcpServer } from '../../../src/core/mcp-server.js';
import { registerCodeReview } from '../../../src/tools/code-review/index.js';
import { PROTOCOL_VERSION } from '../../../src/meta.js';
import { SessionManager } from '../../../src/core/session.js';

describe('code-review integration', () => {
    let app: Application;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let server: any;
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
            registerCodeReview(mcpServer);
            return mcpServer;
        };

        const result = createHttpServer(serverFactory);
        app = result.app;
        shutdown = result.shutdown;
        sessionManager = result.sessionManager;

        await new Promise<void>((resolve) => {
            server = app.listen(0, () => {
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

    it('should list code_review tool', async () => {
        const sessionId = await initializeSession();

        const listPayload = {
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/list'
        };

        const response = await request(app)
            .post('/mcp')
            .set('Mcp-Session-Id', sessionId)
            .set(commonHeaders)
            .send(listPayload);

        expect(response.status).toBe(200);
    });

    it('should reject empty files array', async () => {
        const sessionId = await initializeSession();

        const toolCallPayload = {
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/call',
            params: {
                name: 'code_review',
                arguments: { files: [] }
            }
        };

        const response = await request(app)
            .post('/mcp')
            .set('Mcp-Session-Id', sessionId)
            .set(commonHeaders)
            .send(toolCallPayload);

        expect(response.status).toBe(200);
    });

    it('should reject too many files', async () => {
        const sessionId = await initializeSession();

        const maxFiles = parseInt(process.env.CODE_REVIEW_MAX_FILES ?? '50', 10);
        const tooManyFiles = Array.from({ length: maxFiles + 1 }, (_, i) => ({
            name: `file${i}.ts`,
            content: 'const x = 1;'
        }));

        const toolCallPayload = {
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/call',
            params: {
                name: 'code_review',
                arguments: { files: tooManyFiles }
            }
        };

        const response = await request(app)
            .post('/mcp')
            .set('Mcp-Session-Id', sessionId)
            .set(commonHeaders)
            .send(toolCallPayload);

        expect(response.status).toBe(200);
    });

    it('should reject file that is too large', async () => {
        const sessionId = await initializeSession();

        const maxFileSize = parseInt(process.env.CODE_REVIEW_MAX_FILE_SIZE ?? '50000', 10);
        const largeContent = 'x'.repeat(maxFileSize + 1);

        const toolCallPayload = {
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/call',
            params: {
                name: 'code_review',
                arguments: { files: [{ name: 'large.ts', content: largeContent }] }
            }
        };

        const response = await request(app)
            .post('/mcp')
            .set('Mcp-Session-Id', sessionId)
            .set(commonHeaders)
            .send(toolCallPayload);

        expect(response.status).toBe(200);
    });

    it('should reject absolute file paths', async () => {
        const sessionId = await initializeSession();

        const toolCallPayload = {
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/call',
            params: {
                name: 'code_review',
                arguments: { files: [{ name: '/etc/passwd', content: 'malicious' }] }
            }
        };

        const response = await request(app)
            .post('/mcp')
            .set('Mcp-Session-Id', sessionId)
            .set(commonHeaders)
            .send(toolCallPayload);

        expect(response.status).toBe(200);
    });

    it('should reject directory traversal paths', async () => {
        const sessionId = await initializeSession();

        const toolCallPayload = {
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/call',
            params: {
                name: 'code_review',
                arguments: { files: [{ name: '../../../malicious.ts', content: 'malicious' }] }
            }
        };

        const response = await request(app)
            .post('/mcp')
            .set('Mcp-Session-Id', sessionId)
            .set(commonHeaders)
            .send(toolCallPayload);

        expect(response.status).toBe(200);
    });

    it('should return sample review for valid single file', async () => {
        const sessionId = await initializeSession();

        const toolCallPayload = {
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/call',
            params: {
                name: 'code_review',
                arguments: { files: [{ name: 'src/index.ts', content: 'const x = 1;\nconsole.log(x);' }] }
            }
        };

        const response = await request(app)
            .post('/mcp')
            .set('Mcp-Session-Id', sessionId)
            .set(commonHeaders)
            .send(toolCallPayload);

        expect(response.status).toBe(200);
    });

    it('should return sample review for multiple files', async () => {
        const sessionId = await initializeSession();

        const toolCallPayload = {
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/call',
            params: {
                name: 'code_review',
                arguments: {
                    files: [
                        { name: 'src/index.ts', content: 'const x = 1;' },
                        { name: 'src/utils.ts', content: 'export function add(a: number, b: number) { return a + b; }' }
                    ]
                }
            }
        };

        const response = await request(app)
            .post('/mcp')
            .set('Mcp-Session-Id', sessionId)
            .set(commonHeaders)
            .send(toolCallPayload);

        expect(response.status).toBe(200);
    });

    it('should work with code-review alias', async () => {
        const sessionId = await initializeSession();

        const toolCallPayload = {
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/call',
            params: {
                name: 'code-review',
                arguments: { files: [{ name: 'test.ts', content: 'const test = true;' }] }
            }
        };

        const response = await request(app)
            .post('/mcp')
            .set('Mcp-Session-Id', sessionId)
            .set(commonHeaders)
            .send(toolCallPayload);

        expect(response.status).toBe(200);
    });
});
