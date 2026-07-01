const express = require('express');
const router = express.Router();
const c = require('../controllers/expenseController');
const auth = require('../middleware/auth');
const isAdminOrOwner = require('../middleware/isAdminOrOwner');

// Melindungi rute pengeluaran dengan middleware auth
router.use(auth);

router.get('/', c.getAllExpenses);
router.post('/', c.createExpense);
router.put('/:id', c.updateExpense);
router.delete('/:id', c.deleteExpense);

module.exports = router;
