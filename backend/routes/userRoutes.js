const express = require('express');
const router = express.Router();
const c = require('../controllers/userController');
const auth = require('../middleware/auth');

// Middleware untuk memverifikasi hak akses admin atau owner
const isAdminOrOwner = (req, res, next) => {
    if (req.user && (req.user.role === 'admin' || req.user.role === 'owner')) {
        next();
    } else {
        res.status(403).json({ success: false, message: 'Akses ditolak: Hanya admin atau owner yang diperbolehkan membuka modul ini!' });
    }
};

// Seluruh rute manajemen user dilindungi oleh token & role admin/owner
router.use(auth);
router.use(isAdminOrOwner);

router.get('/', c.getAllUsers);
router.post('/', c.createUser);
router.put('/:id', c.updateUser);
router.delete('/:id', c.deleteUser);

module.exports = router;
