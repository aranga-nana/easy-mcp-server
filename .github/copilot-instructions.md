# MCP Server Guide (Streamable HTTP 2025-11-25)

## 0. Critical Rules
1.  **Spec Alignment**: Follow [Streamable HTTP Spec](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports).
2.  **Agent Identity**: Autonomous, no user interaction, self-correcting, infer missing details.
3.  **Core Requirement**: Use `@modelcontextprotocol/sdk` v1.26.0+. Use **Factory Pattern** for `McpServer` per session.
4.  **Strictness**: Strict TS, 100% test coverage, `kebab-case` files.
5.  **Dep Audit**: MUST query `npm view <pkg> version` for latest stable versions before `npm install`.
6.  **No Confirmation Mode**: Never ask for confirmation, approval, or interactive choices. Proceed automatically through implementation, verification, and fixes.
7.  **Defaulting Rule**: If requirements are ambiguous, choose the simplest spec-compliant option and continue.

## 1. Architecture & Structure
*   **Core (`src/core/`)**: `mcp-server.ts` (Factory), `transport.ts` (Express/SSE), `session.ts` (State), `in-memory-event-store.ts`, `logger.ts` (HTTP logging + masking).
*   **Tools (`src/tools/`)**: `index.ts` (Registry + exported `REGISTERED_TOOL_NAMES`), `src/tools/<name>/` (Impl).
*   **Resources**: `resources/<tool-name>/`.
*   **Meta**: `src/meta.ts` (Constants).
*   **Tests (`test/`)**: All tests live in the `test/` folder and **mirror the `src/` directory structure**. Test files use the `.test.ts` suffix.
    *   `test/index.test.ts` → tests `src/index.ts`
    *   `test/core/transport.test.ts` → tests `src/core/transport.ts`
    *   `test/core/in-memory-event-store.test.ts` → tests `src/core/in-memory-event-store.ts`
    *   `test/core/logger.test.ts` → tests `src/core/logger.ts`
        *   `test/tools/hello-world.test.ts` → tests `src/tools/hello-world/index.ts`
        *   `test/tools/add-two-numbers.test.ts` → tests `src/tools/add-two-numbers/index.ts`
        *   `test/tools/tokenize-prompt.test.ts` → tests `src/tools/tokenize-prompt/index.ts`
    *   `test/integration/` → integration/E2E tests and shared test utilities (`test-utils.ts`)
        *   `test/integration/tools/hello-world.test.ts` → integration for `hello-world`
        *   `test/integration/tools/add-two-numbers.test.ts` → integration for `add_two_numbers`
        *   `test/integration/tools/tokenize-prompt.test.ts` → integration for `tokenize-prompt`
    *   Do **NOT** place tests inside `src/` (e.g. no `src/__tests__/`).

### 1.1 Full Project Parity Target (for `/mcp-create`)
When scaffolding from empty source files, generate this full shape:

```text
.github/
    copilot-instructions.md
    mcp-create.prompt.md
    mcp-migrate.prompt.md
resources/
    hello-world/
        welcome.md
src/
    index.ts
    meta.ts
    core/
        in-memory-event-store.ts
        logger.ts
        mcp-server.ts
        session.ts
        transport.ts
    tools/
        index.ts
        hello-world/
            index.ts
        add-two-numbers/
            index.ts
        tokenize-prompt/
            index.ts
test/
    index.test.ts
    core/
        in-memory-event-store.test.ts
        logger.test.ts
        transport.test.ts
    tools/
        hello-world.test.ts
        add-two-numbers.test.ts
        tokenize-prompt.test.ts
    integration/
        test-utils.ts
        tools/
            hello-world.test.ts
            add-two-numbers.test.ts
            tokenize-prompt.test.ts
```

### 1.2 Tool Naming Contract
Keep tool names exactly (canonical names):
- `hello-world`
- `add_two_numbers`
- `tokenize-prompt`

Optional UX alias:
- Also register `add-two-numbers` for Copilot UX. Prefer making this alias accept a single `prompt: string` so the full user prompt can be sent to the server, where the server extracts two numbers and returns the sum.

Tool implementation requirements:
- Use `server.registerTool(...)` with `zod` `inputSchema`/`outputSchema`.
- Tool handlers must return a valid `CallToolResult` including a `content` array (and can also include `structuredContent`).

