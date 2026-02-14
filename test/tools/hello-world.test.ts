import { jest } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerHelloWorld } from '../../src/tools/hello-world/index.js';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { MCP_SDK_VERSION } from '../../src/meta.js';
import { runWithRequestContext } from '../../src/core/request-context.js';

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
});
