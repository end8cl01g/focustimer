import express from 'express';
import bot from './bot';
import * as dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

// Basic health check
app.get('/', (req, res) => {
    res.send('Focus Timer Bot is running.');
});

// Production: Use Webhook
// Development: Use Polling (handled manually if running locally)

const secretPath = `/webhook/${process.env.TELEGRAM_BOT_TOKEN}`;

// Set webhook only if in production/cloud run env
if (process.env.NODE_ENV === 'production') {
    app.use(bot.webhookCallback(secretPath));
    console.log(`Webhook set to path: ${secretPath}`);
} else {
    // Local development - Start polling
    // Note: If you run this locally, ensure you don't have another instance polling
    console.log('Starting via polling...');
    bot.launch();
}

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
