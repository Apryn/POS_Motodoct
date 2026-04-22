const express = require('express');
const router = express.Router();
const sparepartController = require('../controllers/sparepartController');

// Route untuk Sparepart
router.get('/', sparepartController.getAllSpareparts);
router.get('/:id', sparepartController.getSparepartById);
router.post('/', sparepartController.createSparepart);
router.put('/:id', sparepartController.updateSparepart);
router.delete('/:id', sparepartController.deleteSparepart);

module.exports = router;
