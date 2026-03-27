import axiosClient from './axiosClient';

export const adminApi = {
  // Dashboard
  getStats: () => axiosClient.get('/admin/stats'),

  // Search users
  searchUsers: (q) => axiosClient.get('/admin/users/search', { params: { q } }),

  // Groups
  getGroups: () => axiosClient.get('/admin/groups'),
  getGroup: (id) => axiosClient.get(`/admin/groups/${id}`),
  createGroup: (data) => axiosClient.post('/admin/groups', data),
  updateGroup: (id, data) => axiosClient.put(`/admin/groups/${id}`, data),
  deleteGroup: (id) => axiosClient.delete(`/admin/groups/${id}`),

  // Members
  getMembers: (groupId) => axiosClient.get(`/admin/groups/${groupId}/members`),
  addMember: (groupId, data) => axiosClient.post(`/admin/groups/${groupId}/members`, data),
  removeMember: (groupId, userId) => axiosClient.delete(`/admin/groups/${groupId}/members/${userId}`),

  // Lecturers
  getLecturers: () => axiosClient.get('/admin/lecturers'),
  createLecturer: (data) => axiosClient.post('/admin/lecturers', data),
  updateLecturer: (id, data) => axiosClient.put(`/admin/lecturers/${id}`, data),
  deleteLecturer: (id) => axiosClient.delete(`/admin/lecturers/${id}`),

  // Assign lecturer to group
  assignLecturer: (groupId, data) => axiosClient.post(`/admin/groups/${groupId}/assign-lecturer`, data),

  // Jira
  getJiraConfig: (groupId) => axiosClient.get(`/admin/groups/${groupId}/jira-config`),
  saveJiraConfig: (groupId, data) => axiosClient.post(`/admin/groups/${groupId}/jira-config`, data),
  testJira: (groupId) => axiosClient.post(`/admin/groups/${groupId}/test-jira`),

  // GitHub
  getGithubConfig: (groupId) => axiosClient.get(`/admin/groups/${groupId}/github-config`),
  saveGithubConfig: (groupId, data) => axiosClient.post(`/admin/groups/${groupId}/github-config`, data),
  testGithub: (groupId) => axiosClient.post(`/admin/groups/${groupId}/test-github`),
};
