const express = require('express');
const router = express.Router();
const c = require('../controllers/categoryController');
router.get('/', c.getAllCategories);
router.get('/:id', c.getCategoryById);
router.post('/', c.createCategory);
router.put('/:id', c.updateCategory);
router.delete('/:id', c.deleteCategory);
module.exports = router;
