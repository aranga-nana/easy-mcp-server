import { jest } from '@jest/globals';
import request from 'supertest';
import { createHttpServer } from '../../src/core/transport.js';
import { createMcpServer } from '../../src/core/mcp-server.js';
import { PROTOCOL_VERSION } from '../../src/meta.js';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Application } from 'express';

describe('MCP Server Transport', () => {
    let app: Application;
    let shutdown: (() => void) | undefined;
    
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
        const result = createHttpServer(createMcpServer);
        app = result.app;
        shutdown = result.shutdown;
    });

    afterAll(() => {
        if (shutdown) shutdown();
        jest.useRealTimers();
    });

    it('should have health endpoint', async () => {
        const response = await request(app).get('/health');
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ status: "healthy" });
    });

    it('should have info endpoint', async () => {
        const response = await request(app).get('/info');
        expect(response.status).toBe(200);
        expect(response.text).toContain("Active Sessions");
        expect(response.text).toContain("MCP SDK Version");
    });
    
    it('should reject DELETE without session', async () => {
        const response = await request(app).delete('/mcp');
        expect(response.status).toBe(400);
    });

    it('should initialize a session', async () => {
        const response = await request(app)
            .post('/mcp')
            .send(initPayload)
            .set(commonHeaders);
        
        expect(response.status).toBe(200);
        expect(response.headers['mcp-session-id']).toBeDefined();
        
        // Parse SSE
        const text = response.text;
        
        expect(text).toContain('event: message');
        const lines = text.split('\n');
        const dataLines = lines.filter(l => l.startsWith('data: '));
        const jsonLine = dataLines.find(l => l.length > 6 && l.substring(6).trim().startsWith('{'));
        expect(jsonLine).toBeDefined();
        
        let json;
        try {
            json = JSON.parse(jsonLine!.substring(6));
        } catch (e) {
            console.error('Failed to parse JSON:', jsonLine!.substring(6));
            throw e;
        }
        
        expect(json.result).toBeDefined();
        expect(json.result.protocolVersion).toBe(PROTOCOL_VERSION);
    });

    it('should return 406 if Accept header missing for SSE', async () => {
        const initResponse = await request(app)
            .post('/mcp')
            .send(initPayload)
            .set(commonHeaders);
        
        expect(initResponse.status).toBe(200);
        const sessionId = initResponse.headers['mcp-session-id'];
        expect(sessionId).toBeDefined();

        const response = await request(app)
            .get('/mcp')
            .set('Mcp-Session-Id', sessionId)
            .set('Accept', 'application/json'); 
        
        expect(response.status).toBe(406);
    });

    it('should return 405 for PUT method', async () => {
        const response = await request(app).put('/mcp');
        expect(response.status).toBe(405);
    });

    it('should reject requests with invalid Origin', async () => {
        const response = await request(app)
            .post('/mcp')
            .set('Origin', 'http://evil.com')
            .set(commonHeaders)
            .send(initPayload);
        expect(response.status).toBe(403);
    });

    it('should allow requests with localhost Origin', async () => {
         const response = await request(app)
            .post('/mcp')
            .set('Origin', 'http://localhost:8080')
            .set(commonHeaders)
            .send(initPayload);
        expect(response.status).toBe(200);
    });

    it('should connect to SSE stream', async () => {
        const initResponse = await request(app)
            .post('/mcp')
            .send(initPayload)
            .set(commonHeaders);
        const sessionId = initResponse.headers['mcp-session-id'];
        
        await new Promise<void>((resolve) => {
            request(app)
                .get('/mcp')
                .set('Mcp-Session-Id', sessionId)
                .set(commonHeaders)
                .expect(200)
                .expect('Content-Type', /text\/event-stream/)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .parse((res: any, callback) => {
                    resolve();
                    res.destroy();
                    callback(null, '');
                })
                .end(() => {
                    resolve();
                });
        });
    });

    it('should reuse an existing session', async () => {
        const initResponse = await request(app)
            .post('/mcp')
            .send(initPayload)
            .set(commonHeaders);
        
        const sessionId = initResponse.headers['mcp-session-id'];
        
        const response = await request(app)
            .post('/mcp')
            .set('Mcp-Session-Id', sessionId)
            .set(commonHeaders)
            .send({
                jsonrpc: "2.0",
                id: 2,
                method: "ping"
            });
        
        expect(response.status).toBe(200); 
    });

    it('should cleanup timed out sessions', async () => {
        jest.useFakeTimers();
        const { app: testApp, shutdown: testShutdown } = createHttpServer(createMcpServer);

        const initResponse = await request(testApp)
            .post('/mcp')
            .send(initPayload)
            .set(commonHeaders);
        
        const sessionId = initResponse.headers['mcp-session-id'];
        expect(sessionId).toBeDefined();

        jest.advanceTimersByTime(65 * 60 * 1000); // 65 minutes

        const response = await request(testApp)
            .post('/mcp')
            .set('Mcp-Session-Id', sessionId)
            .set(commonHeaders)
            .send({
                jsonrpc: "2.0",
                id: 2,
                method: "ping"
            });
        
        expect(response.status).toBe(404); 
        
        if (testShutdown) testShutdown();
    });

    it('should reject DELETE with invalid session', async () => {
        const response = await request(app)
            .delete('/mcp')
            .set('Mcp-Session-Id', 'invalid-uuid');
        expect(response.status).toBe(404);
    });

    it('should reject GET (SSE) with invalid session', async () => {
        const response = await request(app)
            .get('/mcp')
            .set('Accept', 'text/event-stream')
            .set('Mcp-Session-Id', 'invalid-uuid');
        expect(response.status).toBe(404);
    });

    it('should reject GET (SSE) without session', async () => {
        const response = await request(app)
            .get('/mcp')
            .set('Accept', 'text/event-stream');
        expect(response.status).toBe(400);
    });

    it('should handle explicit session termination', async () => {
        const initResponse = await request(app)
            .post('/mcp')
            .send(initPayload)
            .set(commonHeaders);
        
        const sessionId = initResponse.headers['mcp-session-id'];
        expect(sessionId).toBeDefined();

        const deleteResponse = await request(app)
            .delete('/mcp')
            .set('Mcp-Session-Id', sessionId);
        
        expect(deleteResponse.status).toBe(200);
        
        const pingResponse = await request(app)
            .post('/mcp')
            .set('Mcp-Session-Id', sessionId)
            .set(commonHeaders)
            .send({
                jsonrpc: "2.0",
                id: 2,
                method: "ping"
            });
            
        expect(pingResponse.status).toBe(404);
    });
});
