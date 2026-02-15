import { Telegraf } from 'telegraf';
import { CalendarManager } from './calendar';
import { getSavedChatId } from './bot';
import { CalendarEvent } from './types';
import { getTaipeiStartOfDay, getTaipeiEndOfDay, formatTime } from './utils';

const notifiedEvents = new Set<string>();
let eventCache: CalendarEvent[] = [];
let lastFetchTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Clear notified set daily to prevent memory growth
setInterval(() => {
    console.log('Clearing notified events cache...');
    notifiedEvents.clear();
}, 24 * 60 * 60 * 1000);

export async function fetchEvents(calendarManager: CalendarManager): Promise<CalendarEvent[]> {
    const now = Date.now();
    if (now - lastFetchTime < CACHE_TTL && eventCache.length > 0) {
        return eventCache;
    }

    try {
        const startOfDay = getTaipeiStartOfDay();
        const endOfDay = getTaipeiEndOfDay();

        eventCache = await calendarManager.listEvents(startOfDay, endOfDay);
        lastFetchTime = now;
        console.log(`Fetched ${eventCache.length} events for today.`);
        return eventCache;
    } catch (e) {
        console.error('Fetch events error:', e);
        return eventCache; // Return stale cache on error
    }
}

/**
 * Force clear cache (e.g. after booking or deletion)
 */
export function invalidateEventCache() {
    console.log('Invalidating event cache...');
    lastFetchTime = 0;
}

export async function checkUpcomingEvents(bot: Telegraf, calendarManager: CalendarManager) {
    const chatId = getSavedChatId();
    if (!chatId) {
        // No chat ID yet, user hasn't started the bot.
        return;
    }

    try {
        const events = await fetchEvents(calendarManager);
        const now = new Date();

        for (const event of events) {
            const start = new Date(event.start);
            const diff = start.getTime() - now.getTime();

            // Notify if event starts in less than 90 seconds (1.5 min), and we haven't notified yet.
            // We keep a 30s grace period for events that just started.
            if (diff <= 90000 && diff > -30000 && !notifiedEvents.has(event.id)) {
                notifiedEvents.add(event.id);
                const timeStr = formatTime(start);

                await bot.telegram.sendMessage(chatId, `🔔 <b>專注提醒：</b> ${event.title}\n⏰ ${timeStr}\n\n準備好進入心流狀態了嗎？🚀`, { parse_mode: 'HTML' });
                console.log(`Notification sent for event "${event.title}" to chat ${chatId}`);
            }
        }
    } catch (e) {
        console.error('Notification loop error:', e);
    }
}

export function startNotificationLoop(bot: Telegraf, calendarManager: CalendarManager) {
    console.log('Starting notification loop (interval: 60s)...');
    // Run immediately once
    checkUpcomingEvents(bot, calendarManager).catch(err => console.error('Initial check failed:', err));
    setInterval(() => checkUpcomingEvents(bot, calendarManager), 60000);
}
