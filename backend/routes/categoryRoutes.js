const express = require('express');
const router = express.Router();
const c = require('../controllers/categoryController');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/', c.getAllCategories);
router.get('/:id', c.getCategoryById);
router.post('/', c.createCategory);
router.put('/:id', c.updateCategory);
router.delete('/:id', c.deleteCategory);

module.exports = router;
