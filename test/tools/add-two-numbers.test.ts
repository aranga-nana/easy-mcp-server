import { jest } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAddTwoNumbers } from '../../src/tools/add-two-numbers/index.js';

describe('add_two_numbers tool', () => {
    let server: McpServer;

    beforeEach(() => {
        server = new McpServer({ name: 'test', version: '1.0' });
    });

    it('should register the tool', () => {
        // We can't easily inspect internal registered tools without calling them or checking private state.
        // But we can verify it doesn't throw.
        expect(() => registerAddTwoNumbers(server)).not.toThrow();
    });

    // To test execution, we would need to mock the tool callback execution which is hidden inside McpServer.
    // However, McpServer usually exposes a way to call a tool or we can inspect it.
    // For coverage of the *registration function*, calling it is enough.
    // For coverage of the *handler*, we need to trigger it.
    
    // We can "spy" on server.tool to capture the handler.
    it('should calculate sum correctly', async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let canonicalHandler: any;
        let aliasHandler: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const toolSpy = jest.spyOn(server, 'registerTool').mockImplementation(((...args: any[]) => {
            const name = args[0] as string;
            const handler = args[2];
             if (name === 'add_two_numbers') {
                 canonicalHandler = handler;
             }
             if (name === 'add-two-numbers') {
                 aliasHandler = handler;
             }
             return server;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any);

        registerAddTwoNumbers(server);
        
        expect(toolSpy).toHaveBeenCalled();
        expect(canonicalHandler).toBeDefined();
        expect(aliasHandler).toBeDefined();

        const result = await canonicalHandler({ a: 10, b: 20 });
        expect(result).toEqual({
            content: [{ type: "text", text: "30" }],
            structuredContent: { sum: 30 }
        });

        const aliasResult = await aliasHandler({ prompt: 'add 10 and 20' });
        expect(aliasResult).toEqual({
            content: [{ type: 'text', text: '30' }],
            structuredContent: { sum: 30 }
        });

        const aliasError = await aliasHandler({ prompt: 'add ten and twenty' });
        expect(aliasError.isError).toBe(true);
        expect(aliasError.content?.[0]?.type).toBe('text');
    });
});
