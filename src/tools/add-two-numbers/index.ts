import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const sumOutputSchema = z.object({
    sum: z.number()
});

const promptInputSchema = z.object({
    prompt: z
        .string()
        .min(1)
        .describe('Full user prompt text (server extracts the first two numbers)')
});

function sumResult(sum: number) {
    return {
        content: [{ type: 'text' as const, text: String(sum) }],
        structuredContent: { sum }
    };
}

function sumError(message: string) {
    return {
        isError: true,
        content: [{ type: 'text' as const, text: message }]
    };
}

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
    const sumFromPrompt = async ({ prompt }: { prompt: string }) => {
        const parsed = parseTwoNumbersFromPrompt(prompt);
        if ('error' in parsed) {
            return sumError(parsed.error);
        }

        return sumResult(parsed.a + parsed.b);
    };

    server.registerTool(
        "add_two_numbers",
        {
            description:
                'Add two numbers from the full user prompt (add/sum/plus/total). ' +
                'Client MUST pass the full user message as { prompt }. ' +
                'Example prompts: "please add following number 10 and 7", "add 10 and 20".',
            inputSchema: promptInputSchema,
            outputSchema: sumOutputSchema
        },
        sumFromPrompt
    );

    // Optional Copilot UX alias: accepts a single prompt so the server extracts two numbers.
    server.registerTool(
        'add-two-numbers',
        {
            description:
                'Alias of add_two_numbers for Copilot UX. ' +
                'Send the full user prompt as { prompt } and the server extracts the first two numbers and returns the sum.',
            inputSchema: promptInputSchema,
            outputSchema: sumOutputSchema
        },
        sumFromPrompt
    );
}
