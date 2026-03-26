const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/commitStats.controller');

router.use(auth);

router.get('/commit-stats/group/:groupId/overview', ctrl.getGroupCommitOverview);
router.get('/commit-stats/group/:groupId/members', ctrl.getGroupCommitMemberStats);

module.exports = router;
