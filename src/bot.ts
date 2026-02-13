import { Telegraf, Markup } from 'telegraf';
import { CalendarService } from './calendar';
import { DateTime } from 'luxon';

const calendarService = new CalendarService();
const WHITELIST = process.env.WHITELIST_IDS?.split(',') || [];

export const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');

// Middleware for Whitelist
bot.use(async (ctx, next) => {
    const userId = ctx.from?.id.toString();
    if (WHITELIST.length > 0 && userId && !WHITELIST.includes(userId)) {
        return ctx.reply('抱歉，您不在使用白名單中。');
    }
    return next();
});

bot.start((ctx) => {
  ctx.reply('歡迎使用 Google 日曆預約機器人！請選擇操作：',
    Markup.inlineKeyboard([
      [Markup.button.callback('📅 預約行程', 'book_start')],
      [Markup.button.callback('📋 管理行程', 'manage_list')]
    ])
  );
});

bot.action('book_start', (ctx) => {
  ctx.editMessageText('請選擇預約時長：',
    Markup.inlineKeyboard([
      [Markup.button.callback('30 分鐘', 'duration_30'), Markup.button.callback('1 小時', 'duration_60')],
      [Markup.button.callback('2 小時', 'duration_120')],
      [Markup.button.callback('🔙 返回', 'main_menu')]
    ])
  );
});

bot.action(/duration_(\d+)/, (ctx) => {
  const duration = ctx.match[1];
  const now = DateTime.now().setZone('Asia/Taipei');
  const buttons = [];
  for (let i = 0; i < 7; i++) {
    const d = now.plus({ days: i });
    buttons.push([Markup.button.callback(d.toFormat('yyyy-MM-dd (ccc)'), `date_${d.toISODate()}_${duration}`)]);
  }
  buttons.push([Markup.button.callback('🔙 返回', 'book_start')]);
  ctx.editMessageText('請選擇預約日期：', Markup.inlineKeyboard(buttons));
});

bot.action(/date_([\d-]+)_(\d+)/, async (ctx) => {
  const date = ctx.match[1];
  const duration = parseInt(ctx.match[2]);

  await ctx.answerCbQuery('正在查詢可用時段...');
  try {
      const slots = await calendarService.getFreeSlots(date, duration);
      if (slots.length === 0) {
        return ctx.reply('該日期已無可用時段，請選擇其他日期。');
      }

      const buttons = slots.map(slot => [
        Markup.button.callback(slot.toFormat('HH:mm'), `confirm_${slot.toISO()}_${duration}`)
      ]);
      buttons.push([Markup.button.callback('🔙 返回', `duration_${duration}`)]);

      ctx.editMessageText(`請選擇 ${date} 的預約時段：`, Markup.inlineKeyboard(buttons));
  } catch (error) {
      console.error(error);
      ctx.reply('查詢失敗，請檢查設定或稍後再試。');
  }
});

bot.action(/confirm_([^ ]+)_(\d+)/, async (ctx) => {
    const startIso = ctx.match[1];
    const duration = parseInt(ctx.match[2]);
    const startTime = DateTime.fromISO(startIso).setZone('Asia/Taipei');

    await ctx.answerCbQuery('正在處理預約...');
    try {
        const userId = ctx.from?.id.toString() || 'unknown';
        const userName = ctx.from?.first_name || 'User';
        const summary = `預約: ${userName} (tg_user_${userId})`;

        await calendarService.createEvent(summary, startTime, duration);

        ctx.editMessageText(`✅ 預約成功！\n\n項目：${summary}\n時間：${startTime.toFormat('yyyy-MM-dd HH:mm')}\n時長：${duration} 分鐘`);
    } catch (error) {
        console.error(error);
        ctx.reply('預約失敗，請稍後再試。');
    }
});

bot.action('manage_list', async (ctx) => {
    const userId = ctx.from?.id.toString() || 'unknown';
    await ctx.answerCbQuery('正在查詢您的預約...');
    try {
        const events = await calendarService.listUserEvents(userId);
        if (events.length === 0) {
            return ctx.editMessageText('目前沒有您的預約記錄。', Markup.inlineKeyboard([[Markup.button.callback('🔙 返回', 'main_menu')]]));
        }

        let message = '您的預約記錄：\n\n';
        const buttons = [];
        for (const event of events) {
            const start = DateTime.fromISO(event.start?.dateTime || event.start?.date || '').setZone('Asia/Taipei');
            message += `🔹 ${start.toFormat('yyyy-MM-dd HH:mm')}\n`;
            buttons.push([Markup.button.callback(`❌ 取消 ${start.toFormat('MM-dd HH:mm')}`, `cancel_${event.id}`)]);
        }
        buttons.push([Markup.button.callback('🔙 返回', 'main_menu')]);

        ctx.editMessageText(message, Markup.inlineKeyboard(buttons));
    } catch (error) {
        console.error(error);
        ctx.reply('查詢失敗，請稍後再試。');
    }
});

bot.action(/cancel_(.+)/, async (ctx) => {
    const eventId = ctx.match[1];
    await ctx.answerCbQuery('正在取消預約...');
    try {
        await calendarService.deleteEvent(eventId);
        ctx.editMessageText('✅ 預約已取消。', Markup.inlineKeyboard([[Markup.button.callback('🔙 返回', 'main_menu')]]));
    } catch (error) {
        console.error(error);
        ctx.reply('取消失敗，請稍後再試。');
    }
});

bot.action('main_menu', (ctx) => {
    ctx.editMessageText('歡迎使用 Google 日曆預約機器人！請選擇操作：',
        Markup.inlineKeyboard([
          [Markup.button.callback('📅 預約行程', 'book_start')],
          [Markup.button.callback('📋 管理行程', 'manage_list')]
        ])
    );
});
