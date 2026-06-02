const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const c = require('../controllers/transactionController');

router.use(auth);

router.get('/', c.getAllTransactions);
router.get('/:id', c.getTransactionById);
router.get('/vehicle/:plate', c.getVehicleHistory);
router.post('/', c.createTransaction);

module.exports = router;
