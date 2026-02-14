import { Telegraf, Markup } from 'telegraf';
import { CalendarManager } from './calendar';
import * as dotenv from 'dotenv';
dotenv.config();

if (!process.env.TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN must be defined');
}

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const calendarManager = new CalendarManager();

// ─── Helpers ───

/** Format a Date to HH:MM in Asia/Taipei — works on Alpine (no ICU needed) */
function formatTime(d: Date): string {
    const h = new Date(d.getTime() + 8 * 3600000).getUTCHours();
    const m = new Date(d.getTime() + 8 * 3600000).getUTCMinutes();
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
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
            ['📅 查詢今日空檔', '📝 管理我的預約']
        ]).resize()
    );
});

bot.hears('📅 查詢今日空檔', async (ctx) => {
    try {
        await ctx.reply('⏳ 正在查詢...');
        const now = new Date();
        const slots = await calendarManager.getFreeSlots(now);

        if (slots.length === 0) {
            return ctx.reply('今日已無空檔。');
        }

        const buttons = slots.map(slot =>
            Markup.button.callback(
                `${formatTime(slot.start)} - ${formatTime(slot.end)}`,
                `book:${slot.start.getTime()}`
            )
        );

        // 2 buttons per row
        const keyboard = [];
        for (let i = 0; i < buttons.length; i += 2) {
            keyboard.push(buttons.slice(i, i + 2));
        }

        ctx.reply(
            `📅 ${formatDate(now)} 可用時段：\n點擊即可預約 (每段 1 小時)`,
            Markup.inlineKeyboard(keyboard)
        );
    } catch (error) {
        console.error('getFreeSlots error:', error);
        ctx.reply('❌ 查詢失敗，請稍後再試。');
    }
});

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
    '📅 查詢今日空檔 - 查看可預約時段\n' +
    '📝 管理我的預約 - (開發中)'
));

// Catch unhandled errors
bot.catch((err, ctx) => {
    console.error(`Bot error for ${ctx.updateType}:`, err);
});

export default bot;
