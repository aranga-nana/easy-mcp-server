import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { CopilotClient } from '@github/copilot-sdk';
import { getCopilotClient } from '../../core/copilot-client.js';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Helper to get directory of current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const MAX_FILES = parseInt(process.env.CODE_REVIEW_MAX_FILES ?? '50', 10);
const MAX_FILE_SIZE = parseInt(process.env.CODE_REVIEW_MAX_FILE_SIZE ?? '50000', 10);
const REVIEW_TIMEOUT = parseInt(process.env.CODE_REVIEW_TIMEOUT ?? '60000', 10);
const REVIEW_MODEL = process.env.CODE_REVIEW_MODEL ?? 'claude-sonnet-4.5';

// Input schema - client sends file names and content
const inputSchema = z.object({
    files: z.array(z.object({
        name: z.string().describe('File path (relative to workspace root)'),
        content: z.string().describe('Full file content to review')
    }))
    .min(1)
    .max(MAX_FILES)
    .describe('Array of files to review. Client must provide file names and content. Maximum 50 files per review.')
});

type CodeReviewInput = z.infer<typeof inputSchema>;

async function getReviewStandards(): Promise<string> {
    try {
        const standardsPath = join(__dirname, '../../../../resources/code-review/standards.md');
        return await readFile(standardsPath, 'utf-8');
    } catch {
        console.warn('Failed to load standards.md, using fallback.');
        return `# Code Review Standards (Fallback)

## General Principles
- Ensure code readability and maintainability
- Check for proper error handling
- Verify type safety and avoid \`any\`
- Look for security vulnerabilities
- Assess performance implications

## Specific Checks
- All public functions should have JSDoc comments
- Use Zod for input validation
- Prefer \`execFile\` over \`exec\` for child processes
- No hardcoded credentials or secrets`;
    }
}

export function registerCodeReview(server: McpServer) {
    const toolDescription = 'Review code changes against project standards using AI-powered analysis. Send file names and content for intelligent review.';
    
    const handler = async (input: CodeReviewInput) => {
        const { files } = input;

        // Validate input
        if (!files || files.length === 0) {
            return {
                isError: true,
                content: [{
                    type: 'text' as const,
                    text: 'No files provided. Client must send file names and content.'
                }]
            };
        }

        // Enforce file count limit
        if (files.length > MAX_FILES) {
            return {
                isError: true,
                content: [{
                    type: 'text' as const,
                    text: `Too many files (${files.length}). Maximum: ${MAX_FILES}`
                }]
            };
        }

        // Validate file sizes and paths
        for (const file of files) {
            // Check file size
            if (file.content.length > MAX_FILE_SIZE) {
                return {
                    isError: true,
                    content: [{
                        type: 'text' as const,
                        text: `File too large: ${file.name} (${file.content.length} bytes, max: ${MAX_FILE_SIZE})`
                    }]
                };
            }

            // Validate file path (reject absolute paths and directory traversal)
            if (file.name.includes('..') || file.name.startsWith('/')) {
                return {
                    isError: true,
                    content: [{
                        type: 'text' as const,
                        text: `Invalid file path: ${file.name}`
                    }]
                };
            }
            
        }

        const standardsContent = await getReviewStandards();

        const taskInstructions = `
You are a senior code reviewer.
Apply these standards exactly:
${standardsContent}

Return concise, actionable findings grouped by severity.
Include suggested patch snippets when useful.
`;

        const reviewPayload = `Review these files:\n\n` +
            files.map((f) => `## ${f.name}\n\`\`\`typescript\n${f.content}\n\`\`\``).join('\n\n');

        let client: CopilotClient;
        try {
            client = getCopilotClient();
        } catch (e: unknown) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            return {
                isError: true,
                content: [{
                    type: 'text' as const,
                    text: `Failed to get Copilot client: ${errorMsg}. Copilot SDK may have failed to initialize.`
                }]
            };
        }

        try {
            // Verify authentication status explicitly
            const authStatus = await client.getAuthStatus();
            if (!authStatus.isAuthenticated) {
                return {
                    isError: true,
                    content: [{
                        type: 'text' as const,
                        text: `Authentication failed. Please run \`copilot auth login\` or set the COPILOT_GITHUB_TOKEN environment variable.\nStatus: ${authStatus.statusMessage || 'Not logged in'}`
                    }]
                };
            }

            const session = await client.createSession({
                model: REVIEW_MODEL,
                systemMessage: {
                    content: taskInstructions
                }
            });
            
            try {
                const reviewResponse = await session.sendAndWait(
                    { prompt: reviewPayload },
                    REVIEW_TIMEOUT
                );
                
                const reviewText = reviewResponse?.data?.content ?? 'Review completed (no text output).';
                
                return {
                    content: [{
                        type: 'text' as const,
                        text: reviewText
                    }]
                };
            } catch (err: unknown) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                
                // Still catch underlying connection errors as backup
                if (errorMessage.includes('401') || errorMessage.includes('Unix socket') || errorMessage.includes('fetch failed')) {
                     return {
                        isError: true,
                        content: [{
                            type: 'text' as const,
                            text: `Authentication or connection failed. Please run \`copilot auth login\` or set COPILOT_GITHUB_TOKEN.\nDetails: ${errorMessage}`
                        }]
                    };
                }

                return {
                    isError: true,
                    content: [{
                        type: 'text' as const,
                        text: `Review failed: ${errorMessage}`
                    }]
                };

            } finally {
                await session.destroy();
            }
        } catch (err: unknown) {
             const errorMessage = err instanceof Error ? err.message : String(err);
             return {
                isError: true,
                content: [{
                    type: 'text' as const,
                    text: `Failed to initialize review session: ${errorMessage}. Ensure Copilot CLI is installed and running.`
                }]
            };
        }
    };

    // Register primary tool name
    server.registerTool('code_review', {
        description: toolDescription,
        inputSchema
    }, handler);

    // Register kebab-case alias for UX consistency
    server.registerTool('code-review', {
        description: toolDescription,
        inputSchema
    }, handler);
}
