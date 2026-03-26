const { Op, fn, col } = require('sequelize');
const { CommitStat } = require('../models/commitStat.model');
const { GroupMember } = require('../models/groupMember.model');
const { User } = require('../models/user.model');
const { ensureGroupAccess } = require('../utils/groupAccess');

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

exports.getGroupCommitOverview = async (req, res) => {
  try {
    const { groupId } = req.params;
    await ensureGroupAccess(req.user, groupId);

    const overview = await CommitStat.findOne({
      where: { group_id: groupId },
      attributes: [
        [fn('COUNT', col('id')), 'totalCommits'],
        [fn('COALESCE', fn('SUM', col('additions')), 0), 'totalAdditions'],
        [fn('COALESCE', fn('SUM', col('deletions')), 0), 'totalDeletions']
      ],
      raw: true
    });

    const weeklyRows = await CommitStat.findAll({
      where: { group_id: groupId },
      attributes: ['committed_at'],
      order: [['committed_at', 'ASC']],
      raw: true
    });

    res.json({
      groupId,
      totalCommits: Number(overview?.totalCommits) || 0,
      totalAdditions: Number(overview?.totalAdditions) || 0,
      totalDeletions: Number(overview?.totalDeletions) || 0,
      commitsPerWeek: aggregateCommitsPerWeek(weeklyRows)
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
};

exports.getGroupCommitMemberStats = async (req, res) => {
  try {
    const { groupId } = req.params;
    await ensureGroupAccess(req.user, groupId);

    const members = await GroupMember.findAll({
      where: { group_id: groupId },
      attributes: ['user_id']
    });

    const memberIds = members.map((member) => member.user_id);
    const users = memberIds.length
      ? await User.findAll({
        where: { id: { [Op.in]: memberIds } },
        attributes: ['id', 'full_name', 'email', 'github_username'],
        raw: true
      })
      : [];

    const groupedStats = memberIds.length
      ? await CommitStat.findAll({
        where: {
          group_id: groupId,
          user_id: { [Op.in]: memberIds }
        },
        attributes: [
          'user_id',
          [fn('COUNT', col('id')), 'commitCount'],
          [fn('COALESCE', fn('SUM', col('additions')), 0), 'totalAdditions'],
          [fn('COALESCE', fn('SUM', col('deletions')), 0), 'totalDeletions']
        ],
        group: ['user_id'],
        raw: true
      })
      : [];

    const weeklyRows = memberIds.length
      ? await CommitStat.findAll({
        where: {
          group_id: groupId,
          user_id: { [Op.in]: memberIds }
        },
        attributes: ['user_id', 'committed_at'],
        order: [['committed_at', 'ASC']],
        raw: true
      })
      : [];

    const userMap = new Map(users.map((user) => [user.id, user]));
    const statsMap = new Map(groupedStats.map((stat) => [stat.user_id, stat]));
    const weeklyMap = new Map();

    weeklyRows.forEach((row) => {
      if (!weeklyMap.has(row.user_id)) weeklyMap.set(row.user_id, []);
      weeklyMap.get(row.user_id).push(row);
    });

    const items = memberIds.map((userId) => {
      const user = userMap.get(userId);
      const stat = statsMap.get(userId);

      return {
        userId,
        fullName: user?.full_name || null,
        email: user?.email || null,
        githubUsername: user?.github_username || null,
        commitCount: Number(stat?.commitCount) || 0,
        totalAdditions: Number(stat?.totalAdditions) || 0,
        totalDeletions: Number(stat?.totalDeletions) || 0,
        commitsPerWeek: aggregateCommitsPerWeek(weeklyMap.get(userId) || [])
      };
    });

    res.json({ groupId, items });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
};
