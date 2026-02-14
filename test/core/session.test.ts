import { jest } from '@jest/globals';
import { SessionManager } from '../../src/core/session.js';
import { SESSION_TIMEOUT_MS } from '../../src/meta.js';

describe('SessionManager', () => {
    it('removeSession closes transport and deletes the session', () => {
        const manager = new SessionManager();

        const close = jest.fn();
        const transport = { close, onclose: undefined } as unknown as { close: () => void; onclose?: () => void };

        manager.createSession('s1', transport as never);
        expect(manager.hasSession('s1')).toBe(true);

        manager.removeSession('s1');
        expect(close).toHaveBeenCalledTimes(1);
        expect(manager.hasSession('s1')).toBe(false);

        manager.destroy();
    });

    it('createSession registers onclose cleanup', () => {
        const manager = new SessionManager();

        const transport = { close: jest.fn(), onclose: undefined as undefined | (() => void) };
        manager.createSession('s2', transport as never);
        expect(manager.hasSession('s2')).toBe(true);

        transport.onclose?.();
        expect(manager.hasSession('s2')).toBe(false);

        manager.destroy();
    });

    it('cleans up timed out sessions', () => {
        jest.useFakeTimers();
        const manager = new SessionManager();

        const close = jest.fn();
        const transport = { close, onclose: undefined } as unknown as { close: () => void; onclose?: () => void };
        manager.createSession('s3', transport as never);

        const session = manager.getSession('s3');
        expect(session).toBeDefined();
        session!.lastAccessed = 0;

        const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(SESSION_TIMEOUT_MS + 1);
        try {
            jest.advanceTimersByTime(60_000);
            expect(close).toHaveBeenCalledTimes(1);
            expect(manager.hasSession('s3')).toBe(false);
        } finally {
            nowSpy.mockRestore();
            manager.destroy();
            jest.useRealTimers();
        }
    });

    it('getSession returns undefined for missing session', () => {
        const manager = new SessionManager();
        expect(manager.getSession('missing')).toBeUndefined();
        manager.destroy();
    });
});
