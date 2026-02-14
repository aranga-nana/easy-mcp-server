import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { MCP_SDK_VERSION } from '../../meta.js';
import { getRequestContext } from '../../core/request-context.js';

export function registerHelloWorld(server: McpServer) {
    const outputSchema = z.object({
        message: z.string(),
        mcpSdkVersion: z.string(),
        clientName: z.string(),
        clientVersion: z.string()
    });

    const handler = async () => {
             try {
                console.log('HELLO WORLD TOOL EXECUTED');
                const ctx = getRequestContext();
                const clientName = ctx?.clientInfo?.name ?? 'unknown';
                const clientVersion = ctx?.clientInfo?.version ?? 'unknown';

                const primaryPath = join(process.cwd(), 'resources', 'hello-world', 'welcome.md');
                let welcome: string;
                try {
                    welcome = await readFile(primaryPath, 'utf-8');
                } catch {
                    const fallbackPath = join(process.cwd(), 'dist', 'resources', 'hello-world', 'welcome.md');
                    welcome = await readFile(fallbackPath, 'utf-8');
                }

                const message = `${welcome}\n\nMCP SDK Version: ${MCP_SDK_VERSION}\nClient: ${clientName} ${clientVersion}`;
                return {
                    content: [{ type: 'text' as const, text: message }],
                    structuredContent: {
                        message: welcome,
                        mcpSdkVersion: MCP_SDK_VERSION,
                        clientName,
                        clientVersion
                    }
                };
             } catch (error) {
                 const message = `Error reading resource: ${(error as Error).message}`;
                 return {
                     isError: true,
                     content: [{ type: 'text' as const, text: message }],
                     structuredContent: {
                         message,
                         mcpSdkVersion: MCP_SDK_VERSION,
                         clientName: 'unknown',
                         clientVersion: 'unknown'
                     }
                 };
             }
    };

    const description =
        'Greeting/welcome tool. Returns welcome.md plus MCP SDK version and client (Copilot plugin) name/version. ' +
        'Invoke for any greeting such as: hello, hi, hey, welcome, good morning/afternoon/evening. ' +
        'IMPORTANT: Clients should call this tool for greetings instead of generating a generic response.';

    const toolsToRegister = ['hello-world', 'welcome', 'greeting'] as const;
    for (const name of toolsToRegister) {
        server.registerTool(
            name,
            {
                title: 'Greeting / Welcome',
                description,
                inputSchema: z.object({}),
                outputSchema,
                annotations: {
                    title: 'Greeting / Welcome',
                    readOnlyHint: true,
                    destructiveHint: false,
                    idempotentHint: true,
                    openWorldHint: false
                },
                _meta: {
                    intent: 'greeting',
                    examples: ['hello', 'welcome', 'good morning', 'hey there']
                }
            },
            handler
        );
    }
}
