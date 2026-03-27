const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/commitStats.controller');

router.use(auth);

router.get('/github/stats/group/:groupId', ctrl.getGroupStats);
router.get('/github/stats/group/:groupId/heatmap', ctrl.getGroupHeatmap);
router.get('/github/stats/group/:groupId/members', ctrl.getGroupMembersComparison);
router.get('/github/stats/user/:userId', ctrl.getUserStats);
router.get('/github/commits/:groupId', ctrl.getGroupCommits);

router.get('/commit-stats/group/:groupId/overview', ctrl.getGroupCommitOverview);
router.get('/commit-stats/group/:groupId/members', ctrl.getGroupCommitMemberStats);

module.exports = router;
