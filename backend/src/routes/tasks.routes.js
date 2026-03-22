const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/tasks.controller');

router.use(auth);

router.get('/tasks', ctrl.getTasks);
router.get('/tasks/my-tasks', ctrl.getMyTasks);
router.get('/tasks/stats/:groupId', ctrl.getTaskStats);
router.get('/tasks/:id', ctrl.getTaskById);
router.patch('/tasks/:id/status', ctrl.updateTaskStatus);
router.post('/tasks/:id/assign', ctrl.assignTask);
router.get('/sprints/:groupId', ctrl.getGroupSprints);

module.exports = router;
