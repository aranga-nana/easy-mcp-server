export function parseSSEResponse(text: string): { type: string, data?: any, id?: string }[] {
    const lines = text.split('\n');
    const events: { type: string, data?: any, id?: string }[] = [];
    let currentEvent: { type: string, data?: any, id?: string } | null = null;

    for (const line of lines) {
        if (line.startsWith('event: ')) {
            if (!currentEvent) currentEvent = { type: '' };
            currentEvent.type = line.substring(7).trim();
        } else if (line.startsWith('data: ')) {
            if (!currentEvent) currentEvent = { type: 'message' }; // Default type if not specified
            try {
                const jsonStr = line.substring(6).trim();
                if (jsonStr) {
                    currentEvent.data = JSON.parse(jsonStr);
                }
            } catch (e) {
                // Ignore parsing errors for incomplete chunks
            }
        } else if (line.startsWith('id: ')) {
            if (!currentEvent) currentEvent = { type: 'message' };
            currentEvent.id = line.substring(4).trim();
        } else if (line.trim() === '' && currentEvent) {
            events.push(currentEvent);
            currentEvent = null;
        }
    }
    return events;
}
