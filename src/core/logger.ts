import { Chalk } from 'chalk';
import type { Request, Response, NextFunction } from 'express';

const yellowChalk = new Chalk({ level: 1 }).yellow;
const greenChalk = new Chalk({ level: 1 }).green;
const redChalk = new Chalk({ level: 1 }).red;

type HeadersLike = Record<string, unknown>;

const DEFAULT_SENSITIVE_HEADER_KEYS = [
    'authorization',
    'proxy-authorization',
    'cookie',
    'set-cookie',
    'x-api-key',
    'x-auth-token',
    'x-csrf-token',
    'x-amz-security-token'
] as const;

export function maskHeaders(headers: HeadersLike, sensitiveHeaderKeys: readonly string[] = DEFAULT_SENSITIVE_HEADER_KEYS): HeadersLike {
    const sensitive = new Set(sensitiveHeaderKeys.map((h) => h.toLowerCase()));
    const masked: HeadersLike = {};

    for (const [key, value] of Object.entries(headers)) {
        if (sensitive.has(key.toLowerCase())) {
            if (Array.isArray(value)) masked[key] = value.map(() => '***');
            else if (value === undefined) masked[key] = value;
            else masked[key] = '***';
            continue;
        }
        masked[key] = value;
    }

    return masked;
}

function serializeBody(body: unknown): string {
    if (body === undefined) return '<undefined>';
    if (typeof body === 'string') return body;
    if (body instanceof Uint8Array) return `<Uint8Array length=${body.length}>`;
    try {
        return JSON.stringify(body);
    } catch {
        return '<unserializable>';
    }
}

function truncate(text: string, maxLen: number): string {
    if (text.length <= maxLen) return text;
    return `${text.slice(0, maxLen)}…<truncated ${text.length - maxLen} chars>`;
}

export function createHttpLoggerMiddleware(options?: {
    maxBodyLength?: number;
    sensitiveHeaderKeys?: readonly string[];
}) {
    const maxBodyLength = options?.maxBodyLength ?? 10_000;
    const sensitiveHeaderKeys = options?.sensitiveHeaderKeys ?? DEFAULT_SENSITIVE_HEADER_KEYS;

    return (req: Request, res: Response, next: NextFunction) => {
        const maskedRequestHeaders = maskHeaders(req.headers as HeadersLike, sensitiveHeaderKeys);
        const requestBody = truncate(serializeBody(req.body), maxBodyLength);

        console.log(yellowChalk('[http] request headers'), {
            method: req.method,
            path: req.originalUrl,
            headers: maskedRequestHeaders
        });
        console.log(greenChalk('[http] request body'), greenChalk(requestBody));

        let capturedResponseBody: unknown = undefined;
        const originalJson = res.json.bind(res);
        const originalSend = res.send.bind(res);

        res.json = ((body: unknown) => {
            capturedResponseBody = body;
            return originalJson(body);
        }) as typeof res.json;

        res.send = ((body: unknown) => {
            capturedResponseBody = body;
            return originalSend(body as Parameters<typeof originalSend>[0]);
        }) as typeof res.send;

        res.on('finish', () => {
            const isError = res.statusCode >= 400;
            const color = isError ? redChalk : greenChalk;
            const maskedResponseHeaders = maskHeaders(res.getHeaders() as HeadersLike, sensitiveHeaderKeys);

            console.log(color('[http] response headers'), {
                method: req.method,
                path: req.originalUrl,
                statusCode: res.statusCode,
                headers: maskedResponseHeaders
            });

            const responseBody = truncate(serializeBody(capturedResponseBody), maxBodyLength);
            console.log(color('[http] response body'), color(responseBody));
        });

        next();
    };
}
