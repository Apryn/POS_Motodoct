const express = require('express');
const router = express.Router();
const c = require('../controllers/customerController');
const auth = require('../middleware/auth');
const isAdminOrOwner = require('../middleware/isAdminOrOwner');

router.use(auth);

router.get('/', c.getAllCustomers);
router.post('/', c.createCustomer);
router.put('/:id', c.updateCustomer);
router.delete('/:id', isAdminOrOwner, c.deleteCustomer);
router.get('/:id/history', c.getCustomerHistory);

module.exports = router;
