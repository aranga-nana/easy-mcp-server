import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAddTwoNumbers } from './add-two-numbers/index.js';
import { registerTokenizePrompt } from './tokenize-prompt/index.js';
import { registerHelloWorld } from './hello-world/index.js';

export function registerTools(server: McpServer) {
    registerAddTwoNumbers(server);
    registerTokenizePrompt(server);
    registerHelloWorld(server);
}
