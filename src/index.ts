import { createHttpServer } from './core/transport.js';
import { createMcpServer } from './core/mcp-server.js';
import { REGISTERED_TOOL_NAMES, registerTools } from './tools/index.js';
import { DEFAULT_PORT, DEFAULT_HOST, SERVER_NAME, SERVER_VERSION, PROTOCOL_VERSION, ENDPOINT_PATH, MCP_SDK_VERSION } from './meta.js';
import chalk from 'chalk';
import figlet from 'figlet';

async function main() {
    const serverFactory = () => {
        const server = createMcpServer();
        registerTools(server);
        return server;
    };
    const { app } = createHttpServer(serverFactory);

    app.listen(DEFAULT_PORT, DEFAULT_HOST, () => {
        console.log(chalk.blue(figlet.textSync(SERVER_NAME, { horizontalLayout: 'full' })));
        console.log(chalk.bold(`Version: ${SERVER_VERSION}`));
        console.log(chalk.cyan(`MCP SDK Version: ${MCP_SDK_VERSION}`));
        console.log(chalk.green(`MCP Protocol Version: ${PROTOCOL_VERSION}`));
        console.log(chalk.rgb(255, 165, 0)('Registered Tools:'));
        for (const toolName of REGISTERED_TOOL_NAMES) {
            // Hide Copilot UX alias from startup display to avoid looking like a duplicate.
            if (toolName === 'add-two-numbers') continue;
            if (toolName === 'welcome') continue;
            if (toolName === 'greeting') continue;
            console.log(chalk.rgb(255, 165, 0)(`- ${toolName}`));
        }
        console.log(`Port: ${DEFAULT_PORT}`);
        console.log(`Endpoint: ${ENDPOINT_PATH}`);
        console.log(chalk.yellow(`Server is running on http://127.0.0.1:${DEFAULT_PORT}${ENDPOINT_PATH}`));
        console.log('Available Tools: View http://localhost:8080/info');
    });
}

main().catch(console.error);
