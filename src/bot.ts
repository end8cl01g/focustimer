import { Telegraf, Markup } from 'telegraf';
import { CalendarManager } from './calendar';
import * as dotenv from 'dotenv';
dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const calendarManager = new CalendarManager();

// ─── Helpers ───

/** Format a Date to HH:mm in Asia/Taipei */
function formatTime(d: Date): string {
    const shifted = new Date(d.getTime() + 8 * 3600000);
    return `${String(shifted.getUTCHours()).padStart(2, '0')}:${String(shifted.getUTCMinutes()).padStart(2, '0')}`;
}

/** Format a Date to YYYY/MM/DD in Asia/Taipei */
function formatDate(d: Date): string {
    const shifted = new Date(d.getTime() + 8 * 3600000);
    return `${shifted.getUTCFullYear()}/${String(shifted.getUTCMonth() + 1).padStart(2, '0')}/${String(shifted.getUTCDate()).padStart(2, '0')}`;
}

/** Format a Date to full datetime string */
function formatDateTime(d: Date): string {
    return `${formatDate(d)} ${formatTime(d)}`;
}

// ─── Bot Commands ───

bot.start((ctx) => {
    ctx.reply('歡迎使用 Focus Timer Bot！請選擇功能：',
        Markup.keyboard([
            ['📅 查詢今日日曆', '📝 管理我的預約']
        ]).resize()
    );
});

bot.hears('📅 查詢今日日曆', async (ctx) => {
    try {
        await ctx.reply('⏳ 正在查詢...');
        const now = new Date();

        // Get start and end of today in Taipei (UTC+8)
        const taipeiNow = new Date(now.getTime() + 8 * 3600000);
        const startOfDay = new Date(Date.UTC(taipeiNow.getUTCFullYear(), taipeiNow.getUTCMonth(), taipeiNow.getUTCDate(), -8, 0, 0));
        const endOfDay = new Date(Date.UTC(taipeiNow.getUTCFullYear(), taipeiNow.getUTCMonth(), taipeiNow.getUTCDate(), 15, 59, 59, 999));

        const events = await calendarManager.listEvents(startOfDay, endOfDay);

        if (events.length === 0) {
            return ctx.reply(`📅 ${formatDate(now)} 今日尚無行程。`);
        }

        let message = `📅 ${formatDate(now)} 今日行程：\n\n`;
        events.forEach(event => {
            message += `📍 ${formatTime(event.start)} - ${formatTime(event.end)}\n`;
            message += `📝 ${event.title}\n`;
            if (event.description) {
                // Truncate description if too long
                const desc = event.description.length > 50 ? event.description.substring(0, 47) + '...' : event.description;
                message += `💬 ${desc}\n`;
            }
            message += `\n`;
        });

        ctx.reply(message);
    } catch (error) {
        console.error('listEvents error:', error);
        ctx.reply('❌ 查詢失敗，請稍後再試。');
    }
});

// We keep the booking action handler in case it's used by other parts of the bot later
bot.action(/book:(.+)/, async (ctx) => {
    const match = ctx.match as RegExpExecArray;
    const timestamp = parseInt(match[1]);
    if (isNaN(timestamp)) {
        return ctx.reply('❌ 無效的時段。');
    }

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

        // Edit the original message to show confirmation
        await ctx.editMessageText(
            `✅ 預約成功！\n` +
            `🕐 ${formatDateTime(startTime)} - ${formatTime(endTime)}\n` +
            (event.htmlLink ? `🔗 ${event.htmlLink}` : `📌 ${event.title || event.id}`)
        );
    } catch (error) {
        console.error('createEvent error:', error);
        await ctx.answerCbQuery('❌ 預約失敗');
        await ctx.reply('❌ 預約失敗，請重試。');
    }
});

bot.hears('📝 管理我的預約', async (ctx) => {
    ctx.reply('此功能開發中 🚧');
});

bot.help((ctx) => ctx.reply(
    '📖 使用說明：\n' +
    '/start - 顯示主選單\n' +
    '📅 查詢今日日曆 - 查看今日行程\n' +
    '📝 管理我的預約 - (開發中)'
));

// Catch unhandled errors
bot.catch((err, ctx) => {
    console.error(`Bot error for ${ctx.updateType}:`, err);
});

export default bot;
