import fs from 'fs';
import { DateTime } from 'luxon';

const TIMEZONE = 'Asia/Dubai'; // GMT+4
let notified = {};

export function setupReminders(bot, chatId) {
  setInterval(() => {
    const now = DateTime.now().setZone(TIMEZONE);
    const currentTime = now.toFormat('HH:mm');
    const today = now.toFormat('cccc').toLowerCase(); // e.g. 'monday'

    const schedule = JSON.parse(fs.readFileSync('./schedule.json', 'utf-8'));
    const tasks = schedule[today] || [];

    tasks.forEach(task => {
      const taskTime = DateTime.fromFormat(task.time, 'HH:mm', { zone: TIMEZONE });
      const diff = taskTime.diff(now, 'minutes').toObject().minutes;
      const key = `${chatId}_${today}_${task.time}`;

      // Напоминание за 5 минут
      if (diff > 4 && diff <= 5 && !notified[key]) {
        bot.sendMessage(chatId, `⏳ Через 5 минут: ${task.time} — ${task.task}`);
        notified[key] = true;
      }

      // Напоминание в момент задачи
      if (Math.abs(diff) < 1 && !notified[key + '_now']) {
        bot.sendMessage(chatId, `🔔 Сейчас: ${task.time} — ${task.task}`);
        notified[key + '_now'] = true;
      }
    });

    if (currentTime === '06:00') {
      notified = {};
    }
  }, 60000);
}
