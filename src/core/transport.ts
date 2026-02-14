import express, { Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SessionManager } from './session.js';
import { InMemoryEventStore } from './in-memory-event-store.js';
import { randomUUID } from 'node:crypto';
import { SERVER_NAME, SERVER_VERSION, ENDPOINT_PATH, PROTOCOL_VERSION } from '../meta.js';

export function createHttpServer(mcpServer: McpServer) {
    const app = express();
    const sessionManager = new SessionManager();

    // Origin validation middleware
    app.use((req, res, next) => {
        const origin = req.get('Origin');
        if (origin) {
            const url = new URL(origin);
            if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
                res.status(403).json({ error: 'Origin not allowed' });
                return;
            }
        }
        next();
    });

    app.use(express.json());

    app.get('/health', (req, res) => {
        res.json({ status: "healthy" });
    });

    app.get('/info', (req, res) => {
        const uptime = process.uptime();
        const activeSessions = sessionManager.getActiveSessionCount();
        const html = `
        <!DOCTYPE html>
        <html>
        <head><title>${SERVER_NAME} Info</title></head>
        <body>
            <h1>${SERVER_NAME} v${SERVER_VERSION}</h1>
            <p><strong>Protocol Version:</strong> ${PROTOCOL_VERSION}</p>
            <p><strong>Active Sessions:</strong> ${activeSessions}</p>
            <p><strong>Uptime:</strong> ${Math.floor(uptime)} seconds</p>
        </body>
        </html>
        `;
        res.send(html);
    });

    const handleMcpRequest = async (req: Request, res: Response) => {
        // console.log(`[Transport] Handle ${req.method} ${req.path}`);
        const sessionId = req.headers['mcp-session-id'] as string | undefined;

        const protocolVersion = req.headers['mcp-protocol-version'] as string | undefined;
        if (protocolVersion && protocolVersion !== PROTOCOL_VERSION) {
             // For strict compliance we should return 400
             // res.status(400).json({ error: 'Unsupported Protocol Version' });
             // return;
        }

        if (sessionId) {
            if (sessionManager.hasSession(sessionId)) {
                sessionManager.getSession(sessionId); 
            } else {
                res.status(404).send('Session not found');
                return;
            }
        }

        try {
            let transport: StreamableHTTPServerTransport;

            if (sessionId) {
                transport = sessionManager.getSession(sessionId)!.transport;
            } else if (!sessionId && req.method === 'POST' && req.body.method === 'initialize') {
                const eventStore = new InMemoryEventStore();
                transport = new StreamableHTTPServerTransport({
                    sessionIdGenerator: () => randomUUID(),
                    eventStore,
                    onsessioninitialized: (id) => {
                        sessionManager.createSession(id, transport);
                    }
                });
                await mcpServer.connect(transport);
            } else {
                 res.status(400).json({ 
                     jsonrpc: '2.0', 
                     error: { code: -32000, message: 'Missing Session ID' }, 
                     id: null 
                 });
                 return;
            }

            await transport.handleRequest(req, res, req.body);

        } catch (error) {
            console.error("Error handling request", error);
            if (!res.headersSent) res.status(500).json({ error: 'Internal Server Error' });
        }
    };

    app.post(ENDPOINT_PATH, handleMcpRequest);
    
    app.get(ENDPOINT_PATH, async (req, res) => {
        const accept = req.headers['accept'];
        if (!accept || !accept.includes('text/event-stream')) {
            res.status(406).send('Not Acceptable');
            return;
        }

        const sessionId = req.headers['mcp-session-id'] as string;
        if (!sessionId) {
            res.status(400).send('Missing session ID');
            return;
        }
        if (!sessionManager.hasSession(sessionId)) {
            res.status(404).send('Session not found');
            return;
        }
        
        const session = sessionManager.getSession(sessionId)!;
        await session.transport.handleRequest(req, res);
    });
    
    app.delete(ENDPOINT_PATH, async (req, res) => {
        const sessionId = req.headers['mcp-session-id'] as string;
        if (!sessionId) {
            res.status(400).send('Missing session ID');
            return;
        }
        if (!sessionManager.hasSession(sessionId)) {
            res.status(404).send('Session not found');
            return;
        }
        const session = sessionManager.getSession(sessionId)!;
        await session.transport.handleRequest(req, res);
        sessionManager.removeSession(sessionId);
    });

    app.all(ENDPOINT_PATH, (req, res) => {
        res.status(405).send('Method Not Allowed');
    });

    return {
        app,
        shutdown: () => sessionManager.destroy(),
        sessionManager // Expose for testing
    };
}
