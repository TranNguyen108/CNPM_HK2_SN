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
};

export const syncApi = {
  // Manually trigger Jira sync for a group
  syncJira: (groupId) => axiosClient.post(`/sync/jira/${groupId}`),

  // Get last 20 sync logs for a group
  getLogs: (groupId) => axiosClient.get(`/sync/logs/${groupId}`),

  // Get all tasks for a group via sync endpoint
  getGroupTasks: (groupId) => axiosClient.get(`/sync/tasks/${groupId}`),
};
