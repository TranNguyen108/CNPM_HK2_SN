const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/export.controller');

router.use(auth);

router.get('/export/task-report/:groupId', ctrl.exportTaskReport);
router.get('/export/commit-report/:groupId', ctrl.exportCommitReport);

module.exports = router;
