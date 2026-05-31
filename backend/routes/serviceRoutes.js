const express = require('express');
const router = express.Router();
const c = require('../controllers/serviceController');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/', c.getAllServices);
router.post('/', c.createService);
router.put('/:id', c.updateService);
router.delete('/:id', c.deleteService);

module.exports = router;
