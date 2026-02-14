import { jest } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerHelloWorld } from '../../src/tools/hello-world/index.js';
import { readFile } from 'fs/promises';
import { join } from 'path';

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
        const toolSpy = jest.spyOn(server, 'tool').mockImplementation(((...args: any[]) => {
            const name = args[0] as string;
            const handler = args[2];
             if (name === 'hello-world') {
                 toolHandler = handler;
             }
             return server;
        }) as any);

        registerHelloWorld(server);

        expect(toolHandler).toBeDefined();

        // Call the handler
        const result = await toolHandler({ prompt: 'hi' });
        
        // Read expected content
        const filePath = join(process.cwd(), 'resources', 'hello-world', 'welcome.md');
        const expectedContent = await readFile(filePath, 'utf-8');

        expect(result).toEqual({
            content: [{ type: "text", text: expectedContent }]
        });
    });
});
