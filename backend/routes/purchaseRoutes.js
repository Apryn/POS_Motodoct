const express = require('express');
const router = express.Router();
const c = require('../controllers/purchaseController');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/', c.getAllPurchases);
router.post('/', c.createPurchase);
router.delete('/by-supplier', c.deletePurchasesBySupplier);
router.get('/undo-last-import/preview', c.previewUndoLastImport);
router.post('/undo-last-import', c.undoLastImport);
router.delete('/:id', c.deletePurchase);

module.exports = router;
