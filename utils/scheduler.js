import fs from 'fs';
import { DateTime } from 'luxon';

// Этот Set будет хранить уникальные ключи уже отправленных уведомлений.
// Формат ключа: "время-день_недели-id_чата" (e.g., "13:00-sunday-123456789")
// Внимание: этот Set очищается при перезапуске бота!
const sentNotifications = new Set();

// Функция для очистки Set в начале нового дня, чтобы он не рос бесконечно.
function scheduleDailyCleanup() {
  const now = DateTime.now().setZone('Asia/Tbilisi');
  const tomorrow = now.plus({ days: 1 }).startOf('day');
  const msUntilTomorrow = tomorrow.diff(now).toMillis();

  setTimeout(() => {
    console.log('Performing daily cleanup of sent notifications cache.');
    sentNotifications.clear();
    // Запускаем очистку на следующий день
    scheduleDailyCleanup();
  }, msUntilTomorrow);
}


export function startScheduler(bot, getChatIds) {
  console.log('Global scheduler has been started.');

  // Запускаем цикл проверки каждую минуту.
  setInterval(() => {
    // Получаем текущее время в нужном часовом поясе.
    // Используем 'Asia/Tbilisi' как пример для GMT+4. Вы можете оставить 'Asia/Dubai'.
    const now = DateTime.now().setZone('Asia/Tbilisi');
    const today = now.toFormat('cccc').toLowerCase(); // e.g., 'sunday'
    const currentTime = now.toFormat('HH:mm'); // e.g., '13:00'

    // Получаем актуальный список ID чатов
    const chatIds = getChatIds();
    if (chatIds.size === 0) {
      // Если нет пользователей, нет смысла работать дальше
      return;
    }

    const schedule = JSON.parse(fs.readFileSync('./schedule.json', 'utf-8'));
    const tasks = schedule[today] || [];

    for (const task of tasks) {
      // Проверяем, наступило ли время задачи
      if (task.time === currentTime) {
        
        // Рассылаем уведомление всем подписанным пользователям
        for (const chatId of chatIds) {
          const notificationKey = `${task.time}-${today}-${chatId}`;

          // Проверяем, не отправляли ли мы это уведомление этому пользователю
          if (!sentNotifications.has(notificationKey)) {
            const message = `🔔 **Напоминание:**\n${task.time} — ${task.task}`;
            bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
              .then(() => console.log(`Sent notification for ${task.time} to ${chatId}`))
              .catch(err => console.error(`Failed to send message to ${chatId}:`, err.response.body.description));

            // Добавляем ключ в Set, чтобы не отправить повторно
            sentNotifications.add(notificationKey);
          }
        }
      }
    }
  }, 60 * 1000); // Проверка каждую минуту

  // Запускаем первую ежедневную очистку кэша уведомлений
  scheduleDailyCleanup();
}
