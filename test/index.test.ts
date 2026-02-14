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

    it('should catch initialization errors', async () => {
        const { initializeCopilotClient } = await import('../src/core/copilot-client.js');
        // Mock it to throw
        (initializeCopilotClient as jest.Mock).mockRejectedValueOnce(new Error('Init failed'));
        
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        
        const { main } = await import('../src/index.js');
        await main();
        
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('Copilot SDK initialization failed'), 
            expect.any(Error)
        );
        consoleSpy.mockRestore();
    });

    it('should register SIGINT handler', async () => {
        // Mock process.exit globally for this test
        // @ts-ignore
        const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});

        const processOnSpy = jest.spyOn(process, 'on').mockImplementation((event, listener) => {
            if (event === 'SIGINT') {
                // Execute the listener immediately to test coverage
                // Wait for the async listener to complete?
                // The listener in index.ts is async () => { await shutdown...; exit(0); }
                // So calling it returns a promise. We should await it.
                (listener as Function)();
            }
            return process;
        });

        const { shutdownCopilotClient } = await import('../src/core/copilot-client.js');
        const { main } = await import('../src/index.js');
        
        await main();

        expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
        
        // We know the listener was called due to our mock implementation.
        // It's async, so we might need to wait a tick? 
        // But the listener in index.ts is NOT awaited by anyone. It's just registered.
        // But our mock CALLS it synchronously. However, the listener BODY is async.
        // So `await shutdown...` inside listener yields execution.
        // Then process.exit happens on next tick.
        
        // Let's just wait a bit.
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(shutdownCopilotClient).toHaveBeenCalled();
        expect(exitSpy).toHaveBeenCalledWith(0);
        
        exitSpy.mockRestore();
        processOnSpy.mockRestore();
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
