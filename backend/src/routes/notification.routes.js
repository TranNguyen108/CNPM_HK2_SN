const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/notification.controller');

router.use(auth);

router.get('/notifications', ctrl.getNotifications);
router.get('/notifications/unread-count', ctrl.getUnreadCount);
router.patch('/notifications/read-all', ctrl.markAllAsRead);
router.patch('/notifications/:id/read', ctrl.markAsRead);

module.exports = router;
