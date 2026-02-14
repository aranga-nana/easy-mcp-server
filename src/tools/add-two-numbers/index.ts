import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerAddTwoNumbers(server: McpServer) {
    server.tool(
        "add_two_numbers",
        { a: z.number(), b: z.number() },
        async ({ a, b }) => {
            return {
                content: [{ type: "text", text: String(a + b) }]
            };
        }
    );
}
