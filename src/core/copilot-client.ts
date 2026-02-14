import { CopilotClient } from '@github/copilot-sdk';
import { createAppAuth } from '@octokit/auth-app';

let clientInstance: CopilotClient | null = null;
const logger = {
    info: (msg: string, meta?: any) => console.log(`[copilot-client] INFO: ${msg}`, meta ?? ''),
    warn: (msg: string, meta?: any) => console.warn(`[copilot-client] WARN: ${msg}`, meta ?? ''),
    error: (msg: string, meta?: any) => console.error(`[copilot-client] ERROR: ${msg}`, meta ?? '')
};

/**
 * Validates and normalizes GitHub App credentials from environment variables.
 * Returns null if any required variable is missing.
 */
async function getGitHubAppToken(): Promise<string | null> {
    const appId = process.env.GITHUB_APP_ID;
    const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
    const installationId = process.env.GITHUB_APP_INSTALLATION_ID;

    if (!appId || !privateKey || !installationId) {
        return null;
    }

    try {
        logger.info('GitHub App credentials found, attempting to authenticate...');
        
        const key = privateKey.includes('\\n') 
            ? privateKey.replace(/\\n/g, '\n') // Handle escaped newlines from env
            : privateKey;

        const auth = createAppAuth({
            appId,
            privateKey: key,
            installationId,
        });

        const { token } = await auth({ type: 'installation' });
        logger.info('Successfully generated GitHub App Installation Token');
        return token;
    } catch (error) {
        logger.error('Failed to authenticate as GitHub App', { error: String(error) });
        return null; // Fallback to other methods if app auth fails
    }
}

export async function initializeCopilotClient(): Promise<CopilotClient> {
    if (clientInstance) {
        return clientInstance;
    }

    try {
        logger.info('Initializing Copilot SDK client...');
        
        // Priority 1: GitHub App Authentication (Most Secure for Servers)
        let githubToken = await getGitHubAppToken();

        // Priority 2: Simple Personal Access Token (PAT) from Environment
        if (!githubToken) {
            githubToken = process.env.COPILOT_GITHUB_TOKEN || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
            if (githubToken) {
                logger.info('Using GitHub token from environment variables (PAT/OAuth)');
            }
        }

        // Priority 3: Local CLI Authentication (Least Secure for Remote Servers)
        if (!githubToken) {
            logger.info('No explicit credentials found (App/PAT), attempting to use local CLI auth');
        }

        const client = new CopilotClient({
            githubToken: githubToken || undefined, // undefined lets SDK try CLI auth
            logLevel: 'info'
        });
        
        await client.start();
        
        try {
            const authStatus = await client.getAuthStatus();
            if (authStatus.isAuthenticated) {
                logger.info('Copilot SDK authenticated successfully', { 
                    login: authStatus.login, 
                    authType: authStatus.authType 
                });
            } else {
                logger.warn('Copilot SDK client started but NOT authenticated', { 
                    status: authStatus.statusMessage 
                });
            }
        } catch (authError) {
             logger.warn('Failed to check auth status', { error: String(authError) });
        }

        clientInstance = client;
        return client;
    } catch (error) {
        logger.error('Failed to initialize Copilot SDK client', { error: String(error) });
        // We throw so startup can decide whether to fail hard or continue without it
        throw error;
    }
}

export function getCopilotClient(): CopilotClient {
    if (!clientInstance) {
        throw new Error('Copilot SDK client not initialized. Call initializeCopilotClient() first.');
    }
    return clientInstance;
}

export async function shutdownCopilotClient(): Promise<void> {
    if (clientInstance) {
        try {
            await clientInstance.stop();
            logger.info('Copilot SDK client stopped');
        } catch (error) {
            logger.error('Error stopping Copilot SDK client', { error: String(error) });
        }
        clientInstance = null;
    }
}