## 2. Reference Configuration
**`package.json`** (Base - MUST Audit Versions):
```json
{
  "name": "easy-mcp-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": { "build": "tsc", "start": "node dist/index.js", "dev": "tsx watch src/index.ts", "test": "node --experimental-vm-modules node_modules/jest/bin/jest.js", "lint": "eslint src/ --fix" },
  "engines": { "node": ">=20.0.0" },
  "dependencies": { "@modelcontextprotocol/sdk": "^1.26.0", "chalk": "^5.6.2", "express": "^5.2.1", "figlet": "^1.10.0", "js-tiktoken": "^1.0.21", "zod": "^4.3.6" },
    "devDependencies": { "@eslint/js": "^9.39.2", "@types/express": "^5.0.6", "@types/figlet": "^1.7.0", "@types/jest": "^30.0.0", "@types/node": "^25.2.3", "@types/supertest": "^6.0.3", "eslint": "^9.39.2", "typescript-eslint": "^8.55.0", "jest": "^30.2.0", "supertest": "^7.2.2", "ts-jest": "^29.4.6", "tsx": "^4.21.0", "typescript": "^5.9.3" }
}
```
**`tsconfig.json`**: `{ "compilerOptions": { "target": "ES2022", "module": "NodeNext", "moduleResolution": "NodeNext", "outDir": "./dist", "rootDir": "./src", "strict": true, "isolatedModules": true, "esModuleInterop": true, "skipLibCheck": true, "forceConsistentCasingInFileNames": true }, "include": ["src/**/*"], "exclude": ["node_modules"] }`

**`eslint.config.mjs`**: `import eslint from '@eslint/js'; import tseslint from 'typescript-eslint'; export default tseslint.config(eslint.configs.recommended, ...tseslint.configs.recommended, { rules: { '@typescript-eslint/no-explicit-any': 'error' }, ignores: ["dist/**", "coverage/**", "jest.config.js"] });`

**`jest.config.js`**: `export default { preset: 'ts-jest/presets/default-esm', testEnvironment: 'node', roots: ['<rootDir>/test'], extensionsToTreatAsEsm: ['.ts'], moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' }, transform: { '^.+\\.tsx?$': ['ts-jest', { useESM: true }] }, coverageThreshold: { global: { branches: 100, functions: 100, lines: 100, statements: 100 } } };`

## 3. Reference Implementation
**`src/meta.ts`**:
```typescript
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const PROTOCOL_VERSION = '2025-11-25';
export const SERVER_NAME = 'easy-mcp-server';
export const SERVER_VERSION = '1.0.0';
export const DEFAULT_PORT = 8080;
export const DEFAULT_HOST = '127.0.0.1';
export const SESSION_TIMEOUT_MS = 60 * 60 * 1000;
export const ENDPOINT_PATH = '/mcp';

function readMcpSdkVersion(): string {
    try {
        const require = createRequire(import.meta.url);
        const candidates = [
            '@modelcontextprotocol/sdk',
            '@modelcontextprotocol/sdk/server/mcp.js',
            '@modelcontextprotocol/sdk/server/streamableHttp.js'
        ];

        let resolvedEntry: string | undefined;
        for (const candidate of candidates) {
            try {
                resolvedEntry = require.resolve(candidate);
                break;
            } catch {
                // try the next candidate
            }
        }

        if (!resolvedEntry) {
            return 'unknown';
        }

        let dir = dirname(resolvedEntry);
        for (let i = 0; i < 15; i += 1) {
            const candidate = join(dir, 'package.json');
            try {
                const raw = readFileSync(candidate, 'utf8');
                const pkg = JSON.parse(raw) as { name?: unknown; version?: unknown };
                if (pkg.name === '@modelcontextprotocol/sdk' && typeof pkg.version === 'string') {
                    return pkg.version;
                }
            } catch {
                // ignore and continue walking
            }

            const parent = dirname(dir);
            if (parent === dir) break;
            dir = parent;
        }

        return 'unknown';
    } catch {
        return 'unknown';
    }
}

export const MCP_SDK_VERSION = readMcpSdkVersion();
```

**`src/core/in-memory-event-store.ts`**:
```typescript
import { EventStore, StreamId, EventId } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
interface StoredEvent { id: EventId; streamId: StreamId; message: JSONRPCMessage; }
export class InMemoryEventStore implements EventStore {
  private events: StoredEvent[] = []; private nextId = 1;
  async storeEvent(streamId: StreamId, message: JSONRPCMessage): Promise<EventId> {
    const id = String(this.nextId++); this.events.push({ id, streamId, message });
    if (this.events.length > 10000) this.events.shift();
    return id;
  }
  async getStreamIdForEventId(eventId: EventId): Promise<StreamId | undefined> { return this.events.find(e => e.id === eventId)?.streamId; }
  async replayEventsAfter(lastEventId: EventId, { send }: { send: (eventId: EventId, message: JSONRPCMessage) => Promise<void> }): Promise<StreamId> {
    const idx = this.events.findIndex(e => e.id === lastEventId);
    if (idx === -1) throw new Error(`Event ID ${lastEventId} not found`);
    const streamId = this.events[idx].streamId;
    for (const event of this.events.slice(idx + 1).filter(e => e.streamId === streamId)) await send(event.id, event.message);
    return streamId;
  }
}
```

