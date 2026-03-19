const cron = require('node-cron');
const { JiraConfig } = require('../models/jiraConfig.model');
const { syncGroupJira } = require('../services/jiraSync.service');

/**
 * Cron job tự động sync Jira mỗi 30 phút
 * Chạy tất cả nhóm có jira_config đang active
 */
const startJiraSyncJob = () => {
  cron.schedule('*/30 * * * *', async () => {
    console.log('[JiraSync] Bắt đầu scheduled sync...');
    try {
      const configs = await JiraConfig.findAll({ where: { is_active: 1 } });

      if (configs.length === 0) {
        console.log('[JiraSync] Không có nhóm nào cần sync.');
        return;
      }

      for (const config of configs) {
        try {
          const result = await syncGroupJira(config.group_id);
          console.log(
            `[JiraSync] Nhóm ${config.group_id}: +${result.newCount} mới, ${result.updatedCount} cập nhật, tổng ${result.total} task`
          );
        } catch (err) {
          console.error(`[JiraSync] Nhóm ${config.group_id} thất bại: ${err.message}`);
        }
      }
    } catch (err) {
      console.error('[JiraSync] Scheduled sync lỗi:', err.message);
    }
  });

  console.log('[JiraSync] Cron job đã khởi động (mỗi 30 phút)');
};

module.exports = { startJiraSyncJob };
