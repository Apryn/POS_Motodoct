const express = require('express');
const router = express.Router();
const c = require('../controllers/purchaseController');
const auth = require('../middleware/auth');
router.get('/', c.getAllPurchases);
router.post('/', auth, c.createPurchase);
router.delete('/:id', auth, c.deletePurchase);
module.exports = router;
