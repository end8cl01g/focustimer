import express from 'express';
import bot from './bot';
import * as dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;
const SERVICE_URL = process.env.SERVICE_URL;

// Health check
app.get('/', (_req, res) => {
    res.json({ status: 'ok', mode: process.env.NODE_ENV || 'development' });
});

const secretPath = `/webhook/${process.env.TELEGRAM_BOT_TOKEN}`;

if (process.env.NODE_ENV === 'production') {
    app.use(bot.webhookCallback(secretPath));

    // Auto-register webhook on startup
    if (SERVICE_URL) {
        const webhookUrl = `${SERVICE_URL}${secretPath}`;
        bot.telegram.setWebhook(webhookUrl)
            .then(() => console.log(`✅ Webhook registered: ${webhookUrl}`))
            .catch((err) => console.error('❌ Webhook registration failed:', err));
    } else {
        console.warn('⚠️ SERVICE_URL not set — webhook not auto-registered');
    }
} else {
    // Local dev: polling mode. Delete any existing webhook first.
    bot.telegram.deleteWebhook()
        .then(() => {
            bot.launch();
            console.log('🤖 Bot started in polling mode');
        })
        .catch((err) => console.error('Failed to delete webhook:', err));
}

const server = app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
});

// ─── SIGTERM Keep-Warm Loop ───
process.on('SIGTERM', async () => {
    console.log('SIGTERM received. Starting keep-warm ping...');

    if (SERVICE_URL) {
        try {
            const res = await fetch(SERVICE_URL, {
                signal: AbortSignal.timeout(5000),
            });
            console.log(`Keep-warm ping → ${res.status}`);
        } catch (err) {
            console.error('Keep-warm ping failed:', err);
        }
    }

    try { bot.stop('SIGTERM'); } catch { }
    server.close(() => {
        console.log('Server closed.');
        process.exit(0);
    });

    setTimeout(() => process.exit(1), 8000);
});

process.on('SIGINT', () => {
    try { bot.stop('SIGINT'); } catch { }
    server.close(() => process.exit(0));
});
