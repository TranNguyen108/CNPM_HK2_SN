const { Op, fn, col, literal } = require('sequelize');
const { Task } = require('../models/task.model');
const { GroupMember } = require('../models/groupMember.model');
const { Group } = require('../models/group.model');
const { User } = require('../models/user.model');
const { JiraConfig } = require('../models/jiraConfig.model');
const { sequelize } = require('../config/database');
const JiraApiService = require('../services/jiraApi.service');
const { ensureGroupAccess, ensureLeaderAccess } = require('../utils/groupAccess');

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

const DONE_STATUSES = ['done', 'closed', 'resolved', 'complete', 'completed'];
const IN_PROGRESS_STATUSES = ['in progress', 'in-progress', 'doing', 'review', 'code review', 'testing', 'qa'];

const normalizeDateValue = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toDateKey = (value) => {
  const date = normalizeDateValue(value);
  if (!date) return null;
  return date.toISOString().slice(0, 10);
};

const getTodayDateKey = () => new Date().toISOString().slice(0, 10);

const enumerateDates = (startDate, endDate) => {
  const start = normalizeDateValue(startDate);
  const end = normalizeDateValue(endDate);
  if (!start || !end || start > end) return [];

  const dates = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const target = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));

  while (cursor <= target) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
};

const getIntegerDaysDiff = (targetDate) => {
  const target = normalizeDateValue(targetDate);
  if (!target) return null;

  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const targetUtc = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());

  return Math.ceil((targetUtc - todayUtc) / (1000 * 60 * 60 * 24));
};

const pickLatestSprintName = async (groupId) => {
  const latestTaskWithSprint = await Task.findOne({
    where: {
      group_id: groupId,
      sprint: { [Op.ne]: null }
    },
    attributes: ['sprint'],
    order: [['updated_at', 'DESC'], ['created_at', 'DESC']]
  });

  const sprintName = latestTaskWithSprint?.sprint;
  return String(sprintName || '').trim() || null;
};

const getSprintMetaFromJira = async (groupId, requestedSprintName) => {
  const config = await JiraConfig.findOne({
    where: { group_id: groupId, is_active: 1 }
  });

  if (!config?.project_key) return null;

  const jira = new JiraApiService(config);
  const boards = await jira.fetchBoards(config.project_key);

  for (const board of boards) {
    const sprints = await jira.fetchSprints(board.id);
    const normalizedRequested = String(requestedSprintName || '').trim().toLowerCase();

    const matchedSprint = normalizedRequested
      ? sprints.find((item) => String(item.name || '').trim().toLowerCase() === normalizedRequested)
      : sprints.find((item) => item.state === 'active');

    if (matchedSprint) {
      return {
        boardId: board.id,
        sprintId: matchedSprint.id,
        sprintName: matchedSprint.name || requestedSprintName || null,
        state: matchedSprint.state || null,
        startDate: normalizeDateValue(matchedSprint.startDate),
        endDate: normalizeDateValue(matchedSprint.endDate),
        completeDate: normalizeDateValue(matchedSprint.completeDate)
      };
    }
  }

  return null;
};

