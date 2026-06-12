const express = require('express');
const router = express.Router();
const c = require('../controllers/mechanicController');
const auth = require('../middleware/auth');
const isAdminOrOwner = require('../middleware/isAdminOrOwner');

router.use(auth);

router.get('/', c.getAllMechanics);
router.post('/', c.createMechanic);
router.put('/:id', c.updateMechanic);
router.get('/:id/jobs', c.getMechanicJobs);
router.post('/:id/claim-commissions', c.claimMechanicCommissions);
router.delete('/:id', isAdminOrOwner, c.deleteMechanic);

module.exports = router;
