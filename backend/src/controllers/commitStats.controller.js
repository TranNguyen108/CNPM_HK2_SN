const { Op, fn, col } = require('sequelize');
const { CommitStat } = require('../models/commitStat.model');
const { GroupMember } = require('../models/groupMember.model');
const { User } = require('../models/user.model');
const { ensureGroupAccess } = require('../utils/groupAccess');

const DEFAULT_PAGE = 1;
const DEFAULT_SIZE = 10;
const MAX_PAGE_SIZE = 100;
const DEFAULT_HEATMAP_MONTHS = 6;

const toNumber = (value) => Number(value) || 0;

const formatDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const getWeekKey = (dateValue) => {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;

  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((utcDate - yearStart) / 86400000) + 1) / 7);

  return `${utcDate.getUTCFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
};

const aggregateCommitsPerWeek = (records) => {
  const bucket = new Map();

  records.forEach((record) => {
    const week = getWeekKey(record.committed_at);
    if (!week) return;
    bucket.set(week, (bucket.get(week) || 0) + 1);
  });

  return [...bucket.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([week, count]) => ({ week, count }));
};

const buildDateRange = (months) => {
  const totalMonths = Math.max(1, Number(months) || DEFAULT_HEATMAP_MONTHS);
  const end = new Date();
  end.setUTCHours(23, 59, 59, 999);

  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  start.setUTCMonth(start.getUTCMonth() - totalMonths + 1);
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);

  return { start, end };
};

const aggregateHeatmap = (records, startDate, endDate) => {
  const bucket = new Map(
    records.map((record) => [formatDate(record.date || record.committed_at), toNumber(record.count)])
  );

  const items = [];
  const cursor = new Date(Date.UTC(
    startDate.getUTCFullYear(),
    startDate.getUTCMonth(),
    startDate.getUTCDate()
  ));

  while (cursor <= endDate) {
    const date = formatDate(cursor);
    items.push({ date, count: bucket.get(date) || 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return items;
};

const parsePagination = (query) => {
  const page = Math.max(DEFAULT_PAGE, parseInt(query.page, 10) || DEFAULT_PAGE);
  const size = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(query.size, 10) || DEFAULT_SIZE));
  return { page, size, offset: (page - 1) * size };
};

const mapCommitItem = (item, user = null) => ({
  id: item.id,
  groupId: item.group_id,
  userId: item.user_id,
  member: user?.full_name || user?.email || item.github_username || item.author_email || 'Unknown',
  fullName: user?.full_name || null,
  email: user?.email || null,
  githubUsername: item.github_username || user?.github_username || null,
  authorEmail: item.author_email,
  taskId: item.task_id,
  taskKey: item.task_key,
  sha: item.sha,
  message: item.message,
  additions: toNumber(item.additions),
  deletions: toNumber(item.deletions),
  committedAt: item.committed_at,
  syncedAt: item.synced_at
});

const ensureUserStatsAccess = async (requestUser, targetUserId) => {
  if (requestUser.role === 'ADMIN' || requestUser.id === targetUserId) return;

  const error = new Error('Bạn không có quyền xem thống kê của thành viên này');
  error.statusCode = 403;
  throw error;
};

const getGroupMembers = async (groupId) => {
  const memberships = await GroupMember.findAll({
    where: { group_id: groupId },
    attributes: ['user_id', 'role_in_group'],
    raw: true
  });

  const memberIds = memberships.map((member) => member.user_id);
  const users = memberIds.length
    ? await User.findAll({
      where: { id: { [Op.in]: memberIds } },
      attributes: ['id', 'full_name', 'email', 'github_username'],
      raw: true
    })
    : [];

  const membershipMap = new Map(memberships.map((member) => [member.user_id, member]));
  const userMap = new Map(users.map((user) => [user.id, user]));

  return { memberships, memberIds, membershipMap, userMap };
};

const buildMemberBreakdown = async (groupId, memberIds, membershipMap, userMap) => {
  if (!memberIds.length) return [];

  const [groupedStats, weeklyRows] = await Promise.all([
    CommitStat.findAll({
      where: {
        group_id: groupId,
        user_id: { [Op.in]: memberIds }
      },
      attributes: [
        'user_id',
        [fn('COUNT', col('id')), 'commitCount'],
        [fn('COALESCE', fn('SUM', col('additions')), 0), 'additions'],
        [fn('COALESCE', fn('SUM', col('deletions')), 0), 'deletions'],
        [fn('MAX', col('committed_at')), 'lastCommitDate']
      ],
      group: ['user_id'],
      raw: true
    }),
    CommitStat.findAll({
      where: {
        group_id: groupId,
        user_id: { [Op.in]: memberIds }
      },
      attributes: ['user_id', 'committed_at'],
      order: [['committed_at', 'ASC']],
      raw: true
    })
  ]);

  const statsMap = new Map(groupedStats.map((stat) => [stat.user_id, stat]));
  const weeklyMap = new Map();

  weeklyRows.forEach((row) => {
    if (!weeklyMap.has(row.user_id)) weeklyMap.set(row.user_id, []);
    weeklyMap.get(row.user_id).push(row);
  });

  return memberIds
    .map((userId) => {
      const user = userMap.get(userId);
      const membership = membershipMap.get(userId);
      const stat = statsMap.get(userId);

      return {
        userId,
        member: user?.full_name || user?.email || user?.github_username || userId,
        fullName: user?.full_name || null,
        email: user?.email || null,
        githubUsername: user?.github_username || null,
        roleInGroup: membership?.role_in_group || null,
        commits: toNumber(stat?.commitCount),
        additions: toNumber(stat?.additions),
        deletions: toNumber(stat?.deletions),
        lastCommitDate: stat?.lastCommitDate || null,
        commitsByWeek: aggregateCommitsPerWeek(weeklyMap.get(userId) || [])
      };
    })
    .sort((a, b) => b.commits - a.commits || String(a.member).localeCompare(String(b.member)));
};

exports.getGroupStats = async (req, res) => {
  try {
    const { groupId } = req.params;
    await ensureGroupAccess(req.user, groupId);

    const [{ memberIds, membershipMap, userMap }, overview, weeklyRows] = await Promise.all([
      getGroupMembers(groupId),
      CommitStat.findOne({
        where: { group_id: groupId },
        attributes: [
          [fn('COUNT', col('id')), 'totalCommits'],
          [fn('COALESCE', fn('SUM', col('additions')), 0), 'totalAdditions'],
          [fn('COALESCE', fn('SUM', col('deletions')), 0), 'totalDeletions'],
          [fn('MAX', col('committed_at')), 'lastCommitDate']
        ],
        raw: true
      }),
      CommitStat.findAll({
        where: { group_id: groupId },
        attributes: ['committed_at'],
        order: [['committed_at', 'ASC']],
        raw: true
      })
    ]);

    const breakdownByMember = await buildMemberBreakdown(groupId, memberIds, membershipMap, userMap);

    res.json({
      groupId,
      totalCommits: toNumber(overview?.totalCommits),
      totalAdditions: toNumber(overview?.totalAdditions),
      totalDeletions: toNumber(overview?.totalDeletions),
      lastCommitDate: overview?.lastCommitDate || null,
      commitsByWeek: aggregateCommitsPerWeek(weeklyRows),
      breakdownByMember
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
};

exports.getGroupHeatmap = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { months } = req.query;
    await ensureGroupAccess(req.user, groupId);

    const { start, end } = buildDateRange(months);
    const dateExpr = fn('DATE', col('committed_at'));

    const rows = await CommitStat.findAll({
      where: {
        group_id: groupId,
        committed_at: { [Op.between]: [start, end] }
      },
      attributes: [
        [dateExpr, 'date'],
        [fn('COUNT', col('id')), 'count']
      ],
      group: [dateExpr],
      order: [[dateExpr, 'ASC']],
      raw: true
    });

    res.json(aggregateHeatmap(rows, start, end));
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
};

exports.getGroupMembersComparison = async (req, res) => {
  try {
    const { groupId } = req.params;
    await ensureGroupAccess(req.user, groupId);

    const { memberIds, membershipMap, userMap } = await getGroupMembers(groupId);
    const items = await buildMemberBreakdown(groupId, memberIds, membershipMap, userMap);

    res.json({
      groupId,
      items: items.map((item) => ({
        userId: item.userId,
        member: item.member,
        fullName: item.fullName,
        email: item.email,
        githubUsername: item.githubUsername,
        roleInGroup: item.roleInGroup,
        commits: item.commits,
        additions: item.additions,
        deletions: item.deletions,
        lastCommitDate: item.lastCommitDate
      }))
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
};

exports.getUserStats = async (req, res) => {
  try {
    const { userId } = req.params;
    await ensureUserStatsAccess(req.user, userId);

    const user = await User.findByPk(userId, {
      attributes: ['id', 'full_name', 'email', 'github_username'],
      raw: true
    });

    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy thành viên' });
    }

    const [overview, weeklyRows, groupedByGroup, recentCommits] = await Promise.all([
      CommitStat.findOne({
        where: { user_id: userId },
        attributes: [
          [fn('COUNT', col('id')), 'totalCommits'],
          [fn('COALESCE', fn('SUM', col('additions')), 0), 'totalAdditions'],
          [fn('COALESCE', fn('SUM', col('deletions')), 0), 'totalDeletions'],
          [fn('MAX', col('committed_at')), 'lastCommitDate']
        ],
        raw: true
      }),
      CommitStat.findAll({
        where: { user_id: userId },
        attributes: ['committed_at'],
        order: [['committed_at', 'ASC']],
        raw: true
      }),
      CommitStat.findAll({
        where: { user_id: userId },
        attributes: [
          'group_id',
          [fn('COUNT', col('id')), 'commits'],
          [fn('COALESCE', fn('SUM', col('additions')), 0), 'additions'],
          [fn('COALESCE', fn('SUM', col('deletions')), 0), 'deletions'],
          [fn('MAX', col('committed_at')), 'lastCommitDate']
        ],
        group: ['group_id'],
        raw: true
      }),
      CommitStat.findAll({
        where: { user_id: userId },
        attributes: [
          'id',
          'group_id',
          'task_id',
          'task_key',
          'sha',
          'message',
          'github_username',
          'author_email',
          'additions',
          'deletions',
          'committed_at',
          'synced_at'
        ],
        order: [['committed_at', 'DESC']],
        limit: 10,
        raw: true
      })
    ]);

    res.json({
      userId,
      fullName: user.full_name,
      email: user.email,
      githubUsername: user.github_username,
      totalCommits: toNumber(overview?.totalCommits),
      totalAdditions: toNumber(overview?.totalAdditions),
      totalDeletions: toNumber(overview?.totalDeletions),
      lastCommitDate: overview?.lastCommitDate || null,
      commitsByWeek: aggregateCommitsPerWeek(weeklyRows),
      groups: groupedByGroup.map((item) => ({
        groupId: item.group_id,
        commits: toNumber(item.commits),
        additions: toNumber(item.additions),
        deletions: toNumber(item.deletions),
        lastCommitDate: item.lastCommitDate || null
      })),
      recentCommits: recentCommits.map((item) => mapCommitItem(item))
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
};

exports.getGroupCommits = async (req, res) => {
  try {
    const { groupId } = req.params;
    await ensureGroupAccess(req.user, groupId);

    const { page, size, offset } = parsePagination(req.query);
    const { rows, count } = await CommitStat.findAndCountAll({
      where: { group_id: groupId },
      attributes: [
        'id',
        'group_id',
        'user_id',
        'task_id',
        'task_key',
        'sha',
        'message',
        'github_username',
        'author_email',
        'additions',
        'deletions',
        'committed_at',
        'synced_at'
      ],
      order: [['committed_at', 'DESC']],
      limit: size,
      offset,
      raw: true
    });

    const userIds = [...new Set(rows.map((item) => item.user_id).filter(Boolean))];
    const users = userIds.length
      ? await User.findAll({
        where: { id: { [Op.in]: userIds } },
        attributes: ['id', 'full_name', 'email', 'github_username'],
        raw: true
      })
      : [];
    const userMap = new Map(users.map((user) => [user.id, user]));

    res.json({
      groupId,
      page,
      size,
      totalItems: count,
      totalPages: Math.ceil(count / size) || 0,
      items: rows.map((item) => mapCommitItem(item, item.user_id ? userMap.get(item.user_id) : null))
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
};

exports.getGroupCommitOverview = exports.getGroupStats;
exports.getGroupCommitMemberStats = exports.getGroupMembersComparison;
