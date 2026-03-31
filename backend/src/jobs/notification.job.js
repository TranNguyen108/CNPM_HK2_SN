const cron = require('node-cron');
const { notifyUpcomingDeadlines } = require('../services/notification.service');

const startNotificationJob = () => {
  cron.schedule('0 */6 * * *', async () => {
    console.log('[NotificationJob] Bat dau kiem tra deadline sap toi...');
    try {
      const result = await notifyUpcomingDeadlines();
      console.log(`[NotificationJob] Da quet ${result.scanned} task, tao ${result.created} notification.`);
    } catch (err) {
      console.error('[NotificationJob] Loi kiem tra deadline:', err.message);
    }
  });

  console.log('[NotificationJob] Cron job da khoi dong (moi 6 gio)');
};

module.exports = { startNotificationJob };
