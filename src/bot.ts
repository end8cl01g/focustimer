import { Telegraf, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import { CalendarManager } from './calendar';
import * as fs from 'fs';
import * as path from 'path';
import { formatDateTime, formatTime, formatDate } from './utils';

let bot: Telegraf;
export const calendarManager = new CalendarManager();

const CHAT_ID_FILE = path.join(__dirname, '../data/chat_id.json');

export function getSavedChatId(): string | null {
    try {
        if (fs.existsSync(CHAT_ID_FILE)) {
            const data = JSON.parse(fs.readFileSync(CHAT_ID_FILE, 'utf-8'));
            return data.chatId;
        }
    } catch (e) { console.error('Error reading chat_id.json', e); }
    return null;
}

function saveChatId(chatId: string) {
    try {
        const dir = path.dirname(CHAT_ID_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(CHAT_ID_FILE, JSON.stringify({ chatId }));
        console.log(`Saved Chat ID: ${chatId}`);
    } catch (e) { console.error('Error saving chat_id.json', e); }
}

export function initBot(): Telegraf {
    if (bot) return bot;

    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
        throw new Error('TELEGRAM_BOT_TOKEN is not defined');
    }

    bot = new Telegraf(token);

    // Register handlers
    bot.start((ctx) => {
        if (ctx.chat) saveChatId(String(ctx.chat.id));
        const webAppUrl = process.env.SERVICE_URL || '';
        ctx.reply('歡迎使用 Focus Timer Bot！請選擇功能：',
            Markup.keyboard([
                [Markup.button.webApp('🚀 開啟專注定時器', webAppUrl)],
                ['📅 查詢今日日曆', '📝 管理我的預約']
            ]).resize()
        );
    });

    bot.hears(/📅\s*查詢今日日曆/, async (ctx) => {
        try {
            await ctx.reply('⏳ 正在查詢...');
            const now = new Date();
            const taipeiNow = new Date(now.getTime() + 8 * 3600000);
            const startOfDay = new Date(Date.UTC(taipeiNow.getUTCFullYear(), taipeiNow.getUTCMonth(), taipeiNow.getUTCDate(), -8, 0, 0));
            const endOfDay = new Date(Date.UTC(taipeiNow.getUTCFullYear(), taipeiNow.getUTCMonth(), taipeiNow.getUTCDate(), 15, 59, 59, 999));

            const events = await calendarManager.listEvents(startOfDay, endOfDay);

            if (events.length === 0) {
                return ctx.reply(`📅 ${formatDate(now)} 今日尚無行程。`);
            }

            let messageText = `📅 ${formatDate(now)} 今日行程：\n\n`;
            events.forEach(event => {
                messageText += `📍 ${formatTime(event.start)} - ${formatTime(event.end)}\n`;
                messageText += `📝 ${event.title}\n`;
                if (event.description) {
                    const desc = event.description.length > 50 ? event.description.substring(0, 47) + '...' : event.description;
                    messageText += `💬 ${desc}\n`;
                }
                messageText += `\n`;
            });
            ctx.reply(messageText);
        } catch (error) {
            console.error('listEvents error:', error);
            ctx.reply(`❌ 查詢失敗，請稍後再試。`);
        }
    });

    bot.on(message('web_app_data'), async (ctx) => {
        try {
            const data = JSON.parse(ctx.message.web_app_data.data);
            if (data.action === 'complete_task') {
                const minutes = Math.floor(data.duration / 60);
                const seconds = data.duration % 60;
                const timeStr = minutes > 0 ? `${minutes} 分 ${seconds} 秒` : `${seconds} 秒`;
                await ctx.reply(`✅ 任務完成！\n\n📝 任務：${data.title}\n⏱️ 耗時：${timeStr}\n\n太棒了！繼續加油！🚀`);
            }
        } catch (error) {
            console.error('web_app_data error:', error);
        }
    });

    bot.action(/book:(.+)/, async (ctx) => {
        const match = ctx.match as RegExpExecArray;
        const timestamp = parseInt(match[1]);
        if (isNaN(timestamp)) return ctx.reply('❌ 無效的時段。');

        const startTime = new Date(timestamp);
        const endTime = new Date(timestamp + 60 * 60 * 1000);

        try {
            await ctx.answerCbQuery('⏳ 預約中...');
            const event = await calendarManager.createEvent({
                summary: `Focus Session (${ctx.from?.first_name || 'User'})`,
                description: `Booked via Telegram by @${ctx.from?.username || ctx.from?.id}`,
                startTime,
                endTime,
            });

            try {
                const { invalidateEventCache } = await import('./notifier');
                invalidateEventCache();
            } catch (e) { console.error('Failed to invalidate cache:', e); }

            await ctx.editMessageText(
                `✅ 預約成功！\n` +
                `🕐 ${formatDateTime(startTime)} - ${formatTime(endTime)}\n` +
                (event.htmlLink ? `🔗 ${event.htmlLink}` : `📌 ${event.title || event.id}`)
            );
        } catch (error) {
            console.error('createEvent error:', error);
            await ctx.answerCbQuery('❌ 預約失敗');
            await ctx.reply(`❌ 預約失敗：${(error as Error).message}`);
        }
    });

    bot.hears('📝 管理我的預約', async (ctx) => {
        try {
            await ctx.reply('⏳ 正在讀取您的預約...');
            const now = new Date();
            // Fetch events for the next 7 days
            const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

            const events = await calendarManager.listEvents(now, end);

            if (events.length === 0) {
                return ctx.reply('📅 您目前沒有未來的預約。');
            }

            await ctx.reply('以下是您接下來 7 天的行程：');

            for (const event of events) {
                const startTime = new Date(event.start);
                const endTime = new Date(event.end);
                const timeStr = `${formatDate(startTime)} ${formatTime(startTime)} - ${formatTime(endTime)}`;

                await ctx.reply(
                    `📌 ${event.title}\n⏰ ${timeStr}`,
                    Markup.inlineKeyboard([
                        [Markup.button.callback('❌ 取消預約', `confirm_delete:${event.id}`)]
                    ])
                );
            }
        } catch (error) {
            console.error('Manage bookings error:', error);
            ctx.reply('❌ 無法讀取預約，請稍後再試。');
        }
    });

    bot.action(/confirm_delete:(.+)/, async (ctx) => {
        const eventId = ctx.match[1];
        await ctx.editMessageReplyMarkup({
            inline_keyboard: [
                [
                    Markup.button.callback('✅ 確定取消', `delete_event:${eventId}`),
                    Markup.button.callback('🔙 返回', `keep_event:${eventId}`)
                ]
            ]
        });
    });

    bot.action(/keep_event:(.+)/, async (ctx) => {
        const eventId = ctx.match[1];
        await ctx.editMessageReplyMarkup({
            inline_keyboard: [
                [Markup.button.callback('❌ 取消預約', `confirm_delete:${eventId}`)]
            ]
        });
    });

    bot.action(/delete_event:(.+)/, async (ctx) => {
        const eventId = ctx.match[1];
        try {
            await ctx.answerCbQuery('⏳ 正在取消...');
            await calendarManager.deleteEvent(eventId);

            try {
                const { invalidateEventCache } = await import('./notifier');
                invalidateEventCache();
            } catch (e) {
                console.error('Failed to invalidate cache:', e);
            }

            await ctx.editMessageText('✅ 預約已成功取消。');
        } catch (error) {
            console.error('Delete event error:', error);
            await ctx.answerCbQuery('❌ 取消失敗');
            await ctx.reply(`❌ 取消失敗：${(error as Error).message}`);
        }
    });

    bot.help((ctx) => ctx.reply(
        '📖 使用說明：\n' +
        '/start - 顯示主選單\n' +
        '🚀 開啟專注定時器 - 開啟網頁版定時器\n' +
        '📅 查詢今日日曆 - 查看今日行程\n' +
        '📝 管理我的預約 - 列出並管理未來的行程'
    ));

    bot.catch((err, ctx) => {
        console.error(`Bot error for ${ctx.updateType}:`, err);
    });

    return bot;
}

export function getBot(): Telegraf {
    if (!bot) return initBot();
    return bot;
}

export default getBot;
