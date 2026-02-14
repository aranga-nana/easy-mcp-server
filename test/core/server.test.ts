import request from 'supertest';
import { createServer } from '../../src/core/server.js';
import { PROTOCOL_VERSION } from '../../src/meta.js';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Application } from 'express';

describe('MCP Server', () => {
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
        const result = await createServer();
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
        const dataLine = lines.find(l => l.startsWith('data: '));
        expect(dataLine).toBeDefined();
        const json = JSON.parse(dataLine!.substring(6));
        
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
                    // Ignore error from destroying stream
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

    it('should catch internal errors', async () => {
        jest.spyOn(McpServer.prototype, 'connect').mockRejectedValueOnce(new Error('Connect failed'));
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

        const response = await request(app)
            .post('/mcp')
            .send(initPayload)
            .set(commonHeaders);
        
        expect(response.status).toBe(500);
        spy.mockRestore();
    });

    it('should cleanup timed out sessions', async () => {
        jest.useFakeTimers();
        const { app: testApp, shutdown: testShutdown } = await createServer();

        const initResponse = await request(testApp)
            .post('/mcp')
            .send(initPayload)
            .set(commonHeaders);
        
        const sessionId = initResponse.headers['mcp-session-id'];
        expect(sessionId).toBeDefined();

        jest.advanceTimersByTime(65 * 60 * 1000);

        const response = await request(testApp)
            .post('/mcp')
            .set('Mcp-Session-Id', sessionId)
            .set(commonHeaders)
            .send({
                jsonrpc: "2.0",
                id: 2,
                method: "ping"
            });
        
        expect(response.status).toBe(400); 
        
        if (testShutdown) testShutdown();
    });

    it('should reject DELETE with invalid session', async () => {
        const response = await request(app)
            .delete('/mcp')
            .set('Mcp-Session-Id', 'invalid-uuid');
        expect(response.status).toBe(400);
    });

    it('should reject GET (SSE) with invalid session', async () => {
        const response = await request(app)
            .get('/mcp')
            .set('Accept', 'text/event-stream')
            .set('Mcp-Session-Id', 'invalid-uuid');
        expect(response.status).toBe(400);
    });

    it('should reject GET (SSE) without session', async () => {
        const response = await request(app)
            .get('/mcp')
            .set('Accept', 'text/event-stream');
        expect(response.status).toBe(400);
    });

    it('should handle explicit session termination', async () => {
        // Create a session
        const initResponse = await request(app)
            .post('/mcp')
            .send(initPayload)
            .set(commonHeaders);
        
        const sessionId = initResponse.headers['mcp-session-id'];
        expect(sessionId).toBeDefined();

        // Delete the session
        const deleteResponse = await request(app)
            .delete('/mcp')
            .set('Mcp-Session-Id', sessionId);
        
        expect(deleteResponse.status).toBe(200); // Or 202, depending on implementation. SDK usually sends 200 or 202.
        
        // Verify session is gone by trying to ping
        const pingResponse = await request(app)
            .post('/mcp')
            .set('Mcp-Session-Id', sessionId)
            .set(commonHeaders)
            .send({
                jsonrpc: "2.0",
                id: 2,
                method: "ping"
            });
            
        expect(pingResponse.status).toBe(400); // Invalid session
    });
});
