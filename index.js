import express from 'express';
import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import fs from 'fs';
import { setupReminders } from './utils/scheduler.js';

dotenv.config();

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// Команды
bot.onText(/^\/start(@\w+)?$/, msg => {
  bot.sendMessage(msg.chat.id, '👋 Привет! Я бот, помогающий тебе следовать расписанию. Используй /plan_today для плана на сегодня.');
  setupReminders(bot, msg.chat.id);
});

bot.onText(/^\/plan_today(@\w+)?$/, msg => {
  try {
    const schedule = JSON.parse(fs.readFileSync('./schedule.json', 'utf-8'));
    const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    const today = days[new Date().getDay()];
    const tasks = schedule[today] || [];
    const formatted = tasks.map(t => `🕒 ${t.time} — ${t.task}`).join('\n') || 'Сегодня задач нет.';
    bot.sendMessage(msg.chat.id, `📅 План на сегодня:\n${formatted}`);
  } catch (err) {
    bot.sendMessage(msg.chat.id, '❌ Ошибка при загрузке плана на сегодня.');
    console.error(err);
  }
});

bot.onText(/^\/next_task(@\w+)?$/, msg => {
  try {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    const today = days[now.getDay()];
    const schedule = JSON.parse(fs.readFileSync('./schedule.json', 'utf-8'));
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
  } catch (err) {
    bot.sendMessage(msg.chat.id, '❌ Ошибка при получении следующей задачи.');
    console.error(err);
  }
});

// Express-заглушка для Render
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Бот работает ✅');
});

app.listen(PORT, () => {
  console.log(`✅ Сервер слушает порт ${PORT}`);
});
