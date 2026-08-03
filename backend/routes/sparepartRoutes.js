const express = require('express');
const router = express.Router();
const c = require('../controllers/sparepartController');
const auth = require('../middleware/auth');
const isAdminOrOwner = require('../middleware/isAdminOrOwner');
const isWarehouseOrAdminOrOwner = require('../middleware/isWarehouseOrAdminOrOwner');

router.use(auth);

router.get('/', c.getAllSpareparts);
router.get('/opname/list', c.getOpnameList);
router.get('/opname/history', c.getOpnameHistory);
router.post('/opname/submit', c.submitOpname);
router.get('/:id', c.getSparepartById);
router.get('/:id/stock-card', c.getSparepartStockCard);
router.post('/', c.createSparepart);
router.post('/bulk-adjust', isAdminOrOwner, c.bulkAdjustPrices);
router.put('/:id', c.updateSparepart);
router.delete('/:id', isWarehouseOrAdminOrOwner, c.deleteSparepart);
router.post('/:id/restore', isWarehouseOrAdminOrOwner, c.restoreSparepart);
router.delete('/:id/permanent', isAdminOrOwner, c.permanentDeleteSparepart);

module.exports = router;
