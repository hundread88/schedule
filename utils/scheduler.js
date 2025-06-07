import fs from 'fs';

let scheduledToday = {}; // Для отслеживания отправленных задач

export function setupReminders(bot, chatId) {
  const interval = setInterval(() => {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // 'HH:MM'
    const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    const today = days[now.getDay()];

    const schedule = JSON.parse(fs.readFileSync('./schedule.json', 'utf-8'));
    const tasks = schedule[today] || [];

    tasks.forEach(task => {
      if (task.time === currentTime) {
        const key = `${chatId}_${today}_${task.time}`;
        if (!scheduledToday[key]) {
          bot.sendMessage(chatId, `🔔 Напоминание: ${task.time} — ${task.task}`);
          scheduledToday[key] = true;
        }
      }
    });

    // Сброс списка отправленных задач на следующий день
    const resetHour = 6; // 6:00 утра
    if (now.getHours() === resetHour && now.getMinutes() === 0) {
      scheduledToday = {};
    }
  }, 60 * 1000); // каждую минуту
}
