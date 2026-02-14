import express from 'express';
import bot from './bot';
import * as dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;
const SERVICE_URL = process.env.SERVICE_URL; // e.g. https://focustimer-bot-xxxxx.a.run.app

// Basic health check
app.get('/', (req, res) => {
    res.send('Focus Timer Bot is running.');
});

// Production: Use Webhook
// Development: Use Polling
const secretPath = `/webhook/${process.env.TELEGRAM_BOT_TOKEN}`;

if (process.env.NODE_ENV === 'production') {
    app.use(bot.webhookCallback(secretPath));
    console.log(`Webhook set to path: ${secretPath}`);
} else {
    console.log('Starting via polling...');
    bot.launch();
}

const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

// ─── SIGTERM Keep-Warm Loop ───
// When Cloud Run sends SIGTERM (instance scaling down / idle timeout),
// we ping our own service URL to force a new instance to spin up,
// then gracefully shut down. This keeps at least 1 warm instance alive.
process.on('SIGTERM', async () => {
    console.log('SIGTERM received. Starting keep-warm ping...');

    // 1. Ping self to wake a new instance BEFORE we die
    if (SERVICE_URL) {
        try {
            const response = await fetch(SERVICE_URL, {
                signal: AbortSignal.timeout(5000), // 5s timeout
            });
            console.log(`Keep-warm ping sent. Status: ${response.status}`);
        } catch (err) {
            console.error('Keep-warm ping failed:', err);
        }
    } else {
        console.warn('SERVICE_URL not set — skipping keep-warm ping.');
    }

    // 2. Graceful shutdown
    try { bot.stop('SIGTERM'); } catch { }
    server.close(() => {
        console.log('Server closed. Exiting.');
        process.exit(0);
    });

    // Force exit after 8s if graceful shutdown hangs
    setTimeout(() => process.exit(1), 8000);
});

process.on('SIGINT', () => {
    try { bot.stop('SIGINT'); } catch { }
    server.close(() => process.exit(0));
});
