import { jest } from '@jest/globals';
import { DEFAULT_PORT, DEFAULT_HOST } from '../src/meta.js';
import { fileURLToPath } from 'node:url';

describe('Index Entry Point', () => {
    let mockListen: any;
    let createMcpServerMock: any;
    let createHttpServerMock: any;
    let registerToolsMock: any;
    let mockMcpServer: any;
    let mockApp: any;

    beforeEach(async () => {
        jest.resetModules();
        mockListen = jest.fn((port: any, host: any, cb: any) => cb && cb());
        mockApp = { listen: mockListen };
        mockMcpServer = {};

        createMcpServerMock = jest.fn().mockReturnValue(mockMcpServer);
        createHttpServerMock = jest.fn().mockReturnValue({ app: mockApp });
        registerToolsMock = jest.fn();

        jest.unstable_mockModule('../src/core/mcp-server.js', () => ({
            createMcpServer: createMcpServerMock
        }));
        jest.unstable_mockModule('../src/core/transport.js', () => ({
            createHttpServer: createHttpServerMock
        }));
        jest.unstable_mockModule('../src/tools/index.js', () => ({
            registerTools: registerToolsMock,
            REGISTERED_TOOL_NAMES: ['add-two-numbers', 'welcome', 'greeting', 'hello-world']
        }));

        jest.unstable_mockModule('../src/core/copilot-client.js', () => ({
            initializeCopilotClient: jest.fn().mockResolvedValue(true),
            shutdownCopilotClient: jest.fn().mockResolvedValue(true)
        }));

        jest.unstable_mockModule('chalk', () => ({
            default: {
                blue: (s: string) => s,
                bold: (s: string) => s,
                cyan: (s: string) => s,
                green: (s: string) => s,
                yellow: (s: string) => s,
                rgb: () => (s: string) => s,
            }
        }));

        jest.unstable_mockModule('figlet', () => ({
            default: {
                textSync: (s: string) => s,
            }
        }));
    });

    it('should start server and register tools', async () => {
        // Import after mocks are set.
        const mod = await import('../src/index.js');
        await mod.main();

        expect(createHttpServerMock).toHaveBeenCalledWith(expect.any(Function));
        
        // Get the factory function passed to createHttpServer
        const factory = createHttpServerMock.mock.calls[0][0];
        const server = factory();
        
        expect(createMcpServerMock).toHaveBeenCalled();
        expect(registerToolsMock).toHaveBeenCalledWith(mockMcpServer);
        expect(server).toBe(mockMcpServer);
        
        expect(mockListen).toHaveBeenCalledWith(DEFAULT_PORT, DEFAULT_HOST, expect.any(Function));
    });

    it('should auto-run when executed as main script', async () => {
        const originalArgv1 = process.argv[1];
        try {
            process.argv[1] = fileURLToPath(new URL('../src/index.ts', import.meta.url));
            await import('../src/index.js');
        } finally {
            process.argv[1] = originalArgv1;
        }

        expect(mockListen).toHaveBeenCalledWith(DEFAULT_PORT, DEFAULT_HOST, expect.any(Function));
    });

    it('should not crash when argv[1] is falsy', async () => {
        const originalArgv1 = process.argv[1];
        try {
            process.argv[1] = '';
            await import('../src/index.js');
        } finally {
            process.argv[1] = originalArgv1;
        }
    });
});
