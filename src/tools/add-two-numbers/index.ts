import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerAddTwoNumbers(server: McpServer) {
    server.registerTool(
        "add_two_numbers",
        {
            description: "Add two numbers",
            inputSchema: z.object({
                a: z.number(),
                b: z.number()
            })
        },
        async ({ a, b }) => {
            return {
                content: [{ type: "text", text: String(a + b) }]
            };
        }
    );
}
