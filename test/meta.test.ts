import { jest } from '@jest/globals';

describe('meta MCP_SDK_VERSION', () => {
    afterEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    it('returns "unknown" when SDK resolution fails', async () => {
        jest.resetModules();

        jest.unstable_mockModule('node:module', () => ({
            createRequire: () => ({
                resolve: () => {
                    throw new Error('cannot resolve');
                }
            })
        }));

        const meta = await import('../src/meta.js');
        expect(meta.MCP_SDK_VERSION).toBe('unknown');
    });

    it('returns "unknown" when package.json cannot be read', async () => {
        jest.resetModules();

        jest.unstable_mockModule('node:module', () => ({
            createRequire: () => ({
                resolve: () => '/virtual/sdk/entry.js'
            })
        }));

        jest.unstable_mockModule('node:fs', () => ({
            readFileSync: () => {
                throw new Error('read failed');
            }
        }));

        jest.unstable_mockModule('node:path', () => ({
            dirname: (p: string) => p,
            join: (a: string, b: string) => `${a}/${b}`
        }));

        const meta = await import('../src/meta.js');
        expect(meta.MCP_SDK_VERSION).toBe('unknown');
    });

    it('returns "unknown" when createRequire throws', async () => {
        jest.resetModules();

        jest.unstable_mockModule('node:module', () => ({
            createRequire: () => {
                throw new Error('boom');
            }
        }));

        const meta = await import('../src/meta.js');
        expect(meta.MCP_SDK_VERSION).toBe('unknown');
    });
});
