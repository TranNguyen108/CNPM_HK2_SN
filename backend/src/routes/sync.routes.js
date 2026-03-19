const router = require('express').Router();
const ctrl = require('../controllers/sync.controller');
const auth = require('../middleware/auth');

router.use(auth);

// Trigger sync thủ công
router.post('/jira/:groupId', ctrl.syncJira);

// Xem lịch sử sync
router.get('/logs/:groupId', ctrl.getSyncLogs);

// Xem danh sách tasks đã sync
router.get('/tasks/:groupId', ctrl.getTasks);

module.exports = router;
