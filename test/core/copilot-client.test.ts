import { jest } from '@jest/globals';
import { CopilotClient } from '@github/copilot-sdk';

// Mock dependencies
const mockAuth = jest.fn();
const mockCreateAppAuth = jest.fn(() => mockAuth);

// Mock SDK
const mockCopilotClientInstance = {
    start: jest.fn(),
    stop: jest.fn(),
    getAuthStatus: jest.fn(),
};

const mockCopilotClientConstructor = jest.fn(() => mockCopilotClientInstance);

// Set up ESM mocks *before* importing
jest.unstable_mockModule('@github/copilot-sdk', () => ({
    CopilotClient: mockCopilotClientConstructor
}));

jest.unstable_mockModule('@octokit/auth-app', () => ({
    createAppAuth: mockCreateAppAuth
}));

// Import module under test
const { 
    initializeCopilotClient, 
    getCopilotClient, 
    shutdownCopilotClient 
} = await import('../../src/core/copilot-client.js');

describe('CopilotClient Core', () => {
    // Save original env
    const originalEnv = process.env;

    beforeEach(async () => {
        process.env = { ...originalEnv };
        
        // Reset singleton state if possible. 
        // Since we can't easily access the private variable `clientInstance`, 
        // we rely on `shutdownCopilotClient` to null it out.
        await shutdownCopilotClient();

        jest.clearAllMocks();
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('should throw if getCopilotClient called before init', () => {
        expect(() => getCopilotClient()).toThrow('Copilot SDK client not initialized');
    });

    describe('GitHub App Authentication', () => {
        beforeEach(() => {
            process.env.GITHUB_APP_ID = '123';
            process.env.GITHUB_APP_PRIVATE_KEY = 'mock-key';
            process.env.GITHUB_APP_INSTALLATION_ID = '456';
        });

        it('should authenticate using GitHub App credentials', async () => {
            mockAuth.mockResolvedValue({ token: 'app-token' });
            (mockCopilotClientInstance.getAuthStatus as jest.Mock).mockResolvedValue({ isAuthenticated: true });

            const client = await initializeCopilotClient();

            expect(mockCreateAppAuth).toHaveBeenCalledWith({
                appId: '123',
                privateKey: 'mock-key',
                installationId: '456'
            });
            expect(mockAuth).toHaveBeenCalledWith({ type: 'installation' });
            expect(mockCopilotClientConstructor).toHaveBeenCalledWith(expect.objectContaining({
                githubToken: 'app-token'
            }));
            expect(client).toBe(mockCopilotClientInstance);
            expect(mockCopilotClientInstance.start).toHaveBeenCalled();
        });

        it('should handle escaped newlines in private key', async () => {
            process.env.GITHUB_APP_PRIVATE_KEY = 'line1\\nline2';
            mockAuth.mockResolvedValue({ token: 'app-token' });
            (mockCopilotClientInstance.getAuthStatus as jest.Mock).mockResolvedValue({ isAuthenticated: true });

            await initializeCopilotClient();

            expect(mockCreateAppAuth).toHaveBeenCalledWith(expect.objectContaining({
                privateKey: 'line1\nline2'
            }));
        });

        it('should fallback if App auth fails', async () => {
            mockAuth.mockRejectedValue(new Error('Auth failed'));
            // Set a fallback PAT so it still works, or it will try CLI
            process.env.COPILOT_GITHUB_TOKEN = 'pat-token';
            
            await initializeCopilotClient();

            // Tried App Auth
            expect(mockCreateAppAuth).toHaveBeenCalled();
            // Fell back to PAT
            expect(mockCopilotClientConstructor).toHaveBeenCalledWith(expect.objectContaining({
                githubToken: 'pat-token'
            }));
        });
    });

    describe('PAT Authentication', () => {
        it('should use COPILOT_GITHUB_TOKEN', async () => {
            process.env.COPILOT_GITHUB_TOKEN = 'pat-token';
            await initializeCopilotClient();
            expect(mockCopilotClientConstructor).toHaveBeenCalledWith(expect.objectContaining({
                githubToken: 'pat-token'
            }));
        });

        it('should use GITHUB_TOKEN', async () => {
            process.env.GITHUB_TOKEN = 'gh-token';
            await initializeCopilotClient();
            expect(mockCopilotClientConstructor).toHaveBeenCalledWith(expect.objectContaining({
                githubToken: 'gh-token'
            }));
        });
    });

    describe('CLI Authentication', () => {
        it('should use CLI auth (undefined token) if no env vars', async () => {
            delete process.env.GITHUB_APP_ID;
            delete process.env.COPILOT_GITHUB_TOKEN;
            delete process.env.GITHUB_TOKEN;
            delete process.env.GH_TOKEN;

            await initializeCopilotClient();

            // Constructor called with undefined githubToken
            expect(mockCopilotClientConstructor).toHaveBeenCalledWith(expect.objectContaining({
                githubToken: undefined
            }));
        });
    });

    describe('Singleton Behavior', () => {
        it('should return existing instance if already initialized', async () => {
            const client1 = await initializeCopilotClient();
            const client2 = await initializeCopilotClient();
            
            // Should not re-construct
            expect(mockCopilotClientConstructor).toHaveBeenCalledTimes(1);
            expect(client1).toBe(client2);
        });

        it('should return instance from getCopilotClient', async () => {
            const client1 = await initializeCopilotClient();
            expect(getCopilotClient()).toBe(client1);
        });
    });

    describe('Shutdown', () => {
        it('should stop client and clear instance', async () => {
            await initializeCopilotClient();
            await shutdownCopilotClient();

            expect(mockCopilotClientInstance.stop).toHaveBeenCalled();
            expect(() => getCopilotClient()).toThrow();
        });

        it('should handle stop errors gracefully', async () => {
            await initializeCopilotClient();
            (mockCopilotClientInstance.stop as jest.Mock).mockRejectedValue(new Error('Stop failed'));
            
            // Should not throw
            await expect(shutdownCopilotClient()).resolves.not.toThrow();
            // Should still allow re-init (instance cleared)
            await initializeCopilotClient();
            expect(mockCopilotClientConstructor).toHaveBeenCalledTimes(2);
        });

        it('should do nothing if not running', async () => {
            await shutdownCopilotClient();
            expect(mockCopilotClientInstance.stop).not.toHaveBeenCalled();
        });
    });

    describe('Startup Errors', () => {
         it('should throw if SDK constructor throws', async () => {
             // We need to override the mock for this single test
             mockCopilotClientConstructor.mockImplementationOnce(() => {
                 throw new Error('SDK Init Error');
             });

             await expect(initializeCopilotClient()).rejects.toThrow('SDK Init Error');
         });

         it('should log warning if auth check fails but not throw', async () => {
             (mockCopilotClientInstance.getAuthStatus as jest.Mock).mockResolvedValue({ 
                 isAuthenticated: false,
                 statusMessage: 'Not logged in' 
             });

             await expect(initializeCopilotClient()).resolves.not.toThrow();
         });
         
         it('should log warning if auth check throws', async () => {
            (mockCopilotClientInstance.getAuthStatus as jest.Mock).mockRejectedValue(new Error('Auth Check Fail'));

            await expect(initializeCopilotClient()).resolves.not.toThrow();
        });
    });
});
