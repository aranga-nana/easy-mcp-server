import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAddTwoNumbers } from './add-two-numbers/index.js';
import { registerHelloWorld } from './hello-world/index.js';

export const REGISTERED_TOOL_NAMES = [
    'add_two_numbers',
    'add-two-numbers',
    'hello-world',
    'welcome',
    'greeting'
] as const;

export function registerTools(server: McpServer) {
    registerAddTwoNumbers(server);
    registerHelloWorld(server);
}
