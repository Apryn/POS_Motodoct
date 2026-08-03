module.exports = (req, res, next) => {
    if (req.user && (req.user.role === 'admin' || req.user.role === 'owner' || req.user.role === 'gudang')) {
        next();
    } else {
        res.status(403).json({
            success: false,
            message: 'Akses ditolak: Hanya admin, owner, atau gudang yang diperbolehkan melakukan tindakan ini!'
        });
    }
};