const resolveSprintContext = async (groupId, requestedSprintName) => {
  const sprintName = String(requestedSprintName || '').trim() || await pickLatestSprintName(groupId);
  if (!sprintName) return null;

  const taskDateBounds = await Task.findOne({
    where: { group_id: groupId, sprint: sprintName },
    attributes: [
      [fn('MIN', col('created_at')), 'minCreatedAt'],
      [fn('MAX', col('updated_at')), 'maxUpdatedAt'],
      [fn('MAX', col('due_date')), 'maxDueDate']
    ],
    raw: true
  });

  const localStartDate = normalizeDateValue(taskDateBounds?.minCreatedAt);
  const localEndDate = normalizeDateValue(taskDateBounds?.maxDueDate)
    || normalizeDateValue(taskDateBounds?.maxUpdatedAt);

  let jiraMeta = null;
  if (!localStartDate || !localEndDate) {
    try {
      jiraMeta = await getSprintMetaFromJira(groupId, sprintName);
    } catch {
      jiraMeta = null;
    }
  }

  const startDate = localStartDate || jiraMeta?.startDate || normalizeDateValue(new Date());
  const endDate = localEndDate || jiraMeta?.endDate || startDate;

  return {
    sprintName,
    state: jiraMeta?.state || null,
    startDate,
    endDate,
    completeDate: jiraMeta?.completeDate || null,
    source: jiraMeta ? 'jira' : 'task-history'
  };
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

exports.getGroupSprintBurndown = async (req, res) => {
  try {
    const { groupId } = req.params;
    await ensureGroupAccess(req.user, groupId);

    const sprintContext = await resolveSprintContext(groupId, req.query.sprintName);
    if (!sprintContext) {
      return res.status(404).json({ message: 'Không tìm thấy sprint cho nhóm này' });
    }

    const doneRows = await Task.findAll({
      where: {
        group_id: groupId,
        sprint: sprintContext.sprintName,
        [Op.and]: [
          { status: { [Op.ne]: null } },
          sequelize.where(fn('LOWER', col('status')), { [Op.in]: DONE_STATUSES })
        ]
      },
      attributes: [
        [fn('DATE', col('updated_at')), 'date'],
        [fn('COUNT', col('id')), 'doneCount']
      ],
      group: [literal('DATE(updated_at)')],
      order: [[literal('DATE(updated_at)'), 'ASC']],
      raw: true
    });

    const doneCountByDate = new Map(
      doneRows.map((row) => [toDateKey(row.date), Number(row.doneCount) || 0])
    );

    let cumulativeDone = 0;
    const burndown = enumerateDates(sprintContext.startDate, sprintContext.endDate).map((date) => {
      const doneCount = doneCountByDate.get(date) || 0;
      cumulativeDone += doneCount;
      return {
        date,
        doneCount,
        cumulativeDone
      };
    });

    res.json({
      groupId,
      sprint: {
        name: sprintContext.sprintName,
        startDate: toDateKey(sprintContext.startDate),
        endDate: toDateKey(sprintContext.endDate),
        state: sprintContext.state,
        source: sprintContext.source
      },
      burndown
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
};

exports.getGroupMemberStats = async (req, res) => {
  try {
    const { groupId } = req.params;
    await ensureGroupAccess(req.user, groupId);

    const members = await GroupMember.findAll({
      where: { group_id: groupId },
      attributes: ['user_id', 'role_in_group']
    });

    const memberIds = members.map((item) => item.user_id);
    if (!memberIds.length) {
      return res.json({ groupId, items: [] });
    }

    const users = await User.findAll({
      where: { id: { [Op.in]: memberIds } },
      attributes: ['id', 'full_name', 'email', 'avatar'],
      raw: true
    });

    const taskStats = await Task.findAll({
      where: {
        group_id: groupId,
        assignee_id: { [Op.in]: memberIds }
      },
      attributes: [
        'assignee_id',
        [fn('COUNT', col('id')), 'assignedCount'],
        [fn('SUM', literal(`CASE
          WHEN LOWER(status) IN (${DONE_STATUSES.map((status) => sequelize.escape(status)).join(', ')})
          THEN 1 ELSE 0 END`)), 'doneCount'],
        [fn('SUM', literal(`CASE
          WHEN LOWER(status) IN (${IN_PROGRESS_STATUSES.map((status) => sequelize.escape(status)).join(', ')})
          THEN 1 ELSE 0 END`)), 'inProgressCount']
      ],
      group: ['assignee_id'],
      raw: true
    });

    const taskStatsMap = new Map(
      taskStats.map((item) => [item.assignee_id, {
        assignedCount: Number(item.assignedCount) || 0,
        doneCount: Number(item.doneCount) || 0,
        inProgressCount: Number(item.inProgressCount) || 0
      }])
    );
    const usersMap = new Map(users.map((item) => [item.id, item]));

    const items = members.map((member) => {
      const user = usersMap.get(member.user_id);
      const stats = taskStatsMap.get(member.user_id) || {
        assignedCount: 0,
        doneCount: 0,
        inProgressCount: 0
      };

      return {
        userId: member.user_id,
        fullName: user?.full_name || null,
        email: user?.email || null,
        avatar: user?.avatar || null,
        roleInGroup: member.role_in_group,
        assignedCount: stats.assignedCount,
        doneCount: stats.doneCount,
        inProgressCount: stats.inProgressCount
      };
    });

    res.json({ groupId, items });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
};

exports.getGroupOverviewStats = async (req, res) => {
  try {
    const { groupId } = req.params;
    await ensureGroupAccess(req.user, groupId);

    const overview = await Task.findOne({
      where: { group_id: groupId },
      attributes: [
        [fn('COUNT', col('id')), 'totalTasks'],
        [fn('SUM', literal(`CASE
          WHEN LOWER(status) IN (${DONE_STATUSES.map((status) => sequelize.escape(status)).join(', ')})
          THEN 1 ELSE 0 END`)), 'completedTasks']
      ],
      raw: true
    });

    const totalTasks = Number(overview?.totalTasks) || 0;
    const completedTasks = Number(overview?.completedTasks) || 0;
    const completionRate = totalTasks ? Number(((completedTasks / totalTasks) * 100).toFixed(2)) : 0;

    const sprintContext = await resolveSprintContext(groupId, req.query.sprintName);
    const sprintDaysLeft = sprintContext?.endDate ? Math.max(getIntegerDaysDiff(sprintContext.endDate), 0) : null;

    res.json({
      groupId,
      totalTasks,
      completedTasks,
      completionRate,
      sprint: sprintContext ? {
        name: sprintContext.sprintName,
        startDate: toDateKey(sprintContext.startDate),
        endDate: toDateKey(sprintContext.endDate),
        daysLeft: sprintDaysLeft,
        state: sprintContext.state,
        source: sprintContext.source
      } : null
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
};

exports.getPersonalStats = async (req, res) => {
  try {
    const { userId } = req.params;
    if (req.user.role !== 'ADMIN' && req.user.id !== userId) {
      return res.status(403).json({ message: 'Bạn không có quyền xem thống kê cá nhân của user này' });
    }

    const where = { assignee_id: userId };
    if (req.query.groupId) {
      await ensureGroupAccess(req.user, req.query.groupId);
      where.group_id = req.query.groupId;
    }

    const personal = await Task.findOne({
      where,
      attributes: [
        [fn('COUNT', col('id')), 'assignedCount'],
        [fn('SUM', literal(`CASE
          WHEN LOWER(status) IN (${DONE_STATUSES.map((status) => sequelize.escape(status)).join(', ')})
          THEN 1 ELSE 0 END`)), 'doneCount'],
        [fn('SUM', literal(`CASE
          WHEN LOWER(status) IN (${IN_PROGRESS_STATUSES.map((status) => sequelize.escape(status)).join(', ')})
          THEN 1 ELSE 0 END`)), 'inProgressCount'],
        [fn('SUM', literal(`CASE
          WHEN due_date IS NOT NULL
          AND due_date < ${sequelize.escape(getTodayDateKey())}
          AND LOWER(COALESCE(status, '')) NOT IN (${DONE_STATUSES.map((status) => sequelize.escape(status)).join(', ')})
          THEN 1 ELSE 0 END`)), 'overdueCount']
      ],
      raw: true
    });

    const assignedCount = Number(personal?.assignedCount) || 0;
    const doneCount = Number(personal?.doneCount) || 0;
    const inProgressCount = Number(personal?.inProgressCount) || 0;
    const overdueCount = Number(personal?.overdueCount) || 0;

    res.json({
      userId,
      groupId: req.query.groupId || null,
      assignedCount,
      doneCount,
      inProgressCount,
      overdueCount,
      completionRate: assignedCount ? Number(((doneCount / assignedCount) * 100).toFixed(2)) : 0
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
};

/**
 * GET /api/my-groups
 * Returns all groups the current user is a member of (any role_in_group).
 * Used by LECTURER dashboard to list supervised groups.
 */
exports.getMyGroups = async (req, res) => {
  try {
    const memberships = await GroupMember.findAll({
      where: { user_id: req.user.id },
      attributes: ['group_id', 'role_in_group']
    });

    if (!memberships.length) {
      return res.json([]);
    }

    const groupIds = memberships.map((m) => m.group_id);
    const groups = await Group.findAll({
      where: { id: { [Op.in]: groupIds } },
      order: [['created_at', 'DESC']]
    });

    const roleMap = new Map(memberships.map((m) => [m.group_id, m.role_in_group]));
    const result = groups.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      semester: g.semester,
      is_active: g.is_active,
      created_at: g.created_at,
      role_in_group: roleMap.get(g.id) || null
    }));

    res.json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
};
