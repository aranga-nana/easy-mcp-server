import { jest } from '@jest/globals';
import { DEFAULT_PORT, DEFAULT_HOST } from '../src/meta.js';

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
            REGISTERED_TOOL_NAMES: ['hello-world']
        }));

        await import('../src/index.js');
        // Wait for async execution
        await new Promise(process.nextTick);
    });

    it('should start server and register tools', () => {
        expect(createHttpServerMock).toHaveBeenCalledWith(expect.any(Function));
        
        // Get the factory function passed to createHttpServer
        const factory = createHttpServerMock.mock.calls[0][0];
        const server = factory();
        
        expect(createMcpServerMock).toHaveBeenCalled();
        expect(registerToolsMock).toHaveBeenCalledWith(mockMcpServer);
        expect(server).toBe(mockMcpServer);
        
        expect(mockListen).toHaveBeenCalledWith(DEFAULT_PORT, DEFAULT_HOST, expect.any(Function));
    });
});
