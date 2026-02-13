import express from 'express';
import { bot } from './bot';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;
const webhookUrl = process.env.WEBHOOK_URL;

app.use(express.json());

if (webhookUrl) {
  app.use(bot.webhookCallback('/webhook'));
  console.log(`Bot configured with webhook: ${webhookUrl}/webhook`);
} else {
  bot.launch().then(() => {
    console.log('Bot started with long polling');
  });
}

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.get('/', (req, res) => {
  res.send('Google Calendar Booking Bot is running.');
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
