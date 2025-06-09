import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import fs from 'fs';
import express from 'express';
import { DateTime } from 'luxon';

dotenv.config();

// --- Конфигурация ---
const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const PORT = process.env.PORT || 3000;
const CHATS_FILE = './chats.json';
const SCHEDULE_FILE = './schedule.json';
const TIMEZONE = 'Asia/Tbilisi'; // Убедитесь, что часовой пояс верный (GMT+4)

// --- Инициализация ---
const bot = new TelegramBot(BOT_TOKEN);
const app = express();
app.use(express.json());

// --- Настройка Webhook ---
bot.setWebHook(`${WEBHOOK_URL}/bot${BOT_TOKEN}`)
  .then(() => console.log(`[SETUP] Webhook set to ${WEBHOOK_URL}`))
  .catch(err => console.error('[ERROR] Error setting webhook:', err));

app.post(`/bot${BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

app.get('/', (req, res) => {
  res.send('Bot is running with webhooks! Debug mode is ON.');
});

app.listen(PORT, () => {
  console.log(`[SETUP] Server is listening on port ${PORT}...`);
});


// --- Логика планировщика и хранилища ---
let chatIds = new Set();
try {
  if (fs.existsSync(CHATS_FILE)) {
    const storedIds = JSON.parse(fs.readFileSync(CHATS_FILE));
    chatIds = new Set(storedIds);
    console.log(`[SETUP] Loaded ${chatIds.size} users from file: ${[...chatIds].join(', ')}`);
  }
} catch (error) {
  console.error('[ERROR] Could not load chat IDs:', error);
}

function saveChatIds() {
  fs.writeFileSync(CHATS_FILE, JSON.stringify([...chatIds]));
}

// --- Запуск ЕДИНОГО планировщика ---
function startScheduler() {
    console.log('[SCHEDULER] Global scheduler has been started.');
    const sentNotifications = new Set();

    // Запускаем цикл проверки каждую минуту
    setInterval(() => {
        const now = DateTime.now().setZone(TIMEZONE);
        const today = now.toFormat('cccc').toLowerCase();
        const currentTime = now.toFormat('HH:mm');

        // --- ОТЛАДОЧНЫЙ ВЫВОД ---
        console.log(`\n[DEBUG] Tick! Current Time: ${now.toFormat('HH:mm:ss')}, Day: ${today}`);
        console.log(`[DEBUG] Users to notify: ${chatIds.size > 0 ? [...chatIds].join(', ') : 'None'}`);
        // --- КОНЕЦ ОТЛАДОЧНОГО ВЫВОДА ---

        if (chatIds.size === 0) {
            return; // Нечего делать, если нет пользователей
        }

        try {
            const schedule = JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf-8'));
            const tasks = schedule[today] || [];
            
            if (tasks.length === 0) {
                console.log(`[DEBUG] No tasks scheduled for ${today}.`);
                return;
            }

            console.log(`[DEBUG] Checking ${tasks.length} tasks for ${today}...`);

            for (const task of tasks) {
                // Сравнение времени из расписания с текущим временем
                if (task.time === currentTime) {
                    console.log(`[DEBUG] MATCH FOUND! Task: "${task.task}" at ${task.time}`);
                    
                    for (const chatId of chatIds) {
                        const notificationKey = `${task.time}-${today}-${chatId}`;
                        
                        if (!sentNotifications.has(notificationKey)) {
                            console.log(`[DEBUG] Preparing to send notification for key: ${notificationKey}`);
                            const message = `🔔 **Напоминание:**\n${task.time} — ${task.task}`;
                            bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
                               .then(() => console.log(`[SUCCESS] Notification sent to ${chatId} for task "${task.task}"`))
                               .catch(err => console.error(`[ERROR] Failed to send to ${chatId}:`, err.message));
                            
                            sentNotifications.add(notificationKey);
                        } else {
                            console.log(`[DEBUG] Notification already sent for key: ${notificationKey}. Skipping.`);
                        }
                    }
                }
            }
        } catch (e) {
            console.error('[ERROR] A critical error occurred in the scheduler interval:', e);
        }

        // Очистка кэша в полночь
        if (currentTime === '00:00') {
            console.log('[SCHEDULER] Performing daily cleanup of notifications cache.');
            sentNotifications.clear();
        }

    }, 60 * 1000); 
}

startScheduler(); // Запускаем планировщик


// --- Команды бота ---
bot.onText(/\/start/, msg => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, '👋 Привет! Я бот для напоминаний. Отладочный режим включен. Я буду присылать уведомления о задачах по расписанию.');
  
  if (!chatIds.has(chatId)) {
    chatIds.add(chatId);
    saveChatIds();
    console.log(`[EVENT] New user added: ${chatId}. Total users: ${chatIds.size}`);
  } else {
    console.log(`[EVENT] User ${chatId} restarted the bot.`);
  }
});

// Остальные команды остаются без изменений
bot.onText(/\/plan_today/, msg => {
    // ... ваш код для /plan_today
});
bot.onText(/\/next_task/, msg => {
    // ... ваш код для /next_task
});

console.log('[SETUP] Bot is starting with Webhook configuration...');

```

