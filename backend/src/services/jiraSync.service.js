const { JiraConfig } = require('../models/jiraConfig.model');
const { Task } = require('../models/task.model');
const { SyncLog } = require('../models/syncLog.model');
const { User } = require('../models/user.model');
const JiraApiService = require('./jiraApi.service');

const stringifyDescription = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value.trim() || null;

  if (Array.isArray(value.content)) {
    const parts = [];
    const walk = (node) => {
      if (!node) return;
      if (typeof node.text === 'string') parts.push(node.text);
      if (Array.isArray(node.content)) node.content.forEach(walk);
      if (node.type === 'paragraph' || node.type === 'hardBreak') parts.push('\n');
    };
    value.content.forEach(walk);
    return parts.join(' ').replace(/\s+\n/g, '\n').replace(/\n\s+/g, '\n').replace(/\n{3,}/g, '\n\n').trim() || null;
  }

  return null;
};

/**
 * Đồng bộ issues Jira vào DB cho một nhóm
 * @param {string} groupId
 * @returns {{ newCount, updatedCount, total }}
 */
const syncGroupJira = async (groupId) => {
  const config = await JiraConfig.findOne({ where: { group_id: groupId, is_active: 1 } });
  if (!config) throw new Error('Jira chưa được cấu hình cho nhóm này');

  const jira = new JiraApiService(config);

  // Lấy toàn bộ issues (có pagination)
  const issues = await jira.fetchIssues(config.project_key);

  // Map email → user_id để khớp assignee
  const users = await User.findAll({ attributes: ['id', 'email'] });
  const emailToUserId = {};
  users.forEach(u => { emailToUserId[u.email.toLowerCase()] = u.id; });

  let newCount = 0;
  let updatedCount = 0;

  for (const issue of issues) {
    const fields = issue.fields;

    // Trích sprint name từ customfield_10020 (Jira Cloud)
    let sprintName = null;
    const sprintField = fields.customfield_10020;
    if (Array.isArray(sprintField) && sprintField.length > 0) {
      const active = sprintField.find(s => s.state === 'active');
      const last = sprintField[sprintField.length - 1];
      sprintName = (active || last)?.name || null;
    }

    // Story points: customfield_10016 hoặc story_points
    const rawPoints = fields.customfield_10016 ?? fields.story_points ?? null;
    const storyPoints = rawPoints !== null ? parseFloat(rawPoints) : null;
    const issueType = fields.issuetype?.name || null;
    const parentKey = fields.parent?.key || null;
    const parentSummary = fields.parent?.fields?.summary || null;
    const directEpicKey = fields.customfield_10014 || null;
    const epicKey = issueType?.toLowerCase() === 'epic'
      ? issue.key
      : parentKey || directEpicKey;
    const epicName = issueType?.toLowerCase() === 'epic'
      ? (fields.customfield_10011 || fields.summary || issue.key)
      : parentSummary || fields.customfield_10011 || null;

    // Khớp assignee theo email
    const assigneeEmail = fields.assignee?.emailAddress?.toLowerCase() || null;
    const assigneeId = assigneeEmail ? (emailToUserId[assigneeEmail] || null) : null;

    const taskData = {
      group_id: groupId,
      jira_key: issue.key,
      jira_id: String(issue.id),
      title: fields.summary || null,
      description: stringifyDescription(fields.description),
      issue_type: issueType,
      status: fields.status?.name || null,
      priority: fields.priority?.name || null,
      epic_key: epicKey,
      epic_name: epicName,
      assignee_id: assigneeId,
      assignee_email: assigneeEmail,
      sprint: sprintName,
      story_points: isNaN(storyPoints) ? null : storyPoints,
      due_date: fields.duedate || null
    };

    const existing = await Task.findOne({ where: { group_id: groupId, jira_key: issue.key } });
    if (existing) {
      await existing.update(taskData);
      updatedCount++;
    } else {
      await Task.create(taskData);
      newCount++;
    }
  }

  // Cập nhật last_synced_at
  await config.update({ last_synced_at: new Date() });

  // Ghi log kết quả sync
  await SyncLog.create({
    group_id: groupId,
    sync_type: 'jira',
    status: 'success',
    new_count: newCount,
    updated_count: updatedCount
  });

  return { newCount, updatedCount, total: issues.length };
};

module.exports = { syncGroupJira };
