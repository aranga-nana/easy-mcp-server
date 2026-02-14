import { jest } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Mock types
type MockCopilotClient = {
    getAuthStatus: jest.Mock<any>;
    createSession: jest.Mock<any>;
    start: jest.Mock<any>;
    stop: jest.Mock<any>;
};

type MockCopilotSession = {
    sendAndWait: jest.Mock<any>;
    destroy: jest.Mock<any>;
};

// Define mocks before imports
const mockSession = {
    sendAndWait: jest.fn(),
    destroy: jest.fn()
};

const mockClient = {
    getAuthStatus: jest.fn(),
    createSession: jest.fn(),
    start: jest.fn(),
    stop: jest.fn()
};

// Setup ESM mocks
const mockGetCopilotClient = jest.fn(() => mockClient);
jest.unstable_mockModule('../../src/core/copilot-client.js', () => ({
    getCopilotClient: mockGetCopilotClient,
    initializeCopilotClient: jest.fn(),
    shutdownCopilotClient: jest.fn()
}));

// Import module under test after mocking
const { registerCodeReview } = await import('../../src/tools/code-review/index.js');
const { getCopilotClient } = await import('../../src/core/copilot-client.js');

describe('code-review tool', () => {
    let server: McpServer;

    beforeEach(() => {
        server = new McpServer({ name: 'test', version: '1.0' });
        jest.clearAllMocks();
        
        // Default happy path mocks
        mockClient.getAuthStatus.mockResolvedValue({ 
            isAuthenticated: true, 
            statusMessage: 'Authenticated' 
        });
        mockClient.start.mockResolvedValue(undefined);
        mockClient.stop.mockResolvedValue(undefined);
        mockClient.createSession.mockResolvedValue(mockSession);
        
        mockSession.sendAndWait.mockResolvedValue({
            data: { content: '✅ LGTM' }
        });
        mockSession.destroy.mockResolvedValue(undefined);
        
        // Reset the main factory mock to return the happy client
        (getCopilotClient as jest.Mock).mockImplementation(() => mockClient);
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

    it('should return error if not authenticated', async () => {
        mockClient.getAuthStatus.mockResolvedValue({ isAuthenticated: false, statusMessage: 'Not logged in' });

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
        
        const result = await toolHandler({
            files: [{ name: 'test.ts', content: 'code' }]
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Authentication failed');
    });

    it('should return review when authenticated', async () => {
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
        
        const result = await toolHandler({
            files: [{ name: 'test.ts', content: 'code' }]
        });

        expect(result.isError).toBeFalsy();
        expect(result.content[0].text).toBe('✅ LGTM');
        expect(mockClient.createSession).toHaveBeenCalled();
        expect(mockSession.sendAndWait).toHaveBeenCalled();
    });

    it('should return error when getCopilotClient throws', async () => {
        (getCopilotClient as jest.Mock).mockImplementationOnce(() => {
            throw new Error('SDK initialization failed');
        });

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
        
        const result = await toolHandler({
            files: [{ name: 'test.ts', content: 'code' }]
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Failed to get Copilot client');
    });

    it('should handle createSession failure', async () => {
        mockClient.createSession.mockRejectedValueOnce(new Error('Session creation error'));

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
        
        const result = await toolHandler({
            files: [{ name: 'test.ts', content: 'code' }]
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Failed to initialize review session');
    });

    it('should handle session.sendAndWait generic failure', async () => {
        mockSession.sendAndWait.mockRejectedValueOnce(new Error('Generic network error'));

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
        
        const result = await toolHandler({
            files: [{ name: 'test.ts', content: 'code' }]
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Review failed: Generic network error');
    });

    it('should handle session.sendAndWait 401 failure', async () => {
        mockSession.sendAndWait.mockRejectedValueOnce(new Error('HTTP 401 Unauthorized'));

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
        
        const result = await toolHandler({
            files: [{ name: 'test.ts', content: 'code' }]
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Authentication or connection failed');
    });

    it('should return error when getCopilotClient throws non-Error', async () => {
        (getCopilotClient as jest.Mock).mockImplementationOnce(() => {
            throw 'String failure';
        });

        let toolHandler: any;
        jest.spyOn(server, 'registerTool').mockImplementation(((...args: any[]) => {
            if (args[0] === 'code_review') toolHandler = args[2];
            return server;
        }) as any);

        registerCodeReview(server);
        
        const result = await toolHandler({
            files: [{ name: 'test.ts', content: 'code' }]
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('String failure');
    });

    it('should handle undefined statusMessage', async () => {
        mockClient.getAuthStatus.mockResolvedValueOnce({ isAuthenticated: false, statusMessage: undefined });

        let toolHandler: any;
        jest.spyOn(server, 'registerTool').mockImplementation(((...args: any[]) => {
            if (args[0] === 'code_review') toolHandler = args[2];
            return server;
        }) as any);

        registerCodeReview(server);
        
        const result = await toolHandler({
            files: [{ name: 'test.ts', content: 'code' }]
        });

        expect(result.content[0].text).toContain('Not logged in');
    });

    it('should handle empty review response', async () => {
        mockSession.sendAndWait.mockResolvedValueOnce({}); // No data

        let toolHandler: any;
        jest.spyOn(server, 'registerTool').mockImplementation(((...args: any[]) => {
            if (args[0] === 'code_review') toolHandler = args[2];
            return server;
        }) as any);

        registerCodeReview(server);
        
        const result = await toolHandler({
            files: [{ name: 'test.ts', content: 'code' }]
        });

        expect(result.content[0].text).toContain('Review completed (no text output)');
    });

    it('should handle sendAndWait non-Error failure', async () => {
        mockSession.sendAndWait.mockRejectedValueOnce('Network String Error');

        let toolHandler: any;
        jest.spyOn(server, 'registerTool').mockImplementation(((...args: any[]) => {
            if (args[0] === 'code_review') toolHandler = args[2];
            return server;
        }) as any);

        registerCodeReview(server);
        
        const result = await toolHandler({
            files: [{ name: 'test.ts', content: 'code' }]
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Network String Error');
    });

    it('should handle alternate connection errors', async () => {
        mockSession.sendAndWait.mockRejectedValueOnce(new Error('Unix socket error'));

        let toolHandler: any;
        jest.spyOn(server, 'registerTool').mockImplementation(((...args: any[]) => {
            if (args[0] === 'code_review') toolHandler = args[2];
            return server;
        }) as any);

        registerCodeReview(server);
        
        const result = await toolHandler({
            files: [{ name: 'test.ts', content: 'code' }]
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Authentication or connection failed');
    });

    it('should handle createSession non-Error failure', async () => {
        mockClient.createSession.mockRejectedValueOnce('Critical String Fail');

        let toolHandler: any;
        jest.spyOn(server, 'registerTool').mockImplementation(((...args: any[]) => {
            if (args[0] === 'code_review') toolHandler = args[2];
            return server;
        }) as any);

        registerCodeReview(server);
        
        const result = await toolHandler({
            files: [{ name: 'test.ts', content: 'code' }]
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Critical String Fail');
    });
});
