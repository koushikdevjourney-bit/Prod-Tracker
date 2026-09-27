const cron = require('node-cron');
const UserSettings = require('../models/UserSettings');
const User = require('../models/User');
const { sendHourlyReminder } = require('./email.service');

let cronJob = null;
let lastRunAt = null;

async function processHourlyReminders() {
  const now = new Date();
  const currentHour = now.getHours();
  const hourFormatted = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  lastRunAt = now.toISOString();

  console.log(`[Reminder Scheduler] Running hourly reminder check at ${hourFormatted} (hour: ${currentHour})...`);

  try {
    // Find all users who have hourly reminders enabled
    const settingsList = await UserSettings.find({
      hourlyEmailReminders: { $ne: false },
    }).populate('user', 'name email');

    let sentCount = 0;

    for (const settings of settingsList) {
      const user = settings.user;
      if (!user) continue;

      const startHour = settings.reminderStartHour ?? 8;
      const endHour = settings.reminderEndHour ?? 23;

      // Skip during sleep/quiet hours
      if (startHour <= endHour) {
        if (currentHour < startHour || currentHour > endHour) {
          console.log(`[Reminder Scheduler] Skipping ${user.email} (outside active hours ${startHour}:00 - ${endHour}:00)`);
          continue;
        }
      } else {
        // Wrap around midnight
        if (currentHour > endHour && currentHour < startHour) {
          console.log(`[Reminder Scheduler] Skipping ${user.email} (in quiet hours)`);
          continue;
        }
      }

      const recipientEmail = settings.reminderEmail || user.email || 'koushiksai242@gmail.com';
      const userName = settings.displayName || user.name || 'there';

      try {
        const result = await sendHourlyReminder(recipientEmail, userName, hourFormatted);
        if (result.success) {
          sentCount++;
          console.log(`[Reminder Scheduler] Successfully sent reminder to ${recipientEmail}`);
        }
      } catch (err) {
        console.error(`[Reminder Scheduler] Failed to send reminder to ${recipientEmail}:`, err.message);
      }
    }

    // If no settings exist yet, ensure the target user koushiksai242@gmail.com is reminded if in active hours
    if (settingsList.length === 0 && currentHour >= 8 && currentHour <= 23) {
      try {
        await sendHourlyReminder('koushiksai242@gmail.com', 'Koushik', hourFormatted);
        sentCount++;
      } catch (err) {
        console.warn(`[Reminder Scheduler] Fallback reminder error:`, err.message);
      }
    }

    console.log(`[Reminder Scheduler] Finished hourly run. Sent ${sentCount} reminder(s).`);
    return { success: true, sentCount, timestamp: lastRunAt };
  } catch (err) {
    console.error(`[Reminder Scheduler] Error processing reminders:`, err);
    return { success: false, error: err.message, timestamp: lastRunAt };
  }
}

function startReminderScheduler() {
  if (cronJob) return;

  // Run at the beginning of every hour (e.g. 09:00, 10:00, 11:00...)
  cronJob = cron.schedule('0 * * * *', async () => {
    await processHourlyReminders();
  });

  console.log('[Reminder Scheduler] Hourly cron job registered (runs every hour at :00).');
}

function getSchedulerStatus() {
  return {
    running: Boolean(cronJob),
    lastRunAt,
  };
}

module.exports = {
  startReminderScheduler,
  processHourlyReminders,
  getSchedulerStatus,
};
