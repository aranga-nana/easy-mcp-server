import { DEFAULT_PORT, DEFAULT_HOST } from '../src/meta.js';

// Mock server.js first
const mockListen = jest.fn((port, host, cb) => cb && cb());
const mockApp = {
    listen: mockListen,
    post: jest.fn(),
    get: jest.fn(),
    delete: jest.fn()
};
const mockMcpServer = {
    tool: jest.fn()
};

jest.mock('../src/core/server.js', () => ({
    createServer: jest.fn().mockResolvedValue({
        app: mockApp,
        mcpServer: mockMcpServer
    })
}));

// Mock console.log and error to keep output clean and verify calls
const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

jest.mock('chalk', () => ({
    green: jest.fn((str) => str),
    blue: jest.fn((str) => str),
    bold: jest.fn((str) => str),
    yellow: jest.fn((str) => str)
}));

jest.mock('figlet', () => ({
    textSync: jest.fn((str) => str)
}));

describe('Entry Entry Point (index.ts)', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should start the server and register tools', async () => {
        // We need to import the module dynamically to trigger the main function execution
        // Since main() is called immediately in index.ts
        
        // Reset modules so index.ts runs again
        jest.resetModules();
        
        // We re-apply mocks because resetModules clears the mock factory ?? 
        // No, verify if jest.mock persists across resetModules. 
        // Actually, jest.mock is hoisted. But when using resetModules, we might need to rely on the module cache being cleared.
        
        // Re-require to run the file
        await import('../src/index.js');
        
        // Wait a tick for async main to complete
        await new Promise(resolve => setTimeout(resolve, 100));

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        expect(require('../src/core/server.js').createServer).toHaveBeenCalled();
        expect(mockListen).toHaveBeenCalledWith(DEFAULT_PORT, DEFAULT_HOST, expect.any(Function));
        
        // Verify tool registration
        // We can't easily spy on registerAddTwoNumbers unless we mock that module too, 
        // but we can check if mcpServer.tool was called which registerAddTwoNumbers does.
        expect(mockMcpServer.tool).toHaveBeenCalledWith("add_two_numbers", expect.any(Object), expect.any(Function));
        
        // Verify console output (server banner)
        expect(consoleLogSpy).toHaveBeenCalled();
    });
});
