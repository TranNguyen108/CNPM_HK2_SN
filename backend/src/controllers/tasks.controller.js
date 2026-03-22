const { Op } = require('sequelize');
const { Task } = require('../models/task.model');
const { GroupMember } = require('../models/groupMember.model');
const { User } = require('../models/user.model');
const { JiraConfig } = require('../models/jiraConfig.model');
const JiraApiService = require('../services/jiraApi.service');

const DEFAULT_PAGE = 1;
const DEFAULT_SIZE = 10;
const MAX_SIZE = 100;

const parsePagination = (query) => {
  const page = Math.max(parseInt(query.page, 10) || DEFAULT_PAGE, 1);
  const size = Math.min(Math.max(parseInt(query.size, 10) || DEFAULT_SIZE, 1), MAX_SIZE);
  return { page, size, offset: (page - 1) * size, limit: size };
};

const normalizeStatus = (status) => String(status || '').trim().toLowerCase();

const categorizeStatus = (status) => {
  const normalized = normalizeStatus(status);

  if (!normalized) return 'other';
  if (['to do', 'todo', 'open', 'backlog', 'selected for development'].includes(normalized)) return 'todo';
  if (['in progress', 'in-progress', 'doing', 'review', 'code review', 'testing', 'qa'].includes(normalized)) return 'in_progress';
  if (['done', 'closed', 'resolved', 'complete', 'completed'].includes(normalized)) return 'done';

  return 'other';
};

const ensureGroupAccess = async (user, groupId) => {
  if (user.role === 'ADMIN') return { isAdmin: true, membership: null };

  const membership = await GroupMember.findOne({
    where: { group_id: groupId, user_id: user.id }
  });

  if (!membership) {
    const error = new Error('Bạn không có quyền truy cập nhóm này');
    error.statusCode = 403;
    throw error;
  }

  return { isAdmin: false, membership };
};

const ensureLeaderAccess = async (user, groupId) => {
  const access = await ensureGroupAccess(user, groupId);

  if (access.isAdmin) return access;
  if (access.membership.role_in_group !== 'LEADER') {
    const error = new Error('Chỉ leader của nhóm mới được thực hiện thao tác này');
    error.statusCode = 403;
    throw error;
  }

  return access;
};

const findTaskOrThrow = async (taskId) => {
  const task = await Task.findByPk(taskId);
  if (!task) {
    const error = new Error('Task not found');
    error.statusCode = 404;
    throw error;
  }
  return task;
};

const buildTaskFilters = (query) => {
  const where = {};

  if (query.groupId) where.group_id = query.groupId;
  if (query.sprintName) where.sprint = query.sprintName;
  if (query.assigneeId) where.assignee_id = query.assigneeId;
  if (query.status) where.status = query.status;

  return where;
};

const syncTaskStatusToJira = async (task, nextStatus) => {
  const config = await JiraConfig.findOne({
    where: { group_id: task.group_id, is_active: 1 }
  });

  if (!config || !task.jira_key) {
    return { attempted: false, synced: false, message: 'Task chưa có cấu hình Jira hoạt động' };
  }

  const jira = new JiraApiService(config);
  await jira.transitionIssueToStatus(task.jira_key, nextStatus);
  return { attempted: true, synced: true, message: 'Đã đồng bộ trạng thái lên Jira' };
};

