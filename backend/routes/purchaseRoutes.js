const express = require('express');
const router = express.Router();
const c = require('../controllers/purchaseController');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/', c.getAllPurchases);
router.post('/', c.createPurchase);
router.delete('/all', c.deleteAllPurchases);
router.delete('/:id', c.deletePurchase);

module.exports = router;
