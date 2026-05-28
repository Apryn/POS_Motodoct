const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const c = require('../controllers/transactionController');
router.get('/', c.getAllTransactions);
router.get('/:id', c.getTransactionById);
router.get('/vehicle/:plate', auth, c.getVehicleHistory);
router.post('/', auth, c.createTransaction);
module.exports = router;
