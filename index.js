import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import fs from 'fs';
import express from 'express';
import { setupReminders } from './utils/scheduler.js';

dotenv.config();
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const app = express();

// Web server to keep Render happy
app.get('/', (req, res) => {
  res.send('Bot is running');
});
app.listen(process.env.PORT || 3000, () => {
  console.log('Server is listening...');
});

// Загрузка сохранённых chatId
let chatIds = new Set();
if (fs.existsSync('./chats.json')) {
  const stored = JSON.parse(fs.readFileSync('./chats.json'));
  chatIds = new Set(stored);
  chatIds.forEach(id => setupReminders(bot, id));
}

// Basic commands
bot.onText(/\/start/, msg => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, '👋 Привет! Я бот, помогающий тебе следовать расписанию. Используй /plan_today для плана на сегодня.');
  chatIds.add(chatId);
  fs.writeFileSync('./chats.json', JSON.stringify([...chatIds]));
  setupReminders(bot, chatId);
});

bot.onText(/\/plan_today/, msg => {
  const schedule = JSON.parse(fs.readFileSync('./schedule.json', 'utf-8'));
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const tasks = schedule[today] || [];
  const formatted = tasks.map(t => `📌 ${t.time} — ${t.task}`).join('\n') || 'Сегодня задач нет.';
  bot.sendMessage(msg.chat.id, `🗓 План на сегодня:\n${formatted}`);
});

bot.onText(/\/next_task/, msg => {
  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();

  const schedule = JSON.parse(fs.readFileSync('./schedule.json', 'utf-8'));
  const today = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const tasks = schedule[today] || [];

  const next = tasks.find(t => {
    const [h, m] = t.time.split(':').map(Number);
    return h * 60 + m > currentTime;
  });

  if (next) {
    bot.sendMessage(msg.chat.id, `⏭ Следующее: ${next.time} — ${next.task}`);
  } else {
    bot.sendMessage(msg.chat.id, '✅ Все задачи на сегодня завершены!');
  }
});
