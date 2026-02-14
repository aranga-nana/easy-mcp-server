import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getEncoding } from 'js-tiktoken';

export function registerTokenizePrompt(server: McpServer) {
    server.registerTool(
        "tokenize-prompt",
        {
            description: "Tokenize a prompt",
            inputSchema: z.object({
                prompt: z.string()
            }),
            outputSchema: z.object({
                tokens: z.array(z.number()),
                count: z.number()
            })
        },
        async ({ prompt }) => {
            const enc = getEncoding("cl100k_base");
            const tokens = enc.encode(prompt);
            const structuredContent = {
                tokens: Array.from(tokens),
                count: tokens.length
            };
            return {
                content: [{ 
                    type: "text", 
                    text: JSON.stringify(structuredContent)
                }],
                structuredContent
            };
        }
    );
}
