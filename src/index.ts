import { createHttpServer } from './core/transport.js';
import { createMcpServer } from './core/mcp-server.js';
import { registerTools } from './tools/index.js';
import { DEFAULT_PORT, DEFAULT_HOST, SERVER_NAME, SERVER_VERSION, PROTOCOL_VERSION, ENDPOINT_PATH } from './meta.js';
import chalk from 'chalk';
import figlet from 'figlet';

async function main() {
    const mcpServer = createMcpServer();
    const { app } = createHttpServer(mcpServer);

    registerTools(mcpServer);

    app.listen(DEFAULT_PORT, DEFAULT_HOST, () => {
        console.log(chalk.blue(figlet.textSync(SERVER_NAME, { horizontalLayout: 'full' })));
        console.log(chalk.bold(`Version: ${SERVER_VERSION}`));
        console.log(chalk.green(`MCP Protocol Version: ${PROTOCOL_VERSION}`));
        console.log(`Port: ${DEFAULT_PORT}`);
        console.log(`Endpoint: ${ENDPOINT_PATH}`);
        console.log(chalk.yellow(`Server is running on http://127.0.0.1:${DEFAULT_PORT}${ENDPOINT_PATH}`));
        console.log('Available Tools: View http://localhost:8080/info');
    });
}

main().catch(console.error);
