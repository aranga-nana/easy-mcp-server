import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

function parseTwoNumbersFromPrompt(prompt: string): { a: number; b: number } | { error: string } {
    const matches = prompt.match(/-?\d+(?:\.\d+)?/g) ?? [];
    if (matches.length < 2) {
        return { error: 'Please provide at least two numbers.' };
    }
    const a = Number(matches[0]);
    const b = Number(matches[1]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
        return { error: 'Parsed numbers are not valid.' };
    }
    return { a, b };
}

export function registerAddTwoNumbers(server: McpServer) {
    server.registerTool(
        "add_two_numbers",
        {
            description: "Add two numbers",
            inputSchema: z.object({
                a: z.number(),
                b: z.number()
            }),
            outputSchema: z.object({
                sum: z.number()
            })
        },
        async ({ a, b }) => {
            const sum = a + b;
            return {
                content: [{ type: "text", text: String(sum) }],
                structuredContent: { sum }
            };
        }
    );

    // Optional Copilot UX alias: accepts a single prompt so the server extracts two numbers.
    server.registerTool(
        'add-two-numbers',
        {
            description: 'Add two numbers extracted from a prompt',
            inputSchema: z.object({
                prompt: z.string().describe('User prompt containing two numbers')
            }),
            outputSchema: z.object({
                sum: z.number()
            })
        },
        async ({ prompt }) => {
            const parsed = parseTwoNumbersFromPrompt(prompt);
            if ('error' in parsed) {
                return {
                    isError: true,
                    content: [{ type: 'text', text: parsed.error }]
                };
            }

            const sum = parsed.a + parsed.b;
            return {
                content: [{ type: 'text', text: String(sum) }],
                structuredContent: { sum }
            };
        }
    );
}
