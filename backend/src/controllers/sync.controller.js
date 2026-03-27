const { syncGroupJira } = require('../services/jiraSync.service');
const { SyncLog } = require('../models/syncLog.model');
const { GithubConfig } = require('../models/githubConfig.model');
const { GroupMember } = require('../models/groupMember.model');
const GitHubApiService = require('../services/githubApi.service');

/**
 * POST /api/sync/jira/:groupId
 * Trigger đồng bộ Jira thủ công
 */
exports.syncJira = async (req, res) => {
  const { groupId } = req.params;
  try {
    const result = await syncGroupJira(groupId);
    res.json({
      message: 'Đồng bộ Jira hoàn tất',
      newTasks: result.newCount,
      updatedTasks: result.updatedCount,
      totalFetched: result.total
    });
  } catch (err) {
    // Ghi log lỗi
    await SyncLog.create({
      group_id: groupId,
      sync_type: 'jira',
      status: 'error',
      new_count: 0,
      updated_count: 0,
      error_message: err.message
    }).catch(() => {});

    res.status(500).json({ message: 'Đồng bộ thất bại: ' + err.message });
  }
};

/**
 * GET /api/sync/logs/:groupId
 * Xem lịch sử sync (20 bản ghi gần nhất)
 */
exports.getSyncLogs = async (req, res) => {
  try {
    const logs = await SyncLog.findAll({
      where: { group_id: req.params.groupId },
      order: [['synced_at', 'DESC']],
      limit: 20
    });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/sync/tasks/:groupId
 * Lấy danh sách tasks đã sync của nhóm
 */
exports.getTasks = async (req, res) => {
  try {
    const { Task } = require('../models/task.model');
    const tasks = await Task.findAll({
      where: { group_id: req.params.groupId },
      order: [['created_at', 'DESC']]
    });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/sync/github/:groupId
 * Kiểm tra kết nối GitHub và cập nhật last_synced_at.
 * Dành cho LEADER và ADMIN.
 */
exports.syncGithub = async (req, res) => {
  const { groupId } = req.params;
  try {
    // Allow LEADER or ADMIN only
    const user = req.user;
    if (user.role !== 'ADMIN') {
      const membership = await GroupMember.findOne({
        where: { group_id: groupId, user_id: user.id },
      });
      if (!membership) {
        return res.status(403).json({ message: 'Bạn không có quyền truy cập nhóm này' });
      }
      if (!['LEADER'].includes(membership.role_in_group)) {
        return res.status(403).json({ message: 'Chỉ Leader hoặc Admin mới được sync GitHub' });
      }
    }

    const config = await GithubConfig.findOne({ where: { group_id: groupId, is_active: 1 } });
    if (!config) {
      return res.status(404).json({ message: 'GitHub chưa được cấu hình cho nhóm này. Liên hệ Admin để cài đặt.' });
    }

    const github = new GitHubApiService(config);
    const recent = await github.fetchCommits({ per_page: 1 });

    await config.update({ last_synced_at: new Date() });

    res.json({
      message: 'Kết nối GitHub thành công',
      repo: `${config.repo_owner}/${config.repo_name}`,
      lastSyncedAt: config.last_synced_at,
      latestCommit: recent[0]
        ? {
            sha: recent[0].sha?.slice(0, 7),
            message: recent[0].commit?.message?.split('\n')[0],
            date: recent[0].commit?.author?.date,
          }
        : null,
    });
  } catch (err) {
    if (err.response?.status === 401) {
      return res.status(401).json({ message: 'Token GitHub không hợp lệ hoặc đã hết hạn' });
    }
    if (err.response?.status === 404) {
      return res.status(404).json({ message: 'Repository không tìm thấy hoặc không có quyền truy cập' });
    }
    res.status(500).json({ message: 'Sync GitHub thất bại: ' + err.message });
  }
};
