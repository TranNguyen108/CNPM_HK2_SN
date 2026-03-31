import axiosClient from './axiosClient';

export const tasksApi = {
  // List tasks with optional filters (groupId, sprintName, assigneeId, status, page, size)
  getTasks: (params) => axiosClient.get('/tasks', { params }),

  // Tasks assigned to current user
  getMyTasks: (params) => axiosClient.get('/tasks/my-tasks', { params }),

  // Task statistics by group
  getStats: (groupId) => axiosClient.get(`/tasks/stats/${groupId}`),

  // Single task detail
  getTask: (id) => axiosClient.get(`/tasks/${id}`),

  // Update task status (syncs to Jira)
  updateStatus: (id, status) => axiosClient.patch(`/tasks/${id}/status`, { status }),

  // Assign task to a group member (LEADER or ADMIN)
  assignTask: (id, assigneeId) => axiosClient.post(`/tasks/${id}/assign`, { assigneeId }),

  // List unique sprint names for a group
  getSprints: (groupId) => axiosClient.get(`/sprints/${groupId}`),

  // All groups the current user is a member of (any role)
  getMyGroups: () => axiosClient.get('/my-groups'),
};

export const syncApi = {
  // Manually trigger Jira sync for a group
  syncJira: (groupId) => axiosClient.post(`/sync/jira/${groupId}`),

  // Manually trigger GitHub connectivity check / sync
  syncGithub: (groupId) => axiosClient.post(`/sync/github/${groupId}`),

  // Get last 20 sync logs for a group
  getLogs: (groupId) => axiosClient.get(`/sync/logs/${groupId}`),

  // Get all tasks for a group via sync endpoint
  getGroupTasks: (groupId) => axiosClient.get(`/sync/tasks/${groupId}`),
};

export const githubApi = {
  // Commit activity heatmap — last N days (default 90)
  getCommitHeatmap: (groupId, days = 90) =>
    axiosClient.get(`/stats/group/${groupId}/commits/heatmap`, { params: { days } }),

  // N most recent commits (default 10)
  getRecentCommits: (groupId, limit = 10) =>
    axiosClient.get(`/stats/group/${groupId}/commits/recent`, { params: { limit } }),

  // Commits grouped by group member email (last N days, default 30)
  getCommitsByMember: (groupId, days = 30) =>
    axiosClient.get(`/stats/group/${groupId}/commits/members`, { params: { days } }),
};

export const statsApi = {
  // Sprint burndown data for a group (?sprintName)
  getSprintBurndown: (groupId, sprintName) =>
    axiosClient.get(`/stats/group/${groupId}/sprint`, { params: sprintName ? { sprintName } : {} }),

  // Per-member task stats (assigned/done/in-progress)
  getMemberStats: (groupId) => axiosClient.get(`/stats/group/${groupId}/members`),

  // Group overview: completion rate, sprint days left
  getGroupOverview: (groupId) => axiosClient.get(`/stats/group/${groupId}/overview`),

  // Personal stats for a specific user (self or ADMIN only)
  getPersonalStats: (userId, params) =>
    axiosClient.get(`/stats/user/${userId}/personal`, { params }),

  // Contribution score by member from Jira tasks + GitHub commits
  getContributionScores: (groupId, sprintName) =>
    axiosClient.get(`/contribution/${groupId}`, { params: sprintName ? { sprintName } : {} }),
};
