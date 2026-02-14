import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SESSION_TIMEOUT_MS } from '../meta.js';

export interface Session {
    transport: StreamableHTTPServerTransport;
    lastAccessed: number;
    clientInfo?: { name: string; version: string };
}

export class SessionManager {
    private sessions: Map<string, Session> = new Map();
    private cleanupInterval: NodeJS.Timeout;

    constructor() {
        this.sessions = new Map();
        this.cleanupInterval = setInterval(() => {
            const now = Date.now();
            for (const [id, session] of this.sessions.entries()) {
                if (now - session.lastAccessed > SESSION_TIMEOUT_MS) {
                    console.log(`Session ${id} timed out`);
                    session.transport.close();
                    this.sessions.delete(id);
                }
            }
        }, 60000); // Check every minute
    }

    createSession(id: string, transport: StreamableHTTPServerTransport, meta?: { clientInfo?: { name: string; version: string } }) {
        this.sessions.set(id, { transport, lastAccessed: Date.now(), clientInfo: meta?.clientInfo });
        transport.onclose = () => {
            this.sessions.delete(id);
            console.log(`Session closed: ${id}`);
        };
    }

    getSession(id: string): Session | undefined {
        const session = this.sessions.get(id);
        if (session) {
            session.lastAccessed = Date.now();
        }
        return session;
    }

    removeSession(id: string) {
        const session = this.sessions.get(id);
        if (session) {
            session.transport.close();
            this.sessions.delete(id);
        }
    }

    hasSession(id: string): boolean {
        return this.sessions.has(id);
    }
    
    getActiveSessionCount(): number {
        return this.sessions.size;
    }
    
    destroy() {
        clearInterval(this.cleanupInterval);
    }
}