exports.getTasks = async (req, res) => {
  try {
    const filters = buildTaskFilters(req.query);

    if (filters.group_id) {
      await ensureGroupAccess(req.user, filters.group_id);
    } else if (req.user.role !== 'ADMIN') {
      const memberGroupIds = await GroupMember.findAll({
        where: { user_id: req.user.id },
        attributes: ['group_id']
      });

      filters.group_id = {
        [Op.in]: memberGroupIds.map((item) => item.group_id)
      };
    }

    const { page, size, offset, limit } = parsePagination(req.query);
    const { count, rows } = await Task.findAndCountAll({
      where: filters,
      order: [['updated_at', 'DESC'], ['created_at', 'DESC']],
      offset,
      limit
    });

    res.json({
      items: rows,
      pagination: {
        page,
        size,
        totalItems: count,
        totalPages: Math.ceil(count / size) || 1
      }
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
};

exports.getTaskById = async (req, res) => {
  try {
    const task = await findTaskOrThrow(req.params.id);
    await ensureGroupAccess(req.user, task.group_id);
    res.json(task);
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
};

exports.updateTaskStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!status || !String(status).trim()) {
      return res.status(400).json({ message: 'Status is required' });
    }

    const task = await findTaskOrThrow(req.params.id);
    await ensureGroupAccess(req.user, task.group_id);

    if (req.user.role !== 'ADMIN' && task.assignee_id !== req.user.id) {
      return res.status(403).json({ message: 'Bạn chỉ được cập nhật task được giao cho mình' });
    }

    await task.update({ status: String(status).trim() });

    let jiraSync = { attempted: false, synced: false, message: 'Không thực hiện đồng bộ Jira' };
    try {
      jiraSync = await syncTaskStatusToJira(task, task.status);
    } catch (jiraErr) {
      jiraSync = { attempted: true, synced: false, message: jiraErr.message };
    }

    res.json({
      message: jiraSync.synced
        ? 'Cập nhật trạng thái task thành công và đã đồng bộ Jira'
        : 'Cập nhật trạng thái task thành công',
      task,
      jiraSync
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
};

exports.assignTask = async (req, res) => {
  try {
    const { assigneeId } = req.body;
    if (!assigneeId) {
      return res.status(400).json({ message: 'assigneeId is required' });
    }

    const task = await findTaskOrThrow(req.params.id);
    await ensureLeaderAccess(req.user, task.group_id);

    const assigneeMembership = await GroupMember.findOne({
      where: {
        group_id: task.group_id,
        user_id: assigneeId,
        role_in_group: { [Op.in]: ['LEADER', 'MEMBER'] }
      }
    });

    if (!assigneeMembership) {
      return res.status(400).json({ message: 'User được gán phải là member hoặc leader của nhóm' });
    }

    const assignee = await User.findByPk(assigneeId, {
      attributes: ['id', 'email', 'full_name']
    });

    if (!assignee) {
      return res.status(404).json({ message: 'Assignee not found' });
    }

    await task.update({
      assignee_id: assignee.id,
      assignee_email: assignee.email
    });

    res.json({
      message: 'Gán task thành công',
      task,
      assignee
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
};

exports.getMyTasks = async (req, res) => {
  try {
    const where = { assignee_id: req.user.id };

    if (req.query.groupId) {
      await ensureGroupAccess(req.user, req.query.groupId);
      where.group_id = req.query.groupId;
    }

    if (req.query.status) where.status = req.query.status;
    if (req.query.sprintName) where.sprint = req.query.sprintName;

    const { page, size, offset, limit } = parsePagination(req.query);
    const { count, rows } = await Task.findAndCountAll({
      where,
      order: [['updated_at', 'DESC'], ['created_at', 'DESC']],
      offset,
      limit
    });

    res.json({
      items: rows,
      pagination: {
        page,
        size,
        totalItems: count,
        totalPages: Math.ceil(count / size) || 1
      }
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
};

exports.getTaskStats = async (req, res) => {
  try {
    const { groupId } = req.params;
    await ensureGroupAccess(req.user, groupId);

    const tasks = await Task.findAll({
      where: { group_id: groupId },
      attributes: ['id', 'status', 'sprint', 'assignee_id']
    });

    const summary = {
      total: tasks.length,
      todo: 0,
      in_progress: 0,
      done: 0,
      other: 0
    };

    const bySprint = {};

    tasks.forEach((task) => {
      const bucket = categorizeStatus(task.status);
      summary[bucket] += 1;

      const sprintName = task.sprint || 'No Sprint';
      if (!bySprint[sprintName]) {
        bySprint[sprintName] = {
          sprint: sprintName,
          total: 0,
          todo: 0,
          in_progress: 0,
          done: 0,
          other: 0
        };
      }

      bySprint[sprintName].total += 1;
      bySprint[sprintName][bucket] += 1;
    });

    res.json({
      groupId,
      summary,
      bySprint: Object.values(bySprint).sort((a, b) => a.sprint.localeCompare(b.sprint))
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
};

exports.getGroupSprints = async (req, res) => {
  try {
    const { groupId } = req.params;
    await ensureGroupAccess(req.user, groupId);

    const sprints = await Task.findAll({
      where: {
        group_id: groupId,
        sprint: { [Op.ne]: null }
      },
      attributes: ['sprint']
    });

    const uniqueSprints = [...new Set(
      sprints
        .map((item) => item.sprint)
        .filter((value) => String(value || '').trim())
    )].sort((a, b) => a.localeCompare(b));

    res.json({
      groupId,
      items: uniqueSprints
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
};
