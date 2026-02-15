import { Telegraf, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import { CalendarManager } from './calendar';
import * as fs from 'fs';
import * as path from 'path';
import { formatDateTime, formatTime, formatDate } from './utils';
import { callAiParser } from './ai_caller';

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
        ctx.reply('此功能開發中 🚧');
    });

    bot.on(message('text'), async (ctx) => {
        const text = ctx.message.text;
        // Skip if it matches keyboard buttons
        if (text === '📅 查詢今日日曆' || text === '📝 管理我的預約' || text.startsWith('/')) return;

        try {
            await ctx.reply('🤖 正在解析您的請求...');
            const parsed = callAiParser(text);

            if (parsed.error) {
                return ctx.reply(`❌ AI 解析失敗：${parsed.error}`);
            }

            const { task, duration, start_time } = parsed;
            let startTime: Date;

            if (start_time === 'now') {
                startTime = new Date();
            } else if (start_time.includes(':')) {
                const [h, m] = start_time.split(':').map(Number);
                const now = new Date();
                // Assume Taipei time for user input
                const nowTaipei = new Date(now.getTime() + 8 * 3600000);
                startTime = new Date(Date.UTC(nowTaipei.getUTCFullYear(), nowTaipei.getUTCMonth(), nowTaipei.getUTCDate(), h - 8, m, 0));
            } else {
                return ctx.reply(`🤔 我理解您的任務是「${task}」(${duration} 分鐘)，但我無法確定開始時間「${start_time}」。請明確指出時間，例如「下午 3 點」或「15:00」。`);
            }

            const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

            await ctx.reply(`✨ 我幫您解析了請求：\n📝 任務：${task}\n⏱️ 長度：${duration} 分鐘\n⏰ 時間：${formatDateTime(startTime)}\n\n是否要預約？`,
                Markup.inlineKeyboard([
                    [Markup.button.callback('✅ 確認預約', `book_ai:${startTime.getTime()}:${duration}:${task}`)],
                    [Markup.button.callback('❌ 取消', 'cancel_ai')]
                ])
            );
        } catch (error) {
            console.error('AI parser error:', error);
            ctx.reply('❌ 處理請求時發生錯誤。');
        }
    });

    bot.action(/book_ai:(.+):(.+):(.+)/, async (ctx) => {
        const startTime = new Date(parseInt(ctx.match[1]));
        const duration = parseInt(ctx.match[2]);
        const task = ctx.match[3];
        const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

        try {
            await ctx.answerCbQuery('⏳ 正在同步到 Google 日曆...');
            const event = await calendarManager.createEvent({
                summary: `${task} (AI Booked)`,
                description: `Booked via Telegram AI Parser`,
                startTime,
                endTime,
            });
            await ctx.editMessageText(
                `✅ 預約成功！\n` +
                `📝 任務：${task}\n` +
                `🕐 ${formatDateTime(startTime)} - ${formatTime(endTime)}` +
                (event.htmlLink ? `\n🔗 ${event.htmlLink}` : '')
            );
        } catch (error) {
            console.error('AI booking error:', error);
            await ctx.answerCbQuery('❌ 預約失敗');
            await ctx.reply(`❌ 預約失敗：${(error as Error).message}`);
        }
    });

    bot.action('cancel_ai', async (ctx) => {
        await ctx.answerCbQuery('已取消');
        await ctx.editMessageText('已取消預約。');
    });

    bot.help((ctx) => ctx.reply(
        '📖 使用說明：\n' +
        '/start - 顯示主選單\n' +
        '🚀 開啟專注定時器 - 開啟網頁版定時器\n' +
        '📅 查詢今日日曆 - 查看今日行程\n' +
        '📝 管理我的預約 - (開發中)\n\n' +
        '🤖 您也可以直接輸入自然語言，例如：\n' +
        '「我要專注 30 分鐘」\n' +
        '「幫我預約下午 2 點的深層工作 1 小時」'
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
