import { jest } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTokenizePrompt } from '../../src/tools/tokenize-prompt/index.js';

describe('tokenize-prompt tool', () => {
    let server: McpServer;

    beforeEach(() => {
        server = new McpServer({ name: 'test', version: '1.0' });
    });

    it('should register the tool', () => {
        expect(() => registerTokenizePrompt(server)).not.toThrow();
    });

    it('should tokenize prompt correctly', async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let toolHandler: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const toolSpy = jest.spyOn(server, 'registerTool').mockImplementation(((...args: any[]) => {
            const name = args[0] as string;
            const handler = args[2];
             if (name === 'tokenize-prompt') {
                 toolHandler = handler;
             }
             return server;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any);

        registerTokenizePrompt(server);
        
        expect(toolSpy).toHaveBeenCalled();
        expect(toolHandler).toBeDefined();

        const result = await toolHandler({ prompt: "Hello world" });
        const content = JSON.parse(result.content[0].text);
        
        expect(content.tokens).toBeDefined();
        expect(Array.isArray(content.tokens)).toBe(true);
        expect(content.count).toBeGreaterThan(0);
        // "Hello world" is usually [9906, 1917] or similar depending on encoding.
        // We just verify structure and non-empty.
        expect(content.count).toBe(2); 

        expect(result.structuredContent).toBeDefined();
        expect(result.structuredContent.count).toBe(2);
    });
});
