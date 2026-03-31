const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/tasks.controller');

router.use(auth);

router.get('/my-groups', ctrl.getMyGroups);
router.get('/tasks', ctrl.getTasks);
router.get('/tasks/my-tasks', ctrl.getMyTasks);
router.get('/tasks/stats/:groupId', ctrl.getTaskStats);
router.get('/stats/group/:groupId/sprint', ctrl.getGroupSprintBurndown);
router.get('/stats/group/:groupId/members', ctrl.getGroupMemberStats);
router.get('/stats/group/:groupId/overview', ctrl.getGroupOverviewStats);
router.get('/stats/user/:userId/personal', ctrl.getPersonalStats);
router.get('/tasks/:id', ctrl.getTaskById);
router.patch('/tasks/:id/status', ctrl.updateTaskStatus);
router.post('/tasks/:id/assign', ctrl.assignTask);
router.get('/sprints/:groupId', ctrl.getGroupSprints);

module.exports = router;
