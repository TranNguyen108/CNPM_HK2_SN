const cron = require('node-cron');
const { GithubConfig } = require('../models/githubConfig.model');
const { syncGroupGithub } = require('../services/githubSync.service');

const startGithubSyncJob = () => {
  cron.schedule('0 * * * *', async () => {
    console.log('[GitHubSync] Bắt đầu scheduled sync...');

    try {
      const configs = await GithubConfig.findAll({ where: { is_active: 1 } });
      if (!configs.length) {
        console.log('[GitHubSync] Không có nhóm nào cần sync.');
        return;
      }

      for (const config of configs) {
        try {
          const result = await syncGroupGithub(config.group_id);
          console.log(
            `[GitHubSync] Nhóm ${config.group_id}: +${result.newCount} mới, ${result.updatedCount} cập nhật, tổng ${result.total} commit`
          );
        } catch (err) {
          console.error(`[GitHubSync] Nhóm ${config.group_id} thất bại: ${err.message}`);
        }
      }
    } catch (err) {
      console.error('[GitHubSync] Scheduled sync lỗi:', err.message);
    }
  });

  console.log('[GitHubSync] Cron job đã khởi động (mỗi 1 giờ)');
};

module.exports = { startGithubSyncJob };
