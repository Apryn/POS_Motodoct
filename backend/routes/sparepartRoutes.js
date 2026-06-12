const express = require('express');
const router = express.Router();
const c = require('../controllers/sparepartController');
const auth = require('../middleware/auth');
const isAdminOrOwner = require('../middleware/isAdminOrOwner');

router.use(auth);

router.get('/', c.getAllSpareparts);
router.get('/:id', c.getSparepartById);
router.get('/:id/stock-card', c.getSparepartStockCard);
router.post('/', c.createSparepart);
router.post('/bulk-adjust', isAdminOrOwner, c.bulkAdjustPrices);
router.put('/:id', c.updateSparepart);
router.delete('/:id', isAdminOrOwner, c.deleteSparepart);

module.exports = router;
