import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import fs from 'fs';
import express from 'express';
import { DateTime } from 'luxon';
import { startScheduler } from './utils/scheduler.js';

dotenv.config();

// --- Конфигурация ---
const BOT_TOKEN = process.env.BOT_TOKEN;
const PORT = process.env.PORT || 3000;
const CHATS_FILE = './chats.json';
const SCHEDULE_FILE = './schedule.json';
const TIMEZONE = 'Asia/Tbilisi'; // Укажите ваш часовой пояс (GMT+4)

// --- Инициализация ---
const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const app = express();

// --- Хранилище пользователей ---
let chatIds = new Set();

// Загрузка сохранённых chatId из файла
try {
  if (fs.existsSync(CHATS_FILE)) {
    const storedIds = JSON.parse(fs.readFileSync(CHATS_FILE));
    chatIds = new Set(storedIds);
    console.log(`Loaded ${chatIds.size} users from file.`);
  }
} catch (error) {
  console.error('Could not load chat IDs:', error);
}

// Функция для сохранения chatId
function saveChatIds() {
  fs.writeFileSync(CHATS_FILE, JSON.stringify([...chatIds]));
}

// --- Запуск планировщика (ЕДИНОЖДЫ) ---
// Передаем в планировщик экземпляр бота и функцию, 
// которая всегда будет возвращать актуальный список пользователей.
startScheduler(bot, () => chatIds);


// --- Веб-сервер для хостинга (Render, Heroku и т.д.) ---
app.get('/', (req, res) => {
  res.send('Bot is running smoothly!');
});
app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}...`);
});


// --- Команды бота ---

bot.onText(/\/start/, msg => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, '👋 Привет! Я бот, помогающий тебе следовать расписанию. Я буду присылать уведомления о задачах.\n\nИспользуй /plan_today для просмотра плана на сегодня и /next_task для следующей задачи.');
  
  if (!chatIds.has(chatId)) {
    chatIds.add(chatId);
    saveChatIds();
    console.log(`New user added: ${chatId}. Total users: ${chatIds.size}`);
  }
});

bot.onText(/\/plan_today/, msg => {
  const now = DateTime.now().setZone(TIMEZONE);
  const today = now.toFormat('cccc').toLowerCase(); // e.g., 'sunday'
  
  const schedule = JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf-8'));
  const tasks = schedule[today] || [];
  
  const formatted = tasks.map(t => `📌 ${t.time} — ${t.task}`).join('\n');
  const message = `🗓 **План на сегодня (${now.toFormat('dd.MM.yyyy')})**:\n\n${formatted || 'Сегодня задач нет.'}`;
  
  bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
});

bot.onText(/\/next_task/, msg => {
  const now = DateTime.now().setZone(TIMEZONE);
  const today = now.toFormat('cccc').toLowerCase(); // 'sunday'
  
  const schedule = JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf-8'));
  const tasks = schedule[today] || [];

  const nextTask = tasks.find(task => {
    const taskTime = DateTime.fromFormat(task.time, 'HH:mm', { zone: TIMEZONE });
    // Сравниваем только время, дата будет сегодняшней
    return taskTime > now;
  });

  if (nextTask) {
    bot.sendMessage(msg.chat.id, `⏭ **Следующая задача:**\n${nextTask.time} — ${nextTask.task}`, { parse_mode: 'Markdown' });
  } else {
    bot.sendMessage(msg.chat.id, '✅ Все задачи на сегодня выполнены!');
  }
});

console.log('Bot has been started successfully!');
