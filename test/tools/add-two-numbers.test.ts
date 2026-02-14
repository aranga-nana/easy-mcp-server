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
        let toolHandler: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const toolSpy = jest.spyOn(server, 'tool').mockImplementation(((...args: any[]) => {
            const name = args[0] as string;
            const handler = args[2];
             if (name === 'add_two_numbers') {
                 toolHandler = handler;
             }
             return server;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any);

        registerAddTwoNumbers(server);
        
        expect(toolSpy).toHaveBeenCalled();
        expect(toolHandler).toBeDefined();

        const result = await toolHandler({ a: 10, b: 20 });
        expect(result).toEqual({
            content: [{ type: "text", text: "30" }]
        });
    });
});
