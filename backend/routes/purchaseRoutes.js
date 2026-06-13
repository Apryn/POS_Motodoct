const express = require('express');
const router = express.Router();
const c = require('../controllers/purchaseController');
const auth = require('../middleware/auth');
const isAdminOrOwner = require('../middleware/isAdminOrOwner');

router.use(auth);

router.get('/', c.getAllPurchases);
router.post('/', c.createPurchase);
router.delete('/by-supplier', isAdminOrOwner, c.deletePurchasesBySupplier);
router.get('/undo-last-import/preview', isAdminOrOwner, c.previewUndoLastImport);
router.post('/undo-last-import', isAdminOrOwner, c.undoLastImport);
router.get('/import-sessions', isAdminOrOwner, c.getImportSessions);
router.post('/undo-import-session', isAdminOrOwner, c.undoImportSession);
router.delete('/:id', isAdminOrOwner, c.deletePurchase);

module.exports = router;
