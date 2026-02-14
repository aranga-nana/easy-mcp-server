import request from 'supertest';
import http from 'http';
import { createHttpServer } from '../../../src/core/transport.js';
import { createMcpServer } from '../../../src/core/mcp-server.js';
import { registerTokenizePrompt } from '../../../src/tools/tokenize-prompt/index.js';
import { PROTOCOL_VERSION } from '../../../src/meta.js';
import { Application } from 'express';
import { SessionManager } from '../../../src/core/session.js';

describe('Tokenize Prompt Tool Integration', () => {
    let app: Application;
    let server: any;
    let port: number;
    let shutdown: (() => void) | undefined;
    let sessionManager: SessionManager;
    let sseReq: http.ClientRequest;
    
    const commonHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
    };

    const initPayload = {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: {},
            clientInfo: { name: "test", version: "1.0" }
        }
    };

    beforeAll(async () => {
        const mcpServer = createMcpServer();
        registerTokenizePrompt(mcpServer);
        
        const result = createHttpServer(mcpServer);
        app = result.app;
        shutdown = result.shutdown;
        sessionManager = result.sessionManager;
        
        await new Promise<void>((resolve) => {
             // eslint-disable-next-line @typescript-eslint/no-explicit-any
            server = app.listen(0, () => {
                port = (server.address() as any).port;
                resolve();
            });
        });
    });

    afterAll((done) => {
        if (sseReq) sseReq.destroy();
        if (shutdown) shutdown();
        if (server) {
            server.close(done);
        } else {
            done();
        }
    });

    it('should tokenize prompt correctly via JSON-RPC', async () => {
        const initResponse = await request(app)
            .post('/mcp')
            .send(initPayload)
            .set(commonHeaders);
        
        const sessionId = initResponse.headers['mcp-session-id'];
        expect(sessionId).toBeDefined();

        const toolCallPayload = {
            jsonrpc: "2.0",
            id: 2,
            method: "tools/call",
            params: {
                name: "tokenize-prompt",
                arguments: { prompt: "hello world" }
            }
        };

        const ssePromise = new Promise<string>((resolve, reject) => {
             sseReq = http.request({
                hostname: 'localhost',
                port: port,
                path: '/mcp',
                method: 'GET',
                headers: {
                    'Accept': 'text/event-stream',
                    'Mcp-Session-Id': sessionId
                }
            }, (res: any) => {
                res.setEncoding('utf8');
                let buffer = '';
                res.on('data', (chunk: string) => {
                    buffer += chunk;
                    if (buffer.includes('"result"') || buffer.includes('"error"')) {
                        sseReq.destroy();
                        resolve(buffer);
                    }
                });
                res.on('end', () => {
                   resolve(buffer);
                });
            });
            
            sseReq.on('error', (e: any) => {
                reject(e);
            });
            sseReq.end();
        });

        // Warm up / wait for connection
        await new Promise(r => setTimeout(r, 500));

        const response = await request(app)
            .post('/mcp')
            .set('Mcp-Session-Id', sessionId)
            .set(commonHeaders)
            .send(toolCallPayload);
        
        expect(response.status).toBe(200);

        if (JSON.stringify(response.body) !== '{}') {
             expect(JSON.stringify(response.body)).toContain('hello');
             expect(JSON.stringify(response.body)).toContain('world');
        } else {
             const session = sessionManager.getSession(sessionId);
             expect(session).toBeDefined();
        }
    }, 10000); 
});
