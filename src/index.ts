import path from 'path';
import express from 'express';
import * as dotenv from 'dotenv';
import { loadSecrets } from "./secrets";
import { readTimerState, writeTimerState, catchUpTimerState } from './timerState';
import { getTaipeiStartOfDay, getTaipeiEndOfDay } from './utils';

dotenv.config();

async function startServer() {
    // 1. Load Secrets
    await loadSecrets();

    // 2. Initialize modules
    const { default: getBot, calendarManager } = await import('./bot');
    const { startNotificationLoop, invalidateEventCache } = await import('./notifier');

    const bot = getBot();

    const app = express();
    app.use(express.static(path.join(__dirname, '../public')));
    app.use(express.json());

    // Health check
    app.get('/health', (_req, res) => {
        res.json({ status: 'ok', mode: process.env.NODE_ENV || 'development' });
    });

    // API: Tasks
    app.get('/api/tasks', async (_req, res) => {
        try {
            const startOfDay = getTaipeiStartOfDay();
            const endOfDay = getTaipeiEndOfDay();

            const events = await calendarManager.listEvents(startOfDay, endOfDay);
            res.json(events);
        } catch (error) {
            console.error('API /api/tasks error:', error);
            res.status(500).json({ error: 'Failed to fetch tasks', details: (error as Error).message });
        }
    });

    // API: Create Event
    app.post('/api/events', async (req, res) => {
        try {
            const { title, description, start, end } = req.body;
            if (!title || !start || !end) return res.status(400).json({ error: 'Missing fields' });

            const event = await calendarManager.createEvent({
                summary: title,
                description: description || 'Created via Focus Timer',
                startTime: new Date(start),
                endTime: new Date(end),
            });
            invalidateEventCache();
            res.json(event);
        } catch (error) {
            console.error('API POST /api/events error:', error);
            res.status(500).json({ error: 'Failed to create event', details: (error as Error).message });
        }
    });

    // API: Delete Event
    app.delete('/api/events/:id', async (req, res) => {
        try {
            const { id } = req.params;
            await calendarManager.deleteEvent(id);
            invalidateEventCache();
            res.json({ ok: true });
        } catch (error) {
            console.error('API DELETE /api/events error:', error);
            res.status(500).json({ error: 'Failed to delete event', details: (error as Error).message });
        }
    });

    // API: Timer State
    app.get('/api/timer-state', (_req, res) => {
        let state = readTimerState();
        state = catchUpTimerState(state);
        res.json(state);
    });

    app.post('/api/timer-state', (req, res) => {
        const { activeTaskId, timers } = req.body;
        writeTimerState({ activeTaskId, timers, lastTick: Date.now() });
        res.json({ ok: true });
    });

    // 3. Start Background Tasks
    startNotificationLoop(bot, calendarManager);

    // 4. Bot Webhook / Polling
    const secretPath = `/webhook/${process.env.TELEGRAM_BOT_TOKEN}`;
    if (process.env.NODE_ENV === 'production') {
        app.use(bot.webhookCallback(secretPath));
        if (process.env.SERVICE_URL) {
            const webhookUrl = `${process.env.SERVICE_URL}${secretPath}`;
            bot.telegram.setWebhook(webhookUrl)
                .then(() => console.log(`✅ Webhook registered: ${webhookUrl}`))
                .catch(err => console.error('❌ Webhook failure:', err));
        }
    } else {
        bot.telegram.deleteWebhook().then(() => {
            bot.launch();
            console.log('🤖 Bot started (Polling)');
        }).catch(err => console.error('Bot launch error:', err));
    }

    // 5. Start Listening
    const port = process.env.PORT || 8080;
    const server = app.listen(port, () => console.log(`🚀 Server running on port ${port}`));

    // 6. Cleanup
    const shutdown = async (signal: string) => {
        console.log(`${signal} received. Shutting down...`);
        try { bot.stop(signal); } catch (e) { console.error('Bot stop error', e); }
        server.close(() => process.exit(0));
        setTimeout(() => process.exit(1), 5000);
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch(err => {
    console.error('Startup crash:', err);
    process.exit(1);
});
