const { syncGroupJira } = require('../services/jiraSync.service');
const { syncGroupGithub } = require('../services/githubSync.service');
const { SyncLog } = require('../models/syncLog.model');
const { ensureGroupAccess, ensureLeaderAccess } = require('../utils/groupAccess');
const { notifyGroupJiraSyncSuccess } = require('../services/notification.service');

/**
 * POST /api/sync/jira/:groupId
 * Trigger đồng bộ Jira thủ công
 */
exports.syncJira = async (req, res) => {
  const { groupId } = req.params;
  try {
    await ensureLeaderAccess(req.user, groupId);
    const result = await syncGroupJira(groupId);
    await notifyGroupJiraSyncSuccess({
      groupId,
      triggeredBy: req.user,
      result
    });
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
 * POST /api/sync/github/:groupId
 * Trigger đồng bộ GitHub thủ công
 */
exports.syncGithub = async (req, res) => {
  const { groupId } = req.params;
  try {
    await ensureGroupAccess(req.user, groupId);
    const result = await syncGroupGithub(groupId);
    res.json({
      message: 'Đồng bộ GitHub hoàn tất',
      newCommits: result.newCount,
      updatedCommits: result.updatedCount,
      totalFetched: result.total
    });
  } catch (err) {
    await SyncLog.create({
      group_id: groupId,
      sync_type: 'github',
      status: 'error',
      new_count: 0,
      updated_count: 0,
      error_message: err.message
    }).catch(() => {});

    res.status(500).json({ message: 'Đồng bộ GitHub thất bại: ' + err.message });
  }
};

/**
 * GET /api/sync/logs/:groupId
 * Xem lịch sử sync (20 bản ghi gần nhất)
 */
exports.getSyncLogs = async (req, res) => {
  try {
    await ensureGroupAccess(req.user, req.params.groupId);
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
    await ensureGroupAccess(req.user, req.params.groupId);
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
