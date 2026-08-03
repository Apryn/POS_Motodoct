const express = require('express');
const router = express.Router();
const c = require('../controllers/reportController');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/summary', c.getSummary);
router.get('/dashboard-stats', c.getDashboardStats);
router.get('/transactions', c.getTransactionList);

module.exports = router;
