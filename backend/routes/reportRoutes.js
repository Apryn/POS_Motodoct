const express = require('express');
const router = express.Router();
const c = require('../controllers/reportController');
router.get('/summary', c.getSummary);
router.get('/transactions', c.getTransactionList);
module.exports = router;
