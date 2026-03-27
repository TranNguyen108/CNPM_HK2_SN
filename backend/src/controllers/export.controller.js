const { Op } = require('sequelize');
const { Group } = require('../models/group.model');
const { GroupMember } = require('../models/groupMember.model');
const { Task } = require('../models/task.model');
const { CommitStat } = require('../models/commitStat.model');
const { User } = require('../models/user.model');
const { ensureGroupAccess } = require('../utils/groupAccess');
const {
  renderTaskReportPdf,
  renderCommitReportExcel
} = require('../services/exportReport.service');

const DEFAULT_TASK_REPORT_FORMAT = 'pdf';
const DEFAULT_COMMIT_REPORT_FORMAT = 'excel';

const normalizeStatus = (status) => String(status || '').trim().toLowerCase();

const categorizeStatus = (status) => {
  const normalized = normalizeStatus(status);

  if (!normalized) return 'other';
  if (['to do', 'todo', 'open', 'backlog', 'selected for development'].includes(normalized)) return 'todo';
  if (['in progress', 'in-progress', 'doing', 'review', 'code review', 'testing', 'qa'].includes(normalized)) return 'in_progress';
  if (['done', 'closed', 'resolved', 'complete', 'completed'].includes(normalized)) return 'done';
  return 'other';
};

const parseDateInput = (value, endOfDay = false) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  if (endOfDay) {
    date.setUTCHours(23, 59, 59, 999);
  } else {
    date.setUTCHours(0, 0, 0, 0);
  }

  return date;
};

const formatDateOnly = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const getGroupOrThrow = async (groupId) => {
  const group = await Group.findByPk(groupId, { raw: true });
  if (!group) {
    const error = new Error('Không tìm thấy nhóm');
    error.statusCode = 404;
    throw error;
  }
  return group;
};

const pickLatestSprintName = async (groupId) => {
  const latestTask = await Task.findOne({
    where: {
      group_id: groupId,
      sprint: { [Op.ne]: null }
    },
    attributes: ['sprint'],
    order: [['updated_at', 'DESC'], ['created_at', 'DESC']],
    raw: true
  });

  return String(latestTask?.sprint || '').trim() || null;
};

const getGroupUsersMap = async (groupId) => {
  const members = await GroupMember.findAll({
    where: { group_id: groupId },
    attributes: ['user_id'],
    raw: true
  });

  const userIds = members.map((member) => member.user_id);
  const users = userIds.length
    ? await User.findAll({
      where: { id: { [Op.in]: userIds } },
      attributes: ['id', 'full_name', 'email', 'github_username'],
      raw: true
    })
    : [];

  return new Map(users.map((user) => [user.id, user]));
};

const mapTaskRows = async (groupId, sprintName) => {
  const where = { group_id: groupId };
  if (sprintName) where.sprint = sprintName;

  const tasks = await Task.findAll({
    where,
    attributes: [
      'id',
      'jira_key',
      'title',
      'status',
      'story_points',
      'assignee_id',
      'assignee_email',
      'sprint',
      'due_date'
    ],
    order: [['updated_at', 'DESC'], ['created_at', 'DESC']],
    raw: true
  });

  const assigneeIds = [...new Set(tasks.map((task) => task.assignee_id).filter(Boolean))];
  const assignees = assigneeIds.length
    ? await User.findAll({
      where: { id: { [Op.in]: assigneeIds } },
      attributes: ['id', 'full_name', 'email'],
      raw: true
    })
    : [];
  const assigneeMap = new Map(assignees.map((user) => [user.id, user]));

  const summary = {
    total: tasks.length,
    todo: 0,
    in_progress: 0,
    done: 0,
    other: 0
  };

  const mappedTasks = tasks.map((task) => {
    summary[categorizeStatus(task.status)] += 1;
    const assignee = task.assignee_id ? assigneeMap.get(task.assignee_id) : null;

    return {
      id: task.id,
      taskKey: task.jira_key,
      title: task.title || '-',
      assigneeName: assignee?.full_name || assignee?.email || task.assignee_email || 'Unassigned',
      status: task.status || 'N/A',
      storyPointsLabel: task.story_points == null ? '-' : String(task.story_points),
      sprint: task.sprint || '',
      dueDate: formatDateOnly(task.due_date)
    };
  });

  return { tasks: mappedTasks, summary };
};

