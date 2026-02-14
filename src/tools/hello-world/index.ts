import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readFile } from 'fs/promises';
import { join } from 'path';

export function registerHelloWorld(server: McpServer) {
    server.registerTool(
        "hello-world",
        {
            description: "Get a welcome message",
            inputSchema: z.object({
                prompt: z.string().describe("The prompt from the user")
            })
        },
        async () => {
             try {
                console.log('HELLO WORLD TOOL EXECUTED');
                const filePath = join(process.cwd(), 'resources', 'hello-world', 'welcome.md');
                const content = await readFile(filePath, 'utf-8');
                return {
                    content: [{ type: "text", text: content }]
                };
             } catch (error) {
                 return {
                     isError: true,
                     content: [{ type: "text", text: `Error reading resource: ${(error as Error).message}` }]
                 };
             }
        }
    );
}
