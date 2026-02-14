import { EventStore, StreamId, EventId } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

interface StoredEvent {
  id: EventId;
  streamId: StreamId;
  message: JSONRPCMessage;
}

export class InMemoryEventStore implements EventStore {
  private events: StoredEvent[] = [];
  private nextId = 1;

  async storeEvent(streamId: StreamId, message: JSONRPCMessage): Promise<EventId> {
    const id = String(this.nextId++);
    this.events.push({ id, streamId, message });
    // Cleanup old events to prevent memory leak? 
    // Instructions say "A background cleanup task MUST run periodically to remove expired sessions".
    // This store is for events, which are tied to streams/sessions.
    // If I delete the session, I should probably prune events too. 
    // But for "InMemory", maybe global array is fine for now or I implement a prune method.
    // For this implementation, I will just keep it simple.
    if (this.events.length > 10000) {
        this.events.shift(); // Simple cap
    }
    return id;
  }

  async getStreamIdForEventId(eventId: EventId): Promise<StreamId | undefined> {
    const event = this.events.find(e => e.id === eventId);
    return event?.streamId;
  }

  async replayEventsAfter(
    lastEventId: EventId, 
    { send }: { send: (eventId: EventId, message: JSONRPCMessage) => Promise<void> }
  ): Promise<StreamId> {
    const lastEventIndex = this.events.findIndex(e => e.id === lastEventId);
    
    if (lastEventIndex === -1) {
       throw new Error(`Event ID ${lastEventId} not found`);
    }

    const lastEvent = this.events[lastEventIndex];
    const streamId = lastEvent.streamId;

    const relevantEvents = this.events.slice(lastEventIndex + 1).filter(e => e.streamId === streamId);

    for (const event of relevantEvents) {
      await send(event.id, event.message);
    }

    return streamId;
  }
}
