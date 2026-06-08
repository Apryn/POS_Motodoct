const express = require('express');
const router = express.Router();
const c = require('../controllers/sparepartController');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/', c.getAllSpareparts);
router.get('/:id', c.getSparepartById);
router.post('/', c.createSparepart);
router.post('/bulk-adjust', c.bulkAdjustPrices);
router.put('/:id', c.updateSparepart);
router.delete('/all', c.deleteAllSpareparts);
router.delete('/:id', c.deleteSparepart);

module.exports = router;
