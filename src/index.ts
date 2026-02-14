import { createServer } from './core/server.js';
import { registerAddTwoNumbers } from './tools/add-two-numbers/index.js';
import { registerTokenizePrompt } from './tools/tokenize-prompt/index.js';
import { DEFAULT_PORT, DEFAULT_HOST, SERVER_NAME, SERVER_VERSION, PROTOCOL_VERSION, ENDPOINT_PATH } from './meta.js';
import chalk from 'chalk';
import figlet from 'figlet';

async function main() {
    const { app, mcpServer } = await createServer();

    // Register tools
    registerAddTwoNumbers(mcpServer);
    registerTokenizePrompt(mcpServer);

    app.listen(DEFAULT_PORT, DEFAULT_HOST, () => {
        console.log(chalk.blue(figlet.textSync(SERVER_NAME, { horizontalLayout: 'full' })));
        console.log(chalk.bold(`Version: ${SERVER_VERSION}`));
        console.log(chalk.green(`MCP Protocol Version: ${PROTOCOL_VERSION}`));
        console.log(`Port: ${DEFAULT_PORT}`);
        console.log(`Endpoint: ${ENDPOINT_PATH}`);
        console.log(chalk.yellow(`Server is running on http://127.0.0.1:${DEFAULT_PORT}${ENDPOINT_PATH}`));
        console.log('Available Tools:');
        console.log(' - add_two_numbers');
        console.log(' - tokenize-prompt');
    });
}

main().catch(console.error);
