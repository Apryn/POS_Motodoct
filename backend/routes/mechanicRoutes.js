const express = require('express');
const router = express.Router();
const c = require('../controllers/mechanicController');
router.get('/', c.getAllMechanics);
router.post('/', c.createMechanic);
router.put('/:id', c.updateMechanic);
router.get('/:id/jobs', c.getMechanicJobs);
router.delete('/:id', c.deleteMechanic);
module.exports = router;
