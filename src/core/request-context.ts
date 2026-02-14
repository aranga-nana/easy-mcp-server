import { AsyncLocalStorage } from 'node:async_hooks';

export interface ClientInfo {
    name: string;
    version: string;
}

export interface RequestContext {
    sessionId?: string;
    clientInfo?: ClientInfo;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
    return storage.run(context, fn);
}

export function getRequestContext(): RequestContext | undefined {
    return storage.getStore();
}
