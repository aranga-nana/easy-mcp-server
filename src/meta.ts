import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const PROTOCOL_VERSION = '2025-11-25';
export const SERVER_NAME = 'easy-mcp-server';
export const SERVER_VERSION = '1.0.0';
export const DEFAULT_PORT = 8080;
export const DEFAULT_HOST = '127.0.0.1';
export const SESSION_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes
export const ENDPOINT_PATH = '/mcp';

function readMcpSdkVersion(): string {
	try {
		const require = createRequire(import.meta.url);
		const candidates = [
			'@modelcontextprotocol/sdk',
			'@modelcontextprotocol/sdk/server/mcp.js',
			'@modelcontextprotocol/sdk/server/streamableHttp.js'
		];

		let resolvedEntry: string | undefined;
		for (const candidate of candidates) {
			try {
				resolvedEntry = require.resolve(candidate);
				break;
			} catch {
				// try the next candidate
			}
		}

		if (!resolvedEntry) {
			return 'unknown';
		}

		// Walk up from the resolved entry until we find the SDK package root.
		// This avoids relying on deep-importing `@modelcontextprotocol/sdk/package.json`,
		// which may be blocked by package "exports".
		let dir = dirname(resolvedEntry);
		for (let i = 0; i < 15; i += 1) {
			const candidate = join(dir, 'package.json');
			try {
				const raw = readFileSync(candidate, 'utf8');
				const pkg = JSON.parse(raw) as { name?: unknown; version?: unknown };
				if (pkg.name === '@modelcontextprotocol/sdk' && typeof pkg.version === 'string') {
					return pkg.version;
				}
			} catch {
				// ignore and continue walking
			}

			const parent = dirname(dir);
			if (parent === dir) break;
			dir = parent;
		}

		return 'unknown';
	} catch {
		return 'unknown';
	}
}

export const MCP_SDK_VERSION = readMcpSdkVersion();
