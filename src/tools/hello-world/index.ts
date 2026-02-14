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
            }),
            outputSchema: z.object({
                message: z.string()
            })
        },
        async () => {
             try {
                console.log('HELLO WORLD TOOL EXECUTED');
                const filePath = join(process.cwd(), 'resources', 'hello-world', 'welcome.md');
                const content = await readFile(filePath, 'utf-8');
                return {
                    content: [{ type: "text", text: content }],
                    structuredContent: { message: content }
                };
             } catch (error) {
                 const message = `Error reading resource: ${(error as Error).message}`;
                 return {
                     isError: true,
                     content: [{ type: "text", text: message }],
                     structuredContent: { message }
                 };
             }
        }
    );
}
