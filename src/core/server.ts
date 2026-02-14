import express, { Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { InMemoryEventStore } from './in-memory-event-store.js';
import { randomUUID } from 'node:crypto';
import { SERVER_NAME, SERVER_VERSION, SESSION_TIMEOUT_MS, ENDPOINT_PATH, PROTOCOL_VERSION } from '../meta.js';

// Session management
interface Session {
    transport: StreamableHTTPServerTransport;
    lastAccessed: number;
}

const sessions: Map<string, Session> = new Map();

export async function createServer() {
    const app = express();
    
    // Cleanup task
    const cleanupInterval = setInterval(() => {
        const now = Date.now();
        for (const [id, session] of sessions.entries()) {
            if (now - session.lastAccessed > SESSION_TIMEOUT_MS) {
                console.log(`Session ${id} timed out`);
                // Close transport? 
                // session.transport.close(); // If method exists
                sessions.delete(id);
            }
        }
    }, 60000); // Check every minute
    
    // Origin validation middleware
    app.use((req, res, next) => {
        const origin = req.get('Origin');
        // Allow no origin (e.g. curl) or localhost/127.0.0.1
        if (origin) {
            const url = new URL(origin);
            if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
                res.status(403).json({ error: 'Origin not allowed' });
                return;
            }
        }
        next();
    });

    // Body parser is needed for POST
    app.use(express.json());

    const mcpServer = new McpServer({
        name: SERVER_NAME,
        version: SERVER_VERSION
    }, {
        capabilities: {
            logging: {},
            tools: { listChanged: true }
        }
    });

    app.get('/health', (req, res) => {
        res.json({ status: "healthy" });
    });

    app.get('/info', (req, res) => {
        const uptime = process.uptime();
        const activeSessions = sessions.size;
        const html = `
        <!DOCTYPE html>
        <html>
        <head><title>${SERVER_NAME} Info</title></head>
        <body>
            <h1>${SERVER_NAME} v${SERVER_VERSION}</h1>
            <p><strong>Protocol Version:</strong> ${PROTOCOL_VERSION}</p>
            <p><strong>Active Sessions:</strong> ${activeSessions}</p>
            <p><strong>Uptime:</strong> ${Math.floor(uptime)} seconds</p>
            <h2>Tools</h2>
            <ul>
                <li>add_two_numbers</li>
            </ul>
        </body>
        </html>
        `;
        res.send(html);
    });


    // We will register tools here or expose method to register tools
    // For now, return both app and mcpServer so index can register tools
    
    const handleMcpRequest = async (req: Request, res: Response) => {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;

        // Valid protocol version check
        const protocolVersion = req.headers['mcp-protocol-version'] as string | undefined;
        if (protocolVersion && protocolVersion !== PROTOCOL_VERSION) {
             // For strict compliance we should return 400, but let's just log for now to avoid breaking tools
             // res.status(400).json({ error: 'Unsupported Protocol Version' });
             // return;
        }

        if (sessionId) {
            if (sessions.has(sessionId)) {
                sessions.get(sessionId)!.lastAccessed = Date.now();
            } else {
                res.status(404).send('Session not found');
                return;
            }
        }

        try {
            let transport: StreamableHTTPServerTransport;

            if (sessionId) {
                // Reuse existing transport (validated above)
                transport = sessions.get(sessionId)!.transport;
            } else if (!sessionId && req.method === 'POST' && req.body.method === 'initialize') {
                // Create NEW transport
                const eventStore = new InMemoryEventStore();
                transport = new StreamableHTTPServerTransport({
                    sessionIdGenerator: () => randomUUID(),
                    eventStore,
                    onsessioninitialized: (id) => {
                        sessions.set(id, { transport, lastAccessed: Date.now() });
                        console.log(`Session initialized: ${id}`);
                        
                        transport.onclose = () => {
                             sessions.delete(id);
                             console.log(`Session closed: ${id}`);
                        };
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

            // Handle the request
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
        if (!sessions.has(sessionId)) {
            res.status(404).send('Session not found');
            return;
        }
        
        const session = sessions.get(sessionId)!;
        session.lastAccessed = Date.now();
        await session.transport.handleRequest(req, res);
    });
    
    app.delete(ENDPOINT_PATH, async (req, res) => {
        const sessionId = req.headers['mcp-session-id'] as string;
        if (!sessionId) {
            res.status(400).send('Missing session ID');
            return;
        }
        if (!sessions.has(sessionId)) {
            res.status(404).send('Session not found');
            return;
        }

        const session = sessions.get(sessionId)!;
        await session.transport.handleRequest(req, res);
        // Transport close logic should handle cleanup
        sessions.delete(sessionId);
    });

    // 405 Method Not Allowed
    app.all(ENDPOINT_PATH, (req, res) => {
        res.status(405).send('Method Not Allowed');
    });

    return { 
        app, 
        mcpServer,
        shutdown: () => {
            clearInterval(cleanupInterval);
        }
    };
}