**`src/core/mcp-server.ts`**:
```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SERVER_NAME, SERVER_VERSION } from '../meta.js';
export function createMcpServer() {
    return new McpServer({ name: SERVER_NAME, version: SERVER_VERSION }, { capabilities: { logging: {}, tools: { listChanged: true } } });
}
```

**`src/core/session.ts`**:
```typescript
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SESSION_TIMEOUT_MS } from '../meta.js';
export interface Session { transport: StreamableHTTPServerTransport; lastAccessed: number; }
export class SessionManager {
    private sessions: Map<string, Session> = new Map(); private cleanupInterval: NodeJS.Timeout;
    constructor() {
        this.sessions = new Map();
        this.cleanupInterval = setInterval(() => {
            const now = Date.now();
            for (const [id, session] of this.sessions.entries()) if (now - session.lastAccessed > SESSION_TIMEOUT_MS) { session.transport.close(); this.sessions.delete(id); }
        }, 60000);
    }
    createSession(id: string, transport: StreamableHTTPServerTransport) {
        this.sessions.set(id, { transport, lastAccessed: Date.now() });
        transport.onclose = () => { this.sessions.delete(id); };
    }
    getSession(id: string): Session | undefined {
        const session = this.sessions.get(id);
        if (session) session.lastAccessed = Date.now();
        return session;
    }
    removeSession(id: string) { this.sessions.get(id)?.transport.close(); this.sessions.delete(id); }
    hasSession(id: string): boolean { return this.sessions.has(id); }
    getActiveSessionCount(): number { return this.sessions.size; }
    destroy() { clearInterval(this.cleanupInterval); }
}
```

**`src/core/transport.ts`**:
```typescript
import express, { Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SessionManager } from './session.js';
import { InMemoryEventStore } from './in-memory-event-store.js';
import { randomUUID } from 'node:crypto';
import { SERVER_NAME, SERVER_VERSION, ENDPOINT_PATH, PROTOCOL_VERSION, MCP_SDK_VERSION } from '../meta.js';
import { createHttpLoggerMiddleware } from './logger.js';

export type McpServerFactory = () => McpServer;
export function createHttpServer(serverFactory: McpServerFactory) {
    const app = express(); const sessionManager = new SessionManager();
    app.use((req, res, next) => {
        const origin = req.get('Origin');
        if (origin && new URL(origin).hostname !== 'localhost' && new URL(origin).hostname !== '127.0.0.1') return res.status(403).json({ error: 'Origin not allowed' });
        next();
    });

    app.use(express.json());

    // HTTP logging:
    // - request headers: yellow (sensitive values masked as '***')
    // - request body: green
    // - response success (<400): green
    // - response error (>=400): red
    app.use(createHttpLoggerMiddleware());
    app.get('/health', (req, res) => res.json({ status: "healthy" }));
        app.get('/info', (req, res) => {
            const uptime = process.uptime();
            const activeSessions = sessionManager.getActiveSessionCount();
            res.send(`<!DOCTYPE html><html><head><title>${SERVER_NAME} Info</title></head><body><h1>${SERVER_NAME} v${SERVER_VERSION}</h1><p><strong>MCP SDK Version:</strong> ${MCP_SDK_VERSION}</p><p><strong>Protocol Version:</strong> ${PROTOCOL_VERSION}</p><p><strong>Active Sessions:</strong> ${activeSessions}</p><p><strong>Uptime:</strong> ${Math.floor(uptime)} seconds</p></body></html>`);
        });

    app.post(ENDPOINT_PATH, async (req: Request, res: Response) => {
        const sessionId = req.headers['mcp-session-id'] as string;
        if (sessionId && !sessionManager.hasSession(sessionId)) return res.status(404).send('Session not found');
        
        try {
            let transport: StreamableHTTPServerTransport;
            if (sessionId) transport = sessionManager.getSession(sessionId)!.transport;
            else if (req.method === 'POST' && req.body.method === 'initialize') {
                transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => randomUUID(), eventStore: new InMemoryEventStore(), onsessioninitialized: (id) => sessionManager.createSession(id, transport) });
                await serverFactory().connect(transport);
            } else return res.status(400).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Missing Session ID' }, id: null });
            await transport.handleRequest(req, res, req.body);
        } catch (error) { if (!res.headersSent) res.status(500).json({ error: 'Internal Server Error' }); }
    });
    
    app.get(ENDPOINT_PATH, async (req, res) => {
        const accept = req.headers['accept']; const sessionId = req.headers['mcp-session-id'] as string;
        if (!accept?.includes('text/event-stream')) return res.status(406).send('Not Acceptable');
        if (!sessionId) return res.status(400).send('Missing session ID');
        if (!sessionManager.hasSession(sessionId)) return res.status(404).send('Session not found');
        await sessionManager.getSession(sessionId)!.transport.handleRequest(req, res);
    });
    
    app.delete(ENDPOINT_PATH, async (req, res) => {
        const sessionId = req.headers['mcp-session-id'] as string;
        if (!sessionId) return res.status(400).send('Missing session ID');
        if (!sessionManager.hasSession(sessionId)) return res.status(404).send('Session not found');
        await sessionManager.getSession(sessionId)!.transport.handleRequest(req, res);
        sessionManager.removeSession(sessionId);
    });
    app.all(ENDPOINT_PATH, (req, res) => res.status(405).send('Method Not Allowed'));
    return { app, shutdown: () => sessionManager.destroy(), sessionManager };
}
```