const mapCommitExportData = async (groupId, from, to) => {
  const where = { group_id: groupId };
  if (from || to) {
    where.committed_at = {};
    if (from) where.committed_at[Op.gte] = from;
    if (to) where.committed_at[Op.lte] = to;
  }

  const [tasks, commits, usersMap] = await Promise.all([
    Task.findAll({
      where: { group_id: groupId },
      attributes: [
        'id',
        'jira_key',
        'title',
        'status',
        'story_points',
        'assignee_id',
        'assignee_email',
        'sprint',
        'due_date'
      ],
      order: [['updated_at', 'DESC'], ['created_at', 'DESC']],
      raw: true
    }),
    CommitStat.findAll({
      where,
      attributes: [
        'id',
        'user_id',
        'task_key',
        'sha',
        'message',
        'github_username',
        'author_email',
        'additions',
        'deletions',
        'committed_at'
      ],
      order: [['committed_at', 'DESC']],
      raw: true
    }),
    getGroupUsersMap(groupId)
  ]);

  const taskAssigneeIds = [...new Set(tasks.map((task) => task.assignee_id).filter(Boolean))];
  if (taskAssigneeIds.length) {
    const missingIds = taskAssigneeIds.filter((id) => !usersMap.has(id));
    if (missingIds.length) {
      const assignees = await User.findAll({
        where: { id: { [Op.in]: missingIds } },
        attributes: ['id', 'full_name', 'email', 'github_username'],
        raw: true
      });
      assignees.forEach((user) => usersMap.set(user.id, user));
    }
  }

  const taskRows = tasks.map((task) => {
    const assignee = task.assignee_id ? usersMap.get(task.assignee_id) : null;
    return {
      id: task.id,
      taskKey: task.jira_key,
      title: task.title || '-',
      assigneeName: assignee?.full_name || assignee?.email || task.assignee_email || 'Unassigned',
      status: task.status || 'N/A',
      storyPointsLabel: task.story_points == null ? '-' : String(task.story_points),
      sprint: task.sprint || '',
      dueDate: formatDateOnly(task.due_date)
    };
  });

  const memberStatsMap = new Map();
  const commitLog = commits.map((commit) => {
    const user = commit.user_id ? usersMap.get(commit.user_id) : null;
    const memberName = user?.full_name || user?.email || commit.github_username || commit.author_email || 'Unknown';
    const memberKey = commit.user_id || commit.github_username || commit.author_email || `commit-${commit.id}`;

    if (!memberStatsMap.has(memberKey)) {
      memberStatsMap.set(memberKey, {
        member: memberName,
        email: user?.email || commit.author_email || '',
        githubUsername: commit.github_username || user?.github_username || '',
        commits: 0,
        additions: 0,
        deletions: 0,
        lastCommitDate: null
      });
    }

    const memberStats = memberStatsMap.get(memberKey);
    memberStats.commits += 1;
    memberStats.additions += Number(commit.additions) || 0;
    memberStats.deletions += Number(commit.deletions) || 0;
    if (!memberStats.lastCommitDate || new Date(commit.committed_at) > new Date(memberStats.lastCommitDate)) {
      memberStats.lastCommitDate = commit.committed_at;
    }

    return {
      committedAt: commit.committed_at,
      sha: commit.sha,
      member: memberName,
      githubUsername: commit.github_username || user?.github_username || '',
      taskKey: commit.task_key || '',
      message: commit.message || '',
      additions: Number(commit.additions) || 0,
      deletions: Number(commit.deletions) || 0
    };
  });

  const memberStats = [...memberStatsMap.values()].sort(
    (a, b) => b.commits - a.commits || String(a.member).localeCompare(String(b.member))
  );

  return { taskRows, memberStats, commitLog };
};

exports.exportTaskReport = async (req, res) => {
  try {
    const { groupId } = req.params;
    await ensureGroupAccess(req.user, groupId);

    const requestedFormat = String(req.query.format || DEFAULT_TASK_REPORT_FORMAT).trim().toLowerCase();
    if (requestedFormat !== 'pdf') {
      return res.status(400).json({ message: 'Task report currently supports format=pdf' });
    }

    const group = await getGroupOrThrow(groupId);
    const sprintName = String(req.query.sprintName || '').trim() || await pickLatestSprintName(groupId);
    const { tasks, summary } = await mapTaskRows(groupId, sprintName);

    await renderTaskReportPdf(res, {
      group,
      sprintName,
      tasks,
      summary,
      exportedAt: new Date()
    });
  } catch (err) {
    if (!res.headersSent) {
      res.status(err.statusCode || 500).json({ message: err.message });
    }
  }
};

exports.exportCommitReport = async (req, res) => {
  try {
    const { groupId } = req.params;
    await ensureGroupAccess(req.user, groupId);

    const requestedFormat = String(req.query.format || DEFAULT_COMMIT_REPORT_FORMAT).trim().toLowerCase();
    if (requestedFormat !== 'excel' && requestedFormat !== 'xlsx') {
      return res.status(400).json({ message: 'Commit report currently supports format=excel' });
    }

    const from = req.query.from ? parseDateInput(req.query.from) : null;
    const to = req.query.to ? parseDateInput(req.query.to, true) : null;

    if (req.query.from && !from) {
      return res.status(400).json({ message: 'from must be a valid date' });
    }
    if (req.query.to && !to) {
      return res.status(400).json({ message: 'to must be a valid date' });
    }
    if (from && to && from > to) {
      return res.status(400).json({ message: 'from must be earlier than or equal to to' });
    }

    const group = await getGroupOrThrow(groupId);
    const { taskRows, memberStats, commitLog } = await mapCommitExportData(groupId, from, to);

    await renderCommitReportExcel(res, {
      group,
      from,
      to,
      tasks: taskRows,
      memberStats,
      commitLog,
      exportedAt: new Date()
    });
  } catch (err) {
    if (!res.headersSent) {
      res.status(err.statusCode || 500).json({ message: err.message });
    }
  }
};
