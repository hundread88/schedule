import cron from 'node-cron';
import fs from 'fs';

export function setupReminders(bot, chatId) {
  const schedule = JSON.parse(fs.readFileSync('./schedule.json', 'utf-8'));
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const tasks = schedule[today] || [];

  tasks.forEach(task => {
    const [hour, minute] = task.time.split(':');
    const cronTime = `${minute} ${hour} * * *`;

    cron.schedule(cronTime, () => {
      bot.sendMessage(chatId, `?? Напоминание: ${task.task}`);
    });
  });
}
