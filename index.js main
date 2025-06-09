import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import fs from 'fs';
import express from 'express';
import { DateTime } from 'luxon';

dotenv.config();

// --- Конфигурация ---
const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL; // Важный новый параметр!
const PORT = process.env.PORT || 3000;
const CHATS_FILE = './chats.json';
const SCHEDULE_FILE = './schedule.json';
const TIMEZONE = 'Asia/Tbilisi'; // Убедитесь, что часовой пояс верный (GMT+4)

// --- Инициализация ---
// ВАЖНО: Мы больше не используем polling!
const bot = new TelegramBot(BOT_TOKEN);
const app = express();

// Необходимо для парсинга JSON-тела запросов от Telegram
app.use(express.json());

// --- Настройка Webhook ---
// Устанавливаем вебхук при запуске
bot.setWebHook(`${WEBHOOK_URL}/bot${BOT_TOKEN}`)
  .then(() => console.log(`Webhook set to ${WEBHOOK_URL}`))
  .catch(err => console.error('Error setting webhook:', err));

// Обрабатываем входящие обновления от Telegram
app.post(`/bot${BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200); // Отвечаем Telegram, что все получили
});

// --- Веб-сервер для хостинга ---
app.get('/', (req, res) => {
  res.send('Bot is running with webhooks!');
});
app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}...`);
});


// --- Логика планировщика и хранилища (объединено для простоты) ---

let chatIds = new Set();

// Загрузка сохранённых chatId
try {
  if (fs.existsSync(CHATS_FILE)) {
    const storedIds = JSON.parse(fs.readFileSync(CHATS_FILE));
    chatIds = new Set(storedIds);
    console.log(`Loaded ${chatIds.size} users from file.`);
  }
} catch (error) {
  console.error('Could not load chat IDs:', error);
}

function saveChatIds() {
  fs.writeFileSync(CHATS_FILE, JSON.stringify([...chatIds]));
}

// --- Запуск ЕДИНОГО планировщика ---
function startScheduler() {
    console.log('Global scheduler has been started.');
    const sentNotifications = new Set();

    setInterval(() => {
        const now = DateTime.now().setZone(TIMEZONE);
        const today = now.toFormat('cccc').toLowerCase();
        const currentTime = now.toFormat('HH:mm');

        if (chatIds.size === 0) return;

        const schedule = JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf-8'));
        const tasks = schedule[today] || [];

        for (const task of tasks) {
            if (task.time === currentTime) {
                for (const chatId of chatIds) {
                    const notificationKey = `${task.time}-${today}-${chatId}`;
                    if (!sentNotifications.has(notificationKey)) {
                        const message = `🔔 **Напоминание:**\n${task.time} — ${task.task}`;
                        bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
                           .catch(err => console.error(`Failed to send to ${chatId}:`, err.message));
                        sentNotifications.add(notificationKey);
                    }
                }
            }
        }
        // Очистка кэша в полночь для предотвращения переполнения памяти
        if (currentTime === '00:00') {
            console.log('Clearing daily notifications cache.');
            sentNotifications.clear();
        }

    }, 60 * 1000); // Проверка каждую минуту
}

startScheduler(); // Запускаем планировщик один раз


// --- Команды бота (остаются без изменений) ---

bot.onText(/\/start/, msg => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, '👋 Привет! Я бот для напоминаний. Я буду присылать уведомления о задачах по расписанию.');
  
  if (!chatIds.has(chatId)) {
    chatIds.add(chatId);
    saveChatIds();
    console.log(`New user added: ${chatId}. Total users: ${chatIds.size}`);
  }
});

// Остальные команды (/plan_today, /next_task) остаются такими же, как в предыдущей версии.
// (Код для них здесь не дублируется, но он должен присутствовать в вашем файле)
bot.onText(/\/plan_today/, msg => {
  const now = DateTime.now().setZone(TIMEZONE);
  const today = now.toFormat('cccc').toLowerCase();
  
  const schedule = JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf-8'));
  const tasks = schedule[today] || [];
  
  const formatted = tasks.map(t => `📌 ${t.time} — ${t.task}`).join('\n');
  const message = `🗓 **План на сегодня (${now.toFormat('dd.MM.yyyy')})**:\n\n${formatted || 'Сегодня задач нет.'}`;
  
  bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
});

bot.onText(/\/next_task/, msg => {
  const now = DateTime.now().setZone(TIMEZONE);
  const today = now.toFormat('cccc').toLowerCase();
  
  const schedule = JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf-8'));
  const tasks = schedule[today] || [];

  const nextTask = tasks.find(task => {
    const taskTime = DateTime.fromFormat(task.time, 'HH:mm', { zone: TIMEZONE });
    return taskTime > now;
  });

  if (nextTask) {
    bot.sendMessage(msg.chat.id, `⏭ **Следующая задача:**\n${nextTask.time} — ${nextTask.task}`, { parse_mode: 'Markdown' });
  } else {
    bot.sendMessage(msg.chat.id, '✅ Все задачи на сегодня выполнены!');
  }
});


console.log('Bot is starting with Webhook configuration...');
