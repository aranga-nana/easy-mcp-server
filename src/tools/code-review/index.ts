import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// Configuration
const MAX_FILES = parseInt(process.env.CODE_REVIEW_MAX_FILES ?? '50', 10);
const MAX_FILE_SIZE = parseInt(process.env.CODE_REVIEW_MAX_FILE_SIZE ?? '50000', 10);

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

/**
 * Generate hardcoded sample review data
 * TODO: Replace with actual Copilot SDK integration
 */
function generateSampleReview(files: CodeReviewInput['files']): string {
    const fileList = files.map(f => `- ${f.name}`).join('\n');
    
    return `# Code Review Summary

## Overview
Reviewed ${files.length} file${files.length > 1 ? 's' : ''}:
${fileList}

## Overall Assessment
✅ **Status**: Sample review generated successfully

This is a **placeholder response**. The actual implementation will use the Copilot SDK to perform intelligent code review based on project standards.

## Files Analyzed

${files.map(f => `### ${f.name}
- **Size**: ${f.content.length} bytes
- **Lines**: ${f.content.split('\n').length}
- **Status**: Received and validated
`).join('\n')}

## Next Steps

The full implementation will:
1. Load review standards from \`resources/code-review/standards.md\`
2. Initialize Copilot SDK client and session
3. Send files + standards to the model for analysis
4. Return structured review with:
   - 🔴 Critical Issues
   - 🟡 Warnings
   - 🟢 Suggestions
   - ✨ Positive Observations

---
*This is a sample response. Full implementation pending.*`;
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

        // TODO: Implement actual Copilot SDK integration
        // For now, return hardcoded sample review
        const reviewText = generateSampleReview(files);

        return {
            content: [{
                type: 'text' as const,
                text: reviewText
            }]
        };
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
