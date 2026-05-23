const express = require('express');
const router = express.Router();
const c = require('../controllers/customerController');
router.get('/', c.getAllCustomers);
router.post('/', c.createCustomer);
router.put('/:id', c.updateCustomer);
router.delete('/:id', c.deleteCustomer);
router.get('/:id/history', c.getCustomerHistory);
module.exports = router;
