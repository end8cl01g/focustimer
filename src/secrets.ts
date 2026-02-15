import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const client = new SecretManagerServiceClient();

/**
 * Loads secrets from Google Cloud Secret Manager and injects them into process.env.
 * Only runs if PROJECT_ID is available or if specifically requested.
 */
export async function loadSecrets(): Promise<void> {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.PROJECT_ID;

    if (!projectId) {
        console.log('Skipping Secret Manager: No Project ID found (local development?)');
        return;
    }

    const secretsToLoad = [
        'TELEGRAM_BOT_TOKEN',
        'GAS_WEBAPP_URL',
        'GAS_API_KEY',
    ];

    for (const secretName of secretsToLoad) {
        // Only fetch if not already in process.env or if we want to override
        try {
            const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;
            const [version] = await client.accessSecretVersion({ name });
            const payload = version.payload?.data?.toString();

            if (payload) {
                process.env[secretName] = payload;
                console.log(`✅ Loaded secret from Secret Manager: ${secretName}`);
            }
        } catch (error) {
            if (process.env[secretName]) {
                console.log(`⚠️ Failed to load ${secretName} from Secret Manager, using existing env var.`);
            } else {
                console.warn(`❌ Failed to load ${secretName} from Secret Manager:`, (error as Error).message);
            }
        }
    }
}
