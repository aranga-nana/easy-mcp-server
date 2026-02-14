import { jest } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerCodeReview } from '../../src/tools/code-review/index.js';

describe('code-review tool', () => {
    let server: McpServer;

    beforeEach(() => {
        server = new McpServer({ name: 'test', version: '1.0' });
    });

    it('should register the tool', () => {
        expect(() => registerCodeReview(server)).not.toThrow();
    });

    it('should register both tool names', async () => {
        let codeReviewHandler: any;
        let codeReviewAliasHandler: any;

        const toolSpy = jest.spyOn(server, 'registerTool').mockImplementation(((...args: any[]) => {
            const name = args[0] as string;
            const handler = args[2];
            if (name === 'code_review') {
                codeReviewHandler = handler;
            }
            if (name === 'code-review') {
                codeReviewAliasHandler = handler;
            }
            return server;
        }) as any);

        registerCodeReview(server);

        expect(toolSpy).toHaveBeenCalled();
        expect(codeReviewHandler).toBeDefined();
        expect(codeReviewAliasHandler).toBeDefined();
    });

    it('should return error when no files provided', async () => {
        let toolHandler: any;
        jest.spyOn(server, 'registerTool').mockImplementation(((...args: any[]) => {
            const name = args[0] as string;
            const handler = args[2];
            if (name === 'code_review') {
                toolHandler = handler;
            }
            return server;
        }) as any);

        registerCodeReview(server);
        expect(toolHandler).toBeDefined();

        const result = await toolHandler({ files: [] });
        expect(result.isError).toBe(true);
        expect(result.content?.[0]?.type).toBe('text');
        expect(result.content?.[0]?.text).toContain('No files provided');
    });

    it('should return error when too many files provided', async () => {
        let toolHandler: any;
        jest.spyOn(server, 'registerTool').mockImplementation(((...args: any[]) => {
            const name = args[0] as string;
            const handler = args[2];
            if (name === 'code_review') {
                toolHandler = handler;
            }
            return server;
        }) as any);

        registerCodeReview(server);
        expect(toolHandler).toBeDefined();

        const maxFiles = parseInt(process.env.CODE_REVIEW_MAX_FILES ?? '50', 10);
        const tooManyFiles = Array.from({ length: maxFiles + 1 }, (_, i) => ({
            name: `file${i}.ts`,
            content: 'const x = 1;'
        }));

        const result = await toolHandler({ files: tooManyFiles });
        expect(result.isError).toBe(true);
        expect(result.content?.[0]?.type).toBe('text');
        expect(result.content?.[0]?.text).toContain('Too many files');
        expect(result.content?.[0]?.text).toContain(`Maximum: ${maxFiles}`);
    });

    it('should return error when file is too large', async () => {
        let toolHandler: any;
        jest.spyOn(server, 'registerTool').mockImplementation(((...args: any[]) => {
            const name = args[0] as string;
            const handler = args[2];
            if (name === 'code_review') {
                toolHandler = handler;
            }
            return server;
        }) as any);

        registerCodeReview(server);
        expect(toolHandler).toBeDefined();

        const maxFileSize = parseInt(process.env.CODE_REVIEW_MAX_FILE_SIZE ?? '50000', 10);
        const largeContent = 'x'.repeat(maxFileSize + 1);

        const result = await toolHandler({
            files: [{ name: 'large.ts', content: largeContent }]
        });
        expect(result.isError).toBe(true);
        expect(result.content?.[0]?.type).toBe('text');
        expect(result.content?.[0]?.text).toContain('File too large');
        expect(result.content?.[0]?.text).toContain('large.ts');
    });

    it('should reject absolute file paths', async () => {
        let toolHandler: any;
        jest.spyOn(server, 'registerTool').mockImplementation(((...args: any[]) => {
            const name = args[0] as string;
            const handler = args[2];
            if (name === 'code_review') {
                toolHandler = handler;
            }
            return server;
        }) as any);

        registerCodeReview(server);
        expect(toolHandler).toBeDefined();

        const result = await toolHandler({
            files: [{ name: '/etc/passwd', content: 'malicious' }]
        });
        expect(result.isError).toBe(true);
        expect(result.content?.[0]?.type).toBe('text');
        expect(result.content?.[0]?.text).toContain('Invalid file path');
    });

    it('should reject directory traversal paths', async () => {
        let toolHandler: any;
        jest.spyOn(server, 'registerTool').mockImplementation(((...args: any[]) => {
            const name = args[0] as string;
            const handler = args[2];
            if (name === 'code_review') {
                toolHandler = handler;
            }
            return server;
        }) as any);

        registerCodeReview(server);
        expect(toolHandler).toBeDefined();

        const result = await toolHandler({
            files: [{ name: '../../../etc/passwd', content: 'malicious' }]
        });
        expect(result.isError).toBe(true);
        expect(result.content?.[0]?.type).toBe('text');
        expect(result.content?.[0]?.text).toContain('Invalid file path');
    });

    it('should return sample review for valid input', async () => {
        let toolHandler: any;
        jest.spyOn(server, 'registerTool').mockImplementation(((...args: any[]) => {
            const name = args[0] as string;
            const handler = args[2];
            if (name === 'code_review') {
                toolHandler = handler;
            }
            return server;
        }) as any);

        registerCodeReview(server);
        expect(toolHandler).toBeDefined();

        const result = await toolHandler({
            files: [
                { name: 'src/index.ts', content: 'const x = 1;\nconsole.log(x);' }
            ]
        });

        expect(result.isError).not.toBe(true);
        expect(result.content?.[0]?.type).toBe('text');
        expect(result.content?.[0]?.text).toContain('### src/index.ts');
        expect(result.content?.[0]?.text).toContain('✅ LGTM');
    });

    it('should return sample review for multiple files', async () => {
        let toolHandler: any;
        jest.spyOn(server, 'registerTool').mockImplementation(((...args: any[]) => {
            const name = args[0] as string;
            const handler = args[2];
            if (name === 'code_review') {
                toolHandler = handler;
            }
            return server;
        }) as any);

        registerCodeReview(server);
        expect(toolHandler).toBeDefined();

        const result = await toolHandler({
            files: [
                { name: 'src/index.ts', content: 'const x = 1;' },
                { name: 'src/utils.ts', content: 'export function add(a: number, b: number) { return a + b; }' }
            ]
        });

        expect(result.isError).not.toBe(true);
        expect(result.content?.[0]?.type).toBe('text');
        expect(result.content?.[0]?.text).toContain('### src/index.ts');
        expect(result.content?.[0]?.text).toContain('### src/utils.ts');
        expect(result.content?.[0]?.text).toContain('✅ LGTM');
    });

    it('should include file statistics in sample review', async () => {
        let toolHandler: any;
        jest.spyOn(server, 'registerTool').mockImplementation(((...args: any[]) => {
            const name = args[0] as string;
            const handler = args[2];
            if (name === 'code_review') {
                toolHandler = handler;
            }
            return server;
        }) as any);

        registerCodeReview(server);
        expect(toolHandler).toBeDefined();

        const fileContent = 'line1\nline2\nline3';
        const result = await toolHandler({
            files: [{ name: 'test.ts', content: fileContent }]
        });

        expect(result.isError).not.toBe(true);
        expect(result.content?.[0]?.type).toBe('text');
        expect(result.content?.[0]?.text).toContain('### test.ts');
        expect(result.content?.[0]?.text).toContain('✅ LGTM');
    });
});
