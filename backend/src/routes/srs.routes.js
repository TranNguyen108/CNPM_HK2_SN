const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/srs.controller');

router.use(auth);

router.get('/srs/preview/:groupId', ctrl.previewSrs);
router.post('/srs/generate', ctrl.generateSrs);

module.exports = router;
