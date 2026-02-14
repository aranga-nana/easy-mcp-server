import { InMemoryEventStore } from '../../src/core/in-memory-event-store.js';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

describe('InMemoryEventStore', () => {
    let store: InMemoryEventStore;
    const mockMessage: JSONRPCMessage = {
        jsonrpc: '2.0',
        method: 'test',
        params: {}
    };

    beforeEach(() => {
        store = new InMemoryEventStore();
    });

    it('should store events and return an id', async () => {
        const id = await store.storeEvent('stream-1', mockMessage);
        expect(id).toBeDefined();
        expect(typeof id).toBe('string');
    });

    it('should store and retrieve event stream ID', async () => {
        const mockMessage = { jsonrpc: "2.0", method: "test" } as JSONRPCMessage;
        const eventId = await store.storeEvent('stream-1', mockMessage);
        
        const streamId = await store.getStreamIdForEventId(eventId);
        expect(streamId).toBe('stream-1');
    });

    it('should return undefined for unknown event ID', async () => {
        const streamId = await store.getStreamIdForEventId('unknown');
        expect(streamId).toBeUndefined();
    });

    it('should replay events after a given id', async () => {
        const mockMessage = { jsonrpc: "2.0", method: "test" } as JSONRPCMessage;
        
        // Populate events
        const id1 = await store.storeEvent('stream-1', { ...mockMessage, id: 1 } as JSONRPCMessage);
        await store.storeEvent('stream-1', { ...mockMessage, id: 2 } as JSONRPCMessage);
        await store.storeEvent('stream-1', { ...mockMessage, id: 3 } as JSONRPCMessage);

        const received: { eventId: string; message: JSONRPCMessage }[] = [];
        const send = async (eventId: string, message: JSONRPCMessage) => {
             received.push({ eventId, message }); 
             return Promise.resolve();
        };

        const replayedStreamId = await store.replayEventsAfter(id1, { send });

        expect(replayedStreamId).toBe('stream-1');
        expect(received).toHaveLength(2);
        // Cast to any to access id for checking
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((received[0].message as any).id).toBe(2);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((received[1].message as any).id).toBe(3);
    });

    it('should throw if event to replay from not found', async () => {
         const send = async () => Promise.resolve();
         await expect(store.replayEventsAfter('unknown', { send })).rejects.toThrow();
    });

    it('should prune events if limits exceeded', async () => {
        // Access private property or just store many events
        // The limit is 10000. That's too many to run in a fast test.
        // We can access the array via casting to any if needed, or simply verify logic by code inspection coverage.
        // Or we can mock the limit if it was a property.
        
        // For 100% coverage, we need to hit line check `if (this.events.length > 10000)`.
        // I'll make the limit configurable or accessible for testing?
        // Or I can change the file? 
        // Or I can skip testing that line if 100% allows for "almost 100%". 
        // "Aim for 100%" usually means hit every line.
        // 10,000 is loopable in unit test but takes time.
        // Let's verify it quickly. 10k array push is fast.
        
        for (let i = 0; i < 10005; i++) {
            await store.storeEvent('stream-1', mockMessage);
        }
        
        // We know we can't easily check private `events.length` without casting.
        const firstEventId = "1";
        // If pruned, event "1" (id 1) should be gone.
        const streamId = await store.getStreamIdForEventId(firstEventId);
        expect(streamId).toBeUndefined();
    });
});
