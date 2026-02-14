import { jest } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerHelloWorld } from '../../src/tools/hello-world/index.js';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { MCP_SDK_VERSION } from '../../src/meta.js';
import { runWithRequestContext } from '../../src/core/request-context.js';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';

describe('hello-world tool', () => {
    let server: McpServer;

    beforeEach(() => {
        server = new McpServer({ name: 'test', version: '1.0' });
    });

    it('should register the tool', () => {
        expect(() => registerHelloWorld(server)).not.toThrow();
    });

    it('should return welcome message', async () => {
        // Mock the implementation to intercept call
        let toolHandler: any;
        const toolSpy = jest.spyOn(server, 'registerTool').mockImplementation(((...args: any[]) => {
            const name = args[0] as string;
            const handler = args[2];
             if (name === 'hello-world') {
                 toolHandler = handler;
             }
             return server;
        }) as any);

        registerHelloWorld(server);

        expect(toolHandler).toBeDefined();

        // Call the handler with a request context so the tool can report client info.
        const result = await runWithRequestContext(
            { sessionId: 'test-session', clientInfo: { name: 'copilot', version: '9.9.9' } },
            () => toolHandler({})
        );
        
        // Read expected content
        const filePath = join(process.cwd(), 'resources', 'hello-world', 'welcome.md');
        const expectedContent = await readFile(filePath, 'utf-8');

        expect(result.content?.[0]?.type).toBe('text');
        expect(result.content?.[0]?.text).toContain(expectedContent);
        expect(result.content?.[0]?.text).toContain(`MCP SDK Version: ${MCP_SDK_VERSION}`);
        expect(result.content?.[0]?.text).toContain('Client: copilot 9.9.9');

        expect(result.structuredContent).toEqual({
            message: expectedContent,
            mcpSdkVersion: MCP_SDK_VERSION,
            clientName: 'copilot',
            clientVersion: '9.9.9'
        });
    });

    it('should fall back to dist/resources when primary missing', async () => {
        let toolHandler: any;
        jest.spyOn(server, 'registerTool').mockImplementation(((...args: any[]) => {
            const name = args[0] as string;
            const handler = args[2];
            if (name === 'hello-world') toolHandler = handler;
            return server;
        }) as any);

        registerHelloWorld(server);
        expect(toolHandler).toBeDefined();

        const originalCwd = process.cwd();
        const sandbox = await mkdtemp(join(tmpdir(), 'mcp-hello-world-'));

        try {
            // No primary resources/hello-world/welcome.md created in sandbox.
            const distPath = join(sandbox, 'dist', 'resources', 'hello-world');
            await mkdir(distPath, { recursive: true });
            await writeFile(join(distPath, 'welcome.md'), 'Fallback Welcome', 'utf-8');

            process.chdir(sandbox);

            const result = await runWithRequestContext(
                { sessionId: 'test-session', clientInfo: { name: 'copilot', version: '1.2.3' } },
                () => toolHandler({})
            );

            expect(result.isError).not.toBe(true);
            expect(result.content?.[0]?.type).toBe('text');
            expect(result.content?.[0]?.text).toContain('Fallback Welcome');
            expect(result.content?.[0]?.text).toContain(`MCP SDK Version: ${MCP_SDK_VERSION}`);
            expect(result.content?.[0]?.text).toContain('Client: copilot 1.2.3');
        } finally {
            process.chdir(originalCwd);
        }
    });

    it('should return an error when welcome resource is missing', async () => {
        let toolHandler: any;
        jest.spyOn(server, 'registerTool').mockImplementation(((...args: any[]) => {
            const name = args[0] as string;
            const handler = args[2];
            if (name === 'hello-world') toolHandler = handler;
            return server;
        }) as any);

        registerHelloWorld(server);
        expect(toolHandler).toBeDefined();

        const originalCwd = process.cwd();
        const sandbox = await mkdtemp(join(tmpdir(), 'mcp-hello-world-missing-'));

        try {
            process.chdir(sandbox);

            const result = await toolHandler({});
            expect(result.isError).toBe(true);
            expect(result.content?.[0]?.type).toBe('text');
            expect(result.content?.[0]?.text).toContain('Error reading resource');
            expect(result.structuredContent?.mcpSdkVersion).toBe(MCP_SDK_VERSION);
            expect(result.structuredContent?.clientName).toBe('unknown');
            expect(result.structuredContent?.clientVersion).toBe('unknown');
        } finally {
            process.chdir(originalCwd);
        }
    });
});
