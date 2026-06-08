const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const c = require('../controllers/transactionController');

const isAdminOrOwner = (req, res, next) => {
    if (req.user && (req.user.role === 'admin' || req.user.role === 'owner')) {
        next();
    } else {
        res.status(403).json({ success: false, message: 'Akses ditolak: Hanya admin atau owner yang diperbolehkan menghapus transaksi!' });
    }
};

router.use(auth);

router.get('/', c.getAllTransactions);
router.get('/:id', c.getTransactionById);
router.get('/vehicle/:plate', c.getVehicleHistory);
router.post('/', c.createTransaction);
router.post('/return', c.processReturn);
router.delete('/:id', isAdminOrOwner, c.deleteTransaction);

module.exports = router;
