import { Telegraf } from 'telegraf';
import { CalendarManager } from './calendar';
import { getSavedChatId } from './bot';
import { CalendarEvent } from './types';

const notifiedEvents = new Set<string>();
let eventCache: CalendarEvent[] = [];
let lastFetchTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Clear notified set daily
setInterval(() => {
    notifiedEvents.clear();
}, 24 * 60 * 60 * 1000);

export async function fetchEvents(calendarManager: CalendarManager): Promise<CalendarEvent[]> {
    const now = Date.now();
    if (now - lastFetchTime < CACHE_TTL && eventCache.length > 0) {
        return eventCache;
    }

    try {
        const taipeiNow = new Date(now + 8 * 3600000);
        const startOfDay = new Date(Date.UTC(taipeiNow.getUTCFullYear(), taipeiNow.getUTCMonth(), taipeiNow.getUTCDate(), -8, 0, 0));
        const endOfDay = new Date(Date.UTC(taipeiNow.getUTCFullYear(), taipeiNow.getUTCMonth(), taipeiNow.getUTCDate(), 15, 59, 59, 999));

        eventCache = await calendarManager.listEvents(startOfDay, endOfDay);
        lastFetchTime = now;
        return eventCache;
    } catch (e) {
        console.error('Fetch events error:', e);
        return eventCache; // Return stale cache on error
    }
}

/**
 * Force clear cache (e.g. after booking)
 */
export function invalidateEventCache() {
    lastFetchTime = 0;
}

export async function checkUpcomingEvents(bot: Telegraf, calendarManager: CalendarManager) {
    const chatId = getSavedChatId();
    if (!chatId) return;

    try {
        const events = await fetchEvents(calendarManager);
        const now = new Date();

        for (const event of events) {
            const start = new Date(event.start);
            const diff = start.getTime() - now.getTime();

            if (diff <= 90000 && diff > -30000 && !notifiedEvents.has(event.id)) {
                notifiedEvents.add(event.id);
                const timeStr = start.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                    timeZone: 'Asia/Taipei'
                });

                await bot.telegram.sendMessage(chatId, `🔔 <b>Task Starting:</b> ${event.title}\n⏰ ${timeStr}`, { parse_mode: 'HTML' });
                console.log(`Notification sent for: ${event.title}`);
            }
        }
    } catch (e) {
        console.error('Notification loop error:', e);
    }
}

export function startNotificationLoop(bot: Telegraf, calendarManager: CalendarManager) {
    console.log('Starting notification loop...');
    setInterval(() => checkUpcomingEvents(bot, calendarManager), 60000);
}
