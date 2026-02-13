import { Telegraf, Context, Markup } from 'telegraf';
import { CalendarManager } from './calendar';
import * as dotenv from 'dotenv';
dotenv.config();

// Ensure token is present
if (!process.env.TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN must be defined');
}

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const calendarManager = new CalendarManager();

// Middleware for auth could go here (whitelist CHECK)

bot.start((ctx) => {
    ctx.reply('歡迎使用 Focus Timer Bot！請選擇功能：',
        Markup.keyboard([
            ['📅 查詢今日空檔', '📝 管理我的預約']
        ]).resize()
    );
});

bot.hears('📅 查詢今日空檔', async (ctx) => {
    try {
        const now = new Date();
        const slots = await calendarManager.getFreeSlots(now);

        if (slots.length === 0) {
            return ctx.reply('今日已無空檔。');
        }

        // Create inline keyboard buttons for each slot
        const buttons = slots.map(slot => {
            const startStr = slot.start.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
            const endStr = slot.end.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
            // Store minimal data in callback_data: type:startTimeISO
            // To fit 64 bytes, we might need to be concise. 
            // format: book:timestamp
            return Markup.button.callback(
                `${startStr} - ${endStr}`,
                `book:${slot.start.getTime()}`
            );
        });

        // Split into chunks of 2 for better layout
        const keyboard = [];
        for (let i = 0; i < buttons.length; i += 2) {
            keyboard.push(buttons.slice(i, i + 2));
        }

        ctx.reply(`今日 (${now.toLocaleDateString()}) 可用時段 (點擊預約):`,
            Markup.inlineKeyboard(keyboard)
        );
    } catch (error) {
        console.error(error);
        ctx.reply('查詢失敗，請稍後再試。');
    }
});

bot.action(/book:(.+)/, async (ctx) => {
    // Telegraf types for action might need casting or specific type usage if strict
    // but usually with Regex it infers match.
    // If ctx.match is issue, we can assume it works in runtime or cast it.
    // Let's use 'any' cast for safety if types are strict, or rely on inference.
    // In recent Telegraf, ctx.match is available on matched context.
    const match = ctx.match as RegExpExecArray;
    const timestamp = parseInt(match[1]);
    const startTime = new Date(timestamp);
    const endTime = new Date(timestamp + 60 * 60 * 1000); // Assume 1 hour for now

    try {
        // Double check availability (optional but recommended)
        // For now, proceed to book
        const event = await calendarManager.createEvent({
            summary: `Focus Session (${ctx.from?.first_name || 'User'})`,
            description: `Booked via Telegram by ID: ${ctx.from?.id}`,
            startTime: startTime,
            endTime: endTime
        });

        await ctx.reply(`✅ 預約成功！\n時間：${startTime.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}\n連結：${event.htmlLink}`);
        // Optionally edit the original message to remove buttons or mark as booked
        // await ctx.editMessageText(`✅ 已預約: ${startTime.toLocaleString('zh-TW')}`, undefined);
    } catch (error) {
        console.error(error);
        await ctx.reply('❌ 預約失敗，請重試。');
    }
});

bot.hears('📝 管理我的預約', async (ctx) => {
    // This would require listing events filtered by user. 
    // Since we don't store user mapping yet, we can skip or show a placeholder.
    ctx.reply('此功能尚未實作 (需資料庫支援)。');
});

bot.help((ctx) => ctx.reply('Send /start to restart.'));

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

export default bot;