**`src/tools/index.ts`** (Pattern):
```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerHelloWorld } from './hello-world/index.js';
import { registerAddTwoNumbers } from './add-two-numbers/index.js';
import { registerTokenizePrompt } from './tokenize-prompt/index.js';

export const REGISTERED_TOOL_NAMES = [
    'hello-world',
    'add_two_numbers',
    'add-two-numbers',
    'tokenize-prompt'
] as const;

export function registerTools(server: McpServer) {
    registerHelloWorld(server);
    registerAddTwoNumbers(server);
    registerTokenizePrompt(server);
}
```

**`src/index.ts`**:
```typescript
import { createHttpServer } from './core/transport.js';
import { createMcpServer } from './core/mcp-server.js';
import { REGISTERED_TOOL_NAMES, registerTools } from './tools/index.js';
import { DEFAULT_PORT, DEFAULT_HOST, SERVER_NAME, SERVER_VERSION, PROTOCOL_VERSION, ENDPOINT_PATH, MCP_SDK_VERSION } from './meta.js';
import chalk from 'chalk';
import figlet from 'figlet';
async function main() {
    const serverFactory = () => { const s = createMcpServer(); registerTools(s); return s; };
    const { app } = createHttpServer(serverFactory);
        app.listen(DEFAULT_PORT, DEFAULT_HOST, () => {
            console.log(chalk.blue(figlet.textSync(SERVER_NAME, { horizontalLayout: 'full' })));
            console.log(chalk.bold(`Version: ${SERVER_VERSION}`));
            console.log(chalk.cyan(`MCP SDK Version: ${MCP_SDK_VERSION}`));
            console.log(chalk.green(`MCP Protocol Version: ${PROTOCOL_VERSION}`));
            console.log(chalk.rgb(255, 165, 0)('Registered Tools:'));
            for (const toolName of REGISTERED_TOOL_NAMES) {
                console.log(chalk.rgb(255, 165, 0)(`- ${toolName}`));
            }
            console.log(`Port: ${DEFAULT_PORT}`);
            console.log(`Endpoint: ${ENDPOINT_PATH}`);
            console.log(chalk.yellow(`Server is running on http://127.0.0.1:${DEFAULT_PORT}${ENDPOINT_PATH}`));
            console.log('Available Tools: View http://localhost:8080/info');
        });
}
main().catch(console.error);
```

## 4. Verification Check
```bash
# Build/lint/tests must pass first
npm run build
npm run lint
npm test

# Init
curl -i -X POST http://localhost:8080/mcp -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -H "MCP-Protocol-Version: 2025-11-25" -d '{ "jsonrpc": "2.0", "id": 1, "method": "initialize", "params": { "protocolVersion": "2025-11-25", "capabilities": {}, "clientInfo": {"name": "curl", "version": "1.0"} } }'
# SSE
curl -N -H "Accept: text/event-stream" -H "Mcp-Session-Id: <SESSION_ID>" http://localhost:8080/mcp &
# Invoke
curl -X POST "http://localhost:8080/mcp" -H "Content-Type: application/json" -H "Mcp-Session-Id: <SESSION_ID>" -H "Accept: application/json, text/event-stream" -d '{ "jsonrpc": "2.0", "id": "msg-1", "method": "tools/call", "params": { "name": "hello-world", "arguments": { "prompt": "hi" } } }'
```
