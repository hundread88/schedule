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
const TIMEZONE = 'Asia/Tbilisi'; // Ваш часовой пояс (GMT+4)

// --- Инициализация ---
const bot = new TelegramBot(BOT_TOKEN);
const app = express();
app.use(express.json());

// --- Роут для UptimeRobot ---
// Этот URL будет всегда отвечать "OK", чтобы UptimeRobot был доволен
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// --- Настройка Webhook ---
bot.setWebHook(`${WEBHOOK_URL}/bot${BOT_TOKEN}`)
  .then(() => console.log(`[SETUP] Webhook successfully set.`))
  .catch(err => console.error('[ERROR] Critical error setting webhook:', err));

app.post(`/bot${BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`[SETUP] Server is listening on port ${PORT}...`);
});

// --- Вспомогательные функции для работы с расписанием ---
const readSchedule = () => {
    try {
        if (!fs.existsSync(SCHEDULE_FILE)) {
            const initialSchedule = { monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [] };
            fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(initialSchedule, null, 2));
            return initialSchedule;
        }
        const data = fs.readFileSync(SCHEDULE_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        console.error("Error reading or parsing schedule file:", e);
        return {};
    }
};

const writeSchedule = (schedule) => {
    try {
        fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(schedule, null, 2));
    } catch (e) {
        console.error("Error writing schedule file:", e);
    }
};

// --- Логика планировщика и хранилища ---
let chatIds = new Set();
try {
  if (fs.existsSync(CHATS_FILE)) {
    chatIds = new Set(JSON.parse(fs.readFileSync(CHATS_FILE)));
  }
} catch (error) {
  console.error('[ERROR] Could not load chat IDs:', error);
}
const saveChatIds = () => fs.writeFileSync(CHATS_FILE, JSON.stringify([...chatIds]));

function startScheduler() {
    console.log('[SCHEDULER] Scheduler started.');
    const sentNotifications = new Set();
    setInterval(() => {
        const now = DateTime.now().setZone(TIMEZONE);
        const today = now.toFormat('cccc').toLowerCase();
        const currentTime = now.toFormat('HH:mm');
        if (chatIds.size === 0) return;
        const schedule = readSchedule();
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
        if (currentTime === '00:00') {
            sentNotifications.clear();
        }
    }, 60 * 1000);
}
startScheduler();

// --- Команды бота ---

bot.onText(/\/start/, msg => {
  const chatId = msg.chat.id;
  const helpText = `
👋 **Привет! Я твой бот-планировщик.**
Я буду присылать напоминания о задачах в нужное время.

**Основные команды:**
▫️ /plan_today - Показать план на сегодня
▫️ /next_task - Показать следующую задачу

**Управление расписанием:**
▫️ \`/add день время задача\`
   Пример: \`/add tuesday 19:00 Учить JavaScript\`
▫️ \`/list день\`
   Пример: \`/list tuesday\`
▫️ \`/del день номер\`
   Пример: \`/del tuesday 3\`

Дни недели: \`monday, tuesday, wednesday, thursday, friday, saturday, sunday\`.
  `;
  bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
  if (!chatIds.has(chatId)) {
    chatIds.add(chatId);
    saveChatIds();
  }
});

// === Команды управления расписанием ===
bot.onText(/\/add (\w+) (\d{2}:\d{2}) (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const day = match[1].toLowerCase();
    const time = match[2];
    const task = match[3];
    const schedule = readSchedule();
    if (!schedule.hasOwnProperty(day)) {
        return bot.sendMessage(chatId, `❌ Неверный день недели. Используйте: monday, tuesday, и т.д.`);
    }
    schedule[day].push({ time, task });
    schedule[day].sort((a, b) => a.time.localeCompare(b.time));
    writeSchedule(schedule);
    bot.sendMessage(chatId, `✅ Задача "${task}" добавлена на ${day} в ${time}.`);
});

bot.onText(/\/list (\w+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const day = match[1].toLowerCase();
    const schedule = readSchedule();
    if (!schedule.hasOwnProperty(day)) {
        return bot.sendMessage(chatId, `❌ Неверный день недели.`);
    }
    const tasks = schedule[day];
    if (!tasks || tasks.length === 0) {
        return bot.sendMessage(chatId, `На ${day} задач нет.`);
    }
    const formattedList = tasks.map((t, index) => `${index + 1}. ${t.time} - ${t.task}`).join('\n');
    bot.sendMessage(chatId, `**План на ${day}:**\n${formattedList}`, { parse_mode: 'Markdown' });
});

bot.onText(/\/del (\w+) (\d+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const day = match[1].toLowerCase();
    const index = parseInt(match[2], 10) - 1;
    const schedule = readSchedule();
    if (!schedule.hasOwnProperty(day) || !schedule[day]) {
        return bot.sendMessage(chatId, `❌ Неверный день недели.`);
    }
    if (index < 0 || index >= schedule[day].length) {
        return bot.sendMessage(chatId, `❌ Неверный номер задачи. Используйте /list ${day}, чтобы увидеть доступные номера.`);
    }
    const removedTask = schedule[day].splice(index, 1)[0];
    writeSchedule(schedule);
    bot.sendMessage(chatId, `🗑️ Задача "${removedTask.task}" удалена.`);
});


// === Основные команды просмотра расписания (ПОЛНОСТЬЮ ВОССТАНОВЛЕНЫ) ===
bot.onText(/\/plan_today/, (msg) => {
    const chatId = msg.chat.id;
    const now = DateTime.now().setZone(TIMEZONE);
    const today = now.toFormat('cccc').toLowerCase();
    const schedule = readSchedule();
    const tasks = schedule[today] || [];
    const formatted = tasks.map(t => `📌 ${t.time} — ${t.task}`).join('\n');
    const message = `🗓 **План на сегодня (${now.toFormat('dd.MM.yyyy')})**:\n\n${formatted || 'Сегодня задач нет.'}`;
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
});

bot.onText(/\/next_task/, (msg) => {
    const chatId = msg.chat.id;
    const now = DateTime.now().setZone(TIMEZONE);
    const today = now.toFormat('cccc').toLowerCase();
    const schedule = readSchedule();
    const tasks = schedule[today] || [];
    const nextTask = tasks.find(task => {
        const taskTime = DateTime.fromFormat(task.time, 'HH:mm', { zone: TIMEZONE });
        return taskTime > now;
    });
    if (nextTask) {
        bot.sendMessage(chatId, `⏭ **Следующая задача:**\n${nextTask.time} — ${nextTask.task}`, { parse_mode: 'Markdown' });
    } else {
        bot.sendMessage(chatId, '✅ Все задачи на сегодня выполнены!');
    }
});


console.log('[SETUP] Bot is fully configured and starting up.');
