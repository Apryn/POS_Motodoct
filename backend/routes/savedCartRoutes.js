const express = require('express');
const router = express.Router();
const c = require('../controllers/savedCartController');
const auth = require('../middleware/auth');

router.get('/', c.getAllSavedCarts);
router.post('/', auth, c.saveCart);
router.delete('/:id', auth, c.deleteSavedCart);

module.exports = router;
