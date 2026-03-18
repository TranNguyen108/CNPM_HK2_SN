import axiosClient from './axiosClient';

export const adminApi = {
  // Groups
  getGroups: () => axiosClient.get('/admin/groups'),
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
  saveJiraConfig: (groupId, data) => axiosClient.post(`/admin/groups/${groupId}/jira-config`, data),
  testJira: (groupId) => axiosClient.post(`/admin/groups/${groupId}/test-jira`),

  // GitHub
  saveGithubConfig: (groupId, data) => axiosClient.post(`/admin/groups/${groupId}/github-config`, data),
  testGithub: (groupId) => axiosClient.post(`/admin/groups/${groupId}/test-github`),
};
