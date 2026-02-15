import path from 'path';
import express from 'express';
import bot, { calendarManager, getSavedChatId } from './bot';
import * as dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.static(path.join(__dirname, '../public')));

// Health check
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', mode: process.env.NODE_ENV || 'development' });
});

// API for Mini App
app.get('/api/tasks', async (_req, res) => {
    try {
        const now = new Date();
        const taipeiNow = new Date(now.getTime() + 8 * 3600000);
        const startOfDay = new Date(Date.UTC(taipeiNow.getUTCFullYear(), taipeiNow.getUTCMonth(), taipeiNow.getUTCDate(), -8, 0, 0));
        const endOfDay = new Date(Date.UTC(taipeiNow.getUTCFullYear(), taipeiNow.getUTCMonth(), taipeiNow.getUTCDate(), 15, 59, 59, 999));

        const events = await calendarManager.listEvents(startOfDay, endOfDay);
        res.json(events);
    } catch (error) {
        console.error('API /api/tasks error:', error);
        res.status(500).json({
            error: 'Failed to fetch tasks',
            details: error instanceof Error ? error.message : String(error)
        });
    }
});

// API for Creating Event
app.use(express.json()); // Enable JSON parsing
app.post('/api/events', async (req, res) => {
    try {
        const { title, description, start, end } = req.body;

        if (!title || !start || !end) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const event = await calendarManager.createEvent({
            summary: title,
            description: description || 'Created via Focus Timer',
            startTime: new Date(start),
            endTime: new Date(end),
        });

        res.json(event);
    } catch (error) {
        console.error('API POST /api/events error:', error);
        res.status(500).json({
            error: 'Failed to create event',
            details: error instanceof Error ? error.message : String(error)
        });
    }
});

// ─── Notification Loop ───
const notifiedEvents = new Set<string>();

// Clear notified set daily
setInterval(() => {
    notifiedEvents.clear();
}, 24 * 60 * 60 * 1000);

async function checkUpcomingEvents() {
    const chatId = getSavedChatId();
    if (!chatId) return;

    try {
        const now = new Date();
        const taipeiNow = new Date(now.getTime() + 8 * 3600000);
        // Look ahead 24 hours just in case, but filter for near future
        const startOfDay = new Date(Date.UTC(taipeiNow.getUTCFullYear(), taipeiNow.getUTCMonth(), taipeiNow.getUTCDate(), -8, 0, 0));
        const endOfDay = new Date(Date.UTC(taipeiNow.getUTCFullYear(), taipeiNow.getUTCMonth(), taipeiNow.getUTCDate(), 15, 59, 59, 999));

        const events = await calendarManager.listEvents(startOfDay, endOfDay);

        for (const event of events) {
            const start = new Date(event.start);
            const diff = start.getTime() - now.getTime();

            // Notify if starting within 90 seconds (and not already notified)
            // also ensure it's not too old (>-30s) so we don't notify old stuff on restart
            if (diff <= 90000 && diff > -30000 && !notifiedEvents.has(event.id)) {
                notifiedEvents.add(event.id);
                const timeStr = start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Taipei' });

                await bot.telegram.sendMessage(chatId, `🔔 <b>Task Starting:</b> ${event.title}\n⏰ ${timeStr}`, { parse_mode: 'HTML' });
                console.log(`Notification sent for: ${event.title}`);
            }
        }
    } catch (e) {
        console.error('Notification loop error:', e);
    }
}

// Check every 60 seconds
setInterval(checkUpcomingEvents, 60000);

const secretPath = `/webhook/${process.env.TELEGRAM_BOT_TOKEN}`;

// Debug Logging Middleware
app.use((req, res, next) => {
    if (req.path.startsWith('/webhook')) {
        console.log(`[Webhook] ${req.method} ${req.path}`);
        // Log body if available (parsed by express.json())
        if (req.body) console.log('[Webhook Body]', JSON.stringify(req.body).substring(0, 500));
    }
    next();
});

if (process.env.NODE_ENV === 'production') {
    app.use(bot.webhookCallback(secretPath));

    // Auto-register webhook on startup
    if (process.env.SERVICE_URL) {
        const webhookUrl = `${process.env.SERVICE_URL}${secretPath}`;
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

const port = process.env.PORT || 8080;
const server = app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
});

// ─── SIGTERM Keep-Warm Loop ───
process.on('SIGTERM', async () => {
    console.log('SIGTERM received. Starting keep-warm ping...');

    if (process.env.SERVICE_URL) {
        try {
            const res = await fetch(process.env.SERVICE_URL, {
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
