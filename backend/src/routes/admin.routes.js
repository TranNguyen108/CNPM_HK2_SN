const router = require('express').Router();
const ctrl = require('../controllers/admin.controller');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');

router.use(auth, roleGuard('ADMIN'));

// Dashboard stats
router.get('/stats', ctrl.getStats);

// Search users
router.get('/users/search', ctrl.searchUsers);

// Groups CRUD
router.get('/groups', ctrl.getGroups);
router.post('/groups', ctrl.createGroup);
router.get('/groups/:id', ctrl.getGroup);
router.put('/groups/:id', ctrl.updateGroup);
router.delete('/groups/:id', ctrl.deleteGroup);

// Members
router.get('/groups/:id/members', ctrl.getMembers);
router.post('/groups/:id/members', ctrl.addMember);
router.delete('/groups/:id/members/:userId', ctrl.removeMember);

// Assign lecturer
router.post('/groups/:id/assign-lecturer', ctrl.assignLecturer);

// Lecturers CRUD
router.get('/lecturers', ctrl.getLecturers);
router.post('/lecturers', ctrl.createLecturer);
router.put('/lecturers/:id', ctrl.updateLecturer);
router.delete('/lecturers/:id', ctrl.deleteLecturer);

// Jira
router.get('/groups/:id/jira-config', ctrl.getJiraConfig);
router.post('/groups/:id/jira-config', ctrl.saveJiraConfig);
router.post('/groups/:id/test-jira', ctrl.testJira);

// GitHub
router.get('/groups/:id/github-config', ctrl.getGithubConfig);
router.post('/groups/:id/github-config', ctrl.saveGithubConfig);
router.post('/groups/:id/test-github', ctrl.testGithub);

module.exports = router;