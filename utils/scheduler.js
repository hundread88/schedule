import fs from 'fs';
import { DateTime } from 'luxon';

const notified = new Set();

export function setupReminders(bot, chatId) {
  setInterval(() => {
    const now = DateTime.now().setZone('Asia/Dubai');
    const today = now.toFormat('cccc').toLowerCase(); // e.g., 'sunday'
    const currentMinutes = now.hour * 60 + now.minute;

    const schedule = JSON.parse(fs.readFileSync('./schedule.json', 'utf-8'));
    const tasks = schedule[today] || [];

    for (const task of tasks) {
      const [h, m] = task.time.split(':').map(Number);
      const taskMinutes = h * 60 + m;
      const diff = taskMinutes - currentMinutes;

      if (diff === 5 && !notified.has(task.time + today + chatId)) {
        bot.sendMessage(chatId, `⏰ Через 5 минут: ${task.time} — ${task.task}`);
        notified.add(task.time + today + chatId);
      }
    }
  }, 60 * 1000); // Проверка каждую минуту
}
